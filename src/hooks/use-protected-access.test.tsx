import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useProtectedAccess } from '@/hooks/use-protected-access';
import { ACCESS_TOKEN_STORAGE_KEY } from '@/lib/access-token';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

function ProtectedAccessProbe() {
  const { accessToken, isChecking } = useProtectedAccess('rag-demo');
  return <p>{isChecking ? 'checking' : accessToken || 'no token'}</p>;
}

describe('useProtectedAccess', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    replaceMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('keeps a stored token when verification is temporarily unavailable', async () => {
    window.localStorage.setItem(
      ACCESS_TOKEN_STORAGE_KEY,
      JSON.stringify({
        'rag-demo': {
          accessToken: 'stored-rag-token',
          experienceId: 'rag-demo',
          expiresAt: '2026-12-31T00:00:00Z',
        },
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ detail: 'Backend unavailable.' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }),
    );

    render(<ProtectedAccessProbe />);

    expect(await screen.findByText('stored-rag-token')).toBeInTheDocument();
    expect(
      window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY),
    ).not.toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('clears a stored token when verification returns a hard auth failure', async () => {
    window.localStorage.setItem(
      ACCESS_TOKEN_STORAGE_KEY,
      JSON.stringify({
        'rag-demo': {
          accessToken: 'expired-rag-token',
          experienceId: 'rag-demo',
          expiresAt: '2026-12-31T00:00:00Z',
        },
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        return new Response(
          JSON.stringify({ detail: 'Access token expired.' }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }),
    );

    render(<ProtectedAccessProbe />);

    expect(await screen.findByText('no token')).toBeInTheDocument();
    await waitFor(() => {
      expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    });
    expect(replaceMock).toHaveBeenCalledWith('/');
  });

  it('verifies the stored token with a bearer header and refreshes expiry', async () => {
    window.localStorage.setItem(
      ACCESS_TOKEN_STORAGE_KEY,
      JSON.stringify({
        'rag-demo': {
          accessToken: 'stored-rag-token',
          experienceId: 'rag-demo',
          expiresAt: '2026-12-31T00:00:00Z',
        },
      }),
    );
    const fetchMock = vi.fn<
      (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
    >(async () =>
      Response.json({
        experience_id: 'rag-demo',
        expires_at: '2027-06-30T00:00:00Z',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<ProtectedAccessProbe />);

    expect(await screen.findByText('stored-rag-token')).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/bff/access/verify');
    expect(new Headers(init?.headers).get('Authorization')).toBe(
      'Bearer stored-rag-token',
    );
    const stored = JSON.parse(
      window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? '{}',
    );
    expect(stored['rag-demo'].expiresAt).toBe('2027-06-30T00:00:00Z');
  });

  it('cancels verification on unmount without touching stored tokens', async () => {
    window.localStorage.setItem(
      ACCESS_TOKEN_STORAGE_KEY,
      JSON.stringify({
        'rag-demo': {
          accessToken: 'stored-rag-token',
          experienceId: 'rag-demo',
          expiresAt: '2026-12-31T00:00:00Z',
        },
      }),
    );
    let capturedSignal: AbortSignal | undefined;
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_input: RequestInfo | URL, init?: RequestInit) =>
          new Promise<Response>((_resolve, reject) => {
            capturedSignal = init?.signal ?? undefined;
            capturedSignal?.addEventListener('abort', () => {
              reject(new DOMException('Aborted', 'AbortError'));
            });
          }),
      ),
    );

    const { unmount } = render(<ProtectedAccessProbe />);
    await waitFor(() => {
      expect(capturedSignal).toBeDefined();
    });

    unmount();

    expect(capturedSignal?.aborted).toBe(true);
    await Promise.resolve();
    expect(
      window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY),
    ).not.toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('does not redirect when redirect:false and no stored token', async () => {
    render(<ProtectedAccessNoRedirectProbe />);
    expect(await screen.findByText('no token')).toBeInTheDocument();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});

function ProtectedAccessNoRedirectProbe() {
  const { accessToken, isChecking } = useProtectedAccess('rag-demo', {
    redirect: false,
  });
  return <p>{isChecking ? 'checking' : accessToken || 'no token'}</p>;
}
