'use client';

import React, {
  ChangeEvent,
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { InlineAccessPanel } from '@/components/inline-access-panel';
import { ProtectedDemoShell } from '@/components/protected-demo-shell';
import { useProtectedAccess } from '@/hooks/use-protected-access';

type ArtifactType = {
  id: string;
  display_name: string;
};

type DomainDetail = {
  id: string;
  display_name: string;
  artifact_types: ArtifactType[];
  views: { id: string; display_name: string; description: string | null }[];
};

type DomainSummary = {
  id: string;
  display_name: string;
};

type SourceLink = {
  artifact_id: string;
  chunk_id: string | null;
  label: string | null;
  excerpt: string | null;
  start_offset?: number | null;
  end_offset?: number | null;
};

type EvidenceLink = {
  source: SourceLink;
  confidence: number | null;
  note: string | null;
};

type Artifact = {
  id: string;
  artifact_type_id: string;
  title: string | null;
  text: string;
  source_uri: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

type ViewSection = {
  id: string;
  title: string;
  content: string | null;
  evidence_links: EvidenceLink[];
  metadata: Record<string, unknown>;
};

type PerspectiveView = {
  id: string;
  view_definition_id: string;
  title: string;
  sections: ViewSection[];
};

type Task = {
  id: string;
  item_type: string;
  title: string;
  description: string | null;
  readiness_status: string;
  source_links: SourceLink[];
};

type IngestResponse = {
  artifact: Artifact;
  chunks: unknown[];
  signals: unknown[];
  actionable_items: Task[];
  extractor_ids: string[];
};

type WorkbenchTab = 'overview' | 'artifacts' | 'perspectives' | 'items';

const READY_LABELS: Record<string, string> = {
  ready_for_agent: 'Ready for agent',
  needs_human_clarification: 'Needs human clarification',
  needs_source_material: 'Needs source material',
  needs_decision: 'Needs decision',
  blocked: 'Blocked',
  needs_review: 'Needs review',
};

function authHeaders(accessToken: string, contentType = true): HeadersInit {
  return {
    Authorization: `Bearer ${accessToken}`,
    ...(contentType ? { 'Content-Type': 'application/json' } : {}),
  };
}

function readableArtifactType(domain: DomainDetail | null, typeId: string) {
  return (
    domain?.artifact_types.find((artifactType) => artifactType.id === typeId)
      ?.display_name ?? typeId.replaceAll('_', ' ')
  );
}

function sourceLabel(
  source: SourceLink,
  artifacts: Artifact[],
  domain: DomainDetail | null,
) {
  const artifact = artifacts.find(
    (candidate) => candidate.id === source.artifact_id,
  );
  if (!artifact) {
    return source.label ?? 'Source artifact';
  }
  return `${artifact.title ?? readableArtifactType(domain, artifact.artifact_type_id)} · ${readableArtifactType(domain, artifact.artifact_type_id)}`;
}

function contentLines(content: string | null) {
  return (content ?? '')
    .split('\n')
    .map((line) => line.trim().replace(/^- /, ''))
    .filter(Boolean);
}

function metadataText(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata).filter(([, value]) => {
    return value !== null && value !== undefined && `${value}`.trim() !== '';
  });
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join('\n');
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
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedViewId, setSelectedViewId] = useState('');
  const [view, setView] = useState<PerspectiveView | null>(null);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    null,
  );
  const [activeTab, setActiveTab] = useState<WorkbenchTab>('overview');
  const [status, setStatus] = useState('Ready');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    artifactTypeId: 'job_description',
    title: '',
    text: '',
    sourceUri: '',
    metadata: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastIngest, setLastIngest] = useState<IngestResponse | null>(null);

  const selectedArtifact = useMemo(
    () =>
      artifacts.find((artifact) => artifact.id === selectedArtifactId) ??
      artifacts[0] ??
      null,
    [artifacts, selectedArtifactId],
  );

  const artifactCounts = useMemo(() => {
    return artifacts.reduce<Record<string, number>>((counts, artifact) => {
      counts[artifact.artifact_type_id] =
        (counts[artifact.artifact_type_id] ?? 0) + 1;
      return counts;
    }, {});
  }, [artifacts]);

  async function refreshDomainData(token: string, domainId: string) {
    const [domainResponse, artifactsResponse, tasksResponse] =
      await Promise.all([
        fetch(`/api/bff/context/domains/${domainId}`, {
          headers: authHeaders(token),
        }),
        fetch(`/api/bff/context/domains/${domainId}/artifacts`, {
          headers: authHeaders(token),
        }),
        fetch(`/api/bff/context/domains/${domainId}/tasks`, {
          headers: authHeaders(token),
        }),
      ]);
    if (!domainResponse.ok || !artifactsResponse.ok || !tasksResponse.ok) {
      throw new Error('Unable to load selected Context Engine domain.');
    }
    const domainPayload = (await domainResponse.json()) as DomainDetail;
    const artifactsPayload = (await artifactsResponse.json()) as {
      artifacts: Artifact[];
    };
    const tasksPayload = (await tasksResponse.json()) as { tasks: Task[] };
    setDomain(domainPayload);
    setArtifacts(artifactsPayload.artifacts);
    setTasks(tasksPayload.tasks);
    setSelectedViewId((current) => current || domainPayload.views[0]?.id || '');
    setSelectedArtifactId(
      (current) => current ?? artifactsPayload.artifacts[0]?.id ?? null,
    );
  }

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
      if (!active) {
        return;
      }
      setDomains(payload.domains);
      setSelectedDomainId((current) => current || payload.domains[0]?.id || '');
      if (payload.domains.length === 0) {
        setDomain(null);
        setArtifacts([]);
        setTasks([]);
        setStatus('No domains registered.');
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
    let active = true;
    setStatus('Loading selected domain');
    refreshDomainData(accessToken, selectedDomainId)
      .then(() => {
        if (active) {
          setStatus('Ready');
        }
      })
      .catch(() => {
        if (active) {
          setDomain(null);
          setArtifacts([]);
          setTasks([]);
          setStatus('Unable to load selected domain.');
        }
      });
    return () => {
      active = false;
    };
  }, [accessToken, selectedDomainId]);

  useEffect(() => {
    if (!accessToken || !selectedDomainId || !selectedViewId) {
      setView(null);
      return;
    }
    let active = true;
    fetch(
      `/api/bff/context/domains/${selectedDomainId}/views/${selectedViewId}`,
      {
        headers: authHeaders(accessToken),
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to build perspective.');
        }
        return (await response.json()) as { view: PerspectiveView };
      })
      .then((payload) => {
        if (active) {
          setView(payload.view);
        }
      })
      .catch(() => {
        if (active) {
          setView(null);
        }
      });
    return () => {
      active = false;
    };
  }, [
    accessToken,
    selectedDomainId,
    selectedViewId,
    artifacts.length,
    tasks.length,
  ]);

  async function handleIngest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!accessToken || !selectedDomainId) {
      return;
    }
    setIsSubmitting(true);
    setError('');
    setStatus('Ingesting artifact');
    try {
      let response: Response;
      if (selectedFile) {
        const payload = new FormData();
        payload.set('artifact_type_id', form.artifactTypeId);
        if (form.title.trim()) {
          payload.set('title', form.title.trim());
        }
        if (form.sourceUri.trim()) {
          payload.set('source_uri', form.sourceUri.trim());
        }
        if (form.metadata.trim()) {
          payload.set('metadata_json', form.metadata.trim());
        }
        payload.set('file', selectedFile);
        response = await fetch(
          `/api/bff/context/domains/${selectedDomainId}/artifact-uploads`,
          {
            method: 'POST',
            headers: authHeaders(accessToken, false),
            body: payload,
          },
        );
      } else {
        const metadata = form.metadata.trim() ? JSON.parse(form.metadata) : {};
        response = await fetch(
          `/api/bff/context/domains/${selectedDomainId}/artifacts`,
          {
            method: 'POST',
            headers: authHeaders(accessToken),
            body: JSON.stringify({
              artifact_type_id: form.artifactTypeId,
              title: form.title.trim() || null,
              text: form.text,
              source_uri: form.sourceUri.trim() || null,
              metadata,
            }),
          },
        );
      }
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as {
          detail?: string;
        };
        throw new Error(payload.detail ?? 'Artifact ingestion failed.');
      }
      const payload = (await response.json()) as IngestResponse;
      setLastIngest(payload);
      await refreshDomainData(accessToken, selectedDomainId);
      setSelectedArtifactId(payload.artifact.id);
      setForm((current) => ({
        ...current,
        title: '',
        text: '',
        sourceUri: '',
        metadata: '',
      }));
      setSelectedFile(null);
      setStatus('Artifact ingested and extracted');
      setActiveTab('overview');
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'Artifact ingestion failed.',
      );
      setStatus('Ingestion failed');
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !form.title) {
      setForm((current) => ({ ...current, title: file.name }));
    }
  }

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
        <section className="section-grid context-workbench">
          <div className="section-heading context-heading">
            <div>
              <p className="eyebrow">Context Engine</p>
              <h2>Contextual workbench.</h2>
              <p className="lede lede--compact">
                Ingest source artifacts, run registered extraction, generate
                source-grounded perspectives, and triage actionable items.
              </p>
            </div>
            <div className="context-status-panel">
              <p className="card-kicker">State</p>
              <strong>{status}</strong>
              <span>
                {artifacts.length} artifacts · {tasks.length} actionable items
              </span>
            </div>
          </div>

          <div
            className="context-tabs"
            role="tablist"
            aria-label="Workbench sections"
          >
            {[
              ['overview', 'Overview'],
              ['artifacts', 'Artifacts'],
              ['perspectives', 'Perspectives'],
              ['items', 'Actionable Items'],
            ].map(([id, label]) => (
              <button
                aria-selected={activeTab === id}
                className={
                  activeTab === id
                    ? 'context-tab context-tab--active'
                    : 'context-tab'
                }
                key={id}
                onClick={() => setActiveTab(id as WorkbenchTab)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          <div className="context-workbench-grid">
            <aside
              className="context-side-panel"
              aria-label="Workbench controls"
            >
              <article className="section-card">
                <p className="card-kicker">Registered domain</p>
                {domains.length > 1 ? (
                  <select
                    className="select-input"
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
                ) : (
                  <h3>{domain?.display_name ?? 'Loading domain'}</h3>
                )}
                <dl className="context-metrics">
                  <div>
                    <dt>Artifact types</dt>
                    <dd>{domain?.artifact_types.length ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Perspectives</dt>
                    <dd>{domain?.views.length ?? 0}</dd>
                  </div>
                  <div>
                    <dt>Sources</dt>
                    <dd>{artifacts.length}</dd>
                  </div>
                </dl>
              </article>

              <form
                className="section-card context-ingest-form"
                onSubmit={handleIngest}
              >
                <p className="card-kicker">Ingest artifact</p>
                <label className="field-label" htmlFor="artifact-type">
                  Artifact type
                </label>
                <select
                  className="select-input"
                  id="artifact-type"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      artifactTypeId: event.target.value,
                    }))
                  }
                  value={form.artifactTypeId}
                >
                  {(domain?.artifact_types ?? []).map((artifactType) => (
                    <option key={artifactType.id} value={artifactType.id}>
                      {artifactType.display_name}
                    </option>
                  ))}
                </select>

                <label className="field-label" htmlFor="artifact-title">
                  Title
                </label>
                <input
                  className="text-input"
                  id="artifact-title"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="Source title"
                  value={form.title}
                />

                <label className="field-label" htmlFor="artifact-file">
                  Upload source
                </label>
                <input
                  accept=".txt,.md,.csv,.json,.pdf,text/*,application/pdf"
                  className="text-input"
                  id="artifact-file"
                  onChange={handleFileChange}
                  type="file"
                />

                <label className="field-label" htmlFor="artifact-text">
                  Paste text
                </label>
                <textarea
                  className="text-input context-textarea"
                  disabled={!!selectedFile}
                  id="artifact-text"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      text: event.target.value,
                    }))
                  }
                  placeholder="Paste source text when not uploading a file."
                  value={form.text}
                />

                <label className="field-label" htmlFor="artifact-source">
                  Source URI
                </label>
                <input
                  className="text-input"
                  id="artifact-source"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      sourceUri: event.target.value,
                    }))
                  }
                  placeholder="Optional provenance label or URL"
                  value={form.sourceUri}
                />

                <label className="field-label" htmlFor="artifact-metadata">
                  Metadata JSON
                </label>
                <textarea
                  className="text-input context-metadata"
                  id="artifact-metadata"
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      metadata: event.target.value,
                    }))
                  }
                  placeholder='{"stage":"screen"}'
                  value={form.metadata}
                />

                <button
                  className="primary-button"
                  disabled={
                    isSubmitting ||
                    !domain ||
                    (!selectedFile && form.text.trim().length === 0)
                  }
                  type="submit"
                >
                  Ingest and extract
                </button>
                {error && <p className="error-text">{error}</p>}
                {lastIngest && (
                  <p className="success-text">
                    {lastIngest.extractor_ids.length || 0} extractors ran ·{' '}
                    {lastIngest.signals.length} signals ·{' '}
                    {lastIngest.actionable_items.length} items
                  </p>
                )}
              </form>
            </aside>

            <div className="context-main-panel">
              {activeTab === 'overview' && (
                <OverviewPanel
                  artifactCounts={artifactCounts}
                  artifacts={artifacts}
                  domain={domain}
                  tasks={tasks}
                  view={view}
                />
              )}
              {activeTab === 'artifacts' && (
                <ArtifactsPanel
                  artifacts={artifacts}
                  domain={domain}
                  onSelect={setSelectedArtifactId}
                  selectedArtifact={selectedArtifact}
                />
              )}
              {activeTab === 'perspectives' && (
                <PerspectivesPanel
                  artifacts={artifacts}
                  domain={domain}
                  selectedViewId={selectedViewId}
                  setSelectedArtifactId={setSelectedArtifactId}
                  setSelectedViewId={setSelectedViewId}
                  view={view}
                />
              )}
              {activeTab === 'items' && (
                <ItemsPanel
                  artifacts={artifacts}
                  domain={domain}
                  setSelectedArtifactId={setSelectedArtifactId}
                  tasks={tasks}
                />
              )}
            </div>
          </div>
        </section>
      )}
    </ProtectedDemoShell>
  );
}

function OverviewPanel({
  artifactCounts,
  artifacts,
  domain,
  tasks,
  view,
}: Readonly<{
  artifactCounts: Record<string, number>;
  artifacts: Artifact[];
  domain: DomainDetail | null;
  tasks: Task[];
  view: PerspectiveView | null;
}>) {
  const readyCount = tasks.filter(
    (task) => task.readiness_status === 'ready_for_agent',
  ).length;
  return (
    <div className="context-panel-stack">
      <div className="architecture-grid">
        <article className="section-card">
          <p className="card-kicker">Ingestion coverage</p>
          <h3>
            {artifacts.length
              ? `${artifacts.length} persisted sources`
              : 'No artifacts yet'}
          </h3>
          <ul className="section-list">
            {(domain?.artifact_types ?? []).map((artifactType) => (
              <li key={artifactType.id}>
                {artifactType.display_name}:{' '}
                {artifactCounts[artifactType.id] ?? 0}
              </li>
            ))}
          </ul>
        </article>
        <article className="section-card">
          <p className="card-kicker">Actionability</p>
          <h3>{readyCount} ready for agent</h3>
          <p className="section-detail">
            Other items stay marked for human clarification, decision, source
            material, review, or blocked status until the evidence supports
            delegation.
          </p>
        </article>
      </div>
      <article className="section-card section-card--wide">
        <p className="card-kicker">Current generated perspective</p>
        <h3>{view?.title ?? 'Generate a perspective from source material'}</h3>
        <div className="context-section-grid">
          {(view?.sections ?? []).map((section) => (
            <div className="context-mini-section" key={section.id}>
              <strong>{section.title}</strong>
              <span>{section.evidence_links.length} evidence links</span>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

function ArtifactsPanel({
  artifacts,
  domain,
  onSelect,
  selectedArtifact,
}: Readonly<{
  artifacts: Artifact[];
  domain: DomainDetail | null;
  onSelect: (artifactId: string) => void;
  selectedArtifact: Artifact | null;
}>) {
  return (
    <div className="context-two-column">
      <article className="section-card">
        <p className="card-kicker">Artifact list</p>
        <div className="context-artifact-list">
          {artifacts.length ? (
            artifacts.map((artifact) => (
              <button
                className={
                  selectedArtifact?.id === artifact.id
                    ? 'context-artifact-row context-artifact-row--active'
                    : 'context-artifact-row'
                }
                key={artifact.id}
                onClick={() => onSelect(artifact.id)}
                type="button"
              >
                <strong>
                  {artifact.title ??
                    readableArtifactType(domain, artifact.artifact_type_id)}
                </strong>
                <span>
                  {readableArtifactType(domain, artifact.artifact_type_id)}
                </span>
              </button>
            ))
          ) : (
            <p className="section-detail">
              Ingest source material to start the workbench.
            </p>
          )}
        </div>
      </article>
      <article className="section-card context-artifact-detail">
        <p className="card-kicker">Artifact detail</p>
        {selectedArtifact ? (
          <>
            <h3>
              {selectedArtifact.title ??
                readableArtifactType(domain, selectedArtifact.artifact_type_id)}
            </h3>
            <p className="section-detail">
              {readableArtifactType(domain, selectedArtifact.artifact_type_id)}{' '}
              · {selectedArtifact.source_uri ?? 'no source URI'}
            </p>
            {metadataText(selectedArtifact.metadata) && (
              <pre className="context-metadata-block">
                {metadataText(selectedArtifact.metadata)}
              </pre>
            )}
            <pre className="context-source-text">{selectedArtifact.text}</pre>
          </>
        ) : (
          <p className="section-detail">No artifact selected.</p>
        )}
      </article>
    </div>
  );
}

function PerspectivesPanel({
  artifacts,
  domain,
  selectedViewId,
  setSelectedArtifactId,
  setSelectedViewId,
  view,
}: Readonly<{
  artifacts: Artifact[];
  domain: DomainDetail | null;
  selectedViewId: string;
  setSelectedArtifactId: (artifactId: string) => void;
  setSelectedViewId: (viewId: string) => void;
  view: PerspectiveView | null;
}>) {
  return (
    <div className="context-panel-stack">
      <article className="section-card">
        <p className="card-kicker">Perspective</p>
        <select
          className="select-input"
          onChange={(event) => setSelectedViewId(event.target.value)}
          value={selectedViewId}
        >
          {(domain?.views ?? []).map((registeredView) => (
            <option key={registeredView.id} value={registeredView.id}>
              {registeredView.display_name}
            </option>
          ))}
        </select>
      </article>
      {(view?.sections ?? []).map((section) => (
        <article className="section-card context-view-section" key={section.id}>
          <div className="context-section-heading-row">
            <div>
              <p className="card-kicker">
                {(
                  section.metadata.evidence_kinds as string[] | undefined
                )?.join(' + ') ?? 'source grounded'}
              </p>
              <h3>{section.title}</h3>
            </div>
            <span>{section.evidence_links.length} sources</span>
          </div>
          <ul className="context-bullets">
            {contentLines(section.content).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
          <EvidenceList
            artifacts={artifacts}
            domain={domain}
            evidenceLinks={section.evidence_links}
            onSelectArtifact={setSelectedArtifactId}
          />
        </article>
      ))}
    </div>
  );
}

function ItemsPanel({
  artifacts,
  domain,
  setSelectedArtifactId,
  tasks,
}: Readonly<{
  artifacts: Artifact[];
  domain: DomainDetail | null;
  setSelectedArtifactId: (artifactId: string) => void;
  tasks: Task[];
}>) {
  return (
    <div className="context-panel-stack">
      {tasks.length ? (
        tasks.map((task) => (
          <article className="section-card context-task-card" key={task.id}>
            <div className="context-section-heading-row">
              <div>
                <p className="card-kicker">
                  {task.item_type.replaceAll('_', ' ')}
                </p>
                <h3>{task.title}</h3>
              </div>
              <span
                className={`context-readiness context-readiness--${task.readiness_status}`}
              >
                {READY_LABELS[task.readiness_status] ?? task.readiness_status}
              </span>
            </div>
            {task.description && (
              <p className="section-detail">{task.description}</p>
            )}
            <p className="context-suitability">
              {task.readiness_status === 'ready_for_agent'
                ? 'Agent-suitable after review of the linked evidence.'
                : 'Human judgment required before execution is delegated.'}
            </p>
            <EvidenceList
              artifacts={artifacts}
              domain={domain}
              evidenceLinks={task.source_links.map((source) => ({
                source,
                confidence: null,
                note: task.title,
              }))}
              onSelectArtifact={setSelectedArtifactId}
            />
          </article>
        ))
      ) : (
        <article className="section-card">
          <p className="card-kicker">Actionable items</p>
          <h3>No generated items yet.</h3>
          <p className="section-detail">
            Add job descriptions, notes, messages, research, or stories to
            create source-grounded next actions.
          </p>
        </article>
      )}
    </div>
  );
}

function EvidenceList({
  artifacts,
  domain,
  evidenceLinks,
  onSelectArtifact,
}: Readonly<{
  artifacts: Artifact[];
  domain: DomainDetail | null;
  evidenceLinks: EvidenceLink[];
  onSelectArtifact: (artifactId: string) => void;
}>) {
  if (!evidenceLinks.length) {
    return <p className="section-detail">No supporting evidence yet.</p>;
  }
  return (
    <div className="context-evidence-list">
      {evidenceLinks.map((evidence, index) => (
        <button
          className="context-evidence"
          key={`${evidence.source.artifact_id}-${evidence.source.chunk_id ?? index}-${index}`}
          onClick={() => onSelectArtifact(evidence.source.artifact_id)}
          type="button"
        >
          <strong>{sourceLabel(evidence.source, artifacts, domain)}</strong>
          <span>{evidence.note ?? 'Supporting source'}</span>
          {evidence.source.excerpt && <q>{evidence.source.excerpt}</q>}
        </button>
      ))}
    </div>
  );
}
