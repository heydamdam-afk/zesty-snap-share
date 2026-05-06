import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Redirection dashboard — Kapsul" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const redirectToAdminDashboard = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        navigate({ to: "/admin" });
        return;
      }

      await supabase.rpc("link_admin_user_id");

      const { data, error: adminError } = await supabase.rpc("my_admin_events");

      if (cancelled) return;

      const events = (data ?? []) as Array<{ slug: string }>;

      if (adminError || events.length === 0) {
        setError("Aucun accès admin trouvé pour ce compte.");
        return;
      }

      // Plusieurs events : on laisse l'utilisateur choisir.
      if (events.length > 1) {
        navigate({ to: "/my-events" });
        return;
      }

      navigate({ to: "/$slug/admin/dashboard", params: { slug: events[0].slug } });
    };

    void redirectToAdminDashboard();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="grid min-h-screen place-items-center bg-secondary px-6">
      <div className="w-full max-w-sm rounded-2xl bg-card p-6 text-center shadow-card">
        <h1 className="font-display text-xl text-foreground">Dashboard</h1>
        {error ? (
          <>
            <p className="mt-2 text-sm text-muted-foreground">{error}</p>
            <Link
              to="/admin"
              className="mt-5 inline-flex rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground"
            >
              Se connecter à l'espace admin
            </Link>
          </>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">Redirection vers votre espace admin…</p>
        )}
      </div>
    </div>
  );
}