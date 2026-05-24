import { createContext, useContext } from "react";

export type AdminRole = "organisateur" | "secondaire";

export type AdminEvent = {
  id: string;
  titre: string;
  slug: string;
  code_acces: string;
  lieu: string | null;
  cover_url: string | null;
  commentaires_actifs: boolean;
  likes_actifs: boolean;
  uploads_actifs: boolean;
  quota_mo: number;
  used_mo: number;
  status: string;
  frozen_at: string | null;
  zip_download_url: string | null;
  expire_at: string | null;
  plan_code: string | null;
};

export type AdminContextValue = {
  event: AdminEvent;
  adminId: string;
  role: AdminRole;
  email: string;
  /** Re-fetch l'event depuis Supabase et met à jour le contexte. */
  reloadEvent: () => Promise<void>;
};

export const AdminContext = createContext<AdminContextValue | null>(null);

export function useAdminContext(): AdminContextValue {
  const ctx = useContext(AdminContext);
  if (!ctx) {
    throw new Error(
      "useAdminContext must be used inside an AdminContext.Provider",
    );
  }
  return ctx;
}

export function useIsOrganisateur(): boolean {
  return useAdminContext().role === "organisateur";
}