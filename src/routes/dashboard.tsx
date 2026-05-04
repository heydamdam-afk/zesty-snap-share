import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Redirection dashboard — Zest" },
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

      const { data, error: adminError } = await supabase
        .from("event_admins")
        .select("events!inner(slug)")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      const slug = (data as { events?: { slug?: string } | null } | null)?.events?.slug;

      if (adminError || !slug) {
        setError("Aucun accès admin trouvé pour ce compte.");
        return;
      }

      navigate({ to: "/$slug/admin/dashboard", params: { slug } });
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