import { useState } from "react";
import { ChevronDown, Calendar, MapPin, User } from "lucide-react";
import { event } from "@/data/mock-event";

export function EventDetails() {
  const [open, setOpen] = useState(true);
  return (
    <div className="mx-3 mt-3 rounded-2xl bg-card p-4 shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-foreground">
          Détails de l'événement
        </span>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${
            open ? "" : "-rotate-90"
          }`}
        />
      </button>
      {open && (
        <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <Calendar className="h-4 w-4 shrink-0" />
            <span>{event.date} — 19h00</span>
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span>{event.location}</span>
          </li>
          <li className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0" />
            <span>Organisé par {event.host}</span>
          </li>
        </ul>
      )}
    </div>
  );
}