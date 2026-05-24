/**
 * Session lifecycle regression tests.
 *
 * Covers the invariants enforced by SessionProvider + zest-session:
 *   1. guest → admin transition wipes the guest blob
 *   2. refresh hydration: Supabase Auth always wins over a stale guest blob
 *   3. signOut() clears both Supabase + localStorage/sessionStorage
 *
 * These are integration tests (jsdom + RTL) rather than full browser e2e —
 * the real Supabase client is mocked so we can drive auth events deterministically.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import type { Session, User } from "@supabase/supabase-js";

// ---------- Mocks ----------

type AuthCallback = (event: string, session: Session | null) => void;

const authState: {
  session: Session | null;
  listeners: Set<AuthCallback>;
} = {
  session: null,
  listeners: new Set(),
};

function emit(event: string, session: Session | null) {
  authState.session = session;
  for (const cb of authState.listeners) cb(event, session);
}

vi.mock("@/integrations/supabase/client", () => {
  return {
    supabase: {
      auth: {
        getSession: vi.fn(async () => ({ data: { session: authState.session } })),
        onAuthStateChange: vi.fn((cb: AuthCallback) => {
          authState.listeners.add(cb);
          return {
            data: {
              subscription: {
                unsubscribe: () => authState.listeners.delete(cb),
              },
            },
          };
        }),
        signOut: vi.fn(async () => {
          emit("SIGNED_OUT", null);
          return { error: null };
        }),
      },
    },
  };
});

// The provider imports loadGuest/saveGuest from AccessGate. AccessGate pulls
// in heavy UI deps we don't need for these tests, so stub it with just the
// two helpers, backed by the same localStorage key the real impl uses.
const GUEST_KEY = "zeste_guest_session";
vi.mock("@/components/zest/AccessGate", () => ({
  loadGuest: () => {
    const raw = localStorage.getItem(GUEST_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  },
  saveGuest: (s: unknown) => {
    if (!s) localStorage.removeItem(GUEST_KEY);
    else localStorage.setItem(GUEST_KEY, JSON.stringify(s));
  },
}));

// ---------- Imports under test (after mocks) ----------
import { SessionProvider, useSession } from "@/contexts/SessionProvider";
import type { GuestSession } from "@/lib/zest-session";

// ---------- Fixtures ----------

function makeUser(id = "admin-1", email = "admin@example.com"): User {
  return { id, email, app_metadata: {}, user_metadata: {}, aud: "authenticated", created_at: "" } as User;
}

function makeSession(user: User): Session {
  return {
    access_token: "tok",
    refresh_token: "ref",
    expires_in: 3600,
    token_type: "bearer",
    user,
  } as Session;
}

function makeGuest(): GuestSession {
  return {
    invite: { id: "inv-1", prenom: "Alice" } as GuestSession["invite"],
    event: { id: "evt-1", slug: "test-event" } as GuestSession["event"],
    initial: "A",
    avatarColor: "#FFB199",
  };
}

function seedGuest() {
  localStorage.setItem(GUEST_KEY, JSON.stringify(makeGuest()));
}

// ---------- Test probe ----------

function Probe() {
  const s = useSession();
  return (
    <div>
      <span data-testid="status">{s.status}</span>
      <span data-testid="user">{s.user?.id ?? ""}</span>
      <span data-testid="guest">{s.guest?.invite.id ?? ""}</span>
      <button onClick={() => s.setGuest(makeGuest())} data-testid="setGuest">guest</button>
      <button onClick={() => void s.signOut()} data-testid="signOut">out</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <SessionProvider>
      <Probe />
    </SessionProvider>,
  );
}

// ---------- Setup ----------

beforeEach(() => {
  authState.session = null;
  authState.listeners.clear();
});

// ---------- Tests ----------

describe("SessionProvider", () => {
  it("hydrates as anonymous when nothing is stored", async () => {
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(screen.getByTestId("user")).toHaveTextContent("");
    expect(screen.getByTestId("guest")).toHaveTextContent("");
  });

  it("hydrates as guest from localStorage when no Supabase session exists", async () => {
    seedGuest();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("guest"));
    expect(screen.getByTestId("guest")).toHaveTextContent("inv-1");
  });

  it("refresh: Supabase Auth wins over a stale guest blob (priority invariant)", async () => {
    // Simulate the cross-session conflict: a guest blob is in localStorage
    // AND a Supabase admin is already signed in (e.g. after a hard refresh).
    seedGuest();
    authState.session = makeSession(makeUser("admin-1"));

    renderProvider();

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("admin"));
    expect(screen.getByTestId("user")).toHaveTextContent("admin-1");
    // Stale guest blob must have been wiped from localStorage on hydration.
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
    expect(screen.getByTestId("guest")).toHaveTextContent("");
  });

  it("guest → admin: signing in as admin clears the existing guest session", async () => {
    seedGuest();
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("guest"));

    // Admin signs in (e.g. via /login in another tab).
    await act(async () => {
      emit("SIGNED_IN", makeSession(makeUser("admin-1")));
    });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("admin"));
    expect(screen.getByTestId("guest")).toHaveTextContent("");
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
  });

  it("user switch wipes the previous user's guest view", async () => {
    authState.session = makeSession(makeUser("admin-1"));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("admin-1"));

    // First admin opens an event as a guest viewer.
    await act(async () => {
      screen.getByTestId("setGuest").click();
    });
    expect(localStorage.getItem(GUEST_KEY)).not.toBeNull();

    // Different admin signs in.
    await act(async () => {
      emit("SIGNED_IN", makeSession(makeUser("admin-2")));
    });

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("admin-2"));
    expect(screen.getByTestId("guest")).toHaveTextContent("");
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
  });

  it("signOut clears Supabase session, localStorage guest blob and sessionStorage", async () => {
    authState.session = makeSession(makeUser("admin-1"));
    sessionStorage.setItem("scratch", "x");
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("admin"));

    // Re-seed a guest blob and some sessionStorage to prove logout wipes both.
    await act(async () => {
      screen.getByTestId("setGuest").click();
    });
    sessionStorage.setItem("scratch2", "y");

    await act(async () => {
      screen.getByTestId("signOut").click();
    });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
    expect(screen.getByTestId("user")).toHaveTextContent("");
    expect(screen.getByTestId("guest")).toHaveTextContent("");
    expect(localStorage.getItem(GUEST_KEY)).toBeNull();
    expect(sessionStorage.length).toBe(0);
  });

  it("SIGNED_OUT event from another tab clears local state", async () => {
    authState.session = makeSession(makeUser("admin-1"));
    renderProvider();
    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("admin"));

    await act(async () => {
      emit("SIGNED_OUT", null);
    });

    await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("anonymous"));
  });
});