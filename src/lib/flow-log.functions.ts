import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import { logFlow } from './flow-log.server';

// In-memory rate limit per flow_id (best-effort; resets on worker restart).
const counts = new Map<string, { n: number; t: number }>();
const MAX_PER_FLOW = 80;
const WINDOW_MS = 30 * 60 * 1000; // 30 minutes

function allow(flowId: string): boolean {
  const now = Date.now();
  const e = counts.get(flowId);
  if (!e || now - e.t > WINDOW_MS) {
    counts.set(flowId, { n: 1, t: now });
    return true;
  }
  e.n += 1;
  return e.n <= MAX_PER_FLOW;
}

const Schema = z.object({
  flowId: z.string().min(8).max(100),
  step: z.string().min(1).max(80),
  status: z.enum(['info', 'success', 'error']).optional(),
  email: z.string().email().max(255).optional().nullable(),
  eventId: z.string().uuid().optional().nullable(),
  slug: z.string().max(120).optional().nullable(),
  planCode: z.string().max(40).optional().nullable(),
  stripeSessionId: z.string().max(255).optional().nullable(),
  pendingId: z.string().uuid().optional().nullable(),
  errorCode: z.string().max(120).optional().nullable(),
  errorMessage: z.string().max(1000).optional().nullable(),
  context: z.record(z.string(), z.unknown()).optional().nullable(),
});

export const logFlowEvent = createServerFn({ method: 'POST' })
  .inputValidator((input) => Schema.parse(input))
  .handler(async ({ data }) => {
    if (!allow(data.flowId)) return { ok: false as const, reason: 'rate_limited' as const };
    await logFlow({
      flowId: data.flowId,
      step: data.step,
      status: data.status,
      email: data.email ?? null,
      eventId: data.eventId ?? null,
      slug: data.slug ?? null,
      planCode: data.planCode ?? null,
      stripeSessionId: data.stripeSessionId ?? null,
      pendingId: data.pendingId ?? null,
      errorCode: data.errorCode ?? null,
      errorMessage: data.errorMessage ?? null,
      context: data.context ?? null,
    });
    return { ok: true as const };
  });