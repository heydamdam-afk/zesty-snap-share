import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { createStripeClient, type StripeEnv } from '@/lib/stripe.server';
import { PLANS, applyCoupon, type CouponInfo } from '@/lib/plans';

const PayloadSchema = z.object({
  titre: z.string().trim().min(3).max(120),
  slug: z
    .string()
    .trim()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9][a-z0-9-]+$/),
  code_acces: z
    .string()
    .trim()
    .min(4)
    .max(20)
    .regex(/^[A-Z0-9]+$/),
  event_date: z.string().min(1),
  lieu: z.string().trim().min(1).max(200),
  cover_url: z.string().max(2048).optional().nullable(),
});

const InputSchema = z.object({
  planCode: z.enum(['decouverte', 'essentiel', 'standard', 'premium', 'illimitee']),
  email: z.string().email().max(255),
  couponCode: z.string().max(40).optional().nullable(),
  payload: PayloadSchema,
  returnUrl: z.string().url(),
  environment: z.enum(['sandbox', 'live']),
});

type CreateResult =
  | { mode: 'paid'; clientSecret: string; sessionId: string; pendingId: string }
  | { mode: 'free'; slug: string; eventId: string };

export const createCheckoutSession = createServerFn({ method: 'POST' })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }): Promise<CreateResult> => {
    const plan = PLANS.find((p) => p.code === data.planCode);
    if (!plan) throw new Error('plan_not_found');

    // Validate slug & code uniqueness early
    const { data: existingSlug } = await supabaseAdmin
      .from('events')
      .select('id')
      .eq('slug', data.payload.slug)
      .maybeSingle();
    if (existingSlug) throw new Error('slug_taken');

    const { data: existingCode } = await supabaseAdmin
      .from('events')
      .select('id')
      .ilike('code_acces', data.payload.code_acces)
      .maybeSingle();
    if (existingCode) throw new Error('code_taken');

    // Resolve coupon → discounted total
    let coupon: CouponInfo | null = null;
    if (data.couponCode && data.couponCode.trim().length > 0) {
      const { data: rpcRes, error } = await supabaseAdmin.rpc('validate_coupon', {
        _code: data.couponCode,
      });
      if (error) throw new Error('coupon_error');
      coupon = rpcRes as unknown as CouponInfo;
      if (!coupon.valid) throw new Error(`coupon_${coupon.reason ?? 'invalid'}`);
    }

    const finalCents = applyCoupon(plan.prix_cents, coupon);

    // Insert pending_event
    const { data: pending, error: pErr } = await supabaseAdmin
      .from('pending_events')
      .insert({
        email: data.email.toLowerCase().trim(),
        plan_code: plan.code,
        paid_amount_cents: finalCents,
        coupon_code: data.couponCode?.trim() || null,
        payload: data.payload,
      })
      .select('id')
      .single();
    if (pErr || !pending) throw new Error('pending_insert_failed');

    // Free path: create the event immediately, send magic link
    if (finalCents === 0) {
      const { data: created, error: cErr } = await supabaseAdmin.rpc('create_event_from_pending', {
        _pending_id: pending.id,
        _stripe_session_id: null as any,
        _paid_amount_cents: 0,
      });
      if (cErr) throw new Error(`event_create_failed: ${cErr.message}`);
      const result = created as unknown as { event_id: string; slug: string };
      await sendMagicLinkInternal(data.email, result.slug, data.returnUrl);
      return { mode: 'free', slug: result.slug, eventId: result.event_id };
    }

    // Paid path: Stripe Embedded Checkout
    const stripe = createStripeClient(data.environment);
    const prices = await stripe.prices.list({ lookup_keys: [plan.stripe_price_id!] });
    if (!prices.data.length) throw new Error('stripe_price_not_found');
    const stripePrice = prices.data[0];

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: 'payment',
      ui_mode: 'embedded_page' as any,
      return_url: `${data.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      customer_email: data.email,
      payment_intent_data: { description: plan.nom },
      metadata: {
        pending_id: pending.id,
        plan_code: plan.code,
      },
      // Apply discount via Stripe if coupon yields a percent/amount discount but plan still > 0
      ...(finalCents !== plan.prix_cents && finalCents > 0
        ? {
            discounts: [
              {
                coupon: await getOrCreateStripeCoupon(
                  stripe,
                  plan.prix_cents - finalCents,
                  data.couponCode || 'discount',
                ),
              },
            ],
          }
        : {}),
    });

    // Persist session id on pending
    await supabaseAdmin
      .from('pending_events')
      .update({ stripe_session_id: session.id })
      .eq('id', pending.id);

    return {
      mode: 'paid',
      clientSecret: session.client_secret as string,
      sessionId: session.id,
      pendingId: pending.id,
    };
  });

/** Lookup an event created via webhook by stripe_session_id (for polling). */
export const lookupEventBySessionId = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ sessionId: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('id, slug')
      .eq('stripe_session_id', data.sessionId)
      .maybeSingle();
    if (!event) return { ready: false } as const;
    // Determine whether the buyer still needs to set an initial password
    // (first-time user: account has no password and never signed in).
    let needsSetPassword = false;
    const { data: pending } = await supabaseAdmin
      .from('pending_events')
      .select('email')
      .eq('stripe_session_id', data.sessionId)
      .maybeSingle();
    if (pending?.email) {
      const email = pending.email.toLowerCase().trim();
      const { data: summary } = await (supabaseAdmin.rpc as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown }>)('get_auth_user_summary_by_email', { _email: email });
      const row = (Array.isArray(summary) ? summary[0] : summary) as
        | { id: string; last_sign_in_at: string | null; has_password: boolean }
        | null
        | undefined;
      // First-time = either no auth user yet, or user with no password and
      // never signed in.
      needsSetPassword = !row || (!row.has_password && !row.last_sign_in_at);
    }
    return {
      ready: true,
      slug: event.slug,
      eventId: event.id,
      needsSetPassword,
    } as const;
  });

/** Resend magic link for the email associated with a Stripe session (used on success page). */
export const resendMagicLinkForSession = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ sessionId: z.string().min(1), originUrl: z.string().url() }).parse(input))
  .handler(async ({ data }) => {
    const { data: pending } = await supabaseAdmin
      .from('pending_events')
      .select('email, created_event_id')
      .eq('stripe_session_id', data.sessionId)
      .maybeSingle();
    if (!pending) return { sent: false };
    let slug: string | null = null;
    if (pending.created_event_id) {
      const { data: ev } = await supabaseAdmin
        .from('events')
        .select('slug')
        .eq('id', pending.created_event_id)
        .maybeSingle();
      slug = ev?.slug ?? null;
    }
    await sendMagicLinkInternal(pending.email, slug, data.originUrl);
    return { sent: true };
  });

/**
 * Prepare the "first-time set password" page after paid checkout.
 * Given a Stripe session id, returns the email + slug if the user can still
 * define an initial password (i.e. no password set yet and never signed in).
 */
export const prepareSetPassword = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ sessionId: z.string().min(1).max(255) }).parse(input))
  .handler(async ({ data }) => {
    const { data: pending } = await supabaseAdmin
      .from('pending_events')
      .select('email, created_event_id')
      .eq('stripe_session_id', data.sessionId)
      .maybeSingle();
    if (!pending?.email) return { ready: false as const };
    const email = pending.email.toLowerCase().trim();

    let slug: string | null = null;
    if (pending.created_event_id) {
      const { data: ev } = await supabaseAdmin
        .from('events')
        .select('slug')
        .eq('id', pending.created_event_id)
        .maybeSingle();
      slug = ev?.slug ?? null;
    }
    if (!slug) return { ready: false as const };

    const { data: summary } = await (supabaseAdmin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown }>)('get_auth_user_summary_by_email', {
      _email: email,
    });
    const row = (Array.isArray(summary) ? summary[0] : summary) as
      | { id: string; last_sign_in_at: string | null; has_password: boolean }
      | null
      | undefined;
    const alreadyOnboarded = !!(row && row.has_password && row.last_sign_in_at);

    return {
      ready: true as const,
      email,
      slug,
      alreadyOnboarded,
    };
  });

/**
 * Set the initial password for an account just created via paid checkout.
 * Only allowed when the matching auth.users row either does not exist yet
 * or has never signed in / has no password. Confirms the email at the same
 * time so the user can immediately sign in with email + password.
 */
export const setInitialPassword = createServerFn({ method: 'POST' })
  .inputValidator((input) =>
    z
      .object({
        sessionId: z.string().min(1).max(255),
        password: z.string().min(8).max(128),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: pending } = await supabaseAdmin
      .from('pending_events')
      .select('email, created_event_id, payload')
      .eq('stripe_session_id', data.sessionId)
      .maybeSingle();
    if (!pending?.email || !pending.created_event_id) {
      throw new Error('session_not_found');
    }
    const email = pending.email.toLowerCase().trim();

    const { data: summary } = await (supabaseAdmin.rpc as unknown as (
      fn: string,
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown }>)('get_auth_user_summary_by_email', {
      _email: email,
    });
    const row = (Array.isArray(summary) ? summary[0] : summary) as
      | { id: string; last_sign_in_at: string | null; has_password: boolean }
      | null
      | undefined;

    if (row && row.has_password && row.last_sign_in_at) {
      throw new Error('already_onboarded');
    }

    if (row?.id) {
      const { error } = await supabaseAdmin.auth.admin.updateUserById(row.id, {
        password: data.password,
        email_confirm: true,
      });
      if (error) throw new Error(`update_failed: ${error.message}`);
    } else {
      const { error } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: data.password,
        email_confirm: true,
      });
      if (error) throw new Error(`create_failed: ${error.message}`);
    }

    return { ok: true as const, email };
  });

async function sendMagicLinkInternal(email: string, slug: string | null, originUrl: string) {
  const origin = new URL(originUrl).origin;
  const redirectTo = slug ? `${origin}/${slug}/admin/dashboard` : `${origin}/my-events`;
  try {
    await supabaseAdmin.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
  } catch (e) {
    console.error('signInWithOtp failed', e);
  }
}

async function getOrCreateStripeCoupon(
  stripe: ReturnType<typeof createStripeClient>,
  amountOffCents: number,
  label: string,
): Promise<string> {
  const coupon = await stripe.coupons.create({
    amount_off: amountOffCents,
    currency: 'eur',
    duration: 'once',
    name: `Kapsul ${label}`,
  });
  return coupon.id;
}