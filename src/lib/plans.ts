export type PlanCode = 'decouverte' | 'essentiel' | 'standard' | 'premium' | 'illimitee';

export type Plan = {
  code: PlanCode;
  nom: string;
  prix_cents: number;
  quota_mo: number;
  max_photos: number;
  max_invites: number | null;
  duree_jours: number;
  stripe_price_id: string | null;
  is_top: boolean;
  description_courte: string;
  description_usage: string;
};

/** Mirrors event_plans table — keep in sync. */
export const PLANS: Plan[] = [
  {
    code: 'decouverte',
    nom: 'Découverte',
    prix_cents: 0,
    quota_mo: 1024,
    max_photos: 50,
    max_invites: 10,
    duree_jours: 7,
    stripe_price_id: null,
    is_top: false,
    description_courte: '50 photos',
    description_usage: 'Idéal pour tester ou un petit moment entre amis.',
  },
  {
    code: 'essentiel',
    nom: 'Essentiel',
    prix_cents: 2900,
    quota_mo: 6144,
    max_photos: 500,
    max_invites: 20,
    duree_jours: 30,
    stripe_price_id: 'plan_essentiel_onetime',
    is_top: false,
    description_courte: '500 photos',
    description_usage: 'Idéal pour un anniversaire ou une fête de famille.',
  },
  {
    code: 'standard',
    nom: 'Standard',
    prix_cents: 7900,
    quota_mo: 20480,
    max_photos: 2000,
    max_invites: 100,
    duree_jours: 30,
    stripe_price_id: 'plan_standard_onetime',
    is_top: true,
    description_courte: '2 000 photos',
    description_usage: 'Le plus choisi — parfait pour un mariage ou un événement pro.',
  },
  {
    code: 'premium',
    nom: 'Premium',
    prix_cents: 14900,
    quota_mo: 51200,
    max_photos: 5000,
    max_invites: 200,
    duree_jours: 30,
    stripe_price_id: 'plan_premium_onetime',
    is_top: false,
    description_courte: '5 000 photos',
    description_usage: 'Idéal pour un grand mariage ou un événement d\u2019entreprise.',
  },
  {
    code: 'illimitee',
    nom: 'Illimitée',
    prix_cents: 19900,
    quota_mo: 204800,
    max_photos: 1000000,
    max_invites: null,
    duree_jours: 30,
    stripe_price_id: 'plan_illimitee_onetime',
    is_top: false,
    description_courte: 'Photos illimitées',
    description_usage: 'Pour les festivals, gros événements ou plusieurs jours.',
  },
];

export function getPlan(code: string): Plan | undefined {
  return PLANS.find((p) => p.code === code);
}

export function formatPrice(cents: number): string {
  if (cents === 0) return '0 €';
  if (cents % 100 === 0) return `${cents / 100} €`;
  return `${(cents / 100).toFixed(2)} €`;
}

export type CouponInfo = {
  valid: boolean;
  reason?: string;
  type?: string;
  discount_percent?: number | null;
  discount_amount_cents?: number | null;
};

/** Compute the final price after applying a coupon. */
export function applyCoupon(basePriceCents: number, coupon: CouponInfo | null): number {
  if (!coupon || !coupon.valid) return basePriceCents;
  // Free coupon: total 0
  if (coupon.type === 'free_event') return 0;
  let total = basePriceCents;
  if (coupon.discount_percent) {
    total = Math.max(0, Math.round(total * (1 - coupon.discount_percent / 100)));
  }
  if (coupon.discount_amount_cents) {
    total = Math.max(0, total - coupon.discount_amount_cents);
  }
  return total;
}