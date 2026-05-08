import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { VoiceDemoWorkspace } from '@/components/voice-demo-workspace';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: replaceMock,
  }),
}));

vi.mock('@/hooks/use-protected-access', () => ({
  useProtectedAccess: () => ({
    accessToken: 'voice-token',
    isChecking: false,
  }),
}));

vi.mock('@/lib/access-token', () => ({
  clearStoredAccessToken: vi.fn(),
}));

// jsdom does not implement scrollIntoView
Element.prototype.scrollIntoView = vi.fn();

const emptyPersonasResponse = JSON.stringify({ personas: [] });
const emptyConfigResponse = new Response(null, { status: 404 });

function makePersona(id: number, name: string) {
  return {
    id,
    name,
    instructions: `Instructions for ${name}`,
    capabilities: `Capabilities for ${name}`,
    tool_config: null,
    is_active: true,
  };
}

describe('VoiceDemoWorkspace', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders Test and Configuration tabs', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/bff/voice/personas')) {
          return new Response(emptyPersonasResponse, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.endsWith('/api/bff/voice/config')) {
          return emptyConfigResponse.clone();
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(<VoiceDemoWorkspace />);

    expect(await screen.findByRole('button', { name: 'Test' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Configuration' })).toBeTruthy();
  });

  it('Test tab shows start button and message when no persona configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/bff/voice/personas')) {
          return new Response(emptyPersonasResponse, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.endsWith('/api/bff/voice/config')) {
          return emptyConfigResponse.clone();
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(<VoiceDemoWorkspace />);

    await screen.findByText('Start conversation');
    expect(screen.getByText(/No personas configured/)).toBeTruthy();

    const startButton = screen.getByText(
      'Start conversation',
    ) as HTMLButtonElement;
    expect(startButton.disabled).toBe(true);
  });

  it('Configuration tab shows persona list and experience sections', async () => {
    const persona = makePersona(1, 'Employer Advisor');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/bff/voice/personas')) {
          return new Response(JSON.stringify({ personas: [persona] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.endsWith('/api/bff/voice/config')) {
          return emptyConfigResponse.clone();
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(<VoiceDemoWorkspace />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Configuration' }),
    );

    expect(await screen.findByText('Employer Advisor')).toBeTruthy();
    expect(screen.getByText('Voice experience')).toBeTruthy();
    expect(screen.getByLabelText('Character name')).toBeTruthy();
  });

  it('saving voice name calls PUT /api/bff/voice/config', async () => {
    const configResponse = {
      id: 1,
      experience_id: 'voice-demo',
      voice_name: 'Eve',
      synthesized_greeting: null,
      greeting_synced_at: null,
    };

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/bff/voice/personas')) {
          return new Response(emptyPersonasResponse, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.endsWith('/api/bff/voice/config')) {
          if (!init?.method || init.method === 'GET') {
            return emptyConfigResponse.clone();
          }
          if (init.method === 'PUT') {
            return new Response(JSON.stringify(configResponse), {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            });
          }
        }
        throw new Error(`Unexpected fetch: ${url} ${init?.method}`);
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<VoiceDemoWorkspace />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Configuration' }),
    );

    const nameInput = await screen.findByLabelText('Character name');
    fireEvent.change(nameInput, { target: { value: 'Eve' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bff/voice/config',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  it('creating a persona calls POST /api/bff/voice/personas', async () => {
    const newPersona = makePersona(42, 'New Advisor');

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (
          url.endsWith('/api/bff/voice/personas') &&
          (!init?.method || init.method === 'GET')
        ) {
          return new Response(emptyPersonasResponse, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (
          url.endsWith('/api/bff/voice/personas') &&
          init?.method === 'POST'
        ) {
          return new Response(JSON.stringify(newPersona), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.endsWith('/api/bff/voice/config')) {
          return emptyConfigResponse.clone();
        }
        throw new Error(`Unexpected fetch: ${url} ${init?.method}`);
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<VoiceDemoWorkspace />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Configuration' }),
    );

    fireEvent.change(await screen.findByLabelText('Name'), {
      target: { value: 'New Advisor' },
    });
    fireEvent.change(screen.getByLabelText('Instructions'), {
      target: { value: 'You are a helpful advisor.' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bff/voice/personas',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(await screen.findByText('New Advisor')).toBeTruthy();
  });

  it('selecting a persona populates the edit form', async () => {
    const persona = makePersona(5, 'Policy Advisor');

    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/bff/voice/personas')) {
          return new Response(JSON.stringify({ personas: [persona] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.endsWith('/api/bff/voice/config')) {
          return emptyConfigResponse.clone();
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(<VoiceDemoWorkspace />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Configuration' }),
    );
    fireEvent.click(await screen.findByText('Policy Advisor'));

    await waitFor(() => {
      const instructionsField = screen.getByLabelText(
        'Instructions',
      ) as HTMLTextAreaElement;
      expect(instructionsField.value).toBe('Instructions for Policy Advisor');
    });
  });

  it('deactivating a persona calls POST .../deactivate and removes it from the list', async () => {
    const persona = makePersona(7, 'Removable Advisor');

    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/bff/voice/personas')) {
          return new Response(JSON.stringify({ personas: [persona] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.includes('/api/bff/voice/personas/7/deactivate')) {
          return new Response(
            JSON.stringify({ ...persona, is_active: false }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          );
        }
        if (url.endsWith('/api/bff/voice/config')) {
          return emptyConfigResponse.clone();
        }
        throw new Error(`Unexpected fetch: ${url} ${init?.method}`);
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<VoiceDemoWorkspace />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Configuration' }),
    );
    fireEvent.click(await screen.findByText('Removable Advisor'));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining('/api/bff/voice/personas/7/deactivate'),
        expect.objectContaining({ method: 'POST' }),
      );
    });
    await waitFor(() => {
      expect(screen.queryByText('Removable Advisor')).toBeNull();
    });
  });

  it('API error displays error-text', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.endsWith('/api/bff/voice/personas')) {
          return new Response(JSON.stringify({ detail: 'Server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        if (url.endsWith('/api/bff/voice/config')) {
          return emptyConfigResponse.clone();
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(<VoiceDemoWorkspace />);

    expect(await screen.findByText('Unable to load personas.')).toBeTruthy();
  });
});
