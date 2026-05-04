import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ZestLogo } from "@/components/zest/Logo";
import { ArrowLeft, LogOut } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/$slug/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord admin — Zest" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

type AdminContext = {
  eventId: string;
  eventTitle: string;
  adminId: string;
  role: "organisateur" | "secondaire";
  email: string;
};

function AdminDashboard() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<AdminContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancel = false;
    const init = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const sessionEmail = sess.session?.user.email;
      if (!sessionEmail) {
        navigate({ to: "/$slug/admin", params: { slug } });
        return;
      }

      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select("id, titre")
        .or(`slug.eq.${slug},code_acces.eq.${slug}`)
        .maybeSingle();
      if (cancel) return;
      if (evErr || !ev) {
        toast.error("Événement introuvable");
        navigate({ to: "/" });
        return;
      }

      await supabase.rpc("link_admin_user_id");
      const { data: adm, error: admErr } = await supabase
        .from("event_admins")
        .select("id, role")
        .eq("event_id", ev.id)
        .ilike("email", sessionEmail)
        .maybeSingle();
      if (cancel) return;
      if (admErr || !adm) {
        toast.error("Vous n'êtes pas admin de cet événement.");
        await supabase.auth.signOut();
        navigate({ to: "/$slug/admin", params: { slug } });
        return;
      }

      setCtx({
        eventId: ev.id,
        eventTitle: ev.titre,
        adminId: adm.id,
        role: adm.role as "organisateur" | "secondaire",
        email: sessionEmail,
      });
      setLoading(false);
    };
    void init();
    return () => {
      cancel = true;
    };
  }, [slug, navigate]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/$slug/admin", params: { slug } });
  };

  if (loading || !ctx) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary">
      {/* Header fixe */}
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <ZestLogo />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-foreground">
              {ctx.eventTitle}
            </p>
            <span
              className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                ctx.role === "organisateur"
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {ctx.role === "organisateur" ? "Organisateur" : "Admin secondaire"}
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
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground hover:bg-secondary"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <div className="rounded-2xl bg-card p-6 shadow-card">
          <h2 className="font-display text-xl text-foreground">
            Espace admin
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Connecté en tant que <span className="font-medium text-foreground">{ctx.email}</span>.
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            Les sections de gestion (Paramètres, Stockage, Offres, Admins, Bannis, Zone dangereuse)
            seront ajoutées dans les prochaines étapes.
          </p>
        </div>
      </main>
    </div>
  );
}