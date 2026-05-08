import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DemoExperience } from '@/components/demo-experience';
import { ACCESS_TOKEN_STORAGE_KEY } from '@/lib/access-token';
import * as accessTokenLib from '@/lib/access-token';

const replaceMock = vi.fn();
const pushMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

describe('DemoExperience', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
    pushMock.mockReset();
    replaceMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it('shows the invitation form when no stored token is present', async () => {
    render(<DemoExperience />);

    expect(
      await screen.findByText('Enter invitation code'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Invitation code')).toBeInTheDocument();
  });

  it('persists a redeemed token and redirects into the messy-notes workspace', async () => {
    const persistSpy = vi.spyOn(accessTokenLib, 'persistAccessToken');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith('/api/bff/access/redeem')) {
          return new Response(
            JSON.stringify({
              access_token: 'signed-token',
              experience_id: 'messy-notes',
              redirect_path: '/messy-notes',
              expires_at: '2026-12-31T00:00:00Z',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      }),
    );

    render(<DemoExperience />);

    fireEvent.change(await screen.findByLabelText('Invitation code'), {
      target: { value: 'demo-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/messy-notes');
    });

    await waitFor(() => {
      expect(persistSpy).toHaveBeenCalledWith({
        accessToken: 'signed-token',
        experienceId: 'messy-notes',
        expiresAt: '2026-12-31T00:00:00Z',
      });
    });
  });

  it('returns to invite entry when a stored token fails verification', async () => {
    window.localStorage.setItem(
      ACCESS_TOKEN_STORAGE_KEY,
      JSON.stringify({
        'messy-notes': {
          accessToken: 'expired-token',
          experienceId: 'messy-notes',
          expiresAt: '2026-12-31T00:00:00Z',
        },
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith('/api/bff/access/verify')) {
          return new Response(
            JSON.stringify({ detail: 'Access token expired.' }),
            {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      }),
    );

    render(<DemoExperience />);

    expect(
      await screen.findByText('Enter invitation code'),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY)).toBeNull();
    });
  });

  it('shows experience selector and navigates on Go', async () => {
    render(<DemoExperience />);

    expect(await screen.findByText('Go to an experience')).toBeInTheDocument();
    expect(screen.getByLabelText('Experience')).toHaveValue('messy-notes');
    fireEvent.click(screen.getByRole('button', { name: 'Go' }));

    expect(pushMock).toHaveBeenCalledWith('/messy-notes');
    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('keeps a stored token when verification is temporarily unavailable', async () => {
    window.localStorage.setItem(
      ACCESS_TOKEN_STORAGE_KEY,
      JSON.stringify({
        'messy-notes': {
          accessToken: 'valid-token',
          experienceId: 'messy-notes',
          expiresAt: '2026-12-31T00:00:00Z',
        },
      }),
    );

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith('/api/bff/access/verify')) {
          return new Response(
            JSON.stringify({ detail: 'Backend unavailable.' }),
            {
              status: 503,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      }),
    );

    render(<DemoExperience />);

    expect(await screen.findByText('Go to an experience')).toBeInTheDocument();
    expect(
      window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY),
    ).not.toBeNull();
    expect(replaceMock).not.toHaveBeenCalled();
  });
});
