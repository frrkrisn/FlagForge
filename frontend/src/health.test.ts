import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHealth } from './health';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fetchHealth', () => {
  it('unwraps the { ok, data } success envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: true, data: { status: 'up', version: '0.1.0' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(fetchHealth()).resolves.toEqual({ status: 'up', version: '0.1.0' });
  });

  it('throws with the server message on a failure envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ ok: false, error: { code: 'INTERNAL', message: 'boom' } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(fetchHealth()).rejects.toThrow('boom');
  });

  it('throws on a non-2xx HTTP status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 503 })),
    );
    await expect(fetchHealth()).rejects.toThrow('HTTP 503');
  });
});
