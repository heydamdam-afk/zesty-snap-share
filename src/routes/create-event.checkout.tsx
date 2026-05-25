import { createFileRoute, useNavigate, Link } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useMemo, useState } from 'react';
import { Loader2, Check, X, Lock } from 'lucide-react';
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from '@stripe/react-stripe-js';
import { supabase } from '@/integrations/supabase/client';
import { getStripe, getStripeEnvironment } from '@/lib/stripe-client';
import { PLANS, formatPrice, applyCoupon, type CouponInfo, type PlanCode } from '@/lib/plans';
import { createCheckoutSession } from '@/lib/create-event.functions';

export const Route = createFileRoute('/create-event/checkout')({
  head: () => ({
    meta: [
      { title: 'Validez votre formule — Kapsul' },
      { name: 'robots', content: 'noindex' },
    ],
  }),
  component: CheckoutPage,
});

type PendingForm = {
  planCode: PlanCode;
  email: string;
  payload: {
    titre: string;
    slug: string;
    code_acces: string;
    event_date: string;
    lieu: string;
    cover_url: string | null;
  };
};

function CheckoutPage() {
  const navigate = useNavigate();
  const createSession = useServerFn(createCheckoutSession);
  const [form, setForm] = useState<PendingForm | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [coupon, setCoupon] = useState<CouponInfo | null>(null);
  const [couponState, setCouponState] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [couponMsg, setCouponMsg] = useState<string | null>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem('kapsul_pending_form');
    if (!raw) {
      navigate({ to: '/create-event' });
      return;
    }
    setForm(JSON.parse(raw));
  }, [navigate]);

  const plan = useMemo(() => (form ? PLANS.find((p) => p.code === form.planCode) : undefined), [form]);
  const finalCents = useMemo(() => (plan ? applyCoupon(plan.prix_cents, coupon) : 0), [plan, coupon]);

  // Debounced coupon validation
  useEffect(() => {
    const code = couponCode.trim();
    if (!code) {
      setCouponState('idle');
      setCoupon(null);
      setCouponMsg(null);
      return;
    }
    setCouponState('checking');
    const t = setTimeout(async () => {
      const { data, error } = await supabase.rpc('validate_coupon', { _code: code });
      if (error) {
        setCouponState('invalid');
        setCouponMsg('Erreur de validation');
        setCoupon(null);
        return;
      }
      const res = data as unknown as CouponInfo;
      if (res.valid) {
        setCouponState('valid');
        setCoupon(res);
        setCouponMsg(
          res.type === 'free_event'
            ? '✓ Coupon valide — création gratuite'
            : res.discount_percent
              ? `✓ -${res.discount_percent}% appliqué`
              : res.discount_amount_cents
                ? `✓ -${formatPrice(res.discount_amount_cents)} appliqué`
                : '✓ Coupon valide',
        );
      } else {
        setCouponState('invalid');
        setCoupon(null);
        const map: Record<string, string> = {
          empty: 'Code vide',
          not_found: 'Code introuvable',
          inactive: 'Coupon désactivé',
          expired: 'Coupon expiré',
          exhausted: 'Coupon épuisé',
        };
        setCouponMsg(map[res.reason ?? ''] ?? 'Coupon invalide');
      }
    }, 400);
    return () => clearTimeout(t);
  }, [couponCode]);

  const handlePay = async (silent = false) => {
    if (!form || !plan) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await createSession({
        data: {
          planCode: form.planCode,
          email: form.email,
          couponCode: couponCode.trim() || null,
          payload: form.payload,
          returnUrl: `${window.location.origin}/create-event/success`,
          environment: getStripeEnvironment(),
        },
      });
      if (result.mode === 'free') {
        sessionStorage.removeItem('kapsul_pending_form');
        navigate({
          to: '/create-event/success',
          search: { slug: result.slug, code: form.payload.code_acces },
        });
        return;
      }
      // Paid path: mount embedded checkout
      setClientSecret(result.clientSecret);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur';
      if (!silent) setError(translateError(msg));
    } finally {
      setSubmitting(false);
    }
  };

  if (!form || !plan) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-5 pt-6 pb-16">
        <div className="mb-5 flex justify-between">
          <Link to="/create-event" className="text-sm text-muted-foreground hover:text-foreground">← Modifier</Link>
        </div>

        <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Validez votre formule</h1>
        <p className="mt-1 text-sm text-muted-foreground">Un paiement unique, pas d'abonnement.</p>

        {/* Recap card */}
        <div className="mt-6 rounded-2xl bg-secondary px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-primary">Plan {plan.nom}</p>
              <p className="mt-1 font-display text-xl font-bold text-foreground">{form.payload.titre}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(form.payload.event_date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' · '}
                {plan.description_courte}
                {' · '}
                {plan.duree_jours === 7 ? '7 jours' : `${Math.round(plan.duree_jours / 30)} mois`}
              </p>
            </div>
            <div className="text-right">
              {finalCents !== plan.prix_cents && (
                <p className="text-xs text-muted-foreground line-through">{formatPrice(plan.prix_cents)}</p>
              )}
              <p className="font-display text-3xl font-bold text-foreground">{formatPrice(finalCents)}</p>
            </div>
          </div>
        </div>

        {/* Coupon input */}
        {!clientSecret && (
          <div className="mt-5">
            <label htmlFor="coupon" className="mb-1.5 block text-sm font-semibold text-foreground">
              Code coupon (optionnel)
            </label>
            <div className="relative">
              <input
                id="coupon"
                type="text"
                maxLength={40}
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, ''))}
                placeholder="VOTRE-COUPON"
                className="w-full rounded-xl border border-border bg-background px-4 py-3 pr-10 font-mono text-base uppercase tracking-wider focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2">
                {couponState === 'checking' && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                {couponState === 'valid' && <Check className="h-4 w-4 text-primary" />}
                {couponState === 'invalid' && <X className="h-4 w-4 text-destructive" />}
              </span>
            </div>
            {couponMsg && (
              <p
                className={`mt-1 text-xs ${
                  couponState === 'valid' ? 'text-primary' : couponState === 'invalid' ? 'text-destructive' : 'text-muted-foreground'
                }`}
              >
                {couponMsg}
              </p>
            )}
          </div>
        )}

        {/* Embedded Stripe Checkout or Pay button */}
        {clientSecret ? (
          <div className="mt-6">
            <EmbeddedCheckoutProvider stripe={getStripe()} options={{ clientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        ) : (
          <>
            {error && (
              <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                {error}
              </div>
            )}
            <button
              type="button"
              onClick={() => handlePay()}
              disabled={submitting || couponState === 'checking'}
              className="mt-6 inline-flex h-14 w-full items-center justify-center rounded-2xl bg-primary px-5 text-base font-bold text-primary-foreground shadow-[0_12px_28px_hsl(var(--primary)/0.28)] transition-all disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground disabled:shadow-none"
            >
              {submitting ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : finalCents === 0 ? (
                <>Créer gratuitement →</>
              ) : (
                <>Payer {formatPrice(finalCents)} →</>
              )}
            </button>
            <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
              <Lock className="h-3 w-3" /> Paiement sécurisé · Données chiffrées de bout en bout
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function translateError(msg: string): string {
  const map: Record<string, string> = {
    slug_taken: 'Ce nom d\u2019événement est déjà pris, modifiez le titre',
    code_taken: 'Conflit de code d\u2019accès, modifiez-le',
    coupon_invalid: 'Coupon invalide',
    coupon_inactive: 'Coupon désactivé',
    coupon_expired: 'Coupon expiré',
    coupon_exhausted: 'Coupon épuisé',
    coupon_not_found: 'Coupon introuvable',
  };
  return map[msg] ?? `Erreur : ${msg}`;
}