import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PostCard } from "@/components/zest/PostCard";
import { Gallery } from "@/components/zest/Gallery";
import { EventHero } from "@/components/zest/EventHero";
import { EventDetails } from "@/components/zest/EventDetails";
import { EventStats } from "@/components/zest/EventStats";
import { StickyTabs, type TabId } from "@/components/zest/StickyTabs";
import { FloatingUploadButton } from "@/components/zest/FloatingUploadButton";
import { GuestsList } from "@/components/zest/GuestsList";
import { QrPanel } from "@/components/zest/QrPanel";
import { ComposeBar } from "@/components/zest/ComposeBar";
import { motion, AnimatePresence } from "framer-motion";
import {
  AccessGate,
  loadGuest,
  saveGuest,
  type GuestSession,
} from "@/components/zest/AccessGate";
import { ProfileMenu } from "@/components/zest/ProfileMenu";
import { ProfileDialog } from "@/components/zest/ProfileDialog";
import { Footer } from "@/components/zest/Footer";
import { QuotaBanner, QUOTA_FULL_MESSAGE } from "@/components/zest/QuotaBanner";
import { useEventFeed, type FeedPost } from "@/hooks/useEventFeed";
import {
  uploadGalleryBatch,
  ACCEPTED_PHOTO_TYPES,
  MAX_PHOTO_BYTES,
  type UploadProgress,
} from "@/lib/zest-actions";
import { useAdmin } from "@/hooks/useAdmin";
import { Link } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { findEventBySlug, findInvite } from "@/lib/zest-actions";
import { buildSession, getOrCreateDeviceId } from "@/lib/zest-session";
import { toast } from "sonner";

const QUOTA_TOTAL = 500;

export const Route = createFileRoute("/e/$slug")({
  head: () => ({
    meta: [
      { title: "Kapsul — Galerie photo de votre événement" },
      {
        name: "description",
        content:
          "Galerie photo éphémère partagée en temps réel — postez vos plus beaux moments avec Kapsul.",
      },
    ],
  }),
  component: Index,
  errorComponent: ({ error, reset }) => (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
      <h1 className="font-display text-2xl text-foreground">Une erreur est survenue</h1>
      <p className="max-w-md text-sm text-muted-foreground">{error.message}</p>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.removeItem("zeste_guest_session");
            localStorage.removeItem("zeste_login_attempts");
            localStorage.removeItem("zeste_login_lock_until");
          } catch {/* noop */}
          reset();
          window.location.reload();
        }}
        className="rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
      >
        Réinitialiser et recharger
      </button>
    </div>
  ),
});

function Index() {
  const { slug: EVENT_SLUG } = Route.useParams();
  const [tab, setTab] = useState<TabId>("feed");
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);
  const [uploads, setUploads] = useState<UploadProgress[]>([]);
  const [uploading, setUploading] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [adminCheckDone, setAdminCheckDone] = useState(false);

  useEffect(() => {
    setGuest(loadGuest());
    setHydrated(true);
  }, []);

  useEffect(() => {
    saveGuest(guest);
  }, [guest]);

  // Auto-créer une session admin si l'utilisateur est connecté côté Supabase
  // mais n'a pas (encore) de session guest locale.
  useEffect(() => {
    if (!hydrated || guest) return;
    let cancel = false;
    (async () => {
      try {
        const { data: sess } = await supabase.auth.getSession();
        const session = sess.session;
        const user = session?.user;
        // Guard : pas de session, on stoppe (pas de requête DB inutile)
        if (!user?.email) { if (!cancel) setAdminCheckDone(true); return; }
        const event = await findEventBySlug(EVENT_SLUG);
        if (!event) { if (!cancel) setAdminCheckDone(true); return; }
        // Lier user_id si admin invité par email avant inscription
        await supabase.rpc("link_admin_user_id");
        const { data: adminRow, error: adminErr } = await supabase
          .from("event_admins")
          .select("id")
          .eq("event_id", event.id)
          .ilike("email", user.email)
          .maybeSingle();
        if (adminErr) {
          console.error("[index] admin lookup error", adminErr);
          if (!cancel) setAdminCheckDone(true);
          return;
        }
        if (!adminRow) { if (!cancel) setAdminCheckDone(true); return; }
        const deviceId = getOrCreateDeviceId();
        let invite = await findInvite(event.id, deviceId);
        if (!invite) {
          // Try to find an existing invite for this admin by email
          // (admin may have logged in on a different device before).
          const { data: existingByEmail } = await supabase
            .from("invites")
            .select("*")
            .eq("event_id", event.id)
            .ilike("email", user.email)
            .maybeSingle();
          if (existingByEmail) {
            invite = existingByEmail;
          } else {
            const prenom = (user.email.split("@")[0] ?? "Admin").slice(0, 40);
            const { data: created, error: createErr } = await supabase
              .from("invites")
              .insert({
                event_id: event.id,
                prenom,
                email: user.email,
                device_id: deviceId,
                rgpd_consent: false,
              })
              .select()
              .single();
            if (createErr) {
              console.error("[index] auto-create invite failed", createErr);
            }
            invite = created ?? null;
          }
        }
        if (!invite || cancel) return;
        setGuest(buildSession(invite, event));
      } catch (e) {
        console.error("[index] auto admin session failed", e);
      } finally {
        if (!cancel) setAdminCheckDone(true);
      }
    })();
    return () => { cancel = true; };
  }, [hydrated, guest]);

  const { posts, reload } = useEventFeed(
    guest?.event.id ?? null,
    guest?.invite.id ?? null,
  );

  const { isAdmin } = useAdmin(guest?.event.id ?? null);

  const stats = useMemo(() => {
    const guests = new Set(posts.map((p) => p.invite_id)).size;
    const photoCount = posts.reduce((sum, p) => {
      const n = p.photos.length > 0 ? p.photos.length : p.url_medium ? 1 : 0;
      return sum + n;
    }, 0);
    const likes = posts.reduce((s, p) => s + p.nb_likes, 0);
    return { guests, photos: photoCount, likes };
  }, [posts]);

  const quotaUsed = stats.photos;
  const quotaFull = quotaUsed >= QUOTA_TOTAL;

  const handleUpload = async (files: FileList) => {
    if (!guest) return;
    if (quotaFull) {
      toast.error(QUOTA_FULL_MESSAGE);
      return;
    }
    const arr = Array.from(files);
    // Client-side validation.
    const tooBig = arr.filter((f) => f.size > MAX_PHOTO_BYTES);
    const badType = arr.filter(
      (f) => !ACCEPTED_PHOTO_TYPES.includes((f.type || "").toLowerCase()),
    );
    const invalid = new Set([...tooBig, ...badType].map((f) => f.name));
    const valid = arr.filter((f) => !invalid.has(f.name));

    if (tooBig.length > 0) {
      toast.error(`${tooBig.length} fichier(s) > 50 Mo ignoré(s)`, {
        description: tooBig.map((f) => `• ${f.name}`).join("\n"),
        duration: 8000,
      });
    }
    if (badType.length > 0) {
      toast.error(`${badType.length} format(s) non supporté(s) ignoré(s)`, {
        description: badType.map((f) => `• ${f.name}`).join("\n"),
        duration: 8000,
      });
    }
    if (valid.length === 0) return;
    setUploading(true);
    setUploads(
      valid.map((f, i) => ({
        index: i,
        total: valid.length,
        fileName: f.name,
        status: "pending" as const,
        percent: 0,
      })),
    );
    try {
      const res = await uploadGalleryBatch({
        eventId: guest.event.id,
        inviteId: guest.invite.id,
        files: valid,
        onProgress: (p) =>
          setUploads((list) => list.map((it) => (it.index === p.index ? p : it))),
      });
      await reload();
      if (res.errors.length > 0 && res.ok > 0) {
        toast.warning(`${res.ok}/${valid.length} photo(s) envoyée(s)`, {
          description:
            `${res.errors.length} échec(s) :\n` +
            res.errors.map((e) => `• ${e.file} — ${e.error}`).join("\n"),
          duration: 12000,
        });
      } else if (res.errors.length > 0) {
        toast.error(`Aucune photo envoyée (${res.errors.length} échec(s))`, {
          description: res.errors.map((e) => `• ${e.file} — ${e.error}`).join("\n"),
          duration: 12000,
        });
      } else {
        toast.success(
          res.ok === 1 ? "Photo envoyée" : `${res.ok} photos envoyées`,
        );
      }
    } catch (e) {
      console.error(e);
      toast.error("Upload impossible, réessayez.", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setUploading(false);
      setTimeout(() => setUploads([]), 1500);
    }
  };

  if (!hydrated) return null;
  if (!guest && !adminCheckDone) return null;
  if (!guest) return <AccessGate slug={EVENT_SLUG} onEnter={setGuest} />;

  const visiblePosts: FeedPost[] = onlyMine
    ? posts.filter((p) => p.invite_id === guest.invite.id)
    : posts;

  return (
    <div className="relative min-h-screen bg-background pb-32">
      <QuotaBanner used={quotaUsed} total={QUOTA_TOTAL} />

      <div className="relative">
        <EventHero title={guest.event.titre} dateIso={guest.event.event_date ?? guest.event.expire_at} coverUrl={guest.event.cover_url} />
        <ProfileMenu
          guest={guest}
          onAvatarChange={(url) =>
            setGuest((g) =>
              g ? { ...g, invite: { ...g.invite, avatar_url: url } } : g,
            )
          }
          onShowMyPhotos={() => {
            setOnlyMine(true);
            setTab("gallery");
          }}
          onEditProfile={() => setProfileOpen(true)}
          onLeave={() => {
            setGuest(null);
            setOnlyMine(false);
          }}
        />
        <ProfileDialog
          open={profileOpen}
          onOpenChange={setProfileOpen}
          guest={guest}
          onUpdated={(next) =>
            setGuest((g) =>
              g
                ? {
                    ...g,
                    invite: {
                      ...g.invite,
                      ...(next.prenom !== undefined ? { prenom: next.prenom } : {}),
                      ...(next.email !== undefined ? { email: next.email } : {}),
                      ...(next.avatar_url !== undefined ? { avatar_url: next.avatar_url } : {}),
                    },
                  }
                : g,
            )
          }
        />
      </div>

      <EventStats
        guests={stats.guests}
        photos={stats.photos}
        likes={stats.likes}
      />

      <StickyTabs active={tab} onChange={setTab} />

      <main className="px-3 pt-3">
        <AnimatePresence mode="wait">
          {tab === "feed" && (
            <motion.div
              key="feed"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <ComposeBar guest={guest} onPosted={reload} />
              {visiblePosts.map((p) => (
                <PostCard key={p.id} post={p} guest={guest} isAdmin={isAdmin} onChanged={reload} />
              ))}
              {visiblePosts.length === 0 && (
                <p className="px-6 py-12 text-center text-sm text-muted-foreground">
                  Aucun post pour le moment.
                </p>
              )}
            </motion.div>
          )}
          {tab === "gallery" && (
            <motion.div
              key="gallery"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="-mx-3"
            >
              {onlyMine && (
                <div className="mx-3 mb-2 flex items-center justify-between rounded-xl bg-secondary px-3 py-2 text-xs">
                  <span className="font-medium text-foreground">
                    Mes photos ({visiblePosts.reduce((s, p) => s + (p.photos.length > 0 ? p.photos.length : p.url_medium ? 1 : 0), 0)})
                  </span>
                  <button
                    type="button"
                    onClick={() => setOnlyMine(false)}
                    className="font-semibold text-primary"
                  >
                    Voir tout
                  </button>
                </div>
              )}
              <Gallery
                posts={visiblePosts}
                isAdmin={isAdmin}
                currentDeviceId={guest.invite.device_id}
                onChanged={reload}
              />
            </motion.div>
          )}
          {tab === "guests" && (
            <motion.div
              key="guests"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="-mx-3"
            >
              <EventDetails
                dateIso={guest.event.event_date ?? guest.event.expire_at}
                isAdmin={isAdmin}
                onEdit={() => window.alert("Édition de l'événement à venir")}
              />
              <GuestsList
                posts={posts}
                eventId={guest.event.id}
                isAdmin={isAdmin}
                currentDeviceId={guest.invite.device_id}
                onChanged={reload}
              />
            </motion.div>
          )}
          {tab === "qr" && (
            <motion.div
              key="qr"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="-mx-3"
            >
              <QrPanel
                title={guest.event.titre}
                code={guest.event.code_acces}
                slug={guest.event.slug}
                dateIso={guest.event.event_date ?? guest.event.expire_at}
                lieu={guest.event.lieu}
                contact={guest.event.contact}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {tab === "gallery" && (
        <FloatingUploadButton onPick={handleUpload} disabled={quotaFull} />
      )}

      {uploads.length > 0 && (
        <div className="fixed inset-x-0 bottom-24 z-50 mx-auto w-full max-w-[360px] space-y-1 px-4">
          <div className="rounded-2xl bg-card p-3 shadow-card">
            <p className="mb-2 text-xs font-semibold text-foreground">
              {uploading ? "Envoi en cours…" : "Envoi terminé"}
            </p>
            <ul className="space-y-1.5 max-h-48 overflow-y-auto">
              {uploads.map((u) => (
                <li key={u.index} className="text-[11px]">
                  <div className="flex justify-between gap-2">
                    <span className="truncate text-foreground/80">{u.fileName}</span>
                    <span
                      className={
                        u.status === "error"
                          ? "text-destructive"
                          : u.status === "done"
                            ? "text-primary"
                            : "text-muted-foreground"
                      }
                    >
                      {u.status === "error"
                        ? "✗"
                        : u.status === "done"
                          ? "✓"
                          : `${u.percent}%`}
                    </span>
                  </div>
                  <div className="mt-0.5 h-1 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={`h-full transition-all ${u.status === "error" ? "bg-destructive" : "bg-primary"}`}
                      style={{ width: `${u.status === "done" ? 100 : u.percent}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="mt-10 pb-20">
        <Footer
          eventId={guest?.event.id}
          eventTitle={guest?.event.titre}
          slug={guest?.event.slug}
        />
      </div>
    </div>
  );
}
