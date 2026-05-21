/**
 * Catalogue centralisé de toutes les pages de l'app.
 * Synchronisé au démarrage de l'app dans la table `app_screens` (Supabase).
 *
 * role_acces (contraint par la DB) :
 *   - "public"      : accessible sans authentification
 *   - "invite"      : invité d'un event (galerie /e/$slug)
 *   - "admin"       : admin d'un event (organisateur ou secondaire)
 *   - "super_admin" : admin plateforme Kapsul (anciennement "platform_admin")
 */
export type RoleAcces = "public" | "invite" | "admin" | "super_admin";

export type AppScreen = {
  slug: string;
  url_complete: string;
  nom_ecran: string;
  role_acces: RoleAcces;
};

export const APP_BASE_URL = "https://kapsul.events";

export const APP_SCREENS: AppScreen[] = [
  // Pages publiques
  { slug: "home",                 url_complete: `${APP_BASE_URL}/`,                 nom_ecran: "Landing",                       role_acces: "public" },
  { slug: "admin-login",          url_complete: `${APP_BASE_URL}/admin`,            nom_ecran: "Connexion admin",               role_acces: "public" },
  { slug: "reset-password",       url_complete: `${APP_BASE_URL}/reset-password`,   nom_ecran: "Réinitialisation mot de passe", role_acces: "public" },
  { slug: "closed",               url_complete: `${APP_BASE_URL}/closed`,           nom_ecran: "Galerie fermée",                role_acces: "public" },
  { slug: "gros-evenement",       url_complete: `${APP_BASE_URL}/gros-evenement`,   nom_ecran: "Gros événement (devis)",        role_acces: "public" },

  // Pages invité
  { slug: "event-gallery",        url_complete: `${APP_BASE_URL}/e/:slug`,          nom_ecran: "Galerie événement",             role_acces: "invite" },

  // Pages admin (utilisateur authentifié)
  { slug: "dashboard",            url_complete: `${APP_BASE_URL}/dashboard`,        nom_ecran: "Dashboard admin",               role_acces: "admin" },
  { slug: "my-events",            url_complete: `${APP_BASE_URL}/my-events`,        nom_ecran: "Mes événements",                role_acces: "admin" },
  { slug: "create-event",         url_complete: `${APP_BASE_URL}/create-event`,     nom_ecran: "Créer un événement",            role_acces: "admin" },
  { slug: "create-event-success", url_complete: `${APP_BASE_URL}/create-event/success`, nom_ecran: "Événement créé (succès)",   role_acces: "admin" },
  { slug: "event-admin-home",     url_complete: `${APP_BASE_URL}/:slug/admin`,      nom_ecran: "Admin événement (accueil)",     role_acces: "admin" },
  { slug: "event-admin-dashboard",url_complete: `${APP_BASE_URL}/:slug/admin/dashboard`, nom_ecran: "Admin événement (dashboard)", role_acces: "admin" },

  // Pages super admin (plateforme Kapsul)
  { slug: "platform-coupons",     url_complete: `${APP_BASE_URL}/platform/coupons`, nom_ecran: "Plateforme · Coupons",          role_acces: "super_admin" },
];