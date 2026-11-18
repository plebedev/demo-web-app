import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  ApiAbortError,
  ApiError,
  ApiParseError,
  ApiTimeoutError,
  getErrorMessage,
  isAbortError,
  requestJson,
  requestText,
  requestVoid,
} from '@/lib/api/http';

type FetchArgs = [RequestInfo | URL, RequestInit | undefined];

function stubFetch(
  impl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
) {
  const mock = vi.fn(impl);
  vi.stubGlobal('fetch', mock);
  return mock;
}

/** A fetch that never answers on its own and rejects once aborted. */
function hangingFetch() {
  return stubFetch(
    (_input, init) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        });
      }),
  );
}

function lastCall(mock: ReturnType<typeof stubFetch>): FetchArgs {
  return mock.mock.calls.at(-1) as FetchArgs;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('shared HTTP client', () => {
  it('sends GET requests with the bearer token and parses JSON', async () => {
    const fetchMock = stubFetch(async () => Response.json({ ok: true }));

    const result = await requestJson<{ ok: boolean }>('/api/bff/things', {
      accessToken: 'token-1',
      cache: 'no-store',
    });

    expect(result).toEqual({ ok: true });
    const [url, init] = lastCall(fetchMock);
    expect(url).toBe('/api/bff/things');
    expect(init?.method).toBe('GET');
    expect(init?.cache).toBe('no-store');
    expect(init?.body).toBeUndefined();
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer token-1');
    expect(headers.has('Content-Type')).toBe(false);
  });

  it('omits the Authorization header when no token is given', async () => {
    const fetchMock = stubFetch(async () => Response.json({}));

    await requestJson('/api/bff/experiences');

    expect(
      new Headers(lastCall(fetchMock)[1]?.headers).has('Authorization'),
    ).toBe(false);
  });

  it('serializes JSON bodies with a JSON content type', async () => {
    const fetchMock = stubFetch(async () => Response.json({ id: 3 }));

    await requestJson('/api/bff/runs', {
      method: 'POST',
      accessToken: 'tok',
      json: { title: 'x', tags: [1, 2] },
    });

    const [, init] = lastCall(fetchMock);
    expect(init?.method).toBe('POST');
    expect(init?.body).toBe('{"title":"x","tags":[1,2]}');
    expect(new Headers(init?.headers).get('Content-Type')).toBe(
      'application/json',
    );
  });

  it('sends FormData untouched and never sets a multipart content type', async () => {
    const fetchMock = stubFetch(async () => Response.json({ uploaded: true }));
    const form = new FormData();
    form.set('title', 'Notes');
    form.append('files', new File(['hello'], 'notes.txt'));

    await requestJson('/api/bff/runs/7/ingest', {
      method: 'POST',
      accessToken: 'tok',
      formData: form,
      headers: { 'Content-Type': 'application/json' },
    });

    const [, init] = lastCall(fetchMock);
    expect(init?.body).toBe(form);
    const headers = new Headers(init?.headers);
    expect(headers.has('Content-Type')).toBe(false);
    expect(headers.get('Authorization')).toBe('Bearer tok');
  });

  it('returns text responses verbatim', async () => {
    stubFetch(async () => new Response('plain body\nline 2', { status: 200 }));

    await expect(requestText('/api/bff/export')).resolves.toBe(
      'plain body\nline 2',
    );
  });

  it('treats successful responses without a body as undefined', async () => {
    stubFetch(async () => new Response(null, { status: 204 }));
    await expect(
      requestJson('/api/bff/rag/personas/1'),
    ).resolves.toBeUndefined();

    stubFetch(async () => new Response('', { status: 200 }));
    await expect(
      requestJson('/api/bff/rag/personas/1'),
    ).resolves.toBeUndefined();

    stubFetch(async () => new Response(null, { status: 204 }));
    await expect(
      requestVoid('/api/bff/rag/personas/1', { method: 'DELETE' }),
    ).resolves.toBeUndefined();
  });

  it('rejects unreadable success bodies with ApiParseError', async () => {
    stubFetch(async () => new Response('<html>', { status: 200 }));

    await expect(requestJson('/api/bff/runs')).rejects.toBeInstanceOf(
      ApiParseError,
    );
  });

  it('preserves backend error status, detail and body', async () => {
    stubFetch(async () =>
      Response.json(
        { detail: 'Invitation expired.', code: 'expired' },
        { status: 403, statusText: 'Forbidden' },
      ),
    );

    const error = await requestJson('/api/bff/access/redeem', {
      method: 'POST',
      json: { code: 'x' },
    }).catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ApiError);
    const apiError = error as ApiError;
    expect(apiError.status).toBe(403);
    expect(apiError.statusText).toBe('Forbidden');
    expect(apiError.detail).toBe('Invitation expired.');
    expect(apiError.message).toBe('Invitation expired.');
    expect(apiError.body).toEqual({
      detail: 'Invitation expired.',
      code: 'expired',
    });
  });

  it('uses the error field and keeps non-JSON error bodies as text', async () => {
    stubFetch(async () =>
      Response.json(
        { error: 'Backend base URL is not configured' },
        { status: 503 },
      ),
    );
    const configError = (await requestJson('/api/bff/x').catch(
      (caught: unknown) => caught,
    )) as ApiError;
    expect(configError.detail).toBe('Backend base URL is not configured');

    stubFetch(async () => new Response('Bad Gateway', { status: 502 }));
    const gatewayError = (await requestJson('/api/bff/x').catch(
      (caught: unknown) => caught,
    )) as ApiError;
    expect(gatewayError.status).toBe(502);
    expect(gatewayError.detail).toBeNull();
    expect(gatewayError.body).toBe('Bad Gateway');
    expect(gatewayError.message).toBe('Request failed with status 502');
  });

  it('never retries failed mutations', async () => {
    const fetchMock = stubFetch(async () => {
      throw new TypeError('Failed to fetch');
    });

    await expect(
      requestJson('/api/bff/runs/1/submit', { method: 'POST' }),
    ).rejects.toThrow('Failed to fetch');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const serverError = stubFetch(async () =>
      Response.json({ detail: 'boom' }, { status: 503 }),
    );
    await expect(
      requestJson('/api/bff/runs', { method: 'POST', json: {} }),
    ).rejects.toBeInstanceOf(ApiError);
    expect(serverError).toHaveBeenCalledTimes(1);
  });

  it('cancels a request through the caller signal', async () => {
    const fetchMock = hangingFetch();
    const controller = new AbortController();

    const pending = requestJson('/api/bff/runs', { signal: controller.signal });
    controller.abort();

    const error = await pending.catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiAbortError);
    expect(isAbortError(error)).toBe(true);
    expect(lastCall(fetchMock)[1]?.signal?.aborted).toBe(true);
  });

  it('does not call fetch when the signal is already aborted', async () => {
    const fetchMock = hangingFetch();
    const controller = new AbortController();
    controller.abort();

    await expect(
      requestJson('/api/bff/runs', { signal: controller.signal }),
    ).rejects.toBeInstanceOf(ApiAbortError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('fails with ApiTimeoutError when the timeout elapses', async () => {
    vi.useFakeTimers();
    const fetchMock = hangingFetch();

    const pending = requestJson('/api/bff/runs', { timeoutMs: 1000 });
    const assertion = expect(pending).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;

    expect(lastCall(fetchMock)[1]?.signal?.aborted).toBe(true);
    expect(isAbortError(await pending.catch((caught: unknown) => caught))).toBe(
      false,
    );
  });

  it('keeps the timeout active when a caller signal is also supplied', async () => {
    vi.useFakeTimers();
    hangingFetch();
    const controller = new AbortController();

    const pending = requestJson('/api/bff/runs', {
      signal: controller.signal,
      timeoutMs: 500,
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(500);
    await assertion;
    expect(controller.signal.aborted).toBe(false);
  });

  it('keeps caller cancellation working when a timeout is also supplied', async () => {
    vi.useFakeTimers();
    hangingFetch();
    const controller = new AbortController();

    const pending = requestJson('/api/bff/runs', {
      signal: controller.signal,
      timeoutMs: 60_000,
    });
    const assertion = expect(pending).rejects.toBeInstanceOf(ApiAbortError);
    controller.abort();
    await assertion;
    // The timer was cleared, so nothing fires later.
    expect(vi.getTimerCount()).toBe(0);
  });

  it('applies the timeout while the response body is still streaming', async () => {
    vi.useFakeTimers();
    stubFetch(async (_input, init) => {
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"partial":'));
          init?.signal?.addEventListener('abort', () => {
            controller.error(new DOMException('Aborted', 'AbortError'));
          });
        },
      });
      return new Response(body, { status: 200 });
    });

    const pending = requestJson('/api/bff/runs', { timeoutMs: 250 });
    const assertion = expect(pending).rejects.toBeInstanceOf(ApiTimeoutError);
    await vi.advanceTimersByTimeAsync(250);
    await assertion;
  });

  it('cleans up timers after a successful request', async () => {
    vi.useFakeTimers();
    stubFetch(async () => Response.json({ ok: true }));

    await requestJson('/api/bff/runs', { timeoutMs: 5000 });

    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('getErrorMessage', () => {
  it('prefers backend detail unless told otherwise', () => {
    const error = new ApiError(400, 'Bad Request', {}, 'Bad code.');
    expect(getErrorMessage(error, 'Fallback')).toBe('Bad code.');
    expect(getErrorMessage(error, 'Fallback', { preferDetail: false })).toBe(
      'Fallback',
    );
  });

  it('uses the fallback for detail-less backend errors and parse errors', () => {
    expect(getErrorMessage(new ApiError(500, '', null, null), 'Fallback')).toBe(
      'Fallback',
    );
    expect(getErrorMessage(new ApiParseError(200), 'Fallback')).toBe(
      'Fallback',
    );
    expect(getErrorMessage('weird', 'Fallback')).toBe('Fallback');
  });

  it('keeps messages from network failures and timeouts', () => {
    expect(getErrorMessage(new TypeError('Failed to fetch'), 'Fallback')).toBe(
      'Failed to fetch',
    );
    expect(getErrorMessage(new ApiTimeoutError(10), 'Fallback')).toBe(
      'Request timed out after 10 ms',
    );
  });
});
