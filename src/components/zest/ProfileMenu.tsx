import type { GuestSession } from "@/lib/zest-session";
import { Avatar } from "./Avatar";
import { LogOut, Image as ImageIcon, Shield, UserCog, Bug } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { BugReportModal } from "@/components/bug-report/BugReportWidget";
import { useSession } from "@/contexts/SessionProvider";

export function ProfileMenu({
  guest,
  onShowMyPhotos,
  onEditProfile,
  onLeave,
}: {
  guest: GuestSession;
  onAvatarChange?: (url: string) => void;
  onShowMyPhotos?: () => void;
  onEditProfile?: () => void;
  onLeave?: () => void;
}) {
  const { profile } = useSession();
  const [open, setOpen] = useState(false);
  const [adminSlug, setAdminSlug] = useState<string | null>(null);
  const [bugOpen, setBugOpen] = useState(false);
  /** Set to true when the invite's email matches a Supabase Auth account. In
   *  that case the user manages their profile from /my-events, not the
   *  per-event invité pop-over. */
  const [hasAuthAccount, setHasAuthAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const email = guest.invite.email?.trim().toLowerCase();
    if (!email) {
      setHasAuthAccount(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase.rpc("get_profiles_by_emails", { _emails: [email] });
      if (cancelled) return;
      if (error) {
        console.error("[ProfileMenu] profile lookup", error);
        return;
      }
      setHasAuthAccount((data ?? []).length > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [guest.invite.email]);

  useEffect(() => {
    let cancelled = false;
    const currentEventId = guest.event.id;
    const currentSlug = guest.event.slug;
    const check = async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const session = sess.session;
        if (!session?.user.email) {
          if (!cancelled) setAdminSlug(null);
          return;
        }
        // Lier user_id si admin invité par email avant inscription
        await supabase.rpc("link_admin_user_id");
        // On vérifie d'abord l'admin sur l'event courant : si l'utilisateur
        // est admin de plusieurs events, on ne veut PAS rediriger vers un autre.
        const { data, error } = await supabase
          .from("event_admins")
          .select("id")
          .eq("event_id", currentEventId)
          .ilike("email", session.user.email)
          .limit(1)
          .maybeSingle();
        if (error) {
          console.error("[ProfileMenu] event_admins lookup", error);
          if (!cancelled) setAdminSlug(null);
          return;
        }
        if (!cancelled) setAdminSlug(data ? currentSlug : null);
      } catch (e) {
        console.error("[ProfileMenu] admin check failed", e);
        if (!cancelled) setAdminSlug(null);
      }
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [guest.event.id, guest.event.slug]);

  // Authenticated user's identity (avatar + name) takes priority over the
  // event-scoped invite for the avatar bubble.
  const displayAvatarUrl =
    (hasAuthAccount && profile?.avatar_url) || guest.invite.avatar_url || null;
  const displayInitial =
    (hasAuthAccount &&
      (profile?.avatar_name?.[0] || profile?.prenom?.[0])?.toUpperCase()) ||
    guest.initial;

  return (
    <div className="absolute right-3 top-3 z-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full ring-2 ring-card"
        aria-label="Profil"
      >
        <Avatar initials={displayInitial} src={displayAvatarUrl} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl bg-card shadow-card">
          {!hasAuthAccount && (
            <button
              onClick={() => {
                setOpen(false);
                onEditProfile?.();
              }}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-secondary"
            >
              <UserCog className="h-4 w-4" />
              Mon profil
            </button>
          )}
          <button
            onClick={() => {
              setOpen(false);
              onShowMyPhotos?.();
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-secondary"
          >
            <ImageIcon className="h-4 w-4" />
            Mes photos
          </button>
          {adminSlug && (
            <Link
              to="/$slug/admin/dashboard"
              params={{ slug: adminSlug }}
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-secondary"
            >
              <Shield className="h-4 w-4" />
              Admin
            </Link>
          )}
          <button
            onClick={() => {
              setOpen(false);
              setBugOpen(true);
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-foreground hover:bg-secondary"
          >
            <Bug className="h-4 w-4" />
            Signaler un problème
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onLeave?.();
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-destructive hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
            Quitter
          </button>
        </div>
      )}
      {bugOpen && <BugReportModal onClose={() => setBugOpen(false)} />}
    </div>
  );
}