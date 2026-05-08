import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InlineAccessPanel } from '@/components/inline-access-panel';
import { ACCESS_TOKEN_STORAGE_KEY } from '@/lib/access-token';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe('InlineAccessPanel', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders redeem form and request access button', () => {
    render(
      <InlineAccessPanel experienceId="rag-demo" onAccessGranted={vi.fn()} />,
    );
    expect(screen.getByLabelText('Invitation code')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Redeem' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Request access' }),
    ).toBeInTheDocument();
  });

  it('shows experience label and description', () => {
    render(
      <InlineAccessPanel
        experienceId="messy-notes"
        onAccessGranted={vi.fn()}
      />,
    );
    expect(screen.getByText('Messy Notes')).toBeInTheDocument();
    expect(screen.getByText('Access required.')).toBeInTheDocument();
  });

  it('calls onAccessGranted and stores token after successful redemption', async () => {
    const onAccessGranted = vi.fn();
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: 'new-rag-token',
              experience_id: 'rag-demo',
              expires_at: '2027-01-01T00:00:00Z',
              redirect_path: '/rag-demo',
            }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
      ),
    );

    render(
      <InlineAccessPanel
        experienceId="rag-demo"
        onAccessGranted={onAccessGranted}
      />,
    );

    fireEvent.change(screen.getByLabelText('Invitation code'), {
      target: { value: 'demo-test-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Redeem' }));

    await waitFor(() => {
      expect(onAccessGranted).toHaveBeenCalledWith('new-rag-token');
    });

    const stored = JSON.parse(
      window.localStorage.getItem(ACCESS_TOKEN_STORAGE_KEY) ?? '{}',
    );
    expect(stored['rag-demo']?.accessToken).toBe('new-rag-token');
  });

  it('shows error message when redemption fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ detail: 'Invalid code.' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    render(
      <InlineAccessPanel experienceId="rag-demo" onAccessGranted={vi.fn()} />,
    );

    fireEvent.change(screen.getByLabelText('Invitation code'), {
      target: { value: 'bad-code' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Redeem' }));

    expect(await screen.findByText('Invalid code.')).toBeInTheDocument();
  });

  it('opens request modal and submits invite request with experience_id', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ message: 'Request received.' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(
      <InlineAccessPanel experienceId="voice-demo" onAccessGranted={vi.fn()} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Request access' }));
    expect(screen.getByLabelText('Name')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Ada Lovelace' },
    });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'ada@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Why are you interested?'), {
      target: { value: 'Evaluating voice AI tools.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send request' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bff/access/invite-requests',
        expect.objectContaining({ method: 'POST' }),
      );
    });

    const allCalls = fetchMock.mock.calls as unknown as [string, RequestInit][];
    const inviteCall = allCalls.find(
      ([url]) => url === '/api/bff/access/invite-requests',
    );
    const body = JSON.parse(inviteCall?.[1]?.body as string) as Record<
      string,
      string
    >;
    expect(body['experience_id']).toBe('voice-demo');
    expect(body['name']).toBe('Ada Lovelace');

    expect(await screen.findByText('Request received.')).toBeInTheDocument();
  });
});
