'use client';

import React, { useEffect, useState } from 'react';

import { InlineAccessPanel } from '@/components/inline-access-panel';
import { ProtectedDemoShell } from '@/components/protected-demo-shell';
import { useProtectedAccess } from '@/hooks/use-protected-access';

type DomainDetail = {
  id: string;
  display_name: string;
  artifact_types: { id: string; display_name: string }[];
  views: { id: string; display_name: string; description: string | null }[];
};

type DomainSummary = {
  id: string;
  display_name: string;
};

type Task = {
  id: string;
  item_type: string;
  title: string;
  readiness_status: string;
};

function authHeaders(accessToken: string): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
  };
}

export function ContextWorkbench() {
  const { accessToken: verifiedToken, isChecking } = useProtectedAccess(
    'context-workbench',
    { redirect: false },
  );
  const [tokenOverride, setTokenOverride] = useState<string | null>(null);
  const accessToken = tokenOverride ?? verifiedToken;
  const [domains, setDomains] = useState<DomainSummary[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState('');
  const [domain, setDomain] = useState<DomainDetail | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [status, setStatus] = useState('Ready');

  useEffect(() => {
    if (!accessToken) {
      return;
    }
    const token = accessToken;
    let active = true;

    async function loadDomains() {
      setStatus('Loading registered domains');
      const response = await fetch('/api/bff/context/domains', {
        headers: authHeaders(token),
      });
      if (!response.ok) {
        throw new Error('Unable to load Context Engine domains.');
      }
      const payload = (await response.json()) as { domains: DomainSummary[] };
      if (active) {
        setDomains(payload.domains);
        setSelectedDomainId(
          (current) => current || payload.domains[0]?.id || '',
        );
        if (payload.domains.length === 0) {
          setDomain(null);
          setTasks([]);
          setStatus('No domains registered.');
        }
      }
    }

    loadDomains().catch(() => {
      if (active) {
        setStatus('Unable to load Context Engine data.');
      }
    });

    return () => {
      active = false;
    };
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken || !selectedDomainId) {
      return;
    }
    const token = accessToken;
    let active = true;

    async function loadSelectedDomain() {
      setStatus('Loading selected domain');
      const [domainResponse, tasksResponse] = await Promise.all([
        fetch(`/api/bff/context/domains/${selectedDomainId}`, {
          headers: authHeaders(token),
        }),
        fetch(`/api/bff/context/domains/${selectedDomainId}/tasks`, {
          headers: authHeaders(token),
        }),
      ]);
      if (!domainResponse.ok || !tasksResponse.ok) {
        throw new Error('Unable to load selected Context Engine domain.');
      }
      const domainPayload = (await domainResponse.json()) as DomainDetail;
      const tasksPayload = (await tasksResponse.json()) as { tasks: Task[] };
      if (active) {
        setDomain(domainPayload);
        setTasks(tasksPayload.tasks);
        setStatus('Ready');
      }
    }

    loadSelectedDomain().catch(() => {
      if (active) {
        setDomain(null);
        setTasks([]);
        setStatus('Unable to load selected domain.');
      }
    });

    return () => {
      active = false;
    };
  }, [accessToken, selectedDomainId]);

  if (isChecking) {
    return (
      <ProtectedDemoShell
        activePath="workspace"
        brandMark="C"
        brandSubtitle="Source-grounded context workspace"
        brandTitle="Context Workbench"
        experienceId="context-workbench"
        hasAccess={false}
        workspaceHref="/context-workbench"
        aboutHref="/context-workbench/about"
      >
        <section className="workspace-hero">
          <p className="eyebrow">Context Workbench</p>
          <h1>Checking your saved access.</h1>
        </section>
      </ProtectedDemoShell>
    );
  }

  return (
    <ProtectedDemoShell
      activePath="workspace"
      brandMark="C"
      brandSubtitle="Source-grounded context workspace"
      brandTitle="Context Workbench"
      experienceId="context-workbench"
      hasAccess={!!accessToken}
      workspaceHref="/context-workbench"
      aboutHref="/context-workbench/about"
    >
      {!accessToken ? (
        <InlineAccessPanel
          experienceId="context-workbench"
          onAccessGranted={setTokenOverride}
        />
      ) : (
        <section className="section-grid">
          <div className="section-heading">
            <p className="eyebrow">Context Engine</p>
            <h2>Domain workbench.</h2>
            <p className="lede lede--compact">
              Select a registered domain pack to inspect its artifact types,
              source-grounded views, and owner-scoped actionable items.
            </p>
          </div>

          <div className="architecture-grid">
            <article className="section-card">
              <p className="card-kicker">Registered domain</p>
              {domains.length > 1 && (
                <div className="experience-control-row">
                  <label
                    className="field-label"
                    htmlFor="context-domain-select"
                  >
                    Domain
                  </label>
                  <select
                    id="context-domain-select"
                    onChange={(event) =>
                      setSelectedDomainId(event.target.value)
                    }
                    value={selectedDomainId}
                  >
                    {domains.map((registeredDomain) => (
                      <option
                        key={registeredDomain.id}
                        value={registeredDomain.id}
                      >
                        {registeredDomain.display_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <h3>{domain?.display_name ?? 'Loading domain'}</h3>
              <p className="section-detail">{status}</p>
              <ul className="section-list">
                {(domain?.artifact_types ?? []).map((artifactType) => (
                  <li key={artifactType.id}>{artifactType.display_name}</li>
                ))}
              </ul>
            </article>

            <article className="section-card">
              <p className="card-kicker">Views</p>
              <ul className="section-list">
                {(domain?.views ?? []).map((view) => (
                  <li key={view.id}>{view.display_name}</li>
                ))}
              </ul>
            </article>

            <article className="section-card">
              <p className="card-kicker">Actionable items</p>
              <ul className="section-list">
                {tasks.length > 0 ? (
                  tasks.slice(0, 6).map((task) => (
                    <li key={task.id}>
                      {task.title} · {task.readiness_status}
                    </li>
                  ))
                ) : (
                  <li>
                    Ingest source material to generate owner-scoped items.
                  </li>
                )}
              </ul>
            </article>
          </div>
        </section>
      )}
    </ProtectedDemoShell>
  );
}
