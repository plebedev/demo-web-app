"use client";

import { useEffect, useState } from "react";

type ProviderStatus = {
  configured: boolean;
};

type BackendStatus = {
  service: string;
  environment: string;
  database_ready: boolean;
  example_record_count: number;
  providers: {
    twilio: ProviderStatus;
    plivo: ProviderStatus;
    llm: ProviderStatus;
  };
};

export function BackendStatusCard() {
  const [status, setStatus] = useState<BackendStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadStatus() {
      try {
        const response = await fetch("/api/bff/status", {
          cache: "no-store"
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.error || `Backend request failed with ${response.status}`);
        }

        const payload = (await response.json()) as BackendStatus;
        if (active) {
          setStatus(payload);
          setError(null);
        }
      } catch (requestError) {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : "Unknown error");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadStatus();
    return () => {
      active = false;
    };
  }, []);

  return (
    <article className="panel">
      <h2>Backend status</h2>
      {loading ? <p>Checking backend connectivity through the BFF...</p> : null}
      {!loading && error ? <p>Unavailable: {error}</p> : null}
      {!loading && status ? (
        <div className="status-stack">
          <p>
            <strong>{status.service}</strong> is reachable in <strong>{status.environment}</strong>.
          </p>
          <p>
            Database ready: <span className="pill">{status.database_ready ? "yes" : "no"}</span>
          </p>
          <p>
            Example records: <span className="pill">{status.example_record_count}</span>
          </p>
          <div className="provider-row">
            <span className="pill">Twilio: {status.providers.twilio.configured ? "configured" : "pending"}</span>
            <span className="pill">Plivo: {status.providers.plivo.configured ? "configured" : "pending"}</span>
            <span className="pill">LLM: {status.providers.llm.configured ? "configured" : "pending"}</span>
          </div>
        </div>
      ) : null}
    </article>
  );
}
