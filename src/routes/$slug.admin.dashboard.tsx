import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AdminContext,
  type AdminContextValue,
  type AdminEvent,
  type AdminRole,
} from "@/components/zest/admin/AdminContext";
import { AdminHeader } from "@/components/zest/admin/AdminHeader";

export const Route = createFileRoute("/$slug/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord admin — Zest" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

const EVENT_SELECT =
  "id, titre, slug, code_acces, lieu, cover_url, commentaires_actifs, likes_actifs, uploads_actifs, quota_mo, used_mo, status";

function AdminDashboard() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<AdminContextValue | null>(null);
  const [loading, setLoading] = useState(true);

  const loadEvent = useCallback(
    async (eventId: string): Promise<AdminEvent | null> => {
      const { data, error } = await supabase
        .from("events")
        .select(EVENT_SELECT)
        .eq("id", eventId)
        .maybeSingle();
      if (error || !data) return null;
      return data as AdminEvent;
    },
    [],
  );

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
        .select(EVENT_SELECT)
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

      const event = ev as AdminEvent;
      const value: AdminContextValue = {
        event,
        adminId: adm.id,
        role: adm.role as AdminRole,
        email: sessionEmail,
        reloadEvent: async () => {
          const fresh = await loadEvent(event.id);
          if (fresh) {
            setCtx((prev) => (prev ? { ...prev, event: fresh } : prev));
          }
        },
      };
      setCtx(value);
      setLoading(false);
    };
    void init();
    return () => {
      cancel = true;
    };
  }, [slug, navigate, loadEvent]);

  if (loading || !ctx) {
    return (
      <div className="grid min-h-screen place-items-center bg-secondary">
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  return (
    <AdminContext.Provider value={ctx}>
      <div className="min-h-screen bg-secondary">
        <AdminHeader />
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-24">
          {/* Sections insérées aux étapes 4 → 9 */}
          <SectionPlaceholder
            title="Bienvenue dans votre espace admin"
            description={`Connecté en tant que ${ctx.email}. Les sections de gestion (Paramètres, Stockage, Offres, Admins, Bannis, Zone dangereuse) seront ajoutées dans les prochaines étapes.`}
          />
        </main>
      </div>
    </AdminContext.Provider>
  );
}

function SectionPlaceholder({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-2xl bg-card p-6 shadow-card">
      <h2 className="font-display text-xl text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </section>
  );
}