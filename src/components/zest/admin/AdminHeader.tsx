import { Link } from "@tanstack/react-router";
import { ArrowRight, Eye } from "lucide-react";
import { ZestLogo } from "@/components/zest/Logo";
import { useAdminContext } from "./AdminContext";
import { Avatar } from "@/components/zest/Avatar";
import { useSession } from "@/contexts/SessionProvider";

export function AdminHeader() {
  const { event, role } = useAdminContext();
  const { profile } = useSession();
  const displayName =
    profile?.avatar_name || profile?.prenom || profile?.email?.split("@")[0] || "";
  const initials = (displayName?.[0] ?? "?").toUpperCase();

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <ZestLogo />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {event.titre}
          </p>
          <div className="mt-0.5 flex items-center gap-2">
            <span
            className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              role === "organisateur"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {role === "organisateur" ? "Organisateur" : "Admin secondaire"}
          </span>
            {displayName && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <Avatar initials={initials} src={profile?.avatar_url ?? null} size="sm" />
                <span className="truncate">{displayName}</span>
              </span>
            )}
          </div>
        </div>

        {/* Mobile : 2 boutons icônes uniquement */}
        <div className="flex items-center gap-1.5 sm:hidden">
          <Link
            to="/e/$slug"
            params={{ slug: event.slug }}
            title="Voir le feed"
            aria-label="Voir le feed"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
          >
            <Eye className="h-5 w-5" />
          </Link>
          <Link
            to="/my-events"
            title="Mes événements"
            aria-label="Mes événements"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
          >
            <ArrowRight className="h-5 w-5" />
          </Link>
        </div>

        {/* Desktop / tablette : liens avec texte */}
        <div className="hidden items-center gap-3 sm:flex">
          <Link
            to="/e/$slug"
            params={{ slug: event.slug }}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
          >
            <Eye className="h-3.5 w-3.5" />
            <span>Voir le feed</span>
          </Link>
          <Link
            to="/my-events"
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            <span>Mes events</span>
          </Link>
        </div>
      </div>
    </header>
  );
}