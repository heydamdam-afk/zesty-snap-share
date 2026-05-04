import { Link } from "@tanstack/react-router";
import { ArrowLeft, LogOut } from "lucide-react";
import { ZestLogo } from "@/components/zest/Logo";
import { useAdminContext } from "./AdminContext";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";

export function AdminHeader() {
  const { event, role } = useAdminContext();
  const navigate = useNavigate();

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (e) {
      console.error("[AdminHeader] signOut failed", e);
    }
    // Hard reload to clear any cached state and force re-auth on the admin page.
    window.location.href = `/${event.slug}/admin`;
  };

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
        <ZestLogo />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {event.titre}
          </p>
          <span
            className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              role === "organisateur"
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {role === "organisateur" ? "Organisateur" : "Admin secondaire"}
          </span>
        </div>
        <Link
          to="/"
          className="hidden items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary sm:inline-flex"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Galerie
        </Link>
        <button
          type="button"
          onClick={signOut}
          title="Se déconnecter"
          aria-label="Se déconnecter"
          className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  );
}