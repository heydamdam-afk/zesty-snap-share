import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { verifyWebhook, type StripeEnv } from '@/lib/stripe.server';

async function handleCheckoutCompleted(session: any) {
  // Add-on Images : event existant, on étend juste le quota/expire_at
  if (session.metadata?.addon_type === 'addon_images') {
    const eventId = session.metadata?.event_id;
    if (!eventId) {
      console.error('addon_images session without event_id metadata', session.id);
      return;
    }
    const paidAmount = typeof session.amount_total === 'number' ? session.amount_total : 0;
    const { error } = await supabaseAdmin.rpc('apply_addon_images', {
      _event_id: eventId,
      _stripe_session_id: session.id,
      _paid_amount_cents: paidAmount,
    });
    if (error) {
      console.error('apply_addon_images failed', error);
      throw error;
    }
    return;
  }

  const pendingId = session.metadata?.pending_id;
  if (!pendingId) {
    console.error('checkout.session.completed without pending_id metadata', session.id);
    return;
  }

  const paidAmount = typeof session.amount_total === 'number' ? session.amount_total : 0;

  const { data: result, error } = await supabaseAdmin.rpc('create_event_from_pending', {
    _pending_id: pendingId,
    _stripe_session_id: session.id,
    _paid_amount_cents: paidAmount,
  });
  if (error) {
    console.error('create_event_from_pending failed', error);
    throw error;
  }

  const created = result as unknown as { event_id: string; slug: string; already_created?: boolean };
  if (created.already_created) {
    console.log('event already created, skipping magic link', created.event_id);
    return;
  }

  // Send magic link
  const email = (session.customer_details?.email || session.customer_email || '').toLowerCase();
  if (!email) {
    console.error('no email on session', session.id);
    return;
  }

  const origin = new URL(session.url || session.return_url || 'https://app.kapsul.events').origin;
  const redirectTo = `${origin}/${created.slug}/admin/dashboard`;

  try {
    await supabaseAdmin.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
  } catch (e) {
    console.error('signInWithOtp failed', e);
  }
}

async function handleWebhook(req: Request, env: StripeEnv) {
  const event = await verifyWebhook(req, env);
  console.log('payments webhook:', event.type);

  switch (event.type) {
    case 'checkout.session.completed':
    case 'transaction.completed':
      await handleCheckoutCompleted(event.data.object);
      break;
    default:
      console.log('unhandled event:', event.type);
  }
}

export const Route = createFileRoute('/api/public/payments/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get('env');
        if (rawEnv !== 'sandbox' && rawEnv !== 'live') {
          return Response.json({ received: true, ignored: 'invalid env' });
        }
        try {
          await handleWebhook(request, rawEnv);
          return Response.json({ received: true });
        } catch (e) {
          console.error('Webhook error:', e);
          return new Response('Webhook error', { status: 400 });
        }
      },
    },
  },
});