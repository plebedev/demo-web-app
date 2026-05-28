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
const providersResponse = JSON.stringify({
  providers: [
    { provider_id: 'xai', provider_name: 'xAI', voices: ['eve', 'ara'] },
    {
      provider_id: 'openai',
      provider_name: 'OpenAI',
      voices: ['alloy', 'echo'],
    },
  ],
});
const toolsResponse = JSON.stringify({
  tools: [
    {
      name: 'record_answer',
      description: 'Record a spoken answer.',
      is_terminal: false,
    },
    {
      name: 'prepare_meeting_context',
      description: 'Prepare meeting context without live web lookup.',
      is_terminal: false,
    },
    {
      name: 'end_conversation',
      description: 'End the conversation.',
      is_terminal: true,
    },
  ],
});

function makePersona(id: number, name: string) {
  return {
    id,
    name,
    instructions: `Instructions for ${name}`,
    capabilities: `Capabilities for ${name}`,
    tool_config: null,
    tool_names: ['record_answer', 'end_conversation'],
    is_active: true,
  };
}

/** Build a fetch mock that handles the three standard read endpoints. */
function makeBaseFetch(
  extraHandler?: (
    url: string,
    init?: RequestInit,
  ) => Response | Promise<Response> | null,
) {
  return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);

    if (extraHandler) {
      const result = extraHandler(url, init);
      if (result !== null) {
        return result instanceof Promise ? await result : result;
      }
    }

    if (
      url.endsWith('/api/bff/voice/personas') &&
      (!init?.method || init.method === 'GET')
    ) {
      return new Response(emptyPersonasResponse, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/api/bff/voice/config') && !init?.method) {
      return emptyConfigResponse.clone();
    }
    if (url.endsWith('/api/bff/voice/providers')) {
      return new Response(providersResponse, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.endsWith('/api/bff/voice/tools')) {
      return new Response(toolsResponse, {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    if (url.includes('/api/bff/voice/history')) {
      return new Response(JSON.stringify({ conversations: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    throw new Error(`Unexpected fetch: ${url} ${init?.method}`);
  });
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
    vi.stubGlobal('fetch', makeBaseFetch());

    render(<VoiceDemoWorkspace />);

    expect(await screen.findByRole('button', { name: 'Test' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Configuration' })).toBeTruthy();
  });

  it('Test tab shows start button and message when no persona configured', async () => {
    vi.stubGlobal('fetch', makeBaseFetch());

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
      makeBaseFetch((url) => {
        if (url.endsWith('/api/bff/voice/personas')) {
          return new Response(JSON.stringify({ personas: [persona] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return null;
      }),
    );

    render(<VoiceDemoWorkspace />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Configuration' }),
    );

    expect(await screen.findByText('Employer Advisor')).toBeTruthy();
    expect(screen.getByText('Voice experience')).toBeTruthy();
    expect(screen.getByLabelText('Provider')).toBeTruthy();
    expect(screen.getByLabelText('Voice')).toBeTruthy();
    expect(
      await screen.findByRole('checkbox', {
        name: /prepare_meeting_context/,
      }),
    ).toBeTruthy();
  });

  it('saving voice config calls PUT /api/bff/voice/config with provider and voice', async () => {
    const configResponse = {
      id: 1,
      experience_id: 'voice-demo',
      voice_name: 'eve',
      voice_provider: 'xai',
      synthesized_greeting: null,
      greeting_synced_at: null,
    };

    const fetchMock = makeBaseFetch((url, init) => {
      if (url.endsWith('/api/bff/voice/config') && init?.method === 'PUT') {
        return new Response(JSON.stringify(configResponse), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return null;
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<VoiceDemoWorkspace />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Configuration' }),
    );

    // Wait for providers to load, then pick a provider and voice
    const providerSelect = (await screen.findByLabelText(
      'Provider',
    )) as HTMLSelectElement;
    fireEvent.change(providerSelect, { target: { value: 'xai' } });

    const voiceSelect = (await screen.findByLabelText(
      'Voice',
    )) as HTMLSelectElement;
    fireEvent.change(voiceSelect, { target: { value: 'eve' } });

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bff/voice/config',
        expect.objectContaining({ method: 'PUT' }),
      );
    });
  });

  it('creating a persona sends selected tool names', async () => {
    const newPersona = makePersona(42, 'New Advisor');
    const requestBodies: Record<string, unknown>[] = [];

    const fetchMock = makeBaseFetch((url, init) => {
      if (url.endsWith('/api/bff/voice/personas') && init?.method === 'POST') {
        requestBodies.push(JSON.parse(String(init.body)));
        return new Response(JSON.stringify(newPersona), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return null;
    });
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
    fireEvent.click(
      await screen.findByRole('checkbox', {
        name: /prepare_meeting_context/,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bff/voice/personas',
        expect.objectContaining({ method: 'POST' }),
      );
    });
    expect(requestBodies[0]?.tool_names).toEqual(['prepare_meeting_context']);
    expect(await screen.findByText('New Advisor')).toBeTruthy();
  });

  it('selecting a persona populates the edit form', async () => {
    const persona = makePersona(5, 'Policy Advisor');

    vi.stubGlobal(
      'fetch',
      makeBaseFetch((url) => {
        if (url.endsWith('/api/bff/voice/personas')) {
          return new Response(JSON.stringify({ personas: [persona] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return null;
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

  it('starting a session includes the selected persona id in the stream URL', async () => {
    const firstPersona = makePersona(5, 'Policy Advisor');
    const secondPersona = makePersona(9, 'Meeting Prep Advisor');
    let streamUrl = '';

    class FakeWebSocket {
      static OPEN = 1;
      readyState = 1;
      onclose: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: ((event: MessageEvent) => void) | null = null;
      onopen: (() => void) | null = null;

      constructor(url: string) {
        streamUrl = url;
      }

      close() {
        this.onclose?.();
      }

      send() {}
    }

    vi.stubGlobal('WebSocket', FakeWebSocket);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: vi.fn().mockRejectedValue(new Error('No mic in test')),
      },
    });
    vi.stubGlobal(
      'fetch',
      makeBaseFetch((url) => {
        if (url.endsWith('/api/bff/voice/personas')) {
          return new Response(
            JSON.stringify({ personas: [firstPersona, secondPersona] }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }
        return null;
      }),
    );

    render(<VoiceDemoWorkspace />);

    const selector = (await screen.findByLabelText(
      'Advisor',
    )) as HTMLSelectElement;
    fireEvent.change(selector, { target: { value: '9' } });
    fireEvent.click(await screen.findByText('Start conversation'));

    await waitFor(() => {
      expect(streamUrl).toContain('persona_id=9');
    });
  });

  it('deactivating a persona calls POST .../deactivate and removes it from the list', async () => {
    const persona = makePersona(7, 'Removable Advisor');

    const fetchMock = makeBaseFetch((url) => {
      if (url.endsWith('/api/bff/voice/personas')) {
        return new Response(JSON.stringify({ personas: [persona] }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      if (url.includes('/api/bff/voice/personas/7/deactivate')) {
        return new Response(JSON.stringify({ ...persona, is_active: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }
      return null;
    });
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
        if (url.endsWith('/api/bff/voice/providers')) {
          return new Response(providersResponse, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      }),
    );

    render(<VoiceDemoWorkspace />);

    expect(await screen.findByText('Unable to load personas.')).toBeTruthy();
  });

  it('renders History tab button', async () => {
    vi.stubGlobal('fetch', makeBaseFetch());
    render(<VoiceDemoWorkspace />);
    expect(await screen.findByRole('button', { name: 'History' })).toBeTruthy();
  });

  it('History tab shows empty state when no conversations', async () => {
    vi.stubGlobal('fetch', makeBaseFetch());
    render(<VoiceDemoWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'History' }));
    expect(
      await screen.findByText(/No conversations recorded yet/),
    ).toBeTruthy();
  });

  it('History tab fetches and displays conversation rows', async () => {
    const historyResponse = JSON.stringify({
      conversations: [
        {
          id: 1,
          call_sid: 'browser-abc123',
          provider: 'xai',
          voice: 'eve',
          started_at: '2026-05-09T10:00:00Z',
          ended_at: '2026-05-09T10:01:30Z',
          duration_seconds: 90,
          input_audio_seconds: 40,
          output_audio_seconds: 50,
          estimated_cost_usd: 0.0125,
          entry_count: 3,
        },
      ],
    });
    vi.stubGlobal(
      'fetch',
      makeBaseFetch((url) => {
        if (url.includes('/api/bff/voice/history')) {
          return new Response(historyResponse, {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        return null;
      }),
    );
    render(<VoiceDemoWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'History' }));
    expect(await screen.findByText('xai/eve')).toBeTruthy();
    expect(screen.getByText('1m 30s')).toBeTruthy();
    expect(screen.getByText('~$0.0125')).toBeTruthy();
  });

  it('renders about tab content when About is clicked', async () => {
    vi.stubGlobal('fetch', vi.fn(makeBaseFetch(() => null)));
    render(<VoiceDemoWorkspace />);
    fireEvent.click(await screen.findByRole('button', { name: 'About' }));
    expect(await screen.findByText('Voice Demo — about')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Browser and phone access to a persona-configured voice advisor.',
      ),
    ).toBeInTheDocument();
  });
});
