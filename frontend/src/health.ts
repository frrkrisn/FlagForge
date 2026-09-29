// Minimal typed client for GET /api/health (Phase 0). The full typed API layer
// with zod schemas mirroring docs/api.md arrives in Prompt 7a.

export type HealthData = {
  status: string;
  version: string;
};

type SuccessEnvelope<T> = { ok: true; data: T };
type FailureEnvelope = { ok: false; error: { code: string; message: string } };
type Envelope<T> = SuccessEnvelope<T> | FailureEnvelope;

/** Fetch and unwrap the standard { ok, data } envelope for /api/health. */
export async function fetchHealth(signal?: AbortSignal): Promise<HealthData> {
  const res = await fetch('/api/health', { signal });
  if (!res.ok) {
    throw new Error(`health request failed: HTTP ${res.status}`);
  }
  const body = (await res.json()) as Envelope<HealthData>;
  if (!body.ok) {
    throw new Error(body.error?.message ?? 'health request returned an error');
  }
  return body.data;
}
