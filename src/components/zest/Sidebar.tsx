import { event } from "@/data/mock-event";
import { CalendarDays, MapPin, UserPlus, MoreHorizontal } from "lucide-react";
import { motion } from "framer-motion";

export function Sidebar({ onUpload }: { onUpload: () => void }) {
  return (
    <aside className="flex flex-col gap-4">
      {/* CTA */}
      <div className="flex items-center gap-3">
        <button
          onClick={onUpload}
          className="flex-1 rounded-2xl bg-gradient-coral px-6 py-3.5 text-base font-semibold text-primary-foreground shadow-pop transition hover:scale-[1.02] active:scale-[0.99]"
        >
          Ajouter mes photos
        </button>
        <button className="grid h-12 w-12 place-items-center rounded-2xl bg-card text-muted-foreground shadow-card transition hover:text-foreground">
          <MoreHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Date card */}
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="relative overflow-hidden rounded-2xl bg-primary-soft p-5"
      >
        <p className="font-display text-3xl font-bold text-primary-soft-foreground">
          {event.date}
        </p>
        <div className="absolute -right-2 -top-2 grid h-12 w-12 place-items-center rounded-full bg-gradient-coral text-xs font-bold text-primary-foreground shadow-soft">
          J-7
        </div>
      </motion.div>

      {/* Details */}
      <div className="rounded-2xl bg-card p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold text-foreground">Détails</h3>
        <ul className="space-y-3 text-sm text-muted-foreground">
          <li className="flex gap-3">
            <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div>
              <p className="text-foreground">Du 31 décembre 2025 à 19h00</p>
              <p>Au 1er janvier 2026 à 06h00</p>
            </div>
          </li>
          <li className="flex gap-3">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>{event.location}</p>
          </li>
          <li className="flex gap-3">
            <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <p>Invité par Damien Breteau</p>
          </li>
        </ul>
      </div>

      {/* Description */}
      <div className="rounded-2xl bg-card p-5 shadow-card">
        <h3 className="mb-2 text-sm font-semibold text-foreground">Description</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          {event.description}{" "}
          <button className="font-medium text-primary hover:underline">Voir plus</button>
        </p>
      </div>

      {/* Guests */}
      <div className="rounded-2xl bg-card p-5 shadow-card">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Invités</h3>
          <button className="text-xs font-medium text-primary hover:underline">
            Voir tout
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat n={event.guests.invited} label="Invités" />
          <Stat n={event.guests.coming} label="Présents" highlight />
          <Stat n={event.guests.maybe} label="Peut-être" />
        </div>
      </div>
    </aside>
  );
}

function Stat({ n, label, highlight }: { n: number; label: string; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl px-2 py-3 text-center ${
        highlight ? "bg-primary-soft" : "bg-secondary"
      }`}
    >
      <p
        className={`font-display text-2xl font-bold ${
          highlight ? "text-primary-soft-foreground" : "text-foreground"
        }`}
      >
        {n.toString().padStart(2, "0")}
      </p>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}