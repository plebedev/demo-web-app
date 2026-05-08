'use client';

import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { clearStoredAccessToken } from '@/lib/access-token';
import { useProtectedAccess } from '@/hooks/use-protected-access';

type VoiceTab = 'test' | 'configuration';

type VoicePersona = {
  id: number;
  name: string;
  instructions: string;
  capabilities: string | null;
  tool_config: string | null;
  is_active: boolean;
};

type VoiceConfig = {
  id: number;
  experience_id: string;
  voice_name: string;
  synthesized_greeting: string | null;
  greeting_synced_at: string | null;
};

type ConnectionState = 'idle' | 'connecting' | 'connected' | 'error';

type TranscriptEntry = { id: number; role: 'advisor' | 'user'; text: string };

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
  const { accessToken, isChecking } = useProtectedAccess('voice-demo');
  const [activeTab, setActiveTab] = useState<VoiceTab>('test');

  // Configuration state
  const [personas, setPersonas] = useState<VoicePersona[]>([]);
  const [selectedPersonaId, setSelectedPersonaId] = useState<number | null>(
    null,
  );
  const [config, setConfig] = useState<VoiceConfig | null>(null);
  const [personaForm, setPersonaForm] =
    useState<PersonaFormState>(emptyPersonaForm);
  const [voiceName, setVoiceName] = useState('');

  // Loading / saving state
  const [isLoadingPersonas, setIsLoadingPersonas] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Test (voice call) state
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('idle');
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  // Feedback
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // WebSocket / audio refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nextPlayTimeRef = useRef(0);
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
      } catch {
        // Config not yet created — not an error
      }
    }

    void loadPersonas();
    void loadConfig();

    return () => {
      active = false;
    };
  }, [accessToken]);

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
          body: JSON.stringify({ voice_name: voiceName.trim() }),
        });
        if (!configResponse.ok) {
          throw new Error('Unable to save voice configuration.');
        }
        const configPayload = (await configResponse.json()) as VoiceConfig;
        setConfig(configPayload);
        setVoiceName(configPayload.voice_name);
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
    const wsUrl = `${wsBase}/api/voice/browser-stream?token=${encodeURIComponent(accessToken)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setConnectionState('connected');

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          data?: string;
          text?: string;
          message?: string;
        };
        if (msg.type === 'audio' && msg.data) {
          playAudio(msg.data);
        } else if (msg.type === 'transcript' && msg.text) {
          appendTranscript('advisor', msg.text);
        } else if (msg.type === 'user_transcript' && msg.text) {
          appendTranscript('user', msg.text);
        } else if (msg.type === 'end') {
          // Close WS and stop mic capture immediately, but let queued
          // audio finish before tearing down the AudioContext.
          wsRef.current?.close();
          wsRef.current = null;
          processorRef.current?.disconnect();
          processorRef.current = null;
          streamRef.current?.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
          const ctx = audioCtxRef.current;
          const remainingMs = ctx
            ? Math.max(0, nextPlayTimeRef.current - ctx.currentTime) * 1000
            : 0;
          setTimeout(() => {
            void audioCtxRef.current?.close();
            audioCtxRef.current = null;
            nextPlayTimeRef.current = 0;
            setConnectionState('idle');
          }, remainingMs + 150);
        } else if (msg.type === 'error') {
          setError(msg.message ?? 'Unknown error from voice service.');
          setConnectionState('error');
        }
      } catch {
        // ignore malformed frames
      }
    };

    ws.onerror = () => {
      setError(
        'Connection error. Check that the backend is reachable and XAI_API_KEY is set.',
      );
      setConnectionState('error');
    };

    ws.onclose = () => {
      setConnectionState((current) => (current === 'error' ? 'error' : 'idle'));
      stopMic();
    };

    await startMic(ws);
  }

  function stopSession() {
    wsRef.current?.close();
    wsRef.current = null;
    nextPlayTimeRef.current = 0;
    stopMic();
    setConnectionState('idle');
  }

  async function startMic(ws: WebSocket) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const ctx = new AudioContext({ sampleRate: 24000 });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) {
          return;
        }
        const float32 = e.inputBuffer.getChannelData(0);
        const b64 = arrayBufferToBase64(float32ToPcm16(float32).buffer);
        ws.send(JSON.stringify({ type: 'audio', data: b64 }));
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

  function stopMic() {
    processorRef.current?.disconnect();
    processorRef.current = null;
    void audioCtxRef.current?.close();
    audioCtxRef.current = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  function playAudio(b64: string) {
    const ctx = audioCtxRef.current;
    if (!ctx) {
      return;
    }
    const pcm16 = new Int16Array(base64ToArrayBuffer(b64));
    const float32 = pcm16ToFloat32(pcm16);
    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    const startTime = Math.max(ctx.currentTime, nextPlayTimeRef.current);
    src.start(startTime);
    nextPlayTimeRef.current = startTime + buffer.duration;
  }

  function appendTranscript(role: 'advisor' | 'user', text: string) {
    setTranscript((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.role === role) {
        return [...prev.slice(0, -1), { ...last, text: last.text + text }];
      }
      return [...prev, { id: ++entryIdRef.current, role, text }];
    });
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
          <Link href="/">Access hub</Link>
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
      ) : activeTab === 'test' ? (
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
                  transcript.map((entry) => (
                    <article
                      className={`voice-message voice-message--${entry.role}`}
                      key={entry.id}
                    >
                      <p className="card-kicker">
                        {entry.role === 'advisor' ? 'Advisor' : 'You'}
                      </p>
                      <p>{entry.text}</p>
                    </article>
                  ))
                )}
                <div ref={transcriptEndRef} />
              </div>
            </section>
          </div>
        </section>
      ) : (
        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">Configuration</p>
            <h2>Configure the voice advisor.</h2>
            <p className="lede lede--compact">
              Set the voice character name and create personas with instructions
              and embedded guidance. The greeting is synthesized automatically
              when personas change.
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
                    Character name
                  </label>
                  <input
                    id="voice-name"
                    className="text-input"
                    onChange={(event) => setVoiceName(event.target.value)}
                    placeholder="e.g. Eve"
                    value={voiceName}
                  />
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
                        (!voiceName.trim() && !personaForm.instructions.trim())
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
      )}
    </main>
  );
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
