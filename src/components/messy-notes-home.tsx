'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ProtectedDemoShell } from '@/components/protected-demo-shell';
import { useProtectedAccess } from '@/hooks/use-protected-access';
import { DemoRun, DemoRunListResponse, formatRunStatus } from '@/lib/demo-runs';
import { formatByteLimit, phase1DemoConfig } from '@/lib/phase1-demo';

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export function MessyNotesHome() {
  const router = useRouter();
  const { accessToken, isChecking } = useProtectedAccess();
  const [runs, setRuns] = useState<DemoRun[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    const token = accessToken;

    let active = true;

    async function loadRuns() {
      try {
        const response = await fetch('/api/bff/runs', {
          cache: 'no-store',
          headers: authHeaders(token),
        });

        if (!response.ok) {
          throw new Error('Unable to load saved runs.');
        }

        const payload = (await response.json()) as DemoRunListResponse;
        if (!active) {
          return;
        }

        setRuns(payload.runs);
        setError(null);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Unable to load saved runs.',
        );
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    }

    void loadRuns();

    return () => {
      active = false;
    };
  }, [accessToken]);

  async function handleCreateRun() {
    if (!accessToken) {
      return;
    }
    const token = accessToken;

    setIsCreating(true);

    try {
      const response = await fetch('/api/bff/runs', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        throw new Error('Unable to create a new run.');
      }

      const createdRun = (await response.json()) as DemoRun;
      router.push(`/messy-notes/${createdRun.id}`);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : 'Unable to create a new run.',
      );
    } finally {
      setIsCreating(false);
    }
  }

  if (isChecking) {
    return (
      <ProtectedDemoShell activePath="workspace">
        <section className="workspace-hero">
          <p className="eyebrow">Protected workspace</p>
          <h1>Checking your saved demo access.</h1>
        </section>
      </ProtectedDemoShell>
    );
  }

  return (
    <ProtectedDemoShell activePath="workspace">
      <section className="workspace-hero">
        <div className="hero-copy">
          <p className="eyebrow">Messy notes workspace</p>
          <h1>Turn raw notes into the first honest demo run.</h1>
          <p className="lede">
            This protected area is the runnable shell for the next phase of the
            demo: create a run, paste chaotic notes, save the draft, and submit
            it into a visible but still-bounded workflow state.
          </p>
          <div className="hero-badges">
            <span>Pasted text first</span>
            <span>File upload ingestion</span>
            <span>Sticky-note preview</span>
            <span>Backend-persisted runs</span>
          </div>
        </div>

        <section className="access-panel">
          <p className="card-kicker">Phase-1 input scope</p>
          <h2>Supported right now</h2>
          <ul className="section-list">
            {phase1DemoConfig.supportedInputs.map((item) => (
              <li key={item}>{item}</li>
            ))}
            <li>
              {phase1DemoConfig.limits.maxFilesPerRun} files per run, up to{' '}
              {formatByteLimit(phase1DemoConfig.limits.maxFileSizeBytes)} each.
            </li>
          </ul>
          <p className="access-note">
            This workspace keeps the limits honest: text only, no OCR, no web
            lookup, and fixed trimming when the demo brain gets crowded.
          </p>
        </section>
      </section>

      <section className="section-grid">
        <div className="section-heading">
          <p className="eyebrow">Run history</p>
          <h2>Start a run or reopen one.</h2>
          <p className="lede lede--compact">
            New runs begin as drafts. Submitting one moves it to
            <strong> submitted</strong> until the async processor exists.
          </p>
        </div>

        <div className="workspace-toolbar">
          <button
            className="primary-button"
            disabled={isCreating}
            onClick={handleCreateRun}
            type="button"
          >
            {isCreating ? 'Creating run…' : 'Create new run'}
          </button>
          <Link
            className="secondary-button secondary-button--link"
            href="/messy-notes/about"
          >
            View architecture/about
          </Link>
        </div>

        {error ? <p className="error-text">{error}</p> : null}

        <div className="run-grid">
          {isLoading ? (
            <article className="section-card">
              <p className="card-kicker">Loading</p>
              <p className="section-detail">
                Fetching saved runs from the backend.
              </p>
            </article>
          ) : runs.length === 0 ? (
            <article className="section-card section-card--empty">
              <p className="card-kicker">No runs yet</p>
              <h3>Create the first messy-notes run.</h3>
              <p className="section-detail">
                The first real artifact in this milestone is the run record
                itself. Once created, the editor page lets you paste notes,
                preview them as sticky cards, and submit honestly into the
                workflow shell.
              </p>
            </article>
          ) : (
            runs.map((run) => (
              <Link
                key={run.id}
                className="section-card run-card"
                href={`/messy-notes/${run.id}`}
              >
                <div className="run-card-row">
                  <p className="card-kicker">Run #{run.id}</p>
                  <span className={`status-pill status-pill--${run.status}`}>
                    {formatRunStatus(run.status)}
                  </span>
                </div>
                <h3>{run.title || 'Untitled run'}</h3>
                <p className="section-detail">Workflow {run.workflow_key}.</p>
                <p className="section-detail">
                  Updated {new Date(run.updated_at).toLocaleString()}.
                </p>
              </Link>
            ))
          )}
        </div>
      </section>
    </ProtectedDemoShell>
  );
}
