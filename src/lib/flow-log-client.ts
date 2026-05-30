import { logFlowEvent } from './flow-log.functions';

const KEY = 'kapsul_flow_id';

export function getOrCreateFlowId(): string {
  if (typeof window === 'undefined') return 'ssr';
  try {
    let id = sessionStorage.getItem(KEY);
    if (!id) {
      id =
        typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : `flow_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(KEY, id);
    }
    return id;
  } catch {
    return `flow_${Date.now()}`;
  }
}

export function getFlowId(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearFlowId(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* noop */
  }
}

export type ClientLogPayload = {
  step: string;
  status?: 'info' | 'success' | 'error';
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
 * Fire-and-forget client logger. Auto-creates a flow_id if missing.
 * Never throws — best-effort observability only.
 */
export function logFlowClient(payload: ClientLogPayload): void {
  try {
    const flowId = getOrCreateFlowId();
    void logFlowEvent({ data: { flowId, ...payload } }).catch((e) => {
      console.warn('[flow-log-client] failed', e);
    });
  } catch (e) {
    console.warn('[flow-log-client] unexpected', e);
  }
}