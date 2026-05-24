import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import {
  clearGuestSession,
  type GuestSession,
} from "@/lib/zest-session";
import { loadGuest, saveGuest } from "@/components/zest/AccessGate";

/**
 * Centralised session state for the whole app.
 *
 * Single source of truth for "who is using the app right now?".
 * Invariant: Supabase Auth ALWAYS takes priority over the guest localStorage
 * session. When a Supabase user signs in, any pre-existing anonymous guest
 * session is wiped before the new state propagates.
 */

export type SessionStatus = "loading" | "admin" | "guest" | "anonymous";

export interface SessionContextValue {
  status: SessionStatus;
  /** Supabase Auth user (organiser/admin), if signed in. */
  user: User | null;
  /** Event-scoped guest session (may also be set for an admin viewing an event). */
  guest: GuestSession | null;
  /** `true` as soon as Supabase Auth + storage have been resolved once. */
  hydrated: boolean;
  /** Update the event-scoped guest session and persist it. */
  setGuest: (g: GuestSession | null | ((prev: GuestSession | null) => GuestSession | null)) => void;
  /** Full logout: revoke Supabase session AND clear all guest storage. */
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [guest, setGuestState] = useState<GuestSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  // Track previous auth user id so we can detect transitions and wipe stale
  // guest data when a NEW Supabase user signs in (cross-session conflict).
  const prevUserIdRef = useRef<string | null>(null);

  // Initial hydration: resolve Supabase session, then optionally load guest.
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (cancel) return;
        if (session?.user) {
          // Admin connected → purge any stale anonymous guest session before
          // the rest of the app reads it.
          clearGuestSession({ keepDeviceId: true });
          setUser(session.user);
          setGuestState(null);
          prevUserIdRef.current = session.user.id;
        } else {
          const stored = loadGuest();
          setUser(null);
          setGuestState(stored);
          prevUserIdRef.current = null;
        }
      } finally {
        if (!cancel) setHydrated(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // React to subsequent auth state changes (login from another tab, refresh,
  // logout, user switch, etc.).
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange(
      (event, session: Session | null) => {
        const nextUser = session?.user ?? null;
        const prevId = prevUserIdRef.current;
        const nextId = nextUser?.id ?? null;

        if (event === "SIGNED_OUT" || !nextUser) {
          // Full logout → clear everything guest-related.
          clearGuestSession({ keepDeviceId: true });
          setUser(null);
          setGuestState(null);
          prevUserIdRef.current = null;
          return;
        }

        // SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED.
        // If this is a NEW user (different identity), invalidate the prior
        // guest session so we never leak one user's view into another's.
        if (prevId !== nextId) {
          clearGuestSession({ keepDeviceId: true });
          setGuestState(null);
        }
        setUser(nextUser);
        prevUserIdRef.current = nextId;
      },
    );
    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  const setGuest = useCallback<SessionContextValue["setGuest"]>((next) => {
    setGuestState((prev) => {
      const value = typeof next === "function" ? next(prev) : next;
      // Persist alongside React state so a refresh keeps the same view.
      saveGuest(value);
      return value;
    });
  }, []);

  const signOut = useCallback<SessionContextValue["signOut"]>(async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore: we still want to wipe local state */
    }
    clearGuestSession({ keepDeviceId: true });
    setUser(null);
    setGuestState(null);
    prevUserIdRef.current = null;
  }, []);

  const status: SessionStatus = !hydrated
    ? "loading"
    : user
    ? "admin"
    : guest
    ? "guest"
    : "anonymous";

  const value = useMemo<SessionContextValue>(
    () => ({ status, user, guest, hydrated, setGuest, signOut }),
    [status, user, guest, hydrated, setGuest, signOut],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession must be used inside <SessionProvider>");
  }
  return ctx;
}
