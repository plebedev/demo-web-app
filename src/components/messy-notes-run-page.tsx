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
  RunEvent,
  RunExecutionSummary,
  SampleChaosListResponse,
  SampleChaosSet,
  deriveRunTitle,
  formatEventType,
  formatRunStatus,
  summarizeStickyBoardText,
} from '@/lib/demo-runs';
import { formatByteLimit, phase1DemoConfig } from '@/lib/phase1-demo';

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
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [summary, setSummary] = useState<RunExecutionSummary | null>(null);
  const [runs, setRuns] = useState<DemoRun[]>([]);
  const [samples, setSamples] = useState<SampleChaosSet[]>([]);
  const [selectedSampleKey, setSelectedSampleKey] = useState('');
  const [title, setTitle] = useState('');
  const [inputText, setInputText] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [wantsSms, setWantsSms] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [phoneNumberBlocked, setPhoneNumberBlocked] = useState(false);
  const [isCheckingPhoneStatus, setIsCheckingPhoneStatus] = useState(false);
  const [followUpQuestion, setFollowUpQuestion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);
  const [isSavingPreference, setIsSavingPreference] = useState(false);
  const [isAskingFollowUp, setIsAskingFollowUp] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    const token = accessToken;

    let active = true;

    async function loadRun() {
      try {
        const [
          runResponse,
          listResponse,
          eventsResponse,
          summaryResponse,
          samplesResponse,
        ] = await Promise.all([
          fetch(`/api/bff/runs/${runId}`, {
            cache: 'no-store',
            headers: authHeaders(token),
          }),
          fetch('/api/bff/runs', {
            cache: 'no-store',
            headers: authHeaders(token),
          }),
          fetch(`/api/bff/runs/${runId}/events`, {
            cache: 'no-store',
            headers: authHeaders(token),
          }),
          fetch(`/api/bff/runs/${runId}/summary`, {
            cache: 'no-store',
            headers: authHeaders(token),
          }),
          fetch('/api/bff/runs/samples', {
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
        const eventsPayload = eventsResponse.ok
          ? ((await eventsResponse.json()) as RunEvent[])
          : [];
        const summaryPayload = summaryResponse.ok
          ? ((await summaryResponse.json()) as RunExecutionSummary)
          : null;
        const samplesPayload = samplesResponse.ok
          ? ((await samplesResponse.json()) as SampleChaosListResponse)
          : { samples: [] };

        if (!active) {
          return;
        }

        setRun(runPayload);
        setEvents(eventsPayload);
        setSummary(summaryPayload);
        setRuns(listPayload.runs);
        setSamples(samplesPayload.samples);
        setSelectedSampleKey(samplesPayload.samples[0]?.key || '');
        setTitle(runPayload.title || '');
        setInputText(runPayload.input_text || '');
        setWantsSms(
          runPayload.notification_preference_json?.wants_sms || false,
        );
        setPhoneNumber(
          runPayload.notification_preference_json?.phone_number || '',
        );
        setPhoneNumberBlocked(
          runPayload.notification_preference_json?.phone_number_blocked ||
            false,
        );
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
  const canFollowUp =
    run?.status === 'completed' &&
    Boolean(run.output_brief_json) &&
    run.follow_up_count < 1;

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

  function hasUnsavedNotificationPreferenceChanges() {
    if (!run) {
      return false;
    }

    const savedPreference = run.notification_preference_json;
    const savedWantsSms = savedPreference?.wants_sms || false;
    const savedPhoneNumber = savedPreference?.phone_number || '';
    return (
      wantsSms !== savedWantsSms ||
      (wantsSms && phoneNumber.trim() !== savedPhoneNumber)
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

  async function persistNotificationPreference() {
    if (!accessToken || !run) {
      throw new Error('Unable to save notification preference.');
    }
    if (!hasUnsavedNotificationPreferenceChanges()) {
      return run;
    }

    const response = await fetch(
      `/api/bff/runs/${run.id}/notification-preference`,
      {
        method: 'POST',
        headers: {
          ...authHeaders(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wants_sms: wantsSms,
          phone_number: wantsSms ? phoneNumber : null,
        }),
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        detail?: string;
      } | null;
      throw new Error(
        payload?.detail || 'Unable to save notification preference.',
      );
    }

    const nextRun = (await response.json()) as DemoRun;
    setRun(nextRun);
    setWantsSms(nextRun.notification_preference_json?.wants_sms || false);
    setPhoneNumber(nextRun.notification_preference_json?.phone_number || '');
    setPhoneNumberBlocked(
      nextRun.notification_preference_json?.phone_number_blocked || false,
    );
    setError(null);
    return nextRun;
  }

  async function handleSave() {
    if (!accessToken || !run || !canSubmit) {
      return;
    }

    setIsSaving(true);
    setNotice(null);

    try {
      const savedRun = await persistIngestion();
      if (!savedRun) {
        return;
      }

      await persistNotificationPreference();

      setNotice('Draft saved. Notification preference is up to date.');
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

  async function handleLoadSample() {
    if (!accessToken || !run || !selectedSampleKey) {
      return;
    }

    setIsLoadingSample(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/bff/runs/${run.id}/sample`, {
        method: 'POST',
        headers: {
          ...authHeaders(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sample_key: selectedSampleKey }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(payload?.detail || 'Unable to load sample chaos.');
      }

      const nextRun = (await response.json()) as DemoRun;
      setRun(nextRun);
      setTitle(nextRun.title || '');
      setInputText(nextRun.input_text || '');
      setSelectedFiles([]);
      setNotice(
        'Sample chaos loaded. It is curated, not freshly hallucinated.',
      );
      setError(null);
    } catch (sampleError) {
      setError(
        sampleError instanceof Error
          ? sampleError.message
          : 'Unable to load sample chaos.',
      );
    } finally {
      setIsLoadingSample(false);
    }
  }

  async function handleSaveNotificationPreference() {
    if (!accessToken || !run) {
      return;
    }

    setIsSavingPreference(true);
    setNotice(null);

    try {
      const nextRun = await persistNotificationPreference();
      setNotice(
        nextRun.notification_preference_json?.wants_sms
          ? 'Preference saved. The backend will send a Twilio SMS when this run completes.'
          : 'Preference saved. No text will be attempted for this run.',
      );
      setError(null);
    } catch (preferenceError) {
      setError(
        preferenceError instanceof Error
          ? preferenceError.message
          : 'Unable to save notification preference.',
      );
    } finally {
      setIsSavingPreference(false);
    }
  }

  async function handlePhoneStatusCheck() {
    if (!accessToken || !wantsSms || !phoneNumber.trim()) {
      setPhoneNumberBlocked(false);
      return;
    }

    setIsCheckingPhoneStatus(true);
    try {
      const response = await fetch('/api/bff/runs/sms-status', {
        method: 'POST',
        headers: {
          ...authHeaders(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        valid: boolean;
        phone_number: string | null;
        phone_number_blocked: boolean;
      };
      setPhoneNumberBlocked(payload.phone_number_blocked);
      if (payload.phone_number) {
        setPhoneNumber(payload.phone_number);
      }
    } finally {
      setIsCheckingPhoneStatus(false);
    }
  }

  async function handleAskFollowUp() {
    if (!accessToken || !run) {
      return;
    }

    setIsAskingFollowUp(true);
    setNotice(null);

    try {
      const response = await fetch(`/api/bff/runs/${run.id}/follow-up`, {
        method: 'POST',
        headers: {
          ...authHeaders(accessToken),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ question: followUpQuestion }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          detail?: string;
        } | null;
        throw new Error(payload?.detail || 'Unable to answer follow-up.');
      }

      const nextRun = (await response.json()) as DemoRun;
      setRun(nextRun);
      setFollowUpQuestion('');
      setNotice('Follow-up answered. Boundaries have re-entered the chat.');
      setError(null);
    } catch (followUpError) {
      setError(
        followUpError instanceof Error
          ? followUpError.message
          : 'Unable to answer follow-up.',
      );
    } finally {
      setIsAskingFollowUp(false);
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

      if (hasUnsavedNotificationPreferenceChanges()) {
        const preferenceRun = await persistNotificationPreference();
        targetRun = preferenceRun;
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
      await refreshEvents(payload.id);
      await refreshSummary(payload.id);
      setNotice(
        payload.status === 'completed'
          ? 'Run completed. The workflow produced a bounded brief and audit.'
          : 'Run submitted. The workflow is processing inside configured bounds.',
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

  async function refreshEvents(targetRunId: number) {
    if (!accessToken) {
      return;
    }

    const response = await fetch(`/api/bff/runs/${targetRunId}/events`, {
      cache: 'no-store',
      headers: authHeaders(accessToken),
    });
    if (response.ok) {
      setEvents((await response.json()) as RunEvent[]);
    }
  }

  async function refreshSummary(targetRunId: number) {
    if (!accessToken) {
      return;
    }

    const response = await fetch(`/api/bff/runs/${targetRunId}/summary`, {
      cache: 'no-store',
      headers: authHeaders(accessToken),
    });
    if (response.ok) {
      setSummary((await response.json()) as RunExecutionSummary);
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
                <span className="run-sidebar-id">#{savedRun.id}</span>
                <strong>{savedRun.title || 'Untitled run'}</strong>
                <span
                  className={`status-pill status-pill--compact status-pill--${savedRun.status}`}
                >
                  {formatRunStatus(savedRun.status)}
                </span>
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
            {run.status === 'failed' ? (
              <p className="error-text">
                This run failed. You can adjust the notes and submit again; the
                workflow will keep the failure state visible.
                {run.failure_message ? ` ${run.failure_message}` : ''}
              </p>
            ) : null}
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

              <div className="sample-chaos-row">
                <div>
                  <label className="field-label" htmlFor="sample-chaos">
                    Sample chaos
                  </label>
                  <select
                    id="sample-chaos"
                    className="text-input"
                    disabled={!canSubmit || samples.length === 0}
                    onChange={(event) =>
                      setSelectedSampleKey(event.target.value)
                    }
                    value={selectedSampleKey}
                  >
                    {samples.map((sample) => (
                      <option key={sample.key} value={sample.key}>
                        {sample.title}
                      </option>
                    ))}
                  </select>
                  <p className="section-detail section-detail--compact-left">
                    {samples.find((sample) => sample.key === selectedSampleKey)
                      ?.description ||
                      'Curated examples are loaded from the backend.'}
                  </p>
                </div>
                <button
                  className="ghost-button"
                  disabled={!canSubmit || isLoadingSample}
                  onClick={handleLoadSample}
                  type="button"
                >
                  {isLoadingSample ? 'Loading…' : 'Load sample chaos'}
                </button>
              </div>

              <div className="editor-label-row">
                <label className="field-label" htmlFor="run-input-text">
                  Pasted notes
                </label>
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
                  routed into workflow execution.
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

              <div className="notification-box">
                <label className="checkbox-row" htmlFor="notify-sms">
                  <input
                    checked={wantsSms}
                    disabled={phoneNumberBlocked && !wantsSms}
                    id="notify-sms"
                    onChange={(event) => {
                      setWantsSms(event.target.checked);
                      if (!event.target.checked) {
                        setPhoneNumberBlocked(false);
                      }
                    }}
                    type="checkbox"
                  />
                  <span>Text me when it is done</span>
                </label>
                {wantsSms ? (
                  <input
                    aria-label="US phone number"
                    className="text-input"
                    aria-invalid={phoneNumberBlocked}
                    onBlur={handlePhoneStatusCheck}
                    onChange={(event) => {
                      setPhoneNumber(event.target.value);
                      setPhoneNumberBlocked(false);
                    }}
                    placeholder="US phone number"
                    value={phoneNumber}
                  />
                ) : null}
                {phoneNumberBlocked ? (
                  <p className="error-text">
                    This number is in the permanent opt-out list.
                  </p>
                ) : null}
                <button
                  className="ghost-button"
                  disabled={
                    isSavingPreference ||
                    isCheckingPhoneStatus ||
                    (wantsSms && phoneNumberBlocked)
                  }
                  onClick={handleSaveNotificationPreference}
                  type="button"
                >
                  {isSavingPreference || isCheckingPhoneStatus
                    ? 'Saving…'
                    : 'Save notification preference'}
                </button>
                <p className="section-detail section-detail--compact-left">
                  By checking this box, you agree to receive SMS notifications
                  related to your demo run. Message frequency varies. Message
                  and data rates may apply. Reply STOP to opt out.
                </p>
                <p className="section-detail section-detail--compact-left">
                  Twilio sends the completion text from backend code. Replies
                  are limited to two AI-generated SMS turns.
                </p>
              </div>

              <div className="workspace-toolbar">
                {canSubmit ? (
                  <button
                    className="primary-button"
                    disabled={isSaving}
                    onClick={handleSave}
                    type="button"
                  >
                    {isSaving ? 'Saving…' : 'Save draft'}
                  </button>
                ) : null}
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
              <p className="card-kicker">Generated brief</p>
              <h3>{briefTitle(run.output_brief_json)}</h3>
              {run.status === 'processing' || run.status === 'submitted' ? (
                <p className="section-detail">
                  Processing is underway. The workflow is sorting the pile
                  without claiming it found buried treasure.
                </p>
              ) : run.status === 'failed' ? (
                <p className="error-text">
                  This run failed during bounded execution. Check the execution
                  summary below.
                </p>
              ) : run.output_brief_json ? (
                <div className="brief-output">
                  <p className="section-detail">
                    {String(run.output_brief_json.executive_summary || '')}
                  </p>
                  {briefSections(run.output_brief_json).map((section) => (
                    <div key={section.heading} className="brief-section">
                      <strong>{section.heading}</strong>
                      <p>{section.content}</p>
                    </div>
                  ))}
                  {briefList(run.output_brief_json.open_questions).length ? (
                    <ul className="source-list">
                      {briefList(run.output_brief_json.open_questions).map(
                        (question) => (
                          <li key={question}>{question}</li>
                        ),
                      )}
                    </ul>
                  ) : null}
                  <div className="follow-up-box">
                    <p className="card-kicker">Guarded follow-up</p>
                    {canFollowUp ? (
                      <>
                        <p className="section-detail">
                          You get one follow-up question. Use it wisely.
                        </p>
                        <textarea
                          aria-label="Follow-up question"
                          className="text-area text-area--compact"
                          onChange={(event) =>
                            setFollowUpQuestion(event.target.value)
                          }
                          placeholder="Try: summarize only risks, clarify a contradiction, or explain one point from the brief."
                          rows={3}
                          value={followUpQuestion}
                        />
                        <button
                          className="secondary-button"
                          disabled={
                            isAskingFollowUp ||
                            followUpQuestion.trim().length < 3
                          }
                          onClick={handleAskFollowUp}
                          type="button"
                        >
                          {isAskingFollowUp ? 'Answering…' : 'Ask follow-up'}
                        </button>
                      </>
                    ) : run.follow_up_response_json ? (
                      <div className="follow-up-answer">
                        <strong>{run.follow_up_response_json.question}</strong>
                        <p>{run.follow_up_response_json.answer}</p>
                        <span>One follow-up used. Boundaries restored.</span>
                      </div>
                    ) : (
                      <p className="section-detail">
                        Follow-up appears after completion. One question only;
                        this demo has hobbies outside of chat.
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="section-detail">
                  No generated brief yet. Load sample chaos or paste your own
                  notes, then submit the run.
                </p>
              )}
            </article>

            <article className="section-card">
              <p className="card-kicker">Execution summary</p>
              <h3>How it worked</h3>
              {summary ? (
                <div className="execution-summary-stack">
                  {summary.failure_message ? (
                    <p className="error-text">{summary.failure_message}</p>
                  ) : null}
                  <SummaryList
                    emptyText="No workflow phases have been recorded yet."
                    items={summary.phase_summary}
                    title="Phases"
                  />
                  <SummaryList
                    emptyText="No tool results have been recorded yet."
                    items={summary.tool_usage_summary}
                    title="Tools"
                  />
                  <SummaryList
                    emptyText="No handoffs have been recorded yet."
                    items={summary.handoff_summary}
                    title="Handoffs"
                  />
                  {summary.audit_summary ? (
                    <p className="success-text">{summary.audit_summary}</p>
                  ) : null}
                </div>
              ) : events.length ? (
                <ul className="source-list">
                  {events.slice(-8).map((event) => (
                    <li key={event.id}>
                      <strong>{formatEventType(event.event_type)}</strong>
                      <span>
                        {event.agent_role ||
                          event.tool_name ||
                          event.post_processor_key ||
                          'run'}
                        {event.handoff_source_role && event.handoff_target_role
                          ? `: ${event.handoff_source_role} to ${event.handoff_target_role}`
                          : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="section-detail">
                  Execution events will appear after the run starts.
                </p>
              )}
            </article>
          </section>

          <section className="editor-panels editor-panels--results">
            <article className="section-card">
              <p className="card-kicker">Audit summary</p>
              <h3>Post-processor review</h3>
              {auditResult(run) ? (
                <>
                  <p className="section-detail">{auditResult(run)?.summary}</p>
                  <p className="section-detail">
                    Assessment:{' '}
                    <button
                      className="inline-link-button"
                      onClick={() => setIsAuditOpen(true)}
                      type="button"
                    >
                      {auditResult(run)?.overall_assessment}
                    </button>
                  </p>
                  {auditResult(run)?.suspicious_actions.length ? (
                    <ul className="source-list">
                      {auditResult(run)?.suspicious_actions.map((action) => (
                        <li key={action}>{action}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="success-text">
                      Tool use and handoffs stayed inside the configured graph.
                    </p>
                  )}
                </>
              ) : (
                <p className="section-detail">
                  The audit post-processor runs after completion.
                </p>
              )}
            </article>

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
      {isAuditOpen && auditResult(run) ? (
        <AuditDetailsOverlay
          events={events}
          onClose={() => setIsAuditOpen(false)}
          run={run}
        />
      ) : null}
    </ProtectedDemoShell>
  );
}

function AuditDetailsOverlay({
  events,
  onClose,
  run,
}: Readonly<{
  events: RunEvent[];
  onClose: () => void;
  run: DemoRun;
}>) {
  const audit = auditResult(run);
  const toolEvents = events.filter(
    (event) =>
      event.event_type === 'tool_called' || event.event_type === 'tool_result',
  );
  const handoffEvents = events.filter(
    (event) => event.event_type === 'handoff_occurred',
  );

  return (
    <div
      aria-labelledby="audit-details-title"
      aria-modal="true"
      className="audit-overlay"
      role="dialog"
    >
      <div className="audit-panel">
        <div className="run-card-row">
          <div>
            <p className="card-kicker">Audit details</p>
            <h3 id="audit-details-title">
              Assessment: {audit?.overall_assessment}
            </h3>
          </div>
          <button className="secondary-button" onClick={onClose} type="button">
            Close
          </button>
        </div>

        <p className="section-detail">{audit?.summary}</p>

        <div className="audit-detail-grid">
          <section>
            <p className="card-kicker">Tool calls</p>
            {toolEvents.length ? (
              <ul className="event-detail-list">
                {toolEvents.map((event) => (
                  <li key={event.id}>
                    <div className="run-card-row">
                      <strong>
                        {event.tool_name || formatEventType(event.event_type)}
                      </strong>
                      <span>{formatEventType(event.event_type)}</span>
                    </div>
                    <p>{event.agent_role || 'run'}</p>
                    {event.tool_arguments ? (
                      <pre>{formatJson(event.tool_arguments)}</pre>
                    ) : null}
                    {event.tool_result ? (
                      <pre>{formatJson(event.tool_result)}</pre>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="section-detail">No tool events are stored yet.</p>
            )}
          </section>

          <section>
            <p className="card-kicker">Handoffs</p>
            {handoffEvents.length ? (
              <ul className="event-detail-list">
                {handoffEvents.map((event) => (
                  <li key={event.id}>
                    <strong>
                      {event.handoff_source_role} to {event.handoff_target_role}
                    </strong>
                    <p>{event.message || 'Configured handoff recorded.'}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="section-detail">
                No handoff events are stored yet.
              </p>
            )}

            <p className="card-kicker audit-subheading">
              Post-processor findings
            </p>
            <ul className="event-detail-list">
              {(audit?.tool_usage_findings || []).map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
              {(audit?.handoff_findings || []).map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
              {(audit?.suspicious_actions || []).map((finding) => (
                <li key={finding}>{finding}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function SummaryList({
  emptyText,
  items,
  title,
}: Readonly<{
  emptyText: string;
  items: string[];
  title: string;
}>) {
  return (
    <div>
      <p className="card-kicker">{title}</p>
      {items.length ? (
        <ul className="source-list">
          {items.slice(0, 6).map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="section-detail section-detail--compact-left">
          {emptyText}
        </p>
      )}
    </div>
  );
}

function briefTitle(output: Record<string, unknown> | null): string {
  return output ? String(output.title || 'Generated brief') : 'Awaiting brief';
}

function briefSections(output: Record<string, unknown>) {
  const sections = output.sections;
  if (!Array.isArray(sections)) {
    return [];
  }
  return sections
    .map((section) => {
      if (!section || typeof section !== 'object') {
        return null;
      }
      const candidate = section as Record<string, unknown>;
      return {
        heading: String(candidate.heading || 'Section'),
        content: String(candidate.content || ''),
      };
    })
    .filter((section): section is { heading: string; content: string } =>
      Boolean(section),
    );
}

function briefList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)) : [];
}

function auditResult(run: DemoRun) {
  const results = run.post_processor_results_json;
  if (!results) {
    return null;
  }
  return results['audit-tool-usage-and-handoffs'] || null;
}

function formatJson(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}
