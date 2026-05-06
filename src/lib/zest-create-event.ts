import { supabase } from "@/integrations/supabase/client";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "event";
}

export function generateAccessCode(length = 6): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let out = "";
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) {
    out += alphabet[arr[i] % alphabet.length];
  }
  return out;
}

export async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  for (let i = 0; i < 10; i++) {
    const { data } = await supabase
      .from("events")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!data) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  throw new Error("slug_unavailable");
}

export async function ensureUniqueCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = generateAccessCode(6);
    const { data } = await supabase
      .from("events")
      .select("id")
      .ilike("code_acces", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("code_unavailable");
}

export type ValidateCouponResult =
  | { valid: true; type: string }
  | { valid: false; reason: string };

export async function validateCoupon(code: string): Promise<ValidateCouponResult> {
  const { data, error } = await supabase.rpc("validate_coupon", { _code: code });
  if (error) return { valid: false, reason: "rpc_error" };
  return data as unknown as ValidateCouponResult;
}

export async function createEventWithCoupon(args: {
  titre: string;
  slug: string;
  codeAcces: string;
  eventDate: string; // ISO
  lieu: string;
  coverUrl: string | null;
  contact: string;
  couponCode: string;
}): Promise<{ event_id: string; slug: string; code_acces: string }> {
  const { data, error } = await supabase.rpc("create_event_with_coupon", {
    _titre: args.titre,
    _slug: args.slug,
    _code_acces: args.codeAcces,
    _event_date: args.eventDate,
    _lieu: args.lieu,
    _cover_url: args.coverUrl ?? "",
    _contact: args.contact,
    _coupon_code: args.couponCode,
  });
  if (error) throw error;
  return data as unknown as { event_id: string; slug: string; code_acces: string };
}