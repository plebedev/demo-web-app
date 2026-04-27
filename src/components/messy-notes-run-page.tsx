'use client';

import React from 'react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ProtectedDemoShell } from '@/components/protected-demo-shell';
import { StickyNotesBoard } from '@/components/sticky-notes-board';
import { useProtectedAccess } from '@/hooks/use-protected-access';
import {
  DemoRun,
  DemoRunListResponse,
  deriveRunTitle,
  formatRunStatus,
} from '@/lib/demo-runs';

const sampleChaos = `Board wants a tighter renewal story
Procurement is worried about timeline risk
Need Oracle-safe deployment talking points
Budget pressure is real but scope can stay narrow
Ask whether legal needs a one-page summary`;

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export function MessyNotesRunPage({
  runId,
}: Readonly<{
  runId: number;
}>) {
  const { accessToken, isChecking } = useProtectedAccess();
  const [run, setRun] = useState<DemoRun | null>(null);
  const [runs, setRuns] = useState<DemoRun[]>([]);
  const [title, setTitle] = useState('');
  const [inputText, setInputText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    const token = accessToken;

    let active = true;

    async function loadRun() {
      try {
        const [runResponse, listResponse] = await Promise.all([
          fetch(`/api/bff/runs/${runId}`, {
            cache: 'no-store',
            headers: authHeaders(token),
          }),
          fetch('/api/bff/runs', {
            cache: 'no-store',
            headers: authHeaders(token),
          }),
        ]);

        if (!runResponse.ok) {
          throw new Error('Unable to load this run.');
        }

        if (!listResponse.ok) {
          throw new Error('Unable to load run history.');
        }

        const runPayload = (await runResponse.json()) as DemoRun;
        const listPayload = (await listResponse.json()) as DemoRunListResponse;

        if (!active) {
          return;
        }

        setRun(runPayload);
        setRuns(listPayload.runs);
        setTitle(runPayload.title || '');
        setInputText(runPayload.input_text || '');
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load this run.',
        );
      }
    }

    void loadRun();

    return () => {
      active = false;
    };
  }, [accessToken, runId]);

  const noteCount = useMemo(
    () =>
      inputText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean).length,
    [inputText],
  );

  const canSubmit =
    run !== null && (run.status === 'draft' || run.status === 'failed');

  function buildPayload() {
    const resolvedTitle = title.trim() || deriveRunTitle(inputText);

    return {
      title: resolvedTitle === 'Untitled run' ? null : resolvedTitle,
      input_text: inputText,
      input_metadata_json: {
        source_kind: 'pasted_text',
        note_count: noteCount,
        phase_1_uploads_planned: ['text files', 'extractable PDFs'],
      },
    };
  }

  async function handleSave() {
    if (!accessToken || !run) {
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/bff/runs/${run.id}`, {
        method: 'PUT',
        headers: authHeaders(accessToken),
        body: JSON.stringify(buildPayload()),
      });

      if (!response.ok) {
        throw new Error('Unable to save this draft.');
      }

      const payload = (await response.json()) as DemoRun;
      setRun(payload);
      setTitle(payload.title || '');
      setInputText(payload.input_text || '');
      setNotice('Draft saved to the backend.');
      setError(null);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : 'Unable to save this draft.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    if (!accessToken || !run) {
      return;
    }

    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/bff/runs/${run.id}/submit`, {
        method: 'POST',
        headers: authHeaders(accessToken),
        body: JSON.stringify(buildPayload()),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(payload?.detail || 'Unable to submit this run.');
      }

      const payload = (await response.json()) as DemoRun;
      setRun(payload);
      setTitle(payload.title || '');
      setInputText(payload.input_text || '');
      setNotice(
        'Run submitted. Async processing is not wired yet, so the status stops at submitted for now.',
      );
      setError(null);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Unable to submit this run.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isChecking || run === null) {
    return (
      <ProtectedDemoShell activePath="workspace">
        <section className="workspace-hero">
          <p className="eyebrow">Run workspace</p>
          <h1>{error || 'Loading saved run details.'}</h1>
        </section>
      </ProtectedDemoShell>
    );
  }

  return (
    <ProtectedDemoShell activePath="workspace">
      <section className="editor-grid">
        <aside className="section-card editor-sidebar">
          <p className="card-kicker">Run history</p>
          <div className="run-sidebar-list">
            {runs.map((savedRun) => (
              <Link
                key={savedRun.id}
                className={`run-sidebar-link ${
                  savedRun.id === run.id ? 'run-sidebar-link-active' : ''
                }`}
                href={`/messy-notes/${savedRun.id}`}
              >
                <span>#{savedRun.id}</span>
                <strong>{savedRun.title || 'Untitled run'}</strong>
              </Link>
            ))}
          </div>
        </aside>

        <div className="editor-main">
          <section className="section-card editor-header">
            <div className="run-card-row">
              <p className="card-kicker">Run #{run.id}</p>
              <span className={`status-pill status-pill--${run.status}`}>
                {formatRunStatus(run.status)}
              </span>
            </div>
            <h2>Messy-notes input</h2>
            <p className="section-detail">
              This is a demo. Paste notes, save the draft, and submit the run
              into a visible status change. File ingestion and brief generation
              are still future steps, not hidden fake behavior.
            </p>
          </section>

          <section className="editor-panels">
            <article className="section-card editor-form-panel">
              <label className="field-label" htmlFor="run-title">
                Run title
              </label>
              <input
                id="run-title"
                className="text-input"
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Optional short label"
                value={title}
              />

              <div className="editor-label-row">
                <label className="field-label" htmlFor="run-input-text">
                  Pasted notes
                </label>
                <button
                  className="ghost-button"
                  onClick={() => setInputText(sampleChaos)}
                  type="button"
                >
                  Load sample chaos
                </button>
              </div>

              <textarea
                id="run-input-text"
                className="text-area"
                onChange={(event) => setInputText(event.target.value)}
                placeholder={
                  'Paste meeting notes, call scraps, or internal bullets here.\n\nPhase 1 supports pasted text now. Text files and extractable PDFs are planned inputs, but not wired into this milestone yet.'
                }
                rows={12}
                value={inputText}
              />

              <div className="editor-meta-row">
                <span>{noteCount} notes on the board</span>
                <span>Follow-up count: {run.follow_up_count}</span>
              </div>

              <div className="workspace-toolbar">
                <button
                  className="primary-button"
                  disabled={isSaving}
                  onClick={handleSave}
                  type="button"
                >
                  {isSaving ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  className="secondary-button"
                  disabled={!canSubmit || isSubmitting}
                  onClick={handleSubmit}
                  type="button"
                >
                  {isSubmitting ? 'Submitting…' : 'Submit run'}
                </button>
              </div>

              {notice ? <p className="success-text">{notice}</p> : null}
              {error ? <p className="error-text">{error}</p> : null}
            </article>

            <article className="section-card editor-board-panel">
              <div className="editor-board-heading">
                <div>
                  <p className="card-kicker">Sticky-note view</p>
                  <h3>Messy dashboard preview</h3>
                </div>
                <p className="section-detail section-detail--compact">
                  Statuses are real. Processing isn&apos;t yet.
                </p>
              </div>
              <StickyNotesBoard inputText={inputText} />
            </article>
          </section>
        </div>
      </section>
    </ProtectedDemoShell>
  );
}
