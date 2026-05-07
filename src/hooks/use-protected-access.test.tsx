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
});
