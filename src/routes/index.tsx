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
import { Footer } from "@/components/zest/Footer";
import { QuotaBanner, QUOTA_FULL_MESSAGE } from "@/components/zest/QuotaBanner";
import { useEventFeed, type FeedPost } from "@/hooks/useEventFeed";
import { createPost } from "@/lib/zest-actions";

const EVENT_SLUG = "JULIE2026";
const QUOTA_TOTAL = 500;

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Zest — Galerie photo de votre événement" },
      {
        name: "description",
        content:
          "Galerie photo éphémère partagée en temps réel — postez vos plus beaux moments avec Zest.",
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
  const [tab, setTab] = useState<TabId>("feed");
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [onlyMine, setOnlyMine] = useState(false);

  useEffect(() => {
    setGuest(loadGuest());
    setHydrated(true);
  }, []);

  useEffect(() => {
    saveGuest(guest);
  }, [guest]);

  const { posts, reload } = useEventFeed(
    guest?.event.id ?? null,
    guest?.invite.id ?? null,
  );

  const stats = useMemo(() => {
    const guests = new Set(posts.map((p) => p.invite_id)).size;
    const photoCount = posts.filter((p) => p.url_medium).length;
    const likes = posts.reduce((s, p) => s + p.nb_likes, 0);
    return { guests, photos: photoCount, likes };
  }, [posts]);

  const quotaUsed = stats.photos;
  const quotaFull = quotaUsed >= QUOTA_TOTAL;

  const handleUpload = async (files: FileList) => {
    if (!guest) return;
    if (quotaFull) {
      window.alert(QUOTA_FULL_MESSAGE);
      return;
    }
    try {
      await createPost({
        eventId: guest.event.id,
        inviteId: guest.invite.id,
        files: Array.from(files),
      });
      await reload();
    } catch (e) {
      console.error(e);
      window.alert("Upload impossible, réessayez.");
    }
  };

  if (!hydrated) return null;
  if (!guest) return <AccessGate slug={EVENT_SLUG} onEnter={setGuest} />;

  const visiblePosts: FeedPost[] = onlyMine
    ? posts.filter((p) => p.invite_id === guest.invite.id)
    : posts;

  return (
    <div className="relative min-h-screen bg-background pb-32">
      <QuotaBanner used={quotaUsed} total={QUOTA_TOTAL} />

      <div className="relative">
        <EventHero title={guest.event.titre} dateIso={guest.event.expire_at} />
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
          onLeave={() => {
            setGuest(null);
            setOnlyMine(false);
          }}
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
                <PostCard key={p.id} post={p} guest={guest} />
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
                    Mes photos ({visiblePosts.filter((p) => p.url_medium).length})
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
              <Gallery posts={visiblePosts} />
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
              <EventDetails dateIso={guest.event.expire_at} />
              <GuestsList posts={posts} />
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
                dateIso={guest.event.expire_at}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {tab === "gallery" && (
        <FloatingUploadButton onPick={handleUpload} disabled={quotaFull} />
      )}

      <div className="mt-10 pb-20">
        <Footer />
      </div>
    </div>
  );
}
