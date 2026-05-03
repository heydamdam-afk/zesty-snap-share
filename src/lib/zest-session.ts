import type { Tables } from "@/integrations/supabase/types";

export type EventRow = Tables<"events">;
export type InviteRow = Tables<"invites">;

export type GuestSession = {
  invite: InviteRow;
  event: EventRow;
  initial: string;
  avatarColor: string;
};

const STORAGE_KEYS = {
  deviceId: "zeste_device_id",
  attempts: "zeste_login_attempts",
  lockUntil: "zeste_login_lock_until",
} as const;

const AVATAR_PALETTE = [
  "#FFB199", "#A0D8B3", "#9FC5E8", "#F4C2C2",
  "#D6B3E5", "#FFD59E", "#B5D8D8", "#F2A6A6",
];

export function pickAvatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

export function getOrCreateDeviceId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(STORAGE_KEYS.deviceId);
  if (!id) {
    id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`);
    localStorage.setItem(STORAGE_KEYS.deviceId, id);
  }
  return id;
}

export function getDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.deviceId);
}

export function clearDevice() {
  Object.values(STORAGE_KEYS).forEach((k) => localStorage.removeItem(k));
}

export function buildSession(invite: InviteRow, event: EventRow): GuestSession {
  return {
    invite,
    event,
    initial: (invite.prenom[0] ?? "?").toUpperCase(),
    avatarColor: pickAvatarColor(invite.prenom),
  };
}

export const LOGIN_KEYS = STORAGE_KEYS;