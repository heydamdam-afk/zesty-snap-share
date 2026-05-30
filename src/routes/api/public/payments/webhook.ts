import { createFileRoute } from '@tanstack/react-router';
import { supabaseAdmin } from '@/integrations/supabase/client.server';
import { verifyWebhook, type StripeEnv } from '@/lib/stripe.server';
import { logFlow } from '@/lib/flow-log.server';

async function handleCheckoutCompleted(session: any) {
  const flowId: string = session.metadata?.flow_id || `wh_${session.id}`;
  // Add-on Images : event existant, on étend juste le quota/expire_at
  if (session.metadata?.addon_type === 'addon_images') {
    const eventId = session.metadata?.event_id;
    if (!eventId) {
      console.error('addon_images session without event_id metadata', session.id);
      await logFlow({ flowId, step: 'webhook_addon', status: 'error', stripeSessionId: session.id, errorCode: 'missing_event_id' });
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
      await logFlow({ flowId, step: 'webhook_addon', status: 'error', stripeSessionId: session.id, eventId, errorCode: 'apply_addon_failed', errorMessage: error.message });
      throw error;
    }
    await logFlow({ flowId, step: 'webhook_addon', status: 'success', stripeSessionId: session.id, eventId });
    return;
  }

  const pendingId = session.metadata?.pending_id;
  const planCode: string | null = session.metadata?.plan_code ?? null;
  if (!pendingId) {
    console.error('checkout.session.completed without pending_id metadata', session.id);
    await logFlow({ flowId, step: 'webhook_checkout', status: 'error', stripeSessionId: session.id, planCode, errorCode: 'missing_pending_id' });
    return;
  }

  const paidAmount = typeof session.amount_total === 'number' ? session.amount_total : 0;
  await logFlow({ flowId, step: 'webhook_checkout_received', status: 'info', stripeSessionId: session.id, pendingId, planCode, context: { paidAmount } });

  const { data: result, error } = await supabaseAdmin.rpc('create_event_from_pending', {
    _pending_id: pendingId,
    _stripe_session_id: session.id,
    _paid_amount_cents: paidAmount,
  });
  if (error) {
    console.error('create_event_from_pending failed', error);
    await logFlow({ flowId, step: 'webhook_event_created', status: 'error', stripeSessionId: session.id, pendingId, planCode, errorCode: 'create_event_failed', errorMessage: error.message });
    throw error;
  }

  const created = result as unknown as { event_id: string; slug: string; already_created?: boolean };
  if (created.already_created) {
    console.log('event already created, skipping post-create steps', created.event_id);
    await logFlow({ flowId, step: 'webhook_event_created', status: 'info', stripeSessionId: session.id, pendingId, planCode, eventId: created.event_id, slug: created.slug, context: { already_created: true } });
    return;
  }
  await logFlow({ flowId, step: 'webhook_event_created', status: 'success', stripeSessionId: session.id, pendingId, planCode, eventId: created.event_id, slug: created.slug });
  // No magic-link email is sent: first-time users will be redirected by the
  // success page to /set-password to define their initial password.
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