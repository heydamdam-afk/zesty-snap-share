import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  LogOut,
  Plus,
  Search,
  Eye,
  Settings,
  Download,
  Trash2,
  Upload,
  Users,
  Heart,
  MessageCircle,
  Clock,
  AlertTriangle,
  AlertCircle,
  Crown,
  User as UserIcon,
  Lightbulb,
  Bug,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { FeatureRequestModal } from "@/components/feature-request/FeatureRequestWidget";
import { BugReportModal } from "@/components/bug-report/BugReportWidget";
import { ProfileModal } from "@/components/zest/ProfileModal";
import { useSession } from "@/contexts/SessionProvider";
import { toast } from "sonner";

export const Route = createFileRoute("/my-events")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Mes événements — Kapsul" },
      { name: "robots", content: "noindex" },
    ],
  }),
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      // Purge any stale local session (e.g. after an email change confirmed
      // elsewhere) so /login can re-authenticate without bouncing back here.
      try { await supabase.auth.signOut({ scope: "local" } as never); } catch { /* noop */ }
      throw redirect({ to: "/login" });
    }
  },
  component: MyEvents,
});

const COLORS = {
  primary: "#FF4842",
  textPrimary: "#212B36",
  textSecondary: "#637381",
  textDisabled: "#919EAB",
  bgNeutral: "#F4F6F8",
  bgPage: "#F9FAFB",
  border: "rgba(145,158,171,0.24)",
  success: "#00AB55",
  successDark: "#006B3A",
  warning: "#FFA000",
  warningDark: "#7A4A00",
  danger: "#FF4842",
  dangerDark: "#8B1A18",
};

type Role = "organisateur" | "secondaire" | "invite";
type EventStatus = "active" | "expired" | "archived" | "frozen";

type EventRow = {
  id: string;
  slug: string;
  titre: string;
  lieu: string | null;
  cover_url: string | null;
  event_date: string | null;
  status: EventStatus;
  frozen_at: string | null;
  expire_at: string | null;
  zip_download_url: string | null;
  plan_code: string | null;
  role: Role;
  photo_count: number;
  max_photos: number;
  likes_count: number;
  comments_count: number;
  invites_count: number;
};

type RoleFilter = "all" | "organisateur" | "secondaire" | "invite";
type StatusFilter = "all" | "actif" | "expiring" | "deleting";

const EVENT_TYPES: Array<{
  key: string;
  label: string;
  emoji: string;
  bg: string;
  match: RegExp;
}> = [
  {
    key: "mariage",
    label: "Mariage",
    emoji: "💍",
    bg: "linear-gradient(135deg,#FFE0DF 0%,#FFD0CE 100%)",
    match: /mariage|wedding|noces|union/i,
  },
  {
    key: "evjf",
    label: "EVJF / EVG",
    emoji: "🥂",
    bg: "linear-gradient(135deg,#E1F0FF 0%,#CCE4FF 100%)",
    match: /evjf|evg|enterrement|bachelorette/i,
  },
  {
    key: "anniversaire",
    label: "Anniversaire",
    emoji: "🎂",
    bg: "linear-gradient(135deg,#FFF4D6 0%,#FFE8A3 100%)",
    match: /anniversaire|birthday|ans\b/i,
  },
  {
    key: "bapteme",
    label: "Baptême",
    emoji: "👶",
    bg: "linear-gradient(135deg,#E4F5E9 0%,#C8EBD4 100%)",
    match: /bapt[êe]me|baby/i,
  },
  {
    key: "seminaire",
    label: "Séminaire",
    emoji: "🏢",
    bg: "linear-gradient(135deg,#F4F6F8 0%,#E5E8EC 100%)",
    match: /s[ée]minaire|corporate|entreprise|team|kick.?off/i,
  },
];

const FALLBACK_TYPE = {
  key: "autre",
  label: "Événement",
  emoji: "📸",
  bg: "linear-gradient(135deg,#EDE9FE 0%,#DDD2FB 100%)",
};

function detectType(titre: string) {
  for (const t of EVENT_TYPES) if (t.match.test(titre)) return t;
  return FALLBACK_TYPE;
}

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return null;
  }
}

const DAY_MS = 86_400_000;

function daysBetween(future: string | null): number | null {
  if (!future) return null;
  return Math.ceil((new Date(future).getTime() - Date.now()) / DAY_MS);
}

type StatusKind = "actif" | "expiring" | "deleting";

function statusKind(ev: EventRow): StatusKind {
  if (ev.status === "expired" || ev.status === "frozen") return "deleting";
  const d = daysBetween(ev.expire_at);
  if (d !== null && d <= 7) return "expiring";
  return "actif";
}

function MyEvents() {
  const navigate = useNavigate();
  const { profile: sessionProfile } = useSession();
  const [events, setEvents] = useState<EventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [user, setUser] = useState<{
    email: string;
    initials: string;
    avatar_url: string | null;
  } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [featureOpen, setFeatureOpen] = useState(false);
  const [bugOpen, setBugOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setEvents(null);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const session = sess.session;
      const email = session?.user.email?.toLowerCase().trim() ?? "";
      const meta = (session?.user.user_metadata ?? {}) as {
        full_name?: string;
        name?: string;
        avatar_url?: string | null;
      };
      const display = meta.full_name || meta.name || email;
      const initials = display
        .split(/[\s@.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("") || "?";
      // Avatar + initials are derived from session.profile (single source of
      // truth). We still keep email/initials fallback here for the moment
      // before the profile loads.
      setUser({ email, initials, avatar_url: meta.avatar_url ?? null });

      await supabase.rpc("link_admin_user_id");

      const [adminRes, inviteRes] = await Promise.all([
        supabase.rpc("my_admin_events"),
        email
          ? supabase.from("invites").select("event_id").ilike("email", email)
          : Promise.resolve({ data: [], error: null } as { data: Array<{ event_id: string }>; error: null }),
      ]);
      if (adminRes.error) throw adminRes.error;
      const adminList = (adminRes.data as Array<{
        event_id: string;
        slug: string;
        titre: string;
        role: "organisateur" | "secondaire";
      }> | null) ?? [];
      const inviteList = ((inviteRes as { data?: Array<{ event_id: string }> | null }).data ?? []);

      const roleByEventId = new Map<string, Role>();
      for (const a of adminList) roleByEventId.set(a.event_id, a.role);
      for (const i of inviteList)
        if (!roleByEventId.has(i.event_id)) roleByEventId.set(i.event_id, "invite");

      const eventIds = Array.from(roleByEventId.keys());
      if (eventIds.length === 0) {
        setEvents([]);
        return;
      }

      const { data: detailsData, error: detErr } = await supabase
        .from("events")
        .select(
          "id, slug, titre, lieu, cover_url, event_date, status, frozen_at, expire_at, zip_download_url, plan_code",
        )
        .in("id", eventIds)
        .neq("status", "archived");
      if (detErr) throw detErr;
      const activeEvents = detailsData ?? [];
      const activeIds = activeEvents.map((e) => e.id);
      if (activeIds.length === 0) {
        setEvents([]);
        return;
      }

      // Stats in parallel
      const planCodes = Array.from(
        new Set(activeEvents.map((e) => e.plan_code).filter((c): c is string => !!c)),
      );

      const [plansRes, addonsRes, postsRes, invitesAllRes] = await Promise.all([
        planCodes.length
          ? supabase
              .from("event_plans")
              .select("code, max_photos")
              .in("code", planCodes)
          : Promise.resolve({ data: [], error: null } as {
              data: Array<{ code: string; max_photos: number }>;
              error: null;
            }),
        supabase
          .from("addon_purchases")
          .select("event_id, addon_type")
          .in("event_id", activeIds),
        supabase
          .from("posts")
          .select("id, event_id, url_full, nb_likes")
          .in("event_id", activeIds),
        supabase.from("invites").select("event_id").in("event_id", activeIds),
      ]);

      const maxByPlan = new Map<string, number>(
        (plansRes.data ?? []).map((p) => [p.code as string, (p.max_photos as number) ?? 0]),
      );
      const addonCount = new Map<string, number>();
      for (const a of addonsRes.data ?? []) {
        if ((a.addon_type as string) === "addon_images") {
          addonCount.set(a.event_id as string, (addonCount.get(a.event_id as string) ?? 0) + 1);
        }
      }
      const photoCount = new Map<string, number>();
      const likesCount = new Map<string, number>();
      const postsByEvent = new Map<string, string[]>();
      for (const p of postsRes.data ?? []) {
        const eid = p.event_id as string;
        if (p.url_full) photoCount.set(eid, (photoCount.get(eid) ?? 0) + 1);
        likesCount.set(eid, (likesCount.get(eid) ?? 0) + ((p.nb_likes as number) ?? 0));
        const arr = postsByEvent.get(eid) ?? [];
        arr.push(p.id as string);
        postsByEvent.set(eid, arr);
      }
      const invitesCount = new Map<string, number>();
      for (const i of invitesAllRes.data ?? [])
        invitesCount.set(i.event_id as string, (invitesCount.get(i.event_id as string) ?? 0) + 1);

      // Comments
      const allPostIds = Array.from(postsByEvent.values()).flat();
      const commentsByEvent = new Map<string, number>();
      if (allPostIds.length > 0) {
        const { data: comments } = await supabase
          .from("commentaires")
          .select("photo_id")
          .in("photo_id", allPostIds);
        const postToEvent = new Map<string, string>();
        for (const [eid, ids] of postsByEvent) for (const id of ids) postToEvent.set(id, eid);
        for (const c of comments ?? []) {
          const eid = postToEvent.get(c.photo_id as string);
          if (eid) commentsByEvent.set(eid, (commentsByEvent.get(eid) ?? 0) + 1);
        }
      }

      const merged: EventRow[] = activeEvents.map((e) => {
        const planMax = e.plan_code ? maxByPlan.get(e.plan_code) ?? 0 : 0;
        return {
          id: e.id,
          slug: e.slug,
          titre: e.titre,
          lieu: e.lieu ?? null,
          cover_url: e.cover_url ?? null,
          event_date: e.event_date ?? null,
          status: e.status as EventStatus,
          frozen_at: e.frozen_at ?? null,
          expire_at: e.expire_at ?? null,
          zip_download_url: e.zip_download_url ?? null,
          plan_code: e.plan_code ?? null,
          role: roleByEventId.get(e.id) ?? "invite",
          photo_count: photoCount.get(e.id) ?? 0,
          max_photos: planMax + (addonCount.get(e.id) ?? 0) * 100,
          likes_count: likesCount.get(e.id) ?? 0,
          comments_count: commentsByEvent.get(e.id) ?? 0,
          invites_count: invitesCount.get(e.id) ?? 0,
        };
      });
      setEvents(merged);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur lors du chargement";
      setError(msg);
      toast.error(msg);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      /* noop */
    }
    navigate({ to: "/", replace: true });
  };

  const filtered = useMemo(() => {
    if (!events) return null;
    const q = search.trim().toLowerCase();
    return events.filter((e) => {
      if (q && !e.titre.toLowerCase().includes(q)) return false;
      if (roleFilter === "organisateur" && e.role !== "organisateur") return false;
      if (roleFilter === "secondaire" && e.role !== "secondaire") return false;
      if (roleFilter === "invite" && e.role !== "invite") return false;
      if (statusFilter !== "all" && statusKind(e) !== statusFilter) return false;
      return true;
    });
  }, [events, search, roleFilter, statusFilter]);

  const count = filtered?.length ?? 0;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #FFFFFF 0%, #F3F4F6 100%)",
        fontFamily: "'Public Sans', system-ui, sans-serif",
        color: COLORS.textPrimary,
      }}
    >
      {/* HEADER */}
      <header
        style={{
          background: "#fff",
          borderBottom: `0.5px solid ${COLORS.border}`,
          padding: "0 24px",
          height: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          position: "sticky",
          top: 0,
          zIndex: 20,
        }}
      >
        <Link
          to="/my-events"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            textDecoration: "none",
            color: COLORS.textPrimary,
            fontWeight: 500,
            fontSize: 15,
          }}
        >
          <span
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: COLORS.primary,
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontWeight: 700,
              fontSize: 12,
            }}
          >
            K
          </span>
          kapsul.events
        </Link>
        <div style={{ display: "flex", alignItems: "center", gap: 12, position: "relative" }} ref={menuRef}>
          <Link
            to="/create-event"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: COLORS.primary,
              color: "#fff",
              padding: "7px 14px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            <Plus size={14} /> Créer un événement
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Profil"
            style={{
              width: 32,
              height: 32,
              borderRadius: "50%",
              background: user?.avatar_url ? "#fff" : COLORS.primary,
              color: "#fff",
              border: `2.5px solid #E85A4F`,
              display: "grid",
              placeItems: "center",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: 12,
              overflow: "hidden",
              padding: 2,
            }}
          >
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
              />
            ) : (
              user?.initials ?? "?"
            )}
          </button>
          {menuOpen && (
            <div
              role="menu"
              style={{
                position: "absolute",
                right: 0,
                top: 48,
                width: 220,
                background: "#fff",
                border: `0.5px solid ${COLORS.border}`,
                borderRadius: 8,
                boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                overflow: "hidden",
                zIndex: 30,
              }}
            >
              <MenuItem
                icon={<UserIcon size={14} />}
                label="Profil"
                onClick={() => {
                  setMenuOpen(false);
                  setProfileOpen(true);
                }}
              />
              <MenuItem
                icon={<Lightbulb size={14} />}
                label="Suggérer une idée"
                onClick={() => {
                  setMenuOpen(false);
                  setFeatureOpen(true);
                }}
              />
              <MenuItem
                icon={<Bug size={14} />}
                label="Signaler un bug"
                onClick={() => {
                  setMenuOpen(false);
                  setBugOpen(true);
                }}
              />
              <div style={{ height: 0.5, background: COLORS.border }} />
              <MenuItem
                icon={<LogOut size={14} />}
                label="Déconnexion"
                danger
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
              />
            </div>
          )}
        </div>
      </header>

      {/* TOOLBAR */}
      <div
        style={{
          padding: "20px 24px 12px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search
            size={15}
            style={{
              position: "absolute",
              left: 10,
              top: "50%",
              transform: "translateY(-50%)",
              color: COLORS.textDisabled,
              pointerEvents: "none",
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un événement..."
            style={{
              width: "100%",
              padding: "8px 12px 8px 32px",
              border: `0.5px solid ${COLORS.border}`,
              borderRadius: 8,
              fontSize: 13,
              background: "#fff",
              color: COLORS.textPrimary,
              fontFamily: "inherit",
              outline: "none",
            }}
            onFocus={(e) => (e.target.style.borderColor = COLORS.primary)}
            onBlur={(e) => (e.target.style.borderColor = COLORS.border)}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
          <FilterPill
            active={roleFilter === "all"}
            onClick={() => setRoleFilter("all")}
            label="Tous"
          />
          <FilterPill
            active={roleFilter === "organisateur"}
            onClick={() =>
              setRoleFilter(roleFilter === "organisateur" ? "all" : "organisateur")
            }
            icon={<Crown size={12} />}
            label="Organisateur"
          />
          <FilterPill
            active={roleFilter === "secondaire"}
            onClick={() =>
              setRoleFilter(roleFilter === "secondaire" ? "all" : "secondaire")
            }
            icon={<UserIcon size={12} />}
            label="Admin secondaire"
          />
          <FilterPill
            active={roleFilter === "invite"}
            onClick={() => setRoleFilter(roleFilter === "invite" ? "all" : "invite")}
            icon={<UserIcon size={12} />}
            label="Invité"
          />
          <span
            style={{
              width: 0.5,
              height: 20,
              background: COLORS.border,
              display: "inline-block",
              margin: "0 2px",
            }}
          />
          <FilterPill
            active={statusFilter === "actif"}
            onClick={() => setStatusFilter(statusFilter === "actif" ? "all" : "actif")}
            dot={COLORS.success}
            label="En cours"
          />
          <FilterPill
            active={statusFilter === "expiring"}
            onClick={() =>
              setStatusFilter(statusFilter === "expiring" ? "all" : "expiring")
            }
            dot={COLORS.warning}
            label="Bientôt clôturés"
          />
          <FilterPill
            active={statusFilter === "deleting"}
            onClick={() =>
              setStatusFilter(statusFilter === "deleting" ? "all" : "deleting")
            }
            dot={COLORS.danger}
            label="Bientôt supprimés"
          />
        </div>
      </div>

      <div style={{ padding: "0 24px 14px", fontSize: 12, color: COLORS.textDisabled }}>
        {events === null
          ? "Chargement..."
          : count === 0
            ? "Aucun résultat"
            : `${count} événement${count > 1 ? "s" : ""}`}
      </div>

      {error && (
        <div
          role="alert"
          style={{
            margin: "0 24px 16px",
            padding: "10px 14px",
            borderRadius: 8,
            background: "rgba(255,72,66,0.08)",
            color: COLORS.dangerDark,
            fontSize: 13,
          }}
        >
          {error}{" "}
          <button
            type="button"
            onClick={() => void load()}
            style={{
              marginLeft: 8,
              background: "transparent",
              border: `0.5px solid ${COLORS.dangerDark}`,
              borderRadius: 6,
              padding: "2px 8px",
              cursor: "pointer",
              color: COLORS.dangerDark,
              fontSize: 12,
            }}
          >
            Réessayer
          </button>
        </div>
      )}

      <div
        style={{
          padding: "0 24px 32px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 16,
        }}
      >
        {events === null
          ? [0, 1, 2].map((i) => (
              <div
                key={i}
                style={{
                  background: "#fff",
                  border: `0.5px solid ${COLORS.border}`,
                  borderRadius: 12,
                  height: 280,
                }}
              />
            ))
          : filtered?.length === 0
            ? (
                <div
                  style={{
                    gridColumn: "1 / -1",
                    padding: "60px 0",
                    textAlign: "center",
                    color: COLORS.textDisabled,
                    fontSize: 14,
                  }}
                >
                  Aucun événement ne correspond à vos filtres.
                </div>
              )
            : filtered?.map((ev) => <EventCard key={ev.id} ev={ev} />)}
      </div>

      {featureOpen && <FeatureRequestModal onClose={() => setFeatureOpen(false)} />}
      {bugOpen && <BugReportModal onClose={() => setBugOpen(false)} />}
      <ProfileModal
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        onAvatarChange={(url) => setUser((u) => (u ? { ...u, avatar_url: url } : u))}
      />
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 14px",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontFamily: "inherit",
        color: danger ? COLORS.danger : COLORS.textPrimary,
        textAlign: "left",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.background = COLORS.bgNeutral)}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {icon}
      {label}
    </button>
  );
}

function FilterPill({
  active,
  onClick,
  label,
  icon,
  dot,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ReactNode;
  dot?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 12px",
        borderRadius: 100,
        border: `0.5px solid ${active ? COLORS.primary : COLORS.border}`,
        background: active ? COLORS.primary : "#fff",
        color: active ? "#fff" : COLORS.textSecondary,
        fontSize: 12,
        fontWeight: active ? 500 : 400,
        cursor: "pointer",
        fontFamily: "inherit",
      }}
    >
      {dot && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: active ? "#fff" : dot,
          }}
        />
      )}
      {icon}
      {label}
    </button>
  );
}

function EventCard({ ev }: { ev: EventRow }) {
  const navigate = useNavigate();
  const type = detectType(ev.titre);
  const kind = statusKind(ev);
  const date = formatDate(ev.event_date);
  const isOrg = ev.role === "organisateur";
  const isAdmin = isOrg || ev.role === "secondaire";

  const goToMain = () => {
    if (isAdmin) navigate({ to: "/$slug/admin/dashboard", params: { slug: ev.slug } });
    else navigate({ to: "/e/$slug", params: { slug: ev.slug } });
  };

  const goToFeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate({ to: "/e/$slug", params: { slug: ev.slug } });
  };
  const goToSettings = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate({ to: "/$slug/admin/dashboard", params: { slug: ev.slug } });
  };

  const photoPct =
    ev.max_photos > 0 ? Math.min(100, Math.round((ev.photo_count / ev.max_photos) * 100)) : 0;
  const fillColor =
    photoPct >= 100 ? COLORS.danger : photoPct >= 80 ? COLORS.warning : COLORS.success;

  const daysToExpire = daysBetween(ev.expire_at);
  const daysToDelete =
    ev.expire_at !== null
      ? Math.max(
          0,
          Math.ceil(
            (new Date(ev.expire_at).getTime() + 7 * DAY_MS - Date.now()) / DAY_MS,
          ),
        )
      : null;

  const status: {
    label: string;
    bg: string;
    color: string;
  } =
    kind === "actif"
      ? { label: "En cours", bg: "rgba(0,171,85,0.15)", color: COLORS.successDark }
      : kind === "expiring"
        ? { label: "Bientôt clôturé", bg: "rgba(255,160,0,0.18)", color: COLORS.warningDark }
        : { label: "Suppression imminente", bg: "rgba(255,72,66,0.15)", color: COLORS.dangerDark };

  return (
    <div
      onClick={goToMain}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") goToMain();
      }}
      style={{
        background: "#fff",
        border: `0.5px solid ${COLORS.border}`,
        borderRadius: 12,
        overflow: "hidden",
        cursor: "pointer",
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "none";
      }}
    >
      {/* Cover */}
      <div style={{ height: 90, position: "relative", overflow: "hidden" }}>
        {ev.cover_url ? (
          <img
            src={ev.cover_url}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              background: type.bg,
              display: "grid",
              placeItems: "center",
              fontSize: 32,
            }}
          >
            {type.emoji}
          </div>
        )}
        <span
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            padding: "2px 8px",
            borderRadius: 100,
            fontSize: 10,
            fontWeight: 500,
            background: isOrg ? "rgba(255,72,66,0.92)" : "rgba(255,255,255,0.88)",
            color: isOrg ? "#fff" : COLORS.textPrimary,
            backdropFilter: "blur(4px)",
          }}
        >
          {isOrg ? "Organisateur" : ev.role === "secondaire" ? "Admin secondaire" : "Invité"}
        </span>
        <span
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            padding: "3px 9px",
            borderRadius: 100,
            fontSize: 11,
            fontWeight: 500,
            background: status.bg,
            color: status.color,
            backdropFilter: "blur(4px)",
          }}
        >
          {status.label}
        </span>
      </div>

      {/* Body */}
      <div style={{ padding: "12px 14px 14px" }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 500,
            textTransform: "uppercase",
            letterSpacing: "0.6px",
            color: COLORS.textDisabled,
            marginBottom: 3,
          }}
        >
          {type.label}
        </div>
        <h3
          style={{
            fontFamily: "'Josefin Sans', sans-serif",
            fontSize: 15,
            fontWeight: 500,
            color: COLORS.textPrimary,
            margin: 0,
            marginBottom: 2,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {ev.titre}
        </h3>
        <div
          style={{
            fontSize: 12,
            color: COLORS.textSecondary,
            marginBottom: 10,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {[date, ev.lieu].filter(Boolean).join(" · ") || "—"}
        </div>

        {kind !== "deleting" ? (
          <div style={{ marginBottom: 10 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 4,
                fontSize: 11,
                color: COLORS.textDisabled,
              }}
            >
              <span>Photos</span>
              <span>
                {ev.photo_count.toLocaleString("fr-FR")} /{" "}
                {ev.max_photos.toLocaleString("fr-FR")}
              </span>
            </div>
            <div
              style={{
                height: 3,
                background: COLORS.bgNeutral,
                borderRadius: 100,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${photoPct}%`,
                  height: "100%",
                  background: fillColor,
                  borderRadius: 100,
                }}
              />
            </div>
          </div>
        ) : (
          <div
            style={{
              marginBottom: 10,
              fontSize: 12,
              color: COLORS.dangerDark,
              fontWeight: 500,
            }}
          >
            ZIP disponible
            {ev.expire_at
              ? ` — expire le ${formatDate(new Date(new Date(ev.expire_at).getTime() + 7 * DAY_MS).toISOString())}`
              : ""}
          </div>
        )}

        <div
          style={{
            display: "flex",
            gap: 12,
            marginBottom: 10,
            fontSize: 12,
            color: COLORS.textSecondary,
          }}
        >
          <Stat icon={<Users size={13} />} value={ev.invites_count} />
          <Stat icon={<Heart size={13} />} value={ev.likes_count} />
          <Stat icon={<MessageCircle size={13} />} value={ev.comments_count} />
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `0.5px solid ${COLORS.border}`,
            paddingTop: 10,
          }}
        >
          <Timer kind={kind} daysToExpire={daysToExpire} daysToDelete={daysToDelete} photoPct={photoPct} />
          <div style={{ display: "flex", gap: 4 }}>
            {kind === "deleting" ? (
              <>
                {ev.zip_download_url && (
                  <IconButton
                    title="Télécharger le ZIP"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(ev.zip_download_url!, "_blank");
                    }}
                    danger
                  >
                    <Download size={13} />
                  </IconButton>
                )}
                {isAdmin && (
                  <IconButton title="Paramètres" onClick={goToSettings}>
                    <Trash2 size={13} />
                  </IconButton>
                )}
              </>
            ) : (
              <>
                <IconButton title="Voir la galerie" onClick={goToFeed}>
                  <Eye size={13} />
                </IconButton>
                {kind === "expiring" && ev.zip_download_url && (
                  <IconButton
                    title="Télécharger ZIP"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(ev.zip_download_url!, "_blank");
                    }}
                  >
                    <Download size={13} />
                  </IconButton>
                )}
                {isAdmin ? (
                  <IconButton title="Paramètres" onClick={goToSettings}>
                    <Settings size={13} />
                  </IconButton>
                ) : (
                  <IconButton title="Ajouter des photos" onClick={goToFeed}>
                    <Upload size={13} />
                  </IconButton>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, value }: { icon: React.ReactNode; value: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
      <span style={{ color: COLORS.textDisabled, display: "inline-flex" }}>{icon}</span>
      {value.toLocaleString("fr-FR")}
    </span>
  );
}

function Timer({
  kind,
  daysToExpire,
  daysToDelete,
  photoPct,
}: {
  kind: StatusKind;
  daysToExpire: number | null;
  daysToDelete: number | null;
  photoPct: number;
}) {
  if (kind === "deleting") {
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: COLORS.dangerDark,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <AlertCircle size={12} /> Supprimé dans {daysToDelete ?? 0} j
      </span>
    );
  }
  if (kind === "expiring") {
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: COLORS.warningDark,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <Clock size={12} /> ZIP dans {Math.max(0, daysToExpire ?? 0)} j
      </span>
    );
  }
  if (photoPct >= 90) {
    return (
      <span
        style={{
          fontSize: 11,
          fontWeight: 500,
          color: COLORS.warningDark,
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <AlertTriangle size={12} /> Quota à {photoPct}%
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 500,
        color: COLORS.successDark,
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
      }}
    >
      <Clock size={12} /> Expire dans {Math.max(0, daysToExpire ?? 0)} j
    </span>
  );
}

function IconButton({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: (e: React.MouseEvent) => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{
        width: 26,
        height: 26,
        borderRadius: 8,
        border: `0.5px solid ${danger ? COLORS.danger : COLORS.border}`,
        background: "transparent",
        display: "grid",
        placeItems: "center",
        cursor: "pointer",
        color: danger ? COLORS.danger : COLORS.textSecondary,
      }}
    >
      {children}
    </button>
  );
}
