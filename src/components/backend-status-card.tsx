'use client';

import React, { useEffect, useState } from 'react';

import { getErrorMessage, isAbortError, isApiError } from '@/lib/api/http';
import { getBackendHealth } from '@/lib/api/status';

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
    const controller = new AbortController();

    async function loadStatus() {
      try {
        await getBackendHealth({ signal: controller.signal });
        if (controller.signal.aborted) {
          return;
        }

        setStatus(true);
        setError(null);
      } catch (requestError) {
        if (controller.signal.aborted || isAbortError(requestError)) {
          return;
        }

        setStatus(false);
        setError(
          isApiError(requestError) && !requestError.detail
            ? `Backend request failed with ${requestError.status}`
            : getErrorMessage(requestError, 'Unknown error'),
        );
      }
    }

    void loadStatus();
    return () => {
      controller.abort();
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
