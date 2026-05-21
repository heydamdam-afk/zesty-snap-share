import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { APP_SCREENS } from "@/routes.config";

/**
 * Upsert le catalogue de pages dans `app_screens` (clé : slug).
 * Appelé au démarrage de l'app — silencieux pour l'utilisateur.
 */
export const syncAppScreens = createServerFn({ method: "POST" }).handler(
  async () => {
    const rows = APP_SCREENS.map((s) => ({
      slug: s.slug,
      url_complete: s.url_complete,
      nom_ecran: s.nom_ecran,
      role_acces: s.role_acces,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabaseAdmin
      .from("app_screens")
      .upsert(rows, { onConflict: "slug" });

    if (error) {
      console.error("[syncAppScreens] upsert failed:", error.message);
      throw new Error(error.message);
    }

    return { ok: true, count: rows.length };
  },
);