import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { createStripeClient } from '@/lib/stripe.server';

export const ADDON_IMAGES_PRICE_ID = 'addon_images';
export const ADDON_IMAGES_MAX_PURCHASES = 3;

const InputSchema = z.object({
  eventId: z.string().uuid(),
  returnUrl: z.string().url(),
  environment: z.enum(['sandbox', 'live']),
});

/**
 * Crée une session Stripe Embedded Checkout pour l'add-on "+100 photos / 30 jours"
 * (10€ one-time). Réservé aux events en offre Découverte, max 3 achats.
 */
export const createAddonImagesCheckout = createServerFn({ method: 'POST' })
  .inputValidator((input) => InputSchema.parse(input))
  .handler(async ({ data }) => {
    // Verify event eligibility server-side
    const { data: event, error: evErr } = await supabaseAdmin
      .from('events')
      .select('id, plan_code')
      .eq('id', data.eventId)
      .maybeSingle();
    if (evErr || !event) throw new Error('event_not_found');
    if (event.plan_code !== 'decouverte') throw new Error('addon_only_for_decouverte');

    const { count } = await supabaseAdmin
      .from('addon_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', data.eventId)
      .eq('addon_type', 'addon_images');
    if ((count ?? 0) >= ADDON_IMAGES_MAX_PURCHASES) {
      throw new Error('addon_limit_reached');
    }

    const stripe = createStripeClient(data.environment);
    const prices = await stripe.prices.list({ lookup_keys: [ADDON_IMAGES_PRICE_ID] });
    if (!prices.data.length) throw new Error('stripe_price_not_found');
    const stripePrice = prices.data[0];

    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: stripePrice.id, quantity: 1 }],
      mode: 'payment',
      ui_mode: 'embedded_page' as any,
      return_url: `${data.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      payment_intent_data: { description: 'Kapsul Add-on Images (+100 photos, 30 jours)' },
      metadata: {
        addon_type: 'addon_images',
        event_id: data.eventId,
        photos_added: '100',
        days_extended: '30',
      },
    });

    return {
      clientSecret: session.client_secret as string,
      sessionId: session.id,
    };
  });

/** Indique si l'event peut encore acheter un add-on images (Découverte + <3 achats). */
export const getAddonImagesEligibility = createServerFn({ method: 'POST' })
  .inputValidator((input) => z.object({ eventId: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: event } = await supabaseAdmin
      .from('events')
      .select('plan_code')
      .eq('id', data.eventId)
      .maybeSingle();
    if (!event) return { eligible: false, reason: 'event_not_found' as const, purchasesUsed: 0, purchasesRemaining: 0 };
    if (event.plan_code !== 'decouverte') {
      return { eligible: false, reason: 'not_decouverte' as const, purchasesUsed: 0, purchasesRemaining: 0 };
    }
    const { count } = await supabaseAdmin
      .from('addon_purchases')
      .select('id', { count: 'exact', head: true })
      .eq('event_id', data.eventId)
      .eq('addon_type', 'addon_images');
    const used = count ?? 0;
    const remaining = Math.max(0, ADDON_IMAGES_MAX_PURCHASES - used);
    return {
      eligible: remaining > 0,
      reason: remaining > 0 ? ('ok' as const) : ('limit_reached' as const),
      purchasesUsed: used,
      purchasesRemaining: remaining,
    };
  });