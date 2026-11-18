// @vitest-environment node
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_UPSTREAM_TIMEOUT_MS,
  buildUpstreamUrl,
  resolveUpstreamTimeoutMs,
  reverseProxy,
  stripHopByHopHeaders,
} from '@/lib/server/reverse-proxy';

type Backend = {
  url: string;
  server: http.Server;
  close: () => Promise<void>;
};

async function startBackend(handler: http.RequestListener): Promise<Backend> {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    server,
    close: () =>
      new Promise<void>((resolve) => {
        server.closeAllConnections();
        server.close(() => resolve());
      }),
  };
}

function readAll(req: http.IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function streamingRequest(
  url: string,
  body: ReadableStream<Uint8Array>,
  init: { headers?: HeadersInit; signal?: AbortSignal } = {},
): Request {
  return new Request(url, {
    method: 'POST',
    body,
    headers: init.headers,
    signal: init.signal,
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

let backend: Backend | null = null;

afterEach(async () => {
  await backend?.close();
  backend = null;
  vi.unstubAllEnvs();
});

describe('resolveUpstreamTimeoutMs', () => {
  it('defaults to 30000 ms when missing or invalid', () => {
    expect(DEFAULT_UPSTREAM_TIMEOUT_MS).toBe(30_000);
    for (const value of [undefined, '', 'abc', '0', '-5', '1.5', '10ms']) {
      expect(resolveUpstreamTimeoutMs({ BFF_UPSTREAM_TIMEOUT_MS: value })).toBe(
        30_000,
      );
    }
  });

  it('uses a valid configured value', () => {
    expect(resolveUpstreamTimeoutMs({ BFF_UPSTREAM_TIMEOUT_MS: '2500' })).toBe(
      2500,
    );
    expect(
      resolveUpstreamTimeoutMs({ BFF_UPSTREAM_TIMEOUT_MS: ' 120000 ' }),
    ).toBe(120_000);
  });
});

describe('buildUpstreamUrl', () => {
  it('joins the path below the backend base and keeps repeated params', () => {
    const url = buildUpstreamUrl(
      'http://backend:8000/api/',
      ['runs', '7', 'events'],
      new URLSearchParams('tag=a&tag=b&limit=5'),
    );
    expect(url?.toString()).toBe(
      'http://backend:8000/api/runs/7/events?tag=a&tag=b&limit=5',
    );
  });

  it('refuses paths that escape the configured backend', () => {
    expect(
      buildUpstreamUrl(
        'http://backend:8000/api',
        ['http:', '', 'evil.example', 'x'],
        new URLSearchParams(),
      ),
    ).toBeNull();
    expect(
      buildUpstreamUrl(
        'http://backend:8000/api',
        ['..', 'admin'],
        new URLSearchParams(),
      ),
    ).toBeNull();
  });
});

describe('stripHopByHopHeaders', () => {
  it('removes standard hop-by-hop headers and those named by Connection', () => {
    const headers = new Headers({
      connection: 'keep-alive, X-Hop-Secret',
      'keep-alive': 'timeout=5',
      'transfer-encoding': 'chunked',
      upgrade: 'websocket',
      te: 'trailers',
      trailer: 'x-checksum',
      'proxy-authorization': 'Basic abc',
      'x-hop-secret': 'drop me',
      'content-type': 'application/json',
      authorization: 'Bearer keep',
    });
    const result = stripHopByHopHeaders(headers);
    expect(Array.from(result.keys()).sort()).toEqual([
      'authorization',
      'content-type',
    ]);
  });
});

describe('reverseProxy', () => {
  it('forwards method, path, query, body and end-to-end headers', async () => {
    let seen: {
      method?: string;
      url?: string;
      headers: http.IncomingHttpHeaders;
      body: string;
    } = { headers: {}, body: '' };
    backend = await startBackend(async (req, res) => {
      seen = {
        method: req.method,
        url: req.url,
        headers: req.headers,
        body: (await readAll(req)).toString(),
      };
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Custom', 'yes');
      res.setHeader('Set-Cookie', ['a=1; Path=/', 'b=2; Path=/']);
      res.statusCode = 201;
      res.end('{"created":true}');
    });

    const target = buildUpstreamUrl(
      `${backend.url}/api`,
      ['runs', '7'],
      new URLSearchParams('x=1&x=2'),
    )!;
    const request = new Request('https://app.example/api/bff/runs/7?x=1&x=2', {
      method: 'PATCH',
      body: '{"title":"t"}',
      headers: {
        authorization: 'Bearer tok',
        'content-type': 'application/json',
        host: 'app.example',
        'x-request-id': 'req-1',
        'keep-alive': 'timeout=5',
        'x-per-hop': 'secret',
        connection: 'x-per-hop',
        te: 'trailers',
      },
    });

    const response = await reverseProxy(request, target, { timeoutMs: 5000 });

    expect(response.status).toBe(201);
    expect(await response.text()).toBe('{"created":true}');
    expect(response.headers.get('x-custom')).toBe('yes');
    expect(response.headers.get('content-type')).toBe('application/json');
    expect(response.headers.getSetCookie()).toEqual([
      'a=1; Path=/',
      'b=2; Path=/',
    ]);

    expect(seen.method).toBe('PATCH');
    expect(seen.url).toBe('/api/runs/7?x=1&x=2');
    expect(seen.body).toBe('{"title":"t"}');
    expect(seen.headers.authorization).toBe('Bearer tok');
    expect(seen.headers['x-request-id']).toBe('req-1');
    expect(seen.headers['x-forwarded-host']).toBe('app.example');
    expect(seen.headers['x-forwarded-proto']).toBe('https');
    expect(seen.headers.host).not.toBe('app.example');
    expect(seen.headers['x-per-hop']).toBeUndefined();
    expect(seen.headers['keep-alive']).toBeUndefined();
    expect(seen.headers.te).toBeUndefined();
  });

  it('strips hop-by-hop response headers, including Connection-named ones', async () => {
    backend = await startBackend((_req, res) => {
      res.setHeader('Connection', 'keep-alive, X-Backend-Hop');
      res.setHeader('Keep-Alive', 'timeout=5');
      res.setHeader('X-Backend-Hop', 'internal');
      res.setHeader('X-End-To-End', 'kept');
      res.write('chunk-1;');
      res.end('chunk-2');
    });

    const response = await reverseProxy(
      new Request('http://app.local/api/bff/stream'),
      new URL(`${backend.url}/api/stream`),
      { timeoutMs: 5000 },
    );

    expect(await response.text()).toBe('chunk-1;chunk-2');
    expect(response.headers.get('x-end-to-end')).toBe('kept');
    expect(response.headers.has('x-backend-hop')).toBe(false);
    expect(response.headers.has('keep-alive')).toBe(false);
    expect(response.headers.has('connection')).toBe(false);
    expect(response.headers.has('transfer-encoding')).toBe(false);
  });

  it('passes redirects and error statuses through untouched', async () => {
    backend = await startBackend((req, res) => {
      if (req.url === '/api/old') {
        res.writeHead(302, { Location: '/api/new' });
        res.end();
        return;
      }
      res.writeHead(422, { 'Content-Type': 'application/json' });
      res.end('{"detail":"Invalid input."}');
    });

    const redirect = await reverseProxy(
      new Request('http://app.local/api/bff/old'),
      new URL(`${backend.url}/api/old`),
      { timeoutMs: 5000 },
    );
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('location')).toBe('/api/new');

    const invalid = await reverseProxy(
      new Request('http://app.local/api/bff/thing', {
        method: 'POST',
        body: '{}',
      }),
      new URL(`${backend.url}/api/thing`),
      { timeoutMs: 5000 },
    );
    expect(invalid.status).toBe(422);
    expect(await invalid.json()).toEqual({ detail: 'Invalid input.' });
  });

  it('returns 504 on upstream timeout without leaking the backend URL', async () => {
    backend = await startBackend(() => {
      // Never respond.
    });

    const response = await reverseProxy(
      new Request('http://app.local/api/bff/slow'),
      new URL(`${backend.url}/api/slow`),
      { timeoutMs: 100 },
    );

    expect(response.status).toBe(504);
    const text = await response.text();
    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toContain(backend.url);
  });

  it('returns 502 when the backend cannot be reached', async () => {
    const closed = await startBackend(() => {});
    const deadUrl = closed.url;
    await closed.close();

    const response = await reverseProxy(
      new Request('http://app.local/api/bff/x'),
      new URL(`${deadUrl}/api/x`),
      { timeoutMs: 5000 },
    );

    expect(response.status).toBe(502);
    const text = await response.text();
    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toContain('ECONNREFUSED');
  });

  it('cancels the upstream request when the client disconnects', async () => {
    let upstreamClosed!: () => void;
    const closedPromise = new Promise<void>((resolve) => {
      upstreamClosed = resolve;
    });
    let received!: () => void;
    const receivedPromise = new Promise<void>((resolve) => {
      received = resolve;
    });
    backend = await startBackend((req, res) => {
      received();
      res.on('close', () => upstreamClosed());
      req.resume();
    });

    const client = new AbortController();
    const pending = reverseProxy(
      new Request('http://app.local/api/bff/hang', { signal: client.signal }),
      new URL(`${backend.url}/api/hang`),
      { timeoutMs: 30_000 },
    );
    await receivedPromise;
    client.abort();

    await closedPromise;
    const response = await pending;
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('streams uploads: the backend sees the first chunk before the last is produced', async () => {
    let firstChunkSeen!: () => void;
    const firstChunkPromise = new Promise<void>((resolve) => {
      firstChunkSeen = resolve;
    });
    backend = await startBackend((req, res) => {
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
        firstChunkSeen();
      });
      req.on('end', () => {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(Buffer.concat(chunks).toString());
      });
    });

    const encoder = new TextEncoder();
    let step = 0;
    const body = new ReadableStream<Uint8Array>({
      async pull(controller) {
        if (step === 0) {
          step = 1;
          controller.enqueue(encoder.encode('first-chunk|'));
          return;
        }
        // Withhold the final chunk until the backend has the first one.
        // A buffering proxy would never forward it, so this would hang.
        await firstChunkPromise;
        controller.enqueue(encoder.encode('final-chunk'));
        controller.close();
      },
    });

    const deadlock = new Promise<never>((_, reject) => {
      setTimeout(
        () => reject(new Error('upload was buffered instead of streamed')),
        5000,
      ).unref();
    });
    const response = await Promise.race([
      reverseProxy(
        streamingRequest('http://app.local/api/bff/upload', body),
        new URL(`${backend.url}/api/upload`),
        { timeoutMs: 10_000 },
      ),
      deadlock,
    ]);

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('first-chunk|final-chunk');
  });

  it('streams responses: the client gets the first chunk before the backend finishes', async () => {
    let finish!: () => void;
    const finishPromise = new Promise<void>((resolve) => {
      finish = resolve;
    });
    backend = await startBackend(async (_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.write('head|');
      await finishPromise;
      res.end('tail');
    });

    const response = await reverseProxy(
      new Request('http://app.local/api/bff/download'),
      new URL(`${backend.url}/api/download`),
      { timeoutMs: 5000 },
    );
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toBe('head|');
    finish();
    let rest = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }
      rest += new TextDecoder().decode(value);
    }
    expect(rest).toBe('tail');
  });
});

describe('reverseProxy memory', () => {
  let gc: () => void;

  beforeEach(() => {
    setFlagsFromString('--expose-gc');
    gc = runInNewContext('gc') as () => void;
  });

  it('proxies a 64 MiB upload with < 48 MiB peak additional ArrayBuffer memory', async () => {
    const MiB = 1024 * 1024;
    const totalBytes = 64 * MiB;
    const chunkBytes = 64 * 1024;
    const gcEveryBytes = 2 * MiB;

    let peak = 0;
    const sample = () => {
      const current = process.memoryUsage().arrayBuffers;
      if (current > peak) {
        peak = current;
      }
    };

    let received = 0;
    backend = await startBackend((req, res) => {
      req.on('data', (chunk: Buffer) => {
        received += chunk.length;
        sample();
      });
      req.on('end', () => {
        sample();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ received }));
      });
    });

    gc();
    const baseline = process.memoryUsage().arrayBuffers;
    peak = baseline;

    let produced = 0;
    let sinceGc = 0;
    const body = new ReadableStream<Uint8Array>(
      {
        pull(controller) {
          sample();
          if (produced >= totalBytes) {
            controller.close();
            return;
          }
          const size = Math.min(chunkBytes, totalBytes - produced);
          controller.enqueue(new Uint8Array(size).fill(produced % 251));
          produced += size;
          sinceGc += size;
          if (sinceGc >= gcEveryBytes) {
            // Collect chunks that were already forwarded so that only
            // memory actually retained by the proxy shows up in the peak.
            sinceGc = 0;
            gc();
          }
        },
      },
      { highWaterMark: 0 },
    );

    const response = await reverseProxy(
      streamingRequest('http://app.local/api/bff/big-upload', body, {
        headers: { 'content-type': 'application/octet-stream' },
      }),
      new URL(`${backend.url}/api/big-upload`),
      { timeoutMs: 120_000 },
    );
    const payload = (await response.json()) as { received: number };
    sample();

    expect(response.status).toBe(200);
    expect(payload.received).toBe(totalBytes);
    expect(produced).toBe(totalBytes);
    const additional = peak - baseline;
    expect(additional).toBeLessThan(48 * MiB);
  }, 120_000);
});
