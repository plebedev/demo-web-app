// @vitest-environment node
import http from 'node:http';
import type { AddressInfo } from 'node:net';

import { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { GET as backendHealth } from '@/app/api/backend-health/route';
import {
  GET as bffGet,
  HEAD as bffHead,
  POST as bffPost,
} from '@/app/api/bff/[...path]/route';

let server: http.Server | null = null;

async function startBackend(handler: http.RequestListener): Promise<string> {
  server = http.createServer(handler);
  await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

function context(path: string[]) {
  return { params: Promise.resolve({ path }) };
}

afterEach(async () => {
  vi.unstubAllEnvs();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server!.close(() => resolve()));
    server = null;
  }
});

describe('BFF catch-all route', () => {
  it('returns 503 when no backend is configured', async () => {
    vi.stubEnv('BACKEND_BASE_URL', '');
    vi.stubEnv('BACKEND_CLUSTER_URL', '');
    vi.stubEnv('BACKEND_LOCAL_URL', '');

    const response = await bffGet(
      new NextRequest('http://app.local/api/bff/runs'),
      context(['runs']),
    );

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Backend base URL is not configured',
    });
  });

  it('proxies to the configured base URL with repeated query params', async () => {
    let seenUrl = '';
    let seenAuth: string | undefined;
    const backendUrl = await startBackend((req, res) => {
      seenUrl = req.url ?? '';
      seenAuth = req.headers.authorization;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"runs":[]}');
    });
    vi.stubEnv('BACKEND_BASE_URL', `${backendUrl}/api`);

    const response = await bffGet(
      new NextRequest('http://app.local/api/bff/runs/7/events?a=1&a=2', {
        headers: { authorization: 'Bearer tok' },
      }),
      context(['runs', '7', 'events']),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ runs: [] });
    expect(seenUrl).toBe('/api/runs/7/events?a=1&a=2');
    expect(seenAuth).toBe('Bearer tok');
  });

  it('streams POST bodies through to the backend', async () => {
    let seenBody = '';
    let seenType: string | undefined;
    const backendUrl = await startBackend((req, res) => {
      seenType = req.headers['content-type'];
      const chunks: Buffer[] = [];
      req.on('data', (chunk: Buffer) => chunks.push(chunk));
      req.on('end', () => {
        seenBody = Buffer.concat(chunks).toString();
        res.writeHead(201);
        res.end();
      });
    });
    vi.stubEnv('BACKEND_BASE_URL', `${backendUrl}/api`);

    const form = new FormData();
    form.set('title', 'Notes');
    form.set('files', new File(['hello file'], 'notes.txt'));
    const outgoing = new Request('http://app.local/api/bff/runs/7/ingest', {
      method: 'POST',
      body: form,
    });

    const response = await bffPost(
      new NextRequest(outgoing.url, {
        method: 'POST',
        headers: outgoing.headers,
        body: outgoing.body,
        duplex: 'half',
      } as ConstructorParameters<typeof NextRequest>[1]),
      context(['runs', '7', 'ingest']),
    );

    expect(response.status).toBe(201);
    expect(seenType).toMatch(/^multipart\/form-data; boundary=/);
    expect(seenBody).toContain('hello file');
    expect(seenBody).toContain('name="title"');
  });

  it('answers HEAD without a body', async () => {
    const backendUrl = await startBackend((_req, res) => {
      res.writeHead(200, { 'X-Total': '3' });
      res.end();
    });
    vi.stubEnv('BACKEND_BASE_URL', `${backendUrl}/api`);

    const response = await bffHead(
      new NextRequest('http://app.local/api/bff/runs', { method: 'HEAD' }),
      context(['runs']),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('x-total')).toBe('3');
    expect(response.body).toBeNull();
  });

  it('applies BFF_UPSTREAM_TIMEOUT_MS and returns 504 on timeout', async () => {
    const backendUrl = await startBackend(() => {
      // never respond
    });
    vi.stubEnv('BACKEND_BASE_URL', `${backendUrl}/api`);
    vi.stubEnv('BFF_UPSTREAM_TIMEOUT_MS', '100');

    const response = await bffGet(
      new NextRequest('http://app.local/api/bff/slow'),
      context(['slow']),
    );

    expect(response.status).toBe(504);
    expect(await response.text()).not.toContain(backendUrl);
  });

  it('rejects paths that would leave the configured backend', async () => {
    vi.stubEnv('BACKEND_BASE_URL', 'http://backend.internal/api');

    const response = await bffGet(
      new NextRequest('http://app.local/api/bff/x'),
      context(['http:', '', 'evil.example']),
    );

    expect(response.status).toBe(400);
    expect(await response.text()).not.toContain('backend.internal');
  });
});

describe('backend health route', () => {
  it('reports ok when the backend health endpoint succeeds', async () => {
    let seenPath = '';
    const backendUrl = await startBackend((req, res) => {
      seenPath = req.url ?? '';
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"status":"healthy","details":"x"}');
    });
    vi.stubEnv('BACKEND_BASE_URL', `${backendUrl}/api`);

    const response = await backendHealth(
      new Request('http://app.local/api/backend-health'),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    expect(seenPath).toBe('/health');
  });

  it('follows backend redirects as before', async () => {
    const backendUrl = await startBackend((req, res) => {
      if (req.url === '/health') {
        res.writeHead(307, { Location: '/health/' });
        res.end();
        return;
      }
      res.writeHead(200);
      res.end('ok');
    });
    vi.stubEnv('BACKEND_BASE_URL', `${backendUrl}/api`);

    const response = await backendHealth(
      new Request('http://app.local/api/backend-health'),
    );

    expect(response.status).toBe(200);
  });

  it('mirrors a failing backend status', async () => {
    const backendUrl = await startBackend((_req, res) => {
      res.writeHead(500);
      res.end('boom');
    });
    vi.stubEnv('BACKEND_BASE_URL', `${backendUrl}/api`);

    const response = await backendHealth(
      new Request('http://app.local/api/backend-health'),
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: 'Backend health check failed with 500',
    });
  });

  it('returns 503 when the backend is unreachable or unconfigured', async () => {
    vi.stubEnv('BACKEND_BASE_URL', 'http://127.0.0.1:1/api');
    const unreachable = await backendHealth(
      new Request('http://app.local/api/backend-health'),
    );
    expect(unreachable.status).toBe(503);
    expect(await unreachable.json()).toEqual({
      error: 'Backend health endpoint is unreachable',
    });

    vi.stubEnv('BACKEND_BASE_URL', '');
    vi.stubEnv('BACKEND_CLUSTER_URL', '');
    vi.stubEnv('BACKEND_LOCAL_URL', '');
    const unconfigured = await backendHealth(
      new Request('http://app.local/api/backend-health'),
    );
    expect(unconfigured.status).toBe(503);
    expect(await unconfigured.json()).toEqual({
      error: 'Backend root URL is not configured',
    });
  });
});
