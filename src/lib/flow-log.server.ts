import { supabaseAdmin } from '@/integrations/supabase/client.server';

export type FlowLogStatus = 'info' | 'success' | 'error';

export type FlowLogInput = {
  flowId: string;
  step: string;
  status?: FlowLogStatus;
  email?: string | null;
  eventId?: string | null;
  slug?: string | null;
  planCode?: string | null;
  stripeSessionId?: string | null;
  pendingId?: string | null;
  errorCode?: string | null;
  errorMessage?: string | null;
  context?: Record<string, unknown> | null;
};

/**
 * Append a row to `event_flow_logs`. Never throws — instrumentation must not
 * break the user flow. Errors are logged via console.warn only.
 */
export async function logFlow(input: FlowLogInput): Promise<void> {
  try {
    if (!input.flowId || !input.step) return;
    const row = {
      flow_id: String(input.flowId).slice(0, 100),
      step: String(input.step).slice(0, 80),
      status: (input.status ?? 'info') as FlowLogStatus,
      email: input.email ? String(input.email).toLowerCase().slice(0, 255) : null,
      event_id: input.eventId ?? null,
      slug: input.slug ? String(input.slug).slice(0, 120) : null,
      plan_code: input.planCode ? String(input.planCode).slice(0, 40) : null,
      stripe_session_id: input.stripeSessionId ? String(input.stripeSessionId).slice(0, 255) : null,
      pending_id: input.pendingId ?? null,
      error_code: input.errorCode ? String(input.errorCode).slice(0, 120) : null,
      error_message: input.errorMessage ? String(input.errorMessage).slice(0, 1000) : null,
      context: input.context ?? null,
    };
    const { error } = await supabaseAdmin.from('event_flow_logs' as never).insert(row as never);
    if (error) console.warn('[flow-log] insert failed', error.message);
  } catch (e) {
    console.warn('[flow-log] unexpected error', e);
  }
}