import { event } from "@/data/mock-event";
import { Avatar } from "./Avatar";
import { ZestLogo } from "./Logo";
import { Plus, Users, Image as ImageIcon } from "lucide-react";
import { motion } from "framer-motion";

type Tab = "gallery" | "feed";

export function EventHeader({
  tab,
  onTab,
  onCreate,
}: {
  tab: Tab;
  onTab: (t: Tab) => void;
  onCreate?: () => void;
}) {
  return (
    <header className="w-full">
      {/* Top nav */}
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <ZestLogo />
        <button
          onClick={onCreate}
          className="group inline-flex items-center gap-2 rounded-full bg-card px-4 py-2 text-sm font-medium text-foreground shadow-card transition hover:shadow-soft"
        >
          Créer un événement
          <span className="grid h-6 w-6 place-items-center rounded-full bg-foreground text-background transition group-hover:bg-primary">
            <Plus className="h-3.5 w-3.5" />
          </span>
        </button>
      </div>

      {/* Cover */}
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="relative overflow-hidden rounded-3xl shadow-pop"
        >
          <img
            src={event.cover}
            alt={event.title}
            className="h-[280px] w-full object-cover sm:h-[360px]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-6 sm:p-10">
            <h1 className="font-display text-4xl font-bold text-white drop-shadow-lg sm:text-6xl">
              {event.title}
            </h1>
          </div>
        </motion.div>

        {/* Host bar */}
        <div className="mt-4 flex flex-col gap-3 rounded-2xl bg-card px-4 py-3 shadow-card sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex items-center gap-3">
            <Avatar initials={event.hostInitials} />
            <div>
              <p className="text-sm font-semibold text-foreground">{event.host}</p>
              <p className="text-xs text-muted-foreground">Organisatrice</p>
            </div>
          </div>
          <div className="flex items-center gap-1 rounded-full bg-secondary p-1">
            <TabButton active={tab === "gallery"} onClick={() => onTab("gallery")}>
              <ImageIcon className="h-4 w-4" />
              Galerie
            </TabButton>
            <TabButton active={tab === "feed"} onClick={() => onTab("feed")}>
              <Users className="h-4 w-4" />
              Feed
            </TabButton>
          </div>
        </div>
      </div>
    </header>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition ${
        active ? "text-primary-soft-foreground" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {active && (
        <motion.span
          layoutId="tab-pill"
          className="absolute inset-0 -z-0 rounded-full bg-primary-soft"
          transition={{ type: "spring", stiffness: 400, damping: 32 }}
        />
      )}
      <span className="relative z-10 inline-flex items-center gap-2">{children}</span>
    </button>
  );
}