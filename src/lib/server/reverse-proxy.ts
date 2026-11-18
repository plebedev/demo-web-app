/**
 * Server-only streaming reverse proxy used by the BFF route handlers.
 *
 * Request and response bodies are streamed end to end; nothing here buffers
 * a whole body in memory. Hop-by-hop headers (including any named by the
 * Connection header) are stripped in both directions. The upstream request
 * is cancelled when the client disconnects or the upstream timeout elapses.
 *
 * Server-only: import it from route handlers, never from client components.
 * Upstream traffic uses node:http(s) directly rather than the global fetch,
 * which can retain streamed request bodies and transparently decompresses
 * responses (leaving Content-Encoding/Content-Length out of sync).
 */

import http from 'node:http';
import https from 'node:https';
import { Readable, pipeline } from 'node:stream';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';

export const DEFAULT_UPSTREAM_TIMEOUT_MS = 30_000;

/** Headers that only apply to a single transport-level connection. */
const HOP_BY_HOP_HEADERS = [
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'proxy-connection',
  'te',
  'trailer',
  'trailers',
  'transfer-encoding',
  'upgrade',
  // `Expect: 100-continue` is negotiated per connection by the Node server.
  'expect',
];

export class UpstreamTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Upstream request timed out after ${timeoutMs} ms`);
    this.name = 'UpstreamTimeoutError';
  }
}

export class UpstreamAbortedError extends Error {
  constructor() {
    super('Client disconnected before the upstream request completed');
    this.name = 'UpstreamAbortedError';
  }
}

export class UpstreamConnectionError extends Error {
  constructor(cause: unknown) {
    super('Upstream request failed');
    this.name = 'UpstreamConnectionError';
    (this as { cause?: unknown }).cause = cause;
  }
}

/**
 * Reads BFF_UPSTREAM_TIMEOUT_MS, falling back to 30000 ms when it is missing
 * or not a positive integer.
 */
export function resolveUpstreamTimeoutMs(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.BFF_UPSTREAM_TIMEOUT_MS?.trim();
  if (!raw || !/^\d+$/.test(raw)) {
    return DEFAULT_UPSTREAM_TIMEOUT_MS;
  }
  const value = Number(raw);
  return Number.isSafeInteger(value) && value > 0
    ? value
    : DEFAULT_UPSTREAM_TIMEOUT_MS;
}

/** Copies headers, dropping hop-by-hop headers and those named by Connection. */
export function stripHopByHopHeaders(source: Headers): Headers {
  const remove = new Set(HOP_BY_HOP_HEADERS);
  const connection = source.get('connection');
  if (connection) {
    for (const token of connection.split(',')) {
      const name = token.trim().toLowerCase();
      if (name) {
        remove.add(name);
      }
    }
  }

  const result = new Headers();
  source.forEach((value, name) => {
    if (
      !remove.has(name.toLowerCase()) &&
      name.toLowerCase() !== 'set-cookie'
    ) {
      result.append(name, value);
    }
  });
  // Headers#forEach joins Set-Cookie values; copy them individually.
  if (!remove.has('set-cookie')) {
    for (const cookie of getSetCookies(source)) {
      result.append('set-cookie', cookie);
    }
  }
  return result;
}

function getSetCookies(headers: Headers): string[] {
  const withGetter = headers as Headers & { getSetCookie?: () => string[] };
  if (typeof withGetter.getSetCookie === 'function') {
    return withGetter.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

/**
 * Resolves the upstream URL for a proxied path below `baseUrl`, appending
 * every query parameter (including repeated ones) in order. Returns null if
 * the path would escape the configured backend origin or base path.
 */
export function buildUpstreamUrl(
  baseUrl: string,
  path: readonly string[],
  searchParams: URLSearchParams,
): URL | null {
  const base = new URL(`${baseUrl.replace(/\/$/, '')}/`);
  const target = new URL(path.join('/'), base);
  if (
    target.origin !== base.origin ||
    !target.pathname.startsWith(base.pathname)
  ) {
    return null;
  }
  target.search = '';
  searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });
  return target;
}

export type UpstreamRequestInit = {
  method: string;
  headers: Headers;
  body?: ReadableStream<Uint8Array> | null;
  /** Aborts the upstream request (e.g. the client disconnected). */
  signal?: AbortSignal;
  timeoutMs?: number;
  /**
   * 'manual' (default) hands redirects to the caller untouched. 'follow'
   * follows them, which is only supported for requests without a body.
   */
  redirect?: 'manual' | 'follow';
};

const MAX_REDIRECTS = 20;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const NULL_BODY_STATUSES = new Set([204, 205, 304]);
/** Bytes of upstream response body buffered before pausing the socket. */
const RESPONSE_HIGH_WATER_MARK = 64 * 1024;

function toOutgoingHeaders(headers: Headers): http.OutgoingHttpHeaders {
  const outgoing: http.OutgoingHttpHeaders = {};
  headers.forEach((value, name) => {
    outgoing[name] = value;
  });
  return outgoing;
}

function toWebHeaders(rawHeaders: string[]): Headers {
  const headers = new Headers();
  for (let index = 0; index + 1 < rawHeaders.length; index += 2) {
    try {
      headers.append(rawHeaders[index], rawHeaders[index + 1]);
    } catch {
      // Skip header values the Fetch API cannot represent.
    }
  }
  return headers;
}

/**
 * Exposes an upstream IncomingMessage as a web stream with backpressure:
 * the socket is paused whenever the consumer falls behind.
 */
function toWebBody(
  message: http.IncomingMessage,
  onCancel: () => void,
): ReadableStream<Uint8Array> {
  let finished = false;
  return new ReadableStream<Uint8Array>(
    {
      start(controller) {
        message.on('data', (chunk: Buffer) => {
          if (finished) {
            return;
          }
          controller.enqueue(
            new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength),
          );
          if ((controller.desiredSize ?? 0) <= 0) {
            message.pause();
          }
        });
        message.on('end', () => {
          if (!finished) {
            finished = true;
            controller.close();
          }
        });
        message.on('error', (error) => {
          if (!finished) {
            finished = true;
            controller.error(error);
          }
        });
        message.on('close', () => {
          if (!finished) {
            finished = true;
            controller.error(new Error('Upstream response ended prematurely'));
          }
        });
      },
      pull() {
        message.resume();
      },
      cancel() {
        finished = true;
        message.destroy();
        onCancel();
      },
    },
    new ByteLengthQueuingStrategy({ highWaterMark: RESPONSE_HIGH_WATER_MARK }),
  );
}

type SingleRequest = {
  url: URL;
  method: string;
  headers: Headers;
  body: ReadableStream<Uint8Array> | null;
  signal: AbortSignal;
};

/** One HTTP exchange; resolves once the response headers have arrived. */
function sendOnce({
  url,
  method,
  headers,
  body,
  signal,
}: SingleRequest): Promise<Response> {
  return new Promise<Response>((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const outgoing = transport.request(url, {
      method,
      headers: toOutgoingHeaders(headers),
    });

    let settled = false;
    const fail = (error: unknown) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    };
    const abort = () => {
      const error = new UpstreamAbortedError();
      outgoing.destroy(error);
      fail(error);
    };
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener('abort', abort, { once: true });

    outgoing.on('error', fail);
    outgoing.on('response', (incoming) => {
      if (settled) {
        incoming.destroy();
        return;
      }
      settled = true;
      // From here on, aborting cancels the response body stream.
      signal.addEventListener('abort', () => incoming.destroy(), {
        once: true,
      });

      const status = incoming.statusCode ?? 502;
      const responseHeaders = toWebHeaders(incoming.rawHeaders);
      const hasBody = method !== 'HEAD' && !NULL_BODY_STATUSES.has(status);
      if (!hasBody) {
        incoming.resume();
      }
      try {
        resolve(
          new Response(
            hasBody ? toWebBody(incoming, () => outgoing.destroy()) : null,
            {
              status,
              statusText: incoming.statusMessage ?? '',
              headers: responseHeaders,
            },
          ),
        );
      } catch (error) {
        incoming.destroy();
        reject(new UpstreamConnectionError(error));
      }
    });

    if (body) {
      // Stream the request body with backpressure; nothing is buffered.
      pipeline(
        Readable.fromWeb(body as NodeReadableStream<Uint8Array>),
        outgoing,
        (error) => {
          if (error) {
            outgoing.destroy(error);
            fail(error);
          }
        },
      );
    } else {
      outgoing.end();
    }
  });
}

/**
 * Sends a streaming request upstream. The timeout covers the time until the
 * upstream response headers arrive (including the upload); once a response
 * starts streaming only `signal` can cancel it.
 *
 * Rejects with UpstreamTimeoutError, UpstreamAbortedError or
 * UpstreamConnectionError.
 */
export async function fetchUpstream(
  url: URL | string,
  init: UpstreamRequestInit,
): Promise<Response> {
  const timeoutMs = init.timeoutMs ?? resolveUpstreamTimeoutMs();
  const controller = new AbortController();
  let timedOut = false;

  // Client aborts stay linked for the life of the response body.
  const onClientAbort = () => controller.abort();
  if (init.signal?.aborted) {
    controller.abort();
  } else {
    init.signal?.addEventListener('abort', onClientAbort, { once: true });
  }
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const method = init.method.toUpperCase();
  const body =
    init.body && method !== 'GET' && method !== 'HEAD' ? init.body : null;
  const follow = init.redirect === 'follow' && body === null;

  try {
    let target = new URL(url);
    for (let redirects = 0; ; redirects += 1) {
      const response = await sendOnce({
        url: target,
        method,
        headers: init.headers,
        body,
        signal: controller.signal,
      });
      const location = response.headers.get('location');
      if (
        !follow ||
        !REDIRECT_STATUSES.has(response.status) ||
        !location ||
        redirects >= MAX_REDIRECTS
      ) {
        return response;
      }
      await response.body?.cancel();
      target = new URL(location, target);
    }
  } catch (error) {
    if (timedOut) {
      throw new UpstreamTimeoutError(timeoutMs);
    }
    if (init.signal?.aborted || error instanceof UpstreamAbortedError) {
      throw new UpstreamAbortedError();
    }
    throw new UpstreamConnectionError(error);
  } finally {
    clearTimeout(timer);
  }
}

export type ReverseProxyOptions = {
  timeoutMs?: number;
};

function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status });
}

/**
 * Proxies `request` to `targetUrl`, streaming both bodies and returning the
 * upstream status, end-to-end headers and body unchanged. Redirects are
 * passed through to the client rather than followed.
 */
export async function reverseProxy(
  request: Request,
  targetUrl: URL,
  options: ReverseProxyOptions = {},
): Promise<Response> {
  const incomingUrl = new URL(request.url);
  const headers = stripHopByHopHeaders(request.headers);
  headers.set('x-forwarded-host', request.headers.get('host') || '');
  headers.set('x-forwarded-proto', incomingUrl.protocol.replace(':', ''));
  headers.delete('host');

  let upstream: Response;
  try {
    upstream = await fetchUpstream(targetUrl, {
      method: request.method,
      headers,
      body: request.body,
      signal: request.signal,
      timeoutMs: options.timeoutMs,
    });
  } catch (error) {
    if (error instanceof UpstreamTimeoutError) {
      return jsonError(504, 'Upstream request timed out');
    }
    if (error instanceof UpstreamAbortedError) {
      // The client is gone; this response will not be delivered.
      return new Response(null, { status: 499 });
    }
    return jsonError(502, 'Upstream request failed');
  }

  const nullBody =
    NULL_BODY_STATUSES.has(upstream.status) || request.method === 'HEAD';
  return new Response(nullBody ? null : upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: stripHopByHopHeaders(upstream.headers),
  });
}
