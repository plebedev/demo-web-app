'use client';

import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { clearStoredAccessToken } from '@/lib/access-token';
import { InlineAccessPanel } from '@/components/inline-access-panel';
import { useProtectedAccess } from '@/hooks/use-protected-access';

type VoiceTab = 'test' | 'configuration' | 'history' | 'about';

type VoicePersona = {
  id: number;
  name: string;
  instructions: string;
  capabilities: string | null;
  tool_config: string | null;
  is_active: boolean;
};

type VoiceProvider = {
  provider_id: string;
  provider_name: string;
  voices: string[];
};

type VoiceConfig = {
  id: number;
  experience_id: string;
  voice_name: string;
  voice_provider: string | null;
  synthesized_greeting: string | null;
  greeting_synced_at: string | null;
};

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

type TranscriptEntry =
  | { id: number; role: 'advisor' | 'user'; text: string }
  | {
      id: number;
      role: 'tool_call';
      tool_name: string;
      args: Record<string, unknown>;
    };

type ConversationSummary = {
  id: number;
  call_sid: string;
  provider: string;
  voice: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  input_audio_seconds: number | null;
  output_audio_seconds: number | null;
  estimated_cost_usd: number | null;
  entry_count: number;
};

type HistoryTranscriptEntry =
  | { role: 'advisor' | 'user'; text: string }
  | { role: 'tool_call'; tool_name: string; args: Record<string, unknown> };

type ConversationDetail = ConversationSummary & {
  transcript: HistoryTranscriptEntry[];
};

type PersonaFormState = {
  name: string;
  instructions: string;
  capabilities: string;
  tool_config: string;
};

const emptyPersonaForm: PersonaFormState = {
  name: '',
  instructions: '',
  capabilities: '',
  tool_config: '',
};

function authHeaders(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

export function VoiceDemoWorkspace() {
  const router = useRouter();
  const { accessToken: verifiedToken, isChecking } = useProtectedAccess(
    'voice-demo',
    { redirect: false },
  );
  const [tokenOverride, setTokenOverride] = useState<string | null>(null);
  const accessToken = tokenOverride ?? verifiedToken;
  const [activeTab, setActiveTab] = useState<VoiceTab>('test');

  // Configuration state
  const [personas, setPersonas] = useState<VoicePersona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(
    null,
  );
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [personaForm, setPersonaForm] =
    useState<PersonaFormState>(emptyPersonaForm);
  const [providers, setProviders] = useState<VoiceProvider[]>([]);
  const [voiceProvider, setVoiceProvider] = useState('');
  const [voiceName, setVoiceName] = useState('');

  // Loading / saving state
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Test (voice call) state
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  // History state
  const [historyRecords, setHistoryRecords] = useState<ConversationSummary[]>(
    [],
  );
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [expandedDetail, setExpandedDetail] =
    useState<ConversationDetail | null>(null);

  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // WebSocket / audio refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef(0);
  const activeSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const entryIdRef = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const selectedPersona = useMemo(
    () => personas.find((p) => p.id === selectedPersonaId) || null,
    [personas, selectedPersonaId],
  );

  // Scroll transcript to bottom when new entries arrive
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Load personas and config when access token is available
  useEffect(() => {
    if (!accessToken) {
      return;
    }
    let active = true;
    const token = accessToken;

    async function loadPersonas() {
      setIsLoadingPersonas(true);
      try {
        const response = await fetch('/api/bff/voice/personas', {
          cache: 'no-store',
          headers: authHeaders(token),
        });
        if (!response.ok) {
          throw new Error('Unable to load personas.');
        }
        const payload = (await response.json()) as { personas: VoicePersona[] };
        if (!active) {
          return;
        }
        setPersonas(payload.personas);
        setSelectedPersonaId((current) => {
          if (
            current !== null &&
            payload.personas.some((p) => p.id === current)
          ) {
            return current;
          }
          return payload.personas[0]?.id ?? null;
        });
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load personas.',
        );
      } finally {
        if (active) {
          setIsLoadingPersonas(false);
        }
      }
    }

    async function loadConfig() {
      try {
        const response = await fetch('/api/bff/voice/config', {
          cache: 'no-store',
          headers: authHeaders(token),
        });
        if (response.status === 404) {
          return;
        }
        if (!response.ok) {
          throw new Error('Unable to load voice config.');
        }
        const payload = (await response.json()) as VoiceConfig;
        if (!active) {
          return;
        }
        setConfig(payload);
        setVoiceName(payload.voice_name);
        setVoiceProvider(payload.voice_provider ?? '');
      } catch {
        // Config not yet created — not an error
      }
    }

    async function loadProviders() {
      try {
        const response = await fetch('/api/bff/voice/providers', {
          cache: 'no-store',
          headers: authHeaders(token),
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          providers: VoiceProvider[];
        };
        if (!active) {
          return;
        }
        setProviders(payload.providers);
      } catch {
        // Non-fatal — dropdowns will be empty
      }
    }

    void loadPersonas();
    void loadConfig();
    void loadProviders();

    return () => {
      active = false;
    };
  }, [accessToken]);

  // Load history when the History tab becomes active
  useEffect(() => {
    if (activeTab !== 'history' || !accessToken) {
      return;
    }
    let active = true;
    const token = accessToken;
    setIsLoadingHistory(true);

    async function loadHistory() {
      try {
        const response = await fetch('/api/bff/voice/history', {
          cache: 'no-store',
          headers: authHeaders(token),
        });
        if (!response.ok) {
          return;
        }
        const payload = (await response.json()) as {
          conversations: ConversationSummary[];
        };
        if (active) {
          setHistoryRecords(payload.conversations);
        }
      } catch {
        // Non-fatal
      } finally {
        if (active) {
          setIsLoadingHistory(false);
        }
      }
    }

    void loadHistory();
    return () => {
      active = false;
    };
  }, [activeTab, accessToken]);

  // Clean up WebSocket and mic on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSignOut() {
    stopSession();
    clearStoredAccessToken('voice-demo');
    router.replace('/');
  }

  // ---------------------------------------------------------------------------
  // Configuration handlers
  // ---------------------------------------------------------------------------

  function handleNewPersona() {
    setSelectedPersonaId(null);
    setPersonaForm(emptyPersonaForm);
  }

  function handleSelectPersona(persona: VoicePersona) {
    setSelectedPersonaId(persona.id);
    setPersonaForm({
      name: persona.name,
      instructions: persona.instructions,
      capabilities: persona.capabilities ?? '',
      tool_config: persona.tool_config ?? '',
    });
  }

  async function handleSaveConfiguration(event: FormEvent) {
    event.preventDefault();
    if (!accessToken) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      if (voiceName.trim()) {
        const configResponse = await fetch('/api/bff/voice/config', {
          method: 'PUT',
          headers: authHeaders(accessToken),
          body: JSON.stringify({
            voice_name: voiceName.trim(),
            voice_provider: voiceProvider.trim() || null,
          }),
        });
        if (!configResponse.ok) {
          throw new Error('Unable to save voice configuration.');
        }
        const configPayload = (await configResponse.json()) as VoiceConfig;
        setConfig(configPayload);
        setVoiceName(configPayload.voice_name);
        setVoiceProvider(configPayload.voice_provider ?? '');
      }

      if (personaForm.instructions.trim()) {
        const isEdit = selectedPersonaId !== null;
        const url = isEdit
          ? `/api/bff/voice/personas/${selectedPersonaId}`
          : '/api/bff/voice/personas';
        const method = isEdit ? 'PATCH' : 'POST';
        const body = isEdit
          ? {
              instructions: personaForm.instructions.trim(),
              capabilities: personaForm.capabilities.trim() || null,
              tool_config: personaForm.tool_config.trim() || null,
            }
          : {
              name: personaForm.name.trim(),
              instructions: personaForm.instructions.trim(),
              capabilities: personaForm.capabilities.trim() || null,
              tool_config: personaForm.tool_config.trim() || null,
            };

        const personaResponse = await fetch(url, {
          method,
          headers: authHeaders(accessToken),
          body: JSON.stringify(body),
        });
        if (!personaResponse.ok) {
          const detail = (await personaResponse.json()) as { detail?: string };
          throw new Error(detail.detail ?? 'Unable to save persona.');
        }
        const saved = (await personaResponse.json()) as VoicePersona;
        setPersonas((current) =>
          isEdit
            ? current.map((p) => (p.id === saved.id ? saved : p))
            : [...current, saved],
        );
        setSelectedPersonaId(saved.id);
        setPersonaForm({
          name: saved.name,
          instructions: saved.instructions,
          capabilities: saved.capabilities ?? '',
          tool_config: saved.tool_config ?? '',
        });
      }

      setNotice('Configuration saved.');
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save configuration.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeactivatePersona() {
    if (!accessToken || selectedPersonaId === null) {
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/bff/voice/personas/${selectedPersonaId}/deactivate`,
        { method: 'POST', headers: authHeaders(accessToken) },
      );
      if (!response.ok) {
        throw new Error('Unable to deactivate persona.');
      }
      setPersonas((current) =>
        current.filter((p) => p.id !== selectedPersonaId),
      );
      setSelectedPersonaId(null);
      setPersonaForm(emptyPersonaForm);
      setNotice('Persona removed.');
    } catch (deactivateError) {
      setError(
        deactivateError instanceof Error
          ? deactivateError.message
          : 'Unable to deactivate persona.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Voice call handlers
  // ---------------------------------------------------------------------------

  async function handleStartSession() {
    if (!accessToken) {
      return;
    }
    setError(null);
    setTranscript([]);
    setConnectionState('connecting');

    const wsScheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const wsBase =
      process.env.NEXT_PUBLIC_BACKEND_WS_URL ??
      `${wsScheme}://${window.location.host}`;
    const wsUrl = `${wsBase}/api/voice/stream?token=${encodeURIComponent(accessToken)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    const callSid = `browser-${crypto.randomUUID()}`;
    const streamSid = `stream-${crypto.randomUUID()}`;

    ws.onopen = () => {
      ws.send(
        JSON.stringify({ event: 'start', start: { callSid, streamSid } }),
      );
      setConnectionState('connected');
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          event: string;
          media?: { payload: string };
          text?: string;
          message?: string;
          tool_name?: string;
          args?: Record<string, unknown>;
        };
        if (msg.event === 'media' && msg.media?.payload) {
          playAudio(msg.media.payload);
        } else if (msg.event === 'transcript' && msg.text) {
          appendTranscript('advisor', msg.text);
        } else if (msg.event === 'user_transcript' && msg.text) {
          appendTranscript('user', msg.text);
        } else if (msg.event === 'tool_call' && msg.tool_name) {
          appendToolCall(msg.tool_name, msg.args ?? {});
        } else if (msg.event === 'clear') {
          activeSourcesRef.current.forEach((s) => {
            try {
              s.stop();
            } catch {
              /* already stopped */
            }
          });
          activeSourcesRef.current = [];
          nextPlayTimeRef.current = audioCtxRef.current?.currentTime ?? 0;
        } else if (msg.event === 'end') {
          // Stop the mic immediately so we stop sending audio.
          // Do NOT close the WebSocket here — the server will close it after
          // sending this event, and the browser guarantees all buffered messages
          // are delivered via onmessage before onclose fires.  Closing the WS
          // early would drop any audio chunks still in transit.
          processorRef.current?.disconnect();
          processorRef.current = null;
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        } else if (msg.event === 'error') {
          setError(msg.message ?? 'Unknown error from voice service.');
          setConnectionState('error');
        }
      } catch {
        /* ignore malformed frames */
      }
    };

    ws.onerror = () => {
      setError(
        'Connection error. Check that the backend is reachable and XAI_API_KEY is set.',
      );
      setConnectionState('error');
    };

    ws.onclose = () => {
      // By the time onclose fires, all buffered WS messages have been delivered,
      // so nextPlayTimeRef reflects the full audio queue.  Wait for it to drain
      // before closing the AudioContext.
      wsRef.current = null;
      stopMicTracks();
      const ctx = audioCtxRef.current;
      const remainingMs = ctx
        ? Math.max(0, nextPlayTimeRef.current - ctx.currentTime) * 1000
        : 0;
      setTimeout(() => {
        void audioCtxRef.current?.close();
        audioCtxRef.current = null;
        nextPlayTimeRef.current = 0;
        setConnectionState((current) =>
          current === 'error' ? 'error' : 'idle',
        );
      }, remainingMs + 400);
    };

    await startMic(ws);
  }

  function stopSession() {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ event: 'stop' }));
    }
    wsRef.current?.close();
    wsRef.current = null;
    activeSourcesRef.current.forEach((s) => {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
    });
    activeSourcesRef.current = [];
    nextPlayTimeRef.current = 0;
    stopMic();
    setConnectionState('idle');
  }

  async function startMic(ws: WebSocket) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      streamRef.current = stream;
      // 8 kHz matches G.711 μ-law — no resampling needed.
      const ctx = new AudioContext({ sampleRate: 8000 });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) {
          return;
        }
        const float32 = e.inputBuffer.getChannelData(0);
        const mulaw = encodeMuLaw(float32ToPcm16(float32));
        ws.send(
          JSON.stringify({
            event: 'media',
            media: { payload: arrayBufferToBase64(mulaw.buffer) },
          }),
        );
      };
      source.connect(processor);
      processor.connect(ctx.destination);
    } catch (micError) {
      setError(
        micError instanceof Error
          ? `Microphone error: ${micError.message}`
          : 'Could not access microphone.',
      );
      setConnectionState('error');
    }
  }

  function stopMicTracks() {
    processorRef.current?.disconnect();
    processorRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function stopMic() {
    stopMicTracks();
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
  }

  function playAudio(b64: string) {
    const ctx = audioCtxRef.current;
    if (!ctx) {
      return;
    }
    const mulaw = new Uint8Array(base64ToArrayBuffer(b64));
    const float32 = pcm16ToFloat32(decodeMuLaw(mulaw));
    const buffer = ctx.createBuffer(1, float32.length, 8000);
    buffer.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    activeSourcesRef.current.push(src);
    src.onended = () => {
      activeSourcesRef.current = activeSourcesRef.current.filter(
        (s) => s !== src,
      );
    };
    const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    src.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }

  function appendTranscript(role: 'advisor' | 'user', text: string) {
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        return [
          ...prev.slice(0, -1),
          { id: last.id, role: last.role, text: last.text + text },
        ];
      }
      return [...prev, { id: ++entryIdRef.current, role, text }];
    });
  }

  function appendToolCall(toolName: string, args: Record<string, unknown>) {
    setTranscript((prev) => [
      ...prev,
      {
        id: ++entryIdRef.current,
        role: 'tool_call' as const,
        tool_name: toolName,
        args,
      },
    ]);
  }

  async function handleExpandConversation(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      setExpandedDetail(null);
      return;
    }
    setExpandedId(id);
    setExpandedDetail(null);
    if (!accessToken) {
      return;
    }
    try {
      const response = await fetch(`/api/bff/voice/history/${id}`, {
        headers: authHeaders(accessToken),
      });
      if (response.ok) {
        const detail = (await response.json()) as ConversationDetail;
        setExpandedDetail(detail);
      }
    } catch {
      // Non-fatal
    }
  }

  const isCallActive =
    connectionState === 'connected' || connectionState === 'connecting';
  const activePersona = personas[0] ?? null;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <main className="shell shell--workspace">
      <header className="topbar topbar--workspace">
        <Link className="brand" href="/voice-demo">
          <span className="brand-mark">V</span>
          <span>
            <strong>Voice Demo</strong>
            <small>Protected voice workspace</small>
          </span>
        </Link>

        <nav className="topnav" aria-label="Voice demo">
          <button
            className={activeTab === 'test' ? 'topnav-link-active' : ''}
            onClick={() => setActiveTab('test')}
            type="button"
          >
            Test
          </button>
          <button
            className={
              activeTab === 'configuration' ? 'topnav-link-active' : ''
            }
            onClick={() => setActiveTab('configuration')}
            type="button"
          >
            Configuration
          </button>
          <button
            className={activeTab === 'history' ? 'topnav-link-active' : ''}
            onClick={() => setActiveTab('history')}
            type="button"
          >
            History
          </button>
          <button
            className={activeTab === 'about' ? 'topnav-link-active' : ''}
            onClick={() => setActiveTab('about')}
            type="button"
          >
            About
          </button>
          <Link href="/">Access hub</Link>
          <Link href="/architecture">Architecture</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>

        <button
          className="secondary-button"
          onClick={handleSignOut}
          type="button"
        >
          Leave demo
        </button>
      </header>

      {isChecking ? (
        <section className="workspace-hero">
          <div className="hero-copy">
            <p className="eyebrow">Voice demo</p>
            <h1>Checking your saved voice access.</h1>
          </div>
        </section>
      ) : activeTab === 'test' && accessToken !== null ? (
        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">Test</p>
            <h2>Talk to the voice advisor.</h2>
            <p className="lede lede--compact">
              Browser-based voice test. Speak naturally and receive a workforce
              readiness recommendation. Configure a persona first if the start
              button is unavailable.
            </p>
          </div>

          {error ? <p className="error-text">{error}</p> : null}

          <div className="voice-chat-grid">
            <section className="section-card voice-chat-sidebar">
              <p className="card-kicker">Active persona</p>
              {personas.length === 0 ? (
                <p className="section-detail">
                  No personas configured. Go to Configuration to create one.
                </p>
              ) : (
                <>
                  <strong>{activePersona?.name}</strong>
                  {activePersona?.capabilities ? (
                    <p className="section-detail">
                      {activePersona.capabilities}
                    </p>
                  ) : null}
                </>
              )}

              {!isCallActive ? (
                <button
                  className="primary-button"
                  disabled={personas.length === 0}
                  onClick={() => void handleStartSession()}
                  type="button"
                >
                  Start conversation
                </button>
              ) : (
                <button
                  className="secondary-button"
                  onClick={stopSession}
                  type="button"
                >
                  {connectionState === 'connecting'
                    ? 'Connecting...'
                    : 'End conversation'}
                </button>
              )}

              {connectionState === 'connected' ? (
                <span className="status-pill">Live</span>
              ) : null}
            </section>

            <section className="section-card voice-chat-panel">
              <p className="card-kicker">Transcript</p>
              <div className="voice-message-list">
                {transcript.length === 0 ? (
                  <p className="section-detail">
                    Start a conversation to see the transcript here.
                  </p>
                ) : (
                  transcript.map((entry) =>
                    entry.role === 'tool_call' ? (
                      <article
                        className="voice-message voice-message--tool-call"
                        key={entry.id}
                      >
                        <p className="voice-tool-call-name">
                          {entry.tool_name}
                        </p>
                        {Object.entries(entry.args).map(([key, val]) => (
                          <p className="voice-tool-call-arg" key={key}>
                            <span className="voice-tool-call-arg-key">
                              {key}:
                            </span>{' '}
                            {String(val)}
                          </p>
                        ))}
                      </article>
                    ) : (
                      <article
                        className={`voice-message voice-message--${entry.role}`}
                        key={entry.id}
                      >
                        <p className="card-kicker">
                          {entry.role === 'advisor' ? 'Advisor' : 'You'}
                        </p>
                        <p>{entry.text}</p>
                      </article>
                    ),
                  )
                )}
                <div ref={transcriptEndRef} />
              </div>
            </section>
          </div>
        </section>
      ) : activeTab === 'test' ? (
        <InlineAccessPanel
          experienceId="voice-demo"
          onAccessGranted={setTokenOverride}
        />
      ) : activeTab === 'configuration' && accessToken !== null ? (
        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">Configuration</p>
            <h2>Configure the voice advisor.</h2>
            <p className="lede lede--compact">
              Select a voice provider and voice, then create personas with
              instructions and embedded guidance. The greeting is synthesized
              automatically when personas change.
            </p>
          </div>

          {error ? <p className="error-text">{error}</p> : null}
          {notice ? <p className="success-text">{notice}</p> : null}

          <div className="voice-config-grid">
            <section className="section-card voice-config-sidebar">
              <div className="run-card-row">
                <div>
                  <p className="card-kicker">Personas</p>
                  <h3>Available advisors</h3>
                </div>
                <button
                  className="secondary-button"
                  onClick={handleNewPersona}
                  type="button"
                >
                  New
                </button>
              </div>

              {isLoadingPersonas ? (
                <p className="section-detail">Loading personas.</p>
              ) : personas.length === 0 ? (
                <p className="section-detail">
                  No personas yet. Create one to define how the voice advisor
                  should behave.
                </p>
              ) : (
                <div className="voice-persona-list-items">
                  {personas.map((persona) => (
                    <button
                      className={`rag-persona-list-item ${
                        persona.id === selectedPersonaId
                          ? 'rag-persona-list-item--active'
                          : ''
                      }`}
                      key={persona.id}
                      onClick={() => handleSelectPersona(persona)}
                      type="button"
                    >
                      <strong>{persona.name}</strong>
                      <span>
                        {persona.capabilities || 'No capabilities set'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <div className="voice-config-panel">
              <section className="section-card">
                <form
                  className="invite-form"
                  onSubmit={(e) => void handleSaveConfiguration(e)}
                >
                  <p className="card-kicker">Voice experience</p>
                  <label className="field-label" htmlFor="voice-name">
                    Provider
                  </label>
                  <select
                    id="voice-name"
                    className="text-input"
                    onChange={(event) => {
                      setVoiceProvider(event.target.value);
                      setVoiceName('');
                    }}
                    value={voiceProvider}
                  >
                    <option value="">— select provider —</option>
                    {providers.map((p) => (
                      <option key={p.provider_id} value={p.provider_id}>
                        {p.provider_name}
                      </option>
                    ))}
                  </select>
                  <label className="field-label" htmlFor="voice-voice">
                    Voice
                  </label>
                  <select
                    id="voice-voice"
                    className="text-input"
                    disabled={!voiceProvider}
                    onChange={(event) => setVoiceName(event.target.value)}
                    value={voiceName}
                  >
                    <option value="">— select voice —</option>
                    {(
                      providers.find((p) => p.provider_id === voiceProvider)
                        ?.voices ?? []
                    ).map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                  {config?.synthesized_greeting ? (
                    <>
                      <label className="field-label">
                        Synthesized greeting
                      </label>
                      <p className="section-detail">
                        {config.synthesized_greeting}
                      </p>
                    </>
                  ) : null}

                  <p className="card-kicker">
                    {selectedPersona ? 'Edit persona' : 'Create persona'}
                  </p>

                  {!selectedPersona ? (
                    <>
                      <label
                        className="field-label"
                        htmlFor="voice-persona-name"
                      >
                        Name
                      </label>
                      <input
                        id="voice-persona-name"
                        className="text-input"
                        onChange={(event) =>
                          setPersonaForm((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        value={personaForm.name}
                      />
                    </>
                  ) : null}

                  <label
                    className="field-label"
                    htmlFor="voice-persona-instructions"
                  >
                    Instructions
                  </label>
                  <textarea
                    id="voice-persona-instructions"
                    className="text-area text-area--request"
                    onChange={(event) =>
                      setPersonaForm((current) => ({
                        ...current,
                        instructions: event.target.value,
                      }))
                    }
                    placeholder="System-level instructions for the xAI voice agent session."
                    rows={5}
                    value={personaForm.instructions}
                  />

                  <label
                    className="field-label"
                    htmlFor="voice-persona-capabilities"
                  >
                    Capabilities
                  </label>
                  <textarea
                    id="voice-persona-capabilities"
                    className="text-area text-area--request"
                    onChange={(event) =>
                      setPersonaForm((current) => ({
                        ...current,
                        capabilities: event.target.value,
                      }))
                    }
                    placeholder="Describe what this persona can help with. Used for greeting synthesis."
                    rows={3}
                    value={personaForm.capabilities}
                  />

                  <label
                    className="field-label"
                    htmlFor="voice-persona-tool-config"
                  >
                    Tool config JSON
                  </label>
                  <textarea
                    id="voice-persona-tool-config"
                    className="text-area text-area--compact"
                    onChange={(event) =>
                      setPersonaForm((current) => ({
                        ...current,
                        tool_config: event.target.value,
                      }))
                    }
                    placeholder='Optional. Override default scoring rules, e.g. {"outcomes": {...}}'
                    rows={4}
                    value={personaForm.tool_config}
                  />

                  <div className="workspace-toolbar">
                    <button
                      className="primary-button"
                      disabled={
                        isSaving ||
                        (!voiceName && !personaForm.instructions.trim())
                      }
                      type="submit"
                    >
                      {isSaving ? 'Saving...' : 'Save'}
                    </button>
                    {selectedPersona ? (
                      <button
                        className="secondary-button"
                        disabled={isSaving}
                        onClick={() => void handleDeactivatePersona()}
                        type="button"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                </form>
              </section>
            </div>
          </div>
        </section>
      ) : activeTab === 'configuration' ? (
        <InlineAccessPanel
          experienceId="voice-demo"
          onAccessGranted={setTokenOverride}
        />
      ) : activeTab === 'about' ? (
        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">Voice Demo — about</p>
            <h2>
              Browser and phone access to a persona-configured voice advisor.
            </h2>
            <p className="lede lede--compact">
              Both paths share the same persona config, transcript storage, and
              session handling. The active persona can be reached from a browser
              or via Twilio inbound call.
            </p>
          </div>

          <div className="architecture-grid">
            <article className="section-card section-card--tall">
              <p className="card-kicker">How it works</p>
              {/*
                Two entry paths converge on the backend bridge, which connects
                to the voice provider. DB stores transcript + metadata.
                Browser: microphone → WebSocket → bridge
                Phone:   Twilio call → bridge (Media Streams, bidirectional)
              */}
              <svg
                aria-label="Voice demo architecture diagram"
                viewBox="0 0 340 155"
                width="100%"
                xmlns="http://www.w3.org/2000/svg"
              >
                <defs>
                  <marker
                    id="v-arr"
                    markerHeight="5"
                    markerWidth="5"
                    orient="auto"
                    refX="5"
                    refY="2.5"
                    viewBox="0 0 5 5"
                  >
                    <path d="M0,0 L5,2.5 L0,5 Z" fill="#64748b" />
                  </marker>
                  <marker
                    id="v-arr-rev"
                    markerHeight="5"
                    markerWidth="5"
                    orient="auto-start-reverse"
                    refX="5"
                    refY="2.5"
                    viewBox="0 0 5 5"
                  >
                    <path d="M0,0 L5,2.5 L0,5 Z" fill="#64748b" />
                  </marker>
                  <marker
                    id="v-arr-pink"
                    markerHeight="5"
                    markerWidth="5"
                    orient="auto"
                    refX="5"
                    refY="2.5"
                    viewBox="0 0 5 5"
                  >
                    <path d="M0,0 L5,2.5 L0,5 Z" fill="#be185d" />
                  </marker>
                </defs>
                <rect
                  fill="#f8f9ff"
                  height="155"
                  rx="6"
                  width="340"
                  x="0"
                  y="0"
                />

                {/* ── Browser path (top) ───────────────────────────── */}
                <text fill="#3b82f6" fontSize="7" fontWeight="600" x="8" y="13">
                  BROWSER
                </text>
                <rect
                  fill="#eff6ff"
                  height="26"
                  rx="4"
                  stroke="#3b82f6"
                  strokeWidth="1.5"
                  width="62"
                  x="8"
                  y="18"
                />
                <text
                  fill="#1e293b"
                  fontSize="8"
                  fontWeight="600"
                  textAnchor="middle"
                  x="39"
                  y="35"
                >
                  Microphone
                </text>

                {/* Microphone → bridge (diagonal down-right) */}
                <line
                  markerEnd="url(#v-arr)"
                  stroke="#64748b"
                  strokeWidth="1"
                  x1="70"
                  x2="94"
                  y1="34"
                  y2="52"
                />

                {/* ── Phone path (middle) ──────────────────────────── */}
                <text fill="#be185d" fontSize="7" fontWeight="600" x="8" y="63">
                  PHONE
                </text>
                <rect
                  fill="#fdf2f8"
                  height="26"
                  rx="4"
                  stroke="#be185d"
                  strokeWidth="1.5"
                  width="62"
                  x="8"
                  y="68"
                />
                <text
                  fill="#1e293b"
                  fontSize="8"
                  fontWeight="600"
                  textAnchor="middle"
                  x="39"
                  y="85"
                >
                  Twilio call
                </text>

                {/* Phone → bridge (diagonal up-right, bidirectional for streams) */}
                <line
                  markerEnd="url(#v-arr)"
                  stroke="#be185d"
                  strokeWidth="1.2"
                  x1="70"
                  x2="94"
                  y1="77"
                  y2="62"
                />
                <line
                  markerEnd="url(#v-arr-pink)"
                  stroke="#be185d"
                  strokeDasharray="3,2"
                  strokeWidth="1.2"
                  x1="94"
                  x2="70"
                  y1="67"
                  y2="82"
                />

                {/* ── FastAPI bridge (center) ──────────────────────── */}
                <rect
                  fill="#f5f3ff"
                  height="44"
                  rx="4"
                  stroke="#7c3aed"
                  strokeWidth="1.5"
                  width="82"
                  x="98"
                  y="40"
                />
                <text
                  fill="#1e293b"
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                  x="139"
                  y="56"
                >
                  FastAPI bridge
                </text>
                <text
                  fill="#64748b"
                  fontSize="7"
                  textAnchor="middle"
                  x="139"
                  y="67"
                >
                  WebSocket
                </text>
                <text
                  fill="#64748b"
                  fontSize="7"
                  textAnchor="middle"
                  x="139"
                  y="77"
                >
                  Media Streams
                </text>

                {/* Bridge ↔ Voice provider (bidirectional) */}
                <line
                  markerEnd="url(#v-arr)"
                  stroke="#64748b"
                  strokeWidth="1"
                  x1="180"
                  x2="200"
                  y1="59"
                  y2="59"
                />
                <line
                  markerEnd="url(#v-arr-rev)"
                  stroke="#64748b"
                  strokeWidth="1"
                  x1="200"
                  x2="180"
                  y1="65"
                  y2="65"
                />

                {/* ── Voice provider ───────────────────────────────── */}
                <rect
                  fill="#fff7ed"
                  height="44"
                  rx="4"
                  stroke="#ea580c"
                  strokeWidth="1.5"
                  width="80"
                  x="204"
                  y="40"
                />
                <text
                  fill="#1e293b"
                  fontSize="9"
                  fontWeight="600"
                  textAnchor="middle"
                  x="244"
                  y="56"
                >
                  Voice provider
                </text>
                <text
                  fill="#64748b"
                  fontSize="7"
                  textAnchor="middle"
                  x="244"
                  y="67"
                >
                  xAI realtime
                </text>
                <text
                  fill="#64748b"
                  fontSize="7"
                  textAnchor="middle"
                  x="244"
                  y="77"
                >
                  OpenAI realtime
                </text>

                {/* Bridge → DB */}
                <line
                  markerEnd="url(#v-arr)"
                  stroke="#64748b"
                  strokeWidth="1"
                  x1="139"
                  x2="139"
                  y1="84"
                  y2="100"
                />

                {/* ── Oracle DB (below bridge) ─────────────────────── */}
                <rect
                  fill="#fefce8"
                  height="28"
                  rx="4"
                  stroke="#d97706"
                  strokeWidth="1.5"
                  width="82"
                  x="98"
                  y="102"
                />
                <text
                  fill="#1e293b"
                  fontSize="8"
                  fontWeight="600"
                  textAnchor="middle"
                  x="139"
                  y="116"
                >
                  Oracle DB
                </text>
                <text
                  fill="#64748b"
                  fontSize="6.5"
                  textAnchor="middle"
                  x="139"
                  y="126"
                >
                  transcript · metadata
                </text>

                {/* footnotes */}
                <text
                  fill="#64748b"
                  fontSize="6.5"
                  textAnchor="middle"
                  x="170"
                  y="143"
                >
                  Both paths share persona config and session handling
                </text>
                <text fill="#be185d" fontSize="6.5" x="8" y="152">
                  ── call in · - - - Media Streams (bidirectional)
                </text>
              </svg>
            </article>

            <article className="section-card section-card--tall">
              <p className="card-kicker">What it is</p>
              <ul className="section-list">
                <li>
                  Browser-based voice session using the microphone and WebSocket
                  connection to the backend.
                </li>
                <li>
                  Phone access via Twilio inbound call — the active persona
                  answers directly.
                </li>
                <li>
                  Persona instructions configure the advisor&#39;s behavior,
                  greeting, and tool access.
                </li>
                <li>
                  Real-time transcript with tool calls visible during and after
                  the session.
                </li>
              </ul>
            </article>

            <article className="section-card">
              <p className="card-kicker">Transcript and storage</p>
              <ul className="section-list">
                <li>
                  Text transcript and tool calls are persisted per session.
                </li>
                <li>Audio is not stored — only the text.</li>
                <li>
                  Session metadata includes provider, voice, duration, and
                  estimated cost.
                </li>
              </ul>
            </article>

            <article className="section-card">
              <p className="card-kicker">Cost tracking</p>
              <ul className="section-list">
                <li>Estimated cost is shown per session in the History tab.</li>
                <li>xAI: approximately $3/hr based on audio duration.</li>
                <li>
                  OpenAI: approximately $0.10–$0.35/min based on audio duration.
                </li>
              </ul>
            </article>

            <article className="section-card">
              <p className="card-kicker">Not yet implemented</p>
              <ul className="section-list">
                <li>
                  OpenAI token-based cost tracking — currently estimated from
                  duration, not usage tokens.
                </li>
                <li>Audio playback of past sessions is not supported.</li>
              </ul>
            </article>
          </div>
        </section>
      ) : accessToken !== null ? (
        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">History</p>
            <h2>Past conversations.</h2>
            <p className="lede lede--compact">
              Each completed voice session is stored below with duration,
              provider, and an estimated cost. Click a row to expand the
              transcript.
            </p>
            <p className="voice-history-cost-note">
              Cost estimates are approximate. xAI rate: $3/hr. OpenAI rate:
              ~$0.10–$0.35/min (midpoint used).
            </p>
          </div>

          <div className="voice-history-list">
            {isLoadingHistory ? (
              <p className="section-detail">Loading history…</p>
            ) : historyRecords.length === 0 ? (
              <p className="section-detail">
                No conversations recorded yet. Complete a voice session to see
                it here.
              </p>
            ) : (
              historyRecords.map((rec) => (
                <div
                  className="voice-history-item"
                  key={rec.id}
                  onClick={() => void handleExpandConversation(rec.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      void handleExpandConversation(rec.id);
                    }
                  }}
                >
                  <div className="voice-history-item-meta">
                    <strong>{new Date(rec.started_at).toLocaleString()}</strong>
                    <span className="voice-history-meta-chip">
                      {rec.provider}/{rec.voice}
                    </span>
                    {rec.duration_seconds !== null ? (
                      <span className="voice-history-meta-chip">
                        {formatDuration(rec.duration_seconds)}
                      </span>
                    ) : null}
                    {rec.estimated_cost_usd !== null ? (
                      <span className="voice-history-meta-chip">
                        ~{formatCost(rec.estimated_cost_usd)}
                      </span>
                    ) : null}
                    <span className="voice-history-meta-chip">
                      {rec.entry_count} entries
                    </span>
                  </div>

                  {expandedId === rec.id ? (
                    expandedDetail ? (
                      <div className="voice-history-transcript">
                        {expandedDetail.transcript.map((entry, idx) =>
                          entry.role === 'tool_call' ? (
                            <article
                              className="voice-message voice-message--tool-call"
                              key={idx}
                            >
                              <p className="voice-tool-call-name">
                                {entry.tool_name}
                              </p>
                              {Object.entries(entry.args).map(([key, val]) => (
                                <p className="voice-tool-call-arg" key={key}>
                                  <span className="voice-tool-call-arg-key">
                                    {key}:
                                  </span>{' '}
                                  {String(val)}
                                </p>
                              ))}
                            </article>
                          ) : (
                            <article
                              className={`voice-message voice-message--${entry.role}`}
                              key={idx}
                            >
                              <p className="card-kicker">
                                {entry.role === 'advisor' ? 'Advisor' : 'You'}
                              </p>
                              <p>{entry.text}</p>
                            </article>
                          ),
                        )}
                      </div>
                    ) : (
                      <p className="section-detail">Loading transcript…</p>
                    )
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>
      ) : (
        <InlineAccessPanel
          experienceId="voice-demo"
          onAccessGranted={setTokenOverride}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function formatCost(usd: number): string {
  if (usd < 0.001) {
    return '< $0.001';
  }
  return `$${usd.toFixed(4)}`;
}

// ---------------------------------------------------------------------------
// Audio helpers
// ---------------------------------------------------------------------------

function float32ToPcm16(float32: Float32Array): Int16Array {
  const out = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function pcm16ToFloat32(pcm16: Int16Array): Float32Array {
  const out = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    out[i] = pcm16[i] / (pcm16[i] < 0 ? 0x8000 : 0x7fff);
  }
  return out;
}

// G.711 μ-law encoding/decoding (ITU-T G.711)
function encodeMuLaw(pcm16: Int16Array): Uint8Array {
  const BIAS = 33;
  const CLIP = 32635;
  const out = new Uint8Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) {
    let s = pcm16[i];
    const sign = s < 0 ? 0x80 : 0;
    if (s < 0) s = -s;
    if (s > CLIP) s = CLIP;
    s += BIAS;
    let exp = 7;
    for (let mask = 0x4000; (s & mask) === 0 && exp > 0; exp--, mask >>= 1) {
      /* find highest set bit */
    }
    const mantissa = (s >> (exp + 3)) & 0x0f;
    out[i] = ~(sign | (exp << 4) | mantissa) & 0xff;
  }
  return out;
}

function decodeMuLaw(mulaw: Uint8Array): Int16Array {
  const out = new Int16Array(mulaw.length);
  for (let i = 0; i < mulaw.length; i++) {
    const b = ~mulaw[i];
    const sign = b & 0x80;
    const exp = (b >> 4) & 0x07;
    const mantissa = b & 0x0f;
    const s = ((mantissa | 0x10) << (exp + 3)) - 33;
    out[i] = sign ? -s : s;
  }
  return out;
}

function arrayBufferToBase64(buffer: ArrayBufferLike): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (const b of bytes) {
    binary += String.fromCharCode(b);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
