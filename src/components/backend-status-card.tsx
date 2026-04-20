'use client';

import { useEffect, useState } from 'react';

type ProviderStatus = {
  configured: boolean;
};

type BackendStatus = {
  database_ready: boolean;
  providers: {
    twilio: ProviderStatus;
    plivo: ProviderStatus;
    llm: ProviderStatus;
  };
};

type ReadinessState = 'checking' | 'ready' | 'not-ready';

function getReadinessState(
  status: BackendStatus | null,
  error: string | null,
): ReadinessState {
  if (error) {
    return 'not-ready';
  }

  if (!status) {
    return 'checking';
  }

  return status.database_ready ? 'ready' : 'not-ready';
}

export function BackendStatusCard() {
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await fetch('/api/bff/status', {
          cache: 'no-store',
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(
            payload?.error || `Backend request failed with ${response.status}`,
          );
        }

        const payload = (await response.json()) as BackendStatus;
        if (!active) {
          return;
        }

        setStatus(payload);
        setError(null);
      } catch (requestError) {
        if (!active) {
          return;
        }

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
    readiness === 'ready'
      ? 'Backend services ready'
      : 'Backend services not ready';
  const detail =
    readiness === 'checking'
      ? 'Checking backend connectivity through the BFF.'
      : readiness === 'ready'
        ? 'Backend status endpoint is reachable and the service reports ready.'
        : error
          ? error
          : 'The backend responded, but it is not reporting database readiness yet.';

  return (
    <section className="status-card" aria-live="polite">
      <div className="status-row">
        <span
          className={`status-light status-light--${readiness}`}
          aria-hidden="true"
        />
        <div>
          <p className="status-label">Service status</p>
          <h2>{heading}</h2>
        </div>
      </div>
      <p className="status-detail">{detail}</p>
    </section>
  );
}
