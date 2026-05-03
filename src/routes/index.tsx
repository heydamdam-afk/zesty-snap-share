import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { EventHeader } from "@/components/zest/EventHeader";
import { Sidebar } from "@/components/zest/Sidebar";
import { ComposeBar } from "@/components/zest/ComposeBar";
import { PostCard } from "@/components/zest/PostCard";
import { Gallery } from "@/components/zest/Gallery";
import { ZestLogo } from "@/components/zest/Logo";
import { photos, event } from "@/data/mock-event";
import { motion, AnimatePresence } from "framer-motion";

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
  const [tab, setTab] = useState<"gallery" | "feed">("feed");
  const handleUpload = () => {
    console.log("upload clicked — TODO: open upload modal");
  };

  return (
    <div className="min-h-screen bg-[image:var(--gradient-warm)] pb-20">
      <EventHeader tab={tab} onTab={setTab} onCreate={handleUpload} />

      <main className="mx-auto mt-6 grid max-w-6xl grid-cols-1 gap-6 px-4 sm:px-6 lg:grid-cols-[340px_1fr]">
        <Sidebar onUpload={handleUpload} />

        <section className="space-y-4">
          <ComposeBar onUpload={handleUpload} />

          <AnimatePresence mode="wait">
            {tab === "feed" ? (
              <motion.div
                key="feed"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
                className="space-y-4"
              >
                {photos.map((p) => (
                  <PostCard key={p.id} photo={p} />
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="gallery"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.25 }}
              >
                <Gallery photos={photos} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </main>

      <footer className="mx-auto mt-12 max-w-6xl px-4 sm:px-6">
        <div className="flex flex-col items-start gap-4 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            Propulsé par <ZestLogo />
          </div>
          <button className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium text-foreground shadow-card transition hover:shadow-soft">
            Créer mon événement
            <span className="text-primary">→</span>
          </button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">
          Galerie active jusqu'au {event.date}. Toutes les photos seront ensuite
          exportées vers Google Drive.
        </p>
      </footer>
    </div>
  );
}
