import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { RagWorkspace } from '@/components/rag-workspace';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock('@/hooks/use-protected-access', () => ({
  useProtectedAccess: () => ({
    accessToken: 'rag-token',
    isChecking: false,
  }),
}));

describe('RagWorkspace', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders mutually exclusive chat and configuration tabs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/bff/rag/personas')) {
          return new Response(JSON.stringify({ personas: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.endsWith('/api/bff/rag/conversations')) {
          return new Response(JSON.stringify({ conversations: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      }),
    );

    render(<RagWorkspace />);

    expect(
      await screen.findByText('Configure assistant personas.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Ask a persona-grounded question.'),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));

    expect(
      await screen.findByText('Ask a persona-grounded question.'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('Configure assistant personas.'),
    ).not.toBeInTheDocument();
  });

  it('creates, edits, and deletes personas through the BFF', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith('/api/bff/rag/personas') && !init?.method) {
          return new Response(JSON.stringify({ personas: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.endsWith('/api/bff/rag/conversations') && !init?.method) {
          return new Response(JSON.stringify({ conversations: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.endsWith('/api/bff/rag/personas') && init?.method === 'POST') {
          return new Response(
            JSON.stringify({
              id: 11,
              name: 'Policy Helper',
              instructions:
                '# Rules\n- Answer from **uploaded** policy documents.',
              capabilities: 'Use `policy` lookup',
              tool_config: null,
              is_active: true,
              created_at: '2026-05-07T00:00:00Z',
              updated_at: '2026-05-07T00:00:00Z',
            }),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (
          url.endsWith('/api/bff/rag/personas/11/documents') &&
          !init?.method
        ) {
          return new Response(JSON.stringify({ documents: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (
          url.endsWith('/api/bff/rag/personas/11') &&
          init?.method === 'PUT'
        ) {
          return new Response(
            JSON.stringify({
              id: 11,
              name: 'Policy Specialist',
              instructions: 'Answer only from uploaded policy documents.',
              capabilities: 'Policy and escalation lookup',
              tool_config: null,
              is_active: true,
              created_at: '2026-05-07T00:00:00Z',
              updated_at: '2026-05-07T00:05:00Z',
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (
          url.endsWith('/api/bff/rag/personas/11') &&
          init?.method === 'DELETE'
        ) {
          return new Response(null, { status: 204 });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<RagWorkspace />);

    fireEvent.change(await screen.findByLabelText('Name'), {
      target: { value: 'Policy Helper' },
    });
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: {
        value: '# Rules\n- Answer from **uploaded** policy documents.',
      },
    });
    fireEvent.change(screen.getByLabelText('Capabilities'), {
      target: { value: 'Use `policy` lookup' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save persona' }));

    expect(await screen.findByText('Persona saved.')).toBeInTheDocument();
    expect(screen.getByText('Policy Helper')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rules' })).toBeInTheDocument();
    expect(screen.getByText('uploaded')).toBeInTheDocument();
    expect(screen.getByText('policy')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Name'), {
      target: { value: 'Policy Specialist' },
    });
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'Answer only from uploaded policy documents.' },
    });
    fireEvent.change(screen.getByLabelText('Capabilities'), {
      target: { value: 'Policy and escalation lookup' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save persona' }));

    await waitFor(() => {
      expect(screen.getByText('Policy Specialist')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(await screen.findByText('Persona deleted.')).toBeInTheDocument();
    expect(screen.queryByText('Policy Specialist')).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bff/rag/personas',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bff/rag/personas/11',
      expect.objectContaining({ method: 'PUT' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bff/rag/personas/11',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('uploads and removes persona documents through the BFF', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith('/api/bff/rag/personas') && !init?.method) {
          return new Response(
            JSON.stringify({
              personas: [
                {
                  id: 21,
                  name: 'Policy Helper',
                  instructions: 'Answer from uploaded policy documents.',
                  capabilities: 'Policy lookup',
                  tool_config: null,
                  is_active: true,
                  created_at: '2026-05-07T00:00:00Z',
                  updated_at: '2026-05-07T00:00:00Z',
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.endsWith('/api/bff/rag/conversations') && !init?.method) {
          return new Response(JSON.stringify({ conversations: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (
          url.endsWith('/api/bff/rag/personas/21/documents') &&
          !init?.method
        ) {
          return new Response(JSON.stringify({ documents: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (
          url.endsWith('/api/bff/rag/personas/21/documents') &&
          init?.method === 'POST'
        ) {
          expect(init.body).toBeInstanceOf(FormData);
          expect((init.headers as Record<string, string>).Authorization).toBe(
            'Bearer rag-token',
          );
          expect(
            (init.headers as Record<string, string>)['Content-Type'],
          ).toBeUndefined();
          return new Response(
            JSON.stringify({
              document: {
                document_id: 31,
                source: 'policy.txt',
                title: 'Policy',
                display_name: 'Policy',
                chunk_count: 2,
                linked_at: '2026-05-07T00:10:00Z',
              },
              reused_existing_document: false,
            }),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (
          url.endsWith('/api/bff/rag/personas/21/documents/31') &&
          init?.method === 'DELETE'
        ) {
          return new Response(null, { status: 204 });
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<RagWorkspace />);

    expect(await screen.findByText('Policy Helper')).toBeInTheDocument();
    expect(
      await screen.findByText('No documents linked to this persona yet.'),
    ).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Policy' },
    });
    fireEvent.change(screen.getByLabelText('Source'), {
      target: { value: 'policy.txt' },
    });
    fireEvent.change(screen.getByLabelText('Pasted text'), {
      target: { value: 'alpha renewal policy context' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload document' }));

    expect(
      await screen.findByText('Document uploaded and linked to persona.'),
    ).toBeInTheDocument();
    expect(screen.getByText('2 chunks · policy.txt')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));

    expect(
      await screen.findByText('Document removed from persona.'),
    ).toBeInTheDocument();
    expect(screen.queryByText('2 chunks · policy.txt')).not.toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bff/rag/personas/21/documents',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bff/rag/personas/21/documents/31',
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('creates a chat conversation and sends a message with citations', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith('/api/bff/rag/personas') && !init?.method) {
          return new Response(
            JSON.stringify({
              personas: [
                {
                  id: 41,
                  name: 'Policy Helper',
                  instructions: 'Answer from uploaded policy documents.',
                  capabilities: 'Policy lookup',
                  tool_config: null,
                  is_active: true,
                  created_at: '2026-05-07T00:00:00Z',
                  updated_at: '2026-05-07T00:00:00Z',
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.endsWith('/api/bff/rag/conversations') && !init?.method) {
          return new Response(JSON.stringify({ conversations: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (
          url.endsWith('/api/bff/rag/personas/41/documents') &&
          !init?.method
        ) {
          return new Response(JSON.stringify({ documents: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (
          url.endsWith('/api/bff/rag/conversations') &&
          init?.method === 'POST'
        ) {
          return new Response(
            JSON.stringify({
              id: 51,
              persona_id: 41,
              persona_name: 'Policy Helper',
              title: 'Policy Helper chat',
              status: 'active',
              created_at: '2026-05-07T00:00:00Z',
              updated_at: '2026-05-07T00:00:00Z',
            }),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.endsWith('/api/bff/rag/conversations/51') && !init?.method) {
          return new Response(
            JSON.stringify({
              conversation: {
                id: 51,
                persona_id: 41,
                persona_name: 'Policy Helper',
                title: 'Policy Helper chat',
                status: 'active',
                created_at: '2026-05-07T00:00:00Z',
                updated_at: '2026-05-07T00:00:00Z',
              },
              messages: [],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (
          url.endsWith('/api/bff/rag/conversations/51/messages') &&
          init?.method === 'POST'
        ) {
          return new Response(
            JSON.stringify({
              user_message: {
                id: 61,
                role: 'user',
                content: 'What does the policy say?',
                turn_index: 0,
                metadata: null,
                created_at: '2026-05-07T00:01:00Z',
              },
              assistant_message: {
                id: 62,
                role: 'assistant',
                content: 'Grounded answer with **evidence**.',
                turn_index: 1,
                metadata: '{}',
                created_at: '2026-05-07T00:01:01Z',
              },
              citations: [
                {
                  id: 71,
                  message_id: 62,
                  document_id: 31,
                  chunk_id: 81,
                  chunk_index: 0,
                  source: 'policy.txt',
                  title: 'Policy',
                  snippet: 'alpha renewal policy context',
                  rank: 1,
                },
              ],
              turns_remaining: 9,
            }),
            {
              status: 201,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<RagWorkspace />);

    fireEvent.click(screen.getByRole('button', { name: 'Chat' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Assistant')).toHaveValue('41');
    });
    fireEvent.click(screen.getByRole('button', { name: 'New chat' }));

    expect(
      await screen.findByText('Ask the first question for this persona.'),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Message'), {
      target: { value: 'What does the policy say?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText(/Grounded answer with/)).toBeInTheDocument();
    expect(screen.getByText('evidence')).toBeInTheDocument();
    expect(screen.getByText('9 turns left')).toBeInTheDocument();
    expect(screen.getByText('Policy')).toBeInTheDocument();
    expect(
      screen.getByText('alpha renewal policy context'),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bff/rag/conversations',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bff/rag/conversations/51/messages',
      expect.objectContaining({ method: 'POST' }),
    );
  });
});
