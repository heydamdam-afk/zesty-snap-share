import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { PostCard } from "@/components/zest/PostCard";
import { Gallery } from "@/components/zest/Gallery";
import { ZestLogo } from "@/components/zest/Logo";
import { EventHero } from "@/components/zest/EventHero";
import { EventDetails } from "@/components/zest/EventDetails";
import { EventStats } from "@/components/zest/EventStats";
import { StickyTabs, type TabId } from "@/components/zest/StickyTabs";
import { FloatingUploadButton } from "@/components/zest/FloatingUploadButton";
import { GuestsList } from "@/components/zest/GuestsList";
import { QrPanel } from "@/components/zest/QrPanel";
import { ComposeBar } from "@/components/zest/ComposeBar";
import { photos, event } from "@/data/mock-event";
import { motion, AnimatePresence } from "framer-motion";
import {
  AccessGate,
  loadGuest,
  type GuestSession,
} from "@/components/zest/AccessGate";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: `${"Mariage de Sabrina & Thomas"} — Zest` },
      {
        name: "description",
        content:
          "Galerie photo éphémère du mariage de Sabrina & Thomas — partagez vos photos en temps réel avec Zest.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const [tab, setTab] = useState<TabId>("feed");
  const [guest, setGuest] = useState<GuestSession | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setGuest(loadGuest());
    setHydrated(true);
  }, []);

  const stats = useMemo(() => {
    const guests = new Set(photos.map((p) => p.author)).size;
    const likes = photos.reduce((s, p) => s + p.likes, 0);
    return { guests, photos: photos.length, likes };
  }, []);

  const handleUpload = (files: FileList) => {
    console.log("upload", files.length, "files — TODO: open drawer");
  };

  if (!hydrated) return null;
  if (!guest) return <AccessGate onEnter={setGuest} />;

  return (
    <div className="relative min-h-screen bg-background pb-32">
      {/* Hero */}
      <EventHero />

      {/* Onglets sticky */}
      <StickyTabs active={tab} onChange={setTab} />

      {/* Contenu */}
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
              <ComposeBar onUpload={() => console.log("compose upload")} />
              {photos.map((p) => (
                <PostCard key={p.id} photo={p} />
              ))}
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
              <Gallery photos={photos} />
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
              <EventDetails />
              <GuestsList />
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
              <QrPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bouton upload flottant — galerie uniquement */}
      {tab === "gallery" && <FloatingUploadButton onPick={handleUpload} />}

      {/* Footer */}
      <footer className="mt-10 px-4 pb-24 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          Propulsé par <ZestLogo />
        </div>
      </footer>
    </div>
  );
}
