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
  summarizeStickyBoardText,
} from '@/lib/demo-runs';
import { formatByteLimit, phase1DemoConfig } from '@/lib/phase1-demo';

const sampleChaos = `Board wants a tighter renewal story
Procurement is worried about timeline risk
Need Oracle-safe deployment talking points
Budget pressure is real but scope can stay narrow
Ask whether legal needs a one-page summary`;

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
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

  const boardText = useMemo(
    () => summarizeStickyBoardText(run, inputText),
    [inputText, run],
  );
  const noteCount = useMemo(
    () =>
      boardText
        .split(/\n+/)
        .map((line) => line.trim())
        .filter(Boolean).length,
    [boardText],
  );

  const canSubmit =
    run !== null && (run.status === 'draft' || run.status === 'failed');

  function hasUnsavedIngestionChanges() {
    if (!run) {
      return false;
    }

    return (
      selectedFiles.length > 0 ||
      title !== (run.title || '') ||
      inputText !== (run.input_text || '')
    );
  }

  async function persistIngestion() {
    if (!accessToken || !run) {
      return null;
    }

    const payload = new FormData();
    const resolvedTitle = title.trim() || deriveRunTitle(inputText);

    if (resolvedTitle && resolvedTitle !== 'Untitled run') {
      payload.set('title', resolvedTitle);
    }
    payload.set('input_text', inputText);
    selectedFiles.forEach((file) => payload.append('files', file));

    const response = await fetch(`/api/bff/runs/${run.id}/ingest`, {
      method: 'POST',
      headers: authHeaders(accessToken),
      body: payload,
    });

    if (!response.ok) {
      const responsePayload = (await response.json().catch(() => null)) as {
        detail?: string;
      } | null;
      throw new Error(
        responsePayload?.detail || 'Unable to process this input.',
      );
    }

    const nextRun = (await response.json()) as DemoRun;
    setRun(nextRun);
    setTitle(nextRun.title || '');
    setInputText(nextRun.input_text || '');
    setSelectedFiles([]);
    setError(null);
    return nextRun;
  }

  async function handleSave() {
    if (!accessToken || !run) {
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const savedRun = await persistIngestion();
      if (!savedRun) {
        return;
      }

      setNotice('Draft saved. No fake ranking, just bounded ingestion.');
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
      let targetRun = run;
      if (hasUnsavedIngestionChanges()) {
        const savedRun = await persistIngestion();
        if (!savedRun) {
          return;
        }
        targetRun = savedRun;
      }

      const response = await fetch(`/api/bff/runs/${targetRun.id}/submit`, {
        method: 'POST',
        headers: authHeaders(accessToken),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(payload?.detail || 'Unable to submit this run.');
      }

      const payload = (await response.json()) as DemoRun;
      setRun(payload);
      setNotice(
        'Run submitted. The ingestion is real; the later workflow is still intentionally bounded.',
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
              Phase 1 accepts pasted text, plain text files, and PDFs with
              extractable text. It does not do OCR, images, audio, video, or web
              lookup, and it will trim input by simple fixed limits instead of
              pretending to understand everything first.
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
                  'Paste meeting notes, call scraps, or internal bullets here.\n\nThe demo keeps the raw pasted text, then trims the workflow input deterministically if it gets too large.'
                }
                rows={12}
                value={inputText}
              />

              <div className="file-input-block">
                <label className="field-label" htmlFor="run-files">
                  Attach files
                </label>
                <input
                  id="run-files"
                  accept=".txt,text/plain,.pdf,application/pdf"
                  className="text-input"
                  multiple
                  onChange={(event) =>
                    setSelectedFiles(Array.from(event.target.files || []))
                  }
                  type="file"
                />
                <p className="section-detail section-detail--compact">
                  Supported: pasted text, `.txt`, and PDFs with selectable text.
                  Unsupported: images, OCR-only PDFs, audio/video, web lookup.
                </p>
                <p className="section-detail section-detail--compact">
                  Limits: {phase1DemoConfig.limits.maxFilesPerRun} files,{' '}
                  {formatByteLimit(phase1DemoConfig.limits.maxFileSizeBytes)}{' '}
                  per file,{' '}
                  {formatByteLimit(phase1DemoConfig.limits.maxPastedTextBytes)}{' '}
                  of pasted text stored, and{' '}
                  {formatByteLimit(
                    phase1DemoConfig.limits.maxTotalWorkflowTextBytes,
                  )}{' '}
                  routed into future workflow text.
                </p>
                {selectedFiles.length > 0 ? (
                  <ul className="source-list" aria-label="Selected files">
                    {selectedFiles.map((file) => (
                      <li key={`${file.name}-${file.size}`}>
                        <strong>{file.name}</strong>{' '}
                        <span>{file.type || 'Unknown type'}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

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
                  Pasted notes stay sticky. File details live below where they
                  can be honest about what got kept.
                </p>
              </div>
              <StickyNotesBoard inputText={boardText} />
            </article>
          </section>

          <section className="editor-panels editor-panels--results">
            <article className="section-card">
              <p className="card-kicker">Accepted input</p>
              <h3>What made it into the run</h3>
              {run.uploaded_files_json?.length ? (
                <ul className="source-list">
                  {run.uploaded_files_json.map((file) => (
                    <li key={file.file_name}>
                      <strong>{file.file_name}</strong>
                      <span>
                        {file.content_type} •{' '}
                        {formatByteLimit(file.file_size_bytes)}
                        {file.trimmed ? ' • kept first slice only' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="section-detail">
                  No accepted file attachments yet. Pasted text still counts.
                </p>
              )}
            </article>

            <article className="section-card">
              <p className="card-kicker">Rejected or trimmed</p>
              <h3>Boundaries, stated plainly</h3>
              {run.ingestion_summary_json?.rejected_files?.length ? (
                <ul className="source-list">
                  {run.ingestion_summary_json.rejected_files.map((file) => (
                    <li key={`${file.file_name}-${file.reason}`}>
                      <strong>{file.file_name}</strong>
                      <span>{file.reason}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="section-detail">
                  Nothing was rejected on the last save.
                </p>
              )}
              {run.ingestion_summary_json?.warnings?.length ? (
                <div className="warning-stack">
                  {run.ingestion_summary_json.warnings.map((warning) => (
                    <p key={warning} className="warning-text">
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}
            </article>
          </section>
        </div>
      </section>
    </ProtectedDemoShell>
  );
}
