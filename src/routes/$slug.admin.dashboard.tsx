import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import {
  AdminContext,
  type AdminContextValue,
  type AdminEvent,
  type AdminRole,
} from "@/components/zest/admin/AdminContext";
import { AdminHeader } from "@/components/zest/admin/AdminHeader";
import { EventSettingsSection } from "@/components/zest/admin/EventSettingsSection";
import { StorageQuotaSection } from "@/components/zest/admin/StorageQuotaSection";
import { AdminsSection } from "@/components/zest/admin/AdminsSection";
import { BannedSection } from "@/components/zest/admin/BannedSection";
import { DangerZoneSection } from "@/components/zest/admin/DangerZoneSection";
import { QuotaBanner } from "@/components/zest/QuotaBanner";
import { Button } from "@/components/ui/button";
import { getStripe, getStripeEnvironment } from "@/lib/stripe-client";
import { createAddonImagesCheckout, getAddonImagesEligibility } from "@/lib/addon.functions";
import { Camera, Loader2 } from "lucide-react";

export const Route = createFileRoute("/$slug/admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Tableau de bord admin — Kapsul" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminDashboard,
});

const EVENT_SELECT =
  "id, titre, slug, code_acces, lieu, cover_url, commentaires_actifs, likes_actifs, uploads_actifs, quota_mo, used_mo, status, frozen_at, zip_download_url, expire_at, plan_code";

function AdminDashboard() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const [ctx, setCtx] = useState<AdminContextValue | null>(null);
  const [loading, setLoading] = useState(true);
  const [addonEligible, setAddonEligible] = useState(false);
  const [addonSecret, setAddonSecret] = useState<string | null>(null);
  const [addonLoading, setAddonLoading] = useState(false);

  const createAddonCheckout = useServerFn(createAddonImagesCheckout);
  const checkAddonEligibility = useServerFn(getAddonImagesEligibility);

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
      try {
        console.log("1. init start");
        const { data: sess } = await supabase.auth.getSession();
        console.log("2. session:", sess.session?.user.email);
        if (cancel) return;
        const sessionEmail = sess.session?.user.email;
        if (!sessionEmail) {
          navigate({
            to: "/login",
            search: { redirect: `/${slug}/admin/dashboard` } as never,
          });
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
        if (cancel) return;
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
          navigate({
            to: "/login",
            search: { redirect: `/${slug}/admin/dashboard` } as never,
          });
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
        console.log("3. ctx avant setCtx:", ctx);
        setCtx(value);
        console.log("4. setCtx appelé");
      } catch (error) {
        console.error("ERREUR:", error);
        if (!cancel) {
          toast.error("Erreur de chargement de l'espace admin.");
          navigate({
            to: "/login",
            search: { redirect: `/${slug}/admin/dashboard` } as never,
          });
        }
      } finally {
        if (!cancel) setLoading(false);
        console.log("5. setLoading(false) appelé");
      }
    };
    void init();
    return () => {
      cancel = true;
    };
    // Intentionally only depend on `slug`. `navigate` and `loadEvent` are stable
    // in practice but including them caused the effect to re-run and cancel
    // itself before the events query could resolve, leaving the dashboard
    // stuck on the loading screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

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
        <QuotaBanner
          used={ctx.event.used_mo ?? 0}
          total={ctx.event.quota_mo ?? 0}
          variant="admin"
        />
        <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 pb-24">
          <EventSettingsSection />
          <StorageQuotaSection />
          <AdminsSection />
          <BannedSection />
          <DangerZoneSection />
        </main>
      </div>
    </AdminContext.Provider>
  );
}