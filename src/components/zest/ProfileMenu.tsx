import type { GuestSession } from "@/lib/zest-session";
import { Avatar } from "./Avatar";
import { LogOut, Image as ImageIcon, Shield } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export function ProfileMenu({
  guest,
  onShowMyPhotos,
  onLeave,
}: {
  guest: GuestSession;
  onAvatarChange?: (url: string) => void;
  onShowMyPhotos?: () => void;
  onLeave?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [adminSlug, setAdminSlug] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const userId = sess.session?.user.id;
      if (!userId) {
        if (!cancelled) setAdminSlug(null);
        return;
      }
      const { data } = await supabase
        .from("event_admins")
        .select("events!inner(slug)")
        .eq("user_id", userId)
        .limit(1)
        .maybeSingle();
      const slug = (data as { events?: { slug?: string } | null } | null)?.events?.slug ?? null;
      if (!cancelled) setAdminSlug(slug);
    };
    check();
    const { data: sub } = supabase.auth.onAuthStateChange(() => check());
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <div className="absolute right-3 top-3 z-10">
      <button
        onClick={() => setOpen((v) => !v)}
        className="rounded-full ring-2 ring-card"
        aria-label="Profil"
      >
        <Avatar initials={guest.initial} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl bg-card shadow-card">
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
              onLeave?.();
            }}
            className="flex w-full items-center gap-2 px-4 py-3 text-sm text-destructive hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
            Quitter
          </button>
        </div>
      )}
    </div>
  );
}