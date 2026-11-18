/**
 * Shared browser HTTP transport.
 *
 * Every browser-side request to the BFF goes through this module so that
 * authentication headers, body encoding, response parsing, error details,
 * timeouts and cancellation are handled in exactly one place. Components and
 * hooks should call the typed operations in `src/lib/api/*` instead of using
 * `fetch` directly.
 *
 * This client never retries automatically.
 */

export type HttpMethod =
  | 'GET'
  | 'HEAD'
  | 'POST'
  | 'PUT'
  | 'PATCH'
  | 'DELETE'
  | 'OPTIONS';

export type ResponseKind = 'json' | 'text' | 'none';

/** Options shared by every API operation. */
export type RequestControl = {
  /** Cancels the request when aborted. */
  signal?: AbortSignal;
  /** Fails the request with an {@link ApiTimeoutError} after this many ms. */
  timeoutMs?: number;
};

export type RequestOptions = RequestControl & {
  method?: HttpMethod;
  /** Sent as `Authorization: Bearer <token>` when present. */
  accessToken?: string | null;
  /** Serialized with JSON.stringify and sent as application/json. */
  json?: unknown;
  /** Sent as multipart/form-data; the browser sets the boundary. */
  formData?: FormData;
  /** Raw text body. */
  text?: string;
  headers?: HeadersInit;
  cache?: RequestCache;
};

/** The backend (or BFF) answered with a non-2xx status. */
export class ApiError extends Error {
  readonly status: number;
  readonly statusText: string;
  /** Parsed JSON error body, or the raw text when it was not JSON. */
  readonly body: unknown;
  /** Human readable detail supplied by the backend, if any. */
  readonly detail: string | null;

  constructor(
    status: number,
    statusText: string,
    body: unknown,
    detail: string | null,
  ) {
    super(detail ?? `Request failed with status ${status}`);
    this.name = 'ApiError';
    this.status = status;
    this.statusText = statusText;
    this.body = body;
    this.detail = detail;
  }
}

/** The request did not complete within the configured timeout. */
export class ApiTimeoutError extends Error {
  readonly timeoutMs: number;

  constructor(timeoutMs: number) {
    super(`Request timed out after ${timeoutMs} ms`);
    this.name = 'TimeoutError';
    this.timeoutMs = timeoutMs;
  }
}

/** The caller cancelled the request via its AbortSignal. */
export class ApiAbortError extends Error {
  constructor() {
    super('The request was cancelled.');
    this.name = 'AbortError';
  }
}

/** A successful response carried a body that could not be parsed. */
export class ApiParseError extends Error {
  readonly status: number;

  constructor(status: number) {
    super('The server returned an unreadable response.');
    this.name = 'ApiParseError';
    this.status = status;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/** True when the request was cancelled by its caller (not timed out). */
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof ApiAbortError ||
    (typeof error === 'object' &&
      error !== null &&
      (error as { name?: unknown }).name === 'AbortError')
  );
}

/**
 * Turns any request failure into a message for the UI.
 *
 * With `preferDetail` (the default) a string `detail`/`error` supplied by the
 * backend wins over the fallback. Backend failures without usable detail and
 * unreadable success bodies use the fallback. Other errors (network failures,
 * timeouts) keep their own message.
 */
export function getErrorMessage(
  error: unknown,
  fallback: string,
  options?: { preferDetail?: boolean },
): string {
  const preferDetail = options?.preferDetail !== false;
  if (error instanceof ApiError) {
    return preferDetail && error.detail ? error.detail : fallback;
  }
  if (error instanceof ApiParseError) {
    return fallback;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return fallback;
}

function extractDetail(body: unknown): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;
  if (typeof record.detail === 'string' && record.detail) {
    return record.detail;
  }
  if (typeof record.error === 'string' && record.error) {
    return record.error;
  }
  return null;
}

function parseMaybeJson(text: string): unknown {
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}

type LinkedSignal = {
  signal: AbortSignal | undefined;
  timedOut: () => boolean;
  dispose: () => void;
};

/**
 * Combines the caller's signal with an optional timeout. Either one aborts
 * the request; neither disables the other.
 */
function linkSignal(signal?: AbortSignal, timeoutMs?: number): LinkedSignal {
  const hasTimeout =
    typeof timeoutMs === 'number' &&
    Number.isFinite(timeoutMs) &&
    timeoutMs > 0;
  if (!signal && !hasTimeout) {
    return { signal: undefined, timedOut: () => false, dispose: () => {} };
  }

  const controller = new AbortController();
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) {
      controller.abort(signal.reason);
    } else {
      signal.addEventListener('abort', onAbort, { once: true });
    }
  }
  if (hasTimeout) {
    timer = setTimeout(() => {
      timedOut = true;
      controller.abort(new ApiTimeoutError(timeoutMs));
    }, timeoutMs);
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

function buildRequestInit(
  options: RequestOptions,
  signal: AbortSignal | undefined,
): RequestInit {
  const headers = new Headers(options.headers);
  let body: BodyInit | undefined;

  if (options.formData !== undefined) {
    body = options.formData;
    // The browser must generate the multipart boundary itself.
    headers.delete('Content-Type');
  } else if (options.json !== undefined) {
    body = JSON.stringify(options.json);
    headers.set('Content-Type', 'application/json');
  } else if (options.text !== undefined) {
    body = options.text;
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'text/plain;charset=UTF-8');
    }
  }

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const init: RequestInit = {
    method: options.method ?? (body === undefined ? 'GET' : 'POST'),
    headers,
  };
  if (body !== undefined) {
    init.body = body;
  }
  if (options.cache) {
    init.cache = options.cache;
  }
  if (signal) {
    init.signal = signal;
  }
  return init;
}

async function readSuccessBody(
  response: Response,
  kind: ResponseKind,
): Promise<unknown> {
  if (kind === 'none') {
    // Release the connection without buffering a body nobody wants.
    await response.body?.cancel().catch(() => {});
    return undefined;
  }
  if (response.status === 204 || response.status === 205) {
    return kind === 'text' ? '' : undefined;
  }
  const text = await response.text();
  if (kind === 'text') {
    return text;
  }
  if (!text) {
    return undefined;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiParseError(response.status);
  }
}

/**
 * Performs a request and returns the parsed body. Non-2xx responses reject
 * with {@link ApiError}, caller cancellation with {@link ApiAbortError} and
 * timeouts with {@link ApiTimeoutError}.
 */
export async function request<T>(
  path: string,
  options: RequestOptions & { responseType?: ResponseKind } = {},
): Promise<T> {
  const { responseType = 'json', ...requestOptions } = options;
  const linked = linkSignal(options.signal, options.timeoutMs);

  const translate = (error: unknown): unknown => {
    if (linked.timedOut()) {
      return new ApiTimeoutError(options.timeoutMs as number);
    }
    if (options.signal?.aborted) {
      return new ApiAbortError();
    }
    return error;
  };

  try {
    if (linked.signal?.aborted) {
      throw new ApiAbortError();
    }

    const response = await fetch(
      path,
      buildRequestInit(requestOptions, linked.signal),
    );
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      const errorBody = parseMaybeJson(errorText);
      throw new ApiError(
        response.status,
        response.statusText,
        errorBody,
        extractDetail(errorBody),
      );
    }
    const result = (await readSuccessBody(response, responseType)) as T;
    // A request cancelled while its body was being read must not deliver
    // stale data to the caller.
    if (linked.timedOut() || options.signal?.aborted) {
      throw new ApiAbortError();
    }
    return result;
  } catch (error) {
    // Timeouts and caller cancellation win over whatever the transport threw.
    throw translate(error);
  } finally {
    linked.dispose();
  }
}

/** Request whose successful response is JSON (or empty → undefined). */
export function requestJson<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  return request<T>(path, { ...options, responseType: 'json' });
}

/** Request whose successful response is plain text. */
export function requestText(
  path: string,
  options: RequestOptions = {},
): Promise<string> {
  return request<string>(path, { ...options, responseType: 'text' });
}

/** Request whose successful response body is irrelevant or absent. */
export function requestVoid(
  path: string,
  options: RequestOptions = {},
): Promise<void> {
  return request<void>(path, { ...options, responseType: 'none' });
}
