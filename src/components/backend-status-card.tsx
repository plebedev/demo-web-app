'use client';

import React, { useEffect, useState } from 'react';

type ReadinessState = 'checking' | 'ready' | 'not-ready';

function getReadinessState(
  status: boolean,
  error: string | null,
): ReadinessState {
  if (error) {
    return 'not-ready';
  }

  if (!status) {
    return 'checking';
  }

  return 'ready';
}

export function BackendStatusCard() {
  const [status, setStatus] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await fetch('/api/backend-health', {
          cache: 'no-store',
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            payload?.error || `Backend request failed with ${response.status}`,
          );
        }

        await response.json();
        if (!active) {
          return;
        }

        setStatus(true);
        setError(null);
      } catch (requestError) {
        if (!active) {
          return;
        }

        setStatus(false);
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Unknown error',
        );
      }
    }

    void loadStatus();
    return () => {
      active = false;
    };
  }, []);

  const readiness = getReadinessState(status, error);
  const heading =
    readiness === 'ready' ? 'Backend process reachable' : 'Backend unavailable';
  const detail =
    readiness === 'checking'
      ? 'Checking whether the backend service responds to an unprotected health probe.'
      : readiness === 'ready'
        ? 'The backend health endpoint is responding. This only indicates the backend process is up.'
        : error
          ? error
          : 'The backend health endpoint did not respond.';

  return (
    <section className="status-card" aria-live="polite">
      <div className="status-row">
        <span
          className={`status-light status-light--${readiness}`}
          aria-hidden="true"
        />
        <div>
          <p className="status-label">Backend health</p>
          <h2>{heading}</h2>
        </div>
      </div>
      <p className="status-detail">{detail}</p>
    </section>
  );
}
