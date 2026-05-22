'use client';

import React, {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

type ArtifactChunk = {
  id: string;
  artifact_id: string;
  chunk_index: number;
  text: string;
  start_offset: number;
  end_offset: number;
  source_link: SourceLink;
};

type ArtifactDetail = {
  artifact: Artifact;
  chunks: ArtifactChunk[];
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
  metadata: Record<string, unknown>;
};

type Task = {
  id: string;
  item_type: string;
  title: string;
  description: string | null;
  readiness_status: string;
  source_links: SourceLink[];
  metadata?: Record<string, unknown>;
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

const READINESS_ORDER = [
  'ready_for_agent',
  'needs_decision',
  'needs_human_clarification',
  'needs_source_material',
  'needs_review',
  'blocked',
];

const PERSPECTIVE_PROFILES: Record<
  string,
  {
    question: string;
    emphasis: string;
    implication: string;
  }
> = {
  role_fit: {
    question: 'How strong is my fit?',
    emphasis: 'Fit signal',
    implication:
      'Use this to decide whether the opportunity deserves more effort.',
  },
  interview_prep: {
    question: 'What should I prepare for?',
    emphasis: 'Preparation focus',
    implication:
      'Use this to choose stories, topics, and questions before the next conversation.',
  },
  resume_positioning: {
    question: 'How should I position myself?',
    emphasis: 'Positioning move',
    implication:
      'Use this to tighten resume language around the evidence already available.',
  },
  application_pipeline: {
    question: 'What should I do next?',
    emphasis: 'Operational next step',
    implication:
      'Use this to move the opportunity forward or expose the next blocker.',
  },
  compensation_scope_risk: {
    question: 'Is this opportunity structurally attractive?',
    emphasis: 'Scope and risk signal',
    implication:
      'Use this to decide what needs human judgment before committing further.',
  },
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

function evidenceKindFromNote(note: string | null) {
  const normalized = (note ?? '').toLowerCase();
  if (normalized.includes('inferred')) {
    return 'inferred';
  }
  if (
    normalized.includes('human_judgment') ||
    normalized.includes('judgment')
  ) {
    return 'human judgment';
  }
  return 'explicit';
}

function evidenceKindLabel(kind: string) {
  if (kind === 'human_judgment') {
    return 'human judgment';
  }
  return kind.replaceAll('_', ' ');
}

function evidenceKey(evidence: EvidenceLink) {
  const excerpt = evidence.source.excerpt?.trim().toLowerCase() ?? '';
  return [
    evidence.source.artifact_id,
    evidence.source.chunk_id ?? evidence.source.label ?? 'artifact',
    evidence.note ?? 'source',
    excerpt,
  ].join('|');
}

function groupedEvidence(evidenceLinks: EvidenceLink[]) {
  const groups = new Map<string, EvidenceLink & { count: number }>();
  evidenceLinks.forEach((evidence) => {
    const key = evidenceKey(evidence);
    const existing = groups.get(key);
    if (existing) {
      existing.count += 1;
      return;
    }
    groups.set(key, { ...evidence, count: 1 });
  });
  return [...groups.values()];
}

function confidenceLabel(section: ViewSection) {
  const configuredConfidence = section.metadata.confidence;
  if (typeof configuredConfidence === 'string') {
    return `${configuredConfidence} confidence`;
  }
  const kinds = new Set(
    ((section.metadata.evidence_kinds as string[] | undefined) ?? []).map(
      evidenceKindLabel,
    ),
  );
  const explicitCount = section.evidence_links.filter(
    (evidence) => evidenceKindFromNote(evidence.note) === 'explicit',
  ).length;
  if (!section.evidence_links.length) {
    return 'Low confidence';
  }
  if (explicitCount >= 3 || (explicitCount > 0 && kinds.has('explicit'))) {
    return 'High confidence';
  }
  return 'Medium confidence';
}

function sectionRationale(section: ViewSection) {
  if (typeof section.metadata.rationale === 'string') {
    return section.metadata.rationale;
  }
  const kinds = (
    (section.metadata.evidence_kinds as string[] | undefined) ?? []
  )
    .map(evidenceKindLabel)
    .filter(Boolean);
  const signalTypes = (
    (section.metadata.signal_types as string[] | undefined) ?? []
  )
    .map((signalType) => signalType.replaceAll('_', ' '))
    .slice(0, 3);
  if (signalTypes.length) {
    return `Based on ${signalTypes.join(', ')} ${
      signalTypes.length === 1 ? 'signal' : 'signals'
    }${kinds.length ? ` with ${kinds.join(' and ')} evidence` : ''}.`;
  }
  const itemTypes = (
    (section.metadata.item_types as string[] | undefined) ?? []
  )
    .map((itemType) => itemType.replaceAll('_', ' '))
    .slice(0, 3);
  if (itemTypes.length) {
    return `Based on generated ${itemTypes.join(', ')} work items and their source links.`;
  }
  if (kinds.length) {
    return `Based on ${kinds.join(' and ')} supporting material.`;
  }
  return 'The workbench has limited source material for this section.';
}

function sectionImplication(
  view: PerspectiveView | null,
  section: ViewSection,
) {
  const implications = section.metadata.actionable_implications;
  if (
    Array.isArray(implications) &&
    implications.length &&
    typeof implications[0] === 'string'
  ) {
    return implications[0];
  }
  const profile = view ? PERSPECTIVE_PROFILES[view.view_definition_id] : null;
  if (!profile) {
    return 'Review the evidence before turning this section into a decision or next action.';
  }
  const title = section.title.toLowerCase();
  if (
    title.includes('risk') ||
    title.includes('concern') ||
    title.includes('blocker')
  ) {
    return 'Clarify this before increasing commitment or delegating follow-up work.';
  }
  if (title.includes('missing') || title.includes('weak')) {
    return 'Add source material or decide whether the gap is acceptable.';
  }
  if (title.includes('action') || title.includes('follow')) {
    return 'Turn the highest-readiness item into the next operational step.';
  }
  return profile.implication;
}

function metadataText(metadata: Record<string, unknown>) {
  const entries = Object.entries(metadata).filter(([, value]) => {
    return value !== null && value !== undefined && `${value}`.trim() !== '';
  });
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join('\n');
}

function viewGenerationLabel(view: PerspectiveView | null) {
  if (!view) {
    return 'No perspective loaded';
  }
  const generatedBy = view.metadata?.generated_by;
  const fallbackWarning = view.metadata?.fallback_warning;
  const modelProfile = view.metadata?.model_profile;
  if (view.metadata?.is_stale === true) {
    return 'Regeneration recommended · artifacts changed';
  }
  if (typeof fallbackWarning === 'string') {
    return `Deterministic fallback · ${fallbackWarning}`;
  }
  if (generatedBy === 'llm') {
    return typeof modelProfile === 'string'
      ? `LLM synthesized · ${modelProfile}`
      : 'LLM synthesized';
  }
  if (generatedBy === 'deterministic') {
    return 'Deterministic view';
  }
  return 'Perspective loaded';
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
  const [viewRefreshVersion, setViewRefreshVersion] = useState(0);
  const shouldRegenerateViewRef = useRef(false);
  const [isViewLoading, setIsViewLoading] = useState(false);
  const [selectedArtifactId, setSelectedArtifactId] = useState<string | null>(
    null,
  );
  const [artifactDetail, setArtifactDetail] = useState<ArtifactDetail | null>(
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  const refreshDomainData = useCallback(
    async (token: string, domainId: string) => {
      const [domainResponse, artifactsResponse, tasksResponse] =
        await Promise.all([
          fetch(`/api/bff/context/domains/${domainId}`, {
            headers: authHeaders(token),
          }),
          fetch(`/api/bff/context/domains/${domainId}/artifacts`, {
            headers: authHeaders(token),
          }),
          fetch(`/api/bff/context/domains/${domainId}/actionable-items`, {
            headers: authHeaders(token),
          }),
        ]);
      if (!domainResponse.ok || !artifactsResponse.ok || !tasksResponse.ok) {
        const failed = [
          !domainResponse.ok && `domain metadata (${domainResponse.status})`,
          !artifactsResponse.ok && `artifacts (${artifactsResponse.status})`,
          !tasksResponse.ok && `actionable items (${tasksResponse.status})`,
        ].filter(Boolean);
        throw new Error(`Unable to load ${failed.join(', ')}.`);
      }
      const domainPayload = (await domainResponse.json()) as DomainDetail;
      const artifactsPayload = (await artifactsResponse.json()) as {
        artifacts: Artifact[];
      };
      const tasksPayload = (await tasksResponse.json()) as {
        actionable_items: Task[];
      };
      setDomain(domainPayload);
      setArtifacts(artifactsPayload.artifacts);
      setTasks(tasksPayload.actionable_items);
      setSelectedViewId(
        (current) => current || domainPayload.views[0]?.id || '',
      );
      setSelectedArtifactId(
        (current) => current ?? artifactsPayload.artifacts[0]?.id ?? null,
      );
    },
    [],
  );

  const openArtifact = useCallback((artifactId: string) => {
    setSelectedArtifactId(artifactId);
    setActiveTab('artifacts');
  }, []);

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
      .catch((caught) => {
        if (active) {
          setDomain(null);
          setArtifacts([]);
          setTasks([]);
          setStatus(
            caught instanceof Error
              ? caught.message
              : 'Unable to load selected domain.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, [accessToken, refreshDomainData, selectedDomainId]);

  useEffect(() => {
    if (!accessToken || !selectedDomainId || !selectedViewId) {
      setView(null);
      setIsViewLoading(false);
      return;
    }
    let active = true;
    setIsViewLoading(true);
    setError('');
    const shouldRegenerate = shouldRegenerateViewRef.current;
    shouldRegenerateViewRef.current = false;
    setStatus(
      shouldRegenerate ? 'Regenerating perspective' : 'Loading perspective',
    );
    const viewUrl = `/api/bff/context/domains/${selectedDomainId}/views/${selectedViewId}${
      shouldRegenerate ? '?regenerate=true' : ''
    }`;
    fetch(viewUrl, {
      headers: authHeaders(accessToken),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error('Unable to build perspective.');
        }
        return (await response.json()) as { view: PerspectiveView };
      })
      .then((payload) => {
        if (active) {
          setView(payload.view);
          setStatus(viewGenerationLabel(payload.view));
        }
      })
      .catch((caught) => {
        if (active) {
          setView(null);
          setError(
            caught instanceof Error
              ? caught.message
              : 'Unable to build perspective.',
          );
          setStatus('Perspective build failed');
        }
      })
      .finally(() => {
        if (active) {
          setIsViewLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [accessToken, selectedDomainId, selectedViewId, viewRefreshVersion]);

  useEffect(() => {
    if (!accessToken || !selectedDomainId || !selectedArtifactId) {
      setArtifactDetail(null);
      return;
    }
    let active = true;
    fetch(
      `/api/bff/context/domains/${selectedDomainId}/artifacts/${selectedArtifactId}`,
      {
        headers: authHeaders(accessToken),
      },
    )
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(
            `Unable to load artifact detail (${response.status}).`,
          );
        }
        return (await response.json()) as ArtifactDetail;
      })
      .then((payload) => {
        if (active) {
          setArtifactDetail(payload);
        }
      })
      .catch(() => {
        if (active) {
          setArtifactDetail(null);
        }
      });
    return () => {
      active = false;
    };
  }, [accessToken, selectedArtifactId, selectedDomainId]);

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
      setViewRefreshVersion((current) => current + 1);
      setForm((current) => ({
        ...current,
        title: '',
        text: '',
        sourceUri: '',
        metadata: '',
      }));
      clearSelectedFile();
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

  function clearSelectedFile() {
    const clearedFileName = selectedFile?.name;
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (clearedFileName) {
      setForm((current) => ({
        ...current,
        title: current.title === clearedFileName ? '' : current.title,
      }));
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
                  ref={fileInputRef}
                  type="file"
                />
                {selectedFile && (
                  <button
                    className="ghost-button"
                    onClick={clearSelectedFile}
                    type="button"
                  >
                    Clear file
                  </button>
                )}

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
                  artifactDetail={artifactDetail}
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
                  isLoading={isViewLoading}
                  onOpenArtifact={openArtifact}
                  onRegenerate={() => {
                    setError('');
                    shouldRegenerateViewRef.current = true;
                    setStatus('Regenerating perspective');
                    setViewRefreshVersion((current) => current + 1);
                  }}
                  selectedViewId={selectedViewId}
                  setSelectedViewId={setSelectedViewId}
                  view={view}
                />
              )}
              {activeTab === 'items' && (
                <ItemsPanel
                  artifacts={artifacts}
                  domain={domain}
                  onOpenArtifact={openArtifact}
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
  artifactDetail,
  artifacts,
  domain,
  onSelect,
  selectedArtifact,
}: Readonly<{
  artifactDetail: ArtifactDetail | null;
  artifacts: Artifact[];
  domain: DomainDetail | null;
  onSelect: (artifactId: string) => void;
  selectedArtifact: Artifact | null;
}>) {
  const detailArtifact = artifactDetail?.artifact ?? selectedArtifact;
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
        {detailArtifact ? (
          <>
            <h3>
              {detailArtifact.title ??
                readableArtifactType(domain, detailArtifact.artifact_type_id)}
            </h3>
            <p className="section-detail">
              {readableArtifactType(domain, detailArtifact.artifact_type_id)} ·{' '}
              {detailArtifact.source_uri ?? 'no source URI'}
            </p>
            {metadataText(detailArtifact.metadata) && (
              <pre className="context-metadata-block">
                {metadataText(detailArtifact.metadata)}
              </pre>
            )}
            <pre className="context-source-text">{detailArtifact.text}</pre>
            {artifactDetail?.chunks.length ? (
              <div className="context-chunk-list">
                <p className="card-kicker">Persisted chunks</p>
                {artifactDetail.chunks.map((chunk) => (
                  <article className="context-chunk" key={chunk.id}>
                    <strong>Chunk {chunk.chunk_index + 1}</strong>
                    <span>
                      offsets {chunk.start_offset}-{chunk.end_offset}
                    </span>
                    <p>{chunk.text}</p>
                  </article>
                ))}
              </div>
            ) : null}
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
  isLoading,
  onOpenArtifact,
  onRegenerate,
  selectedViewId,
  setSelectedViewId,
  view,
}: Readonly<{
  artifacts: Artifact[];
  domain: DomainDetail | null;
  isLoading: boolean;
  onOpenArtifact: (artifactId: string) => void;
  onRegenerate: () => void;
  selectedViewId: string;
  setSelectedViewId: (viewId: string) => void;
  view: PerspectiveView | null;
}>) {
  const profile = view
    ? (PERSPECTIVE_PROFILES[view.view_definition_id] ?? null)
    : null;
  return (
    <div className="context-panel-stack">
      <article className="section-card context-perspective-toolbar">
        <div>
          <p className="card-kicker">Perspective</p>
          <h3>{view?.title ?? 'Select a perspective'}</h3>
          <p className="section-detail">
            {profile?.question ??
              'Read this view as a synthesis first, then inspect evidence when needed.'}
          </p>
          <p className="context-generation-status" aria-live="polite">
            {isLoading ? 'Loading perspective...' : viewGenerationLabel(view)}
          </p>
        </div>
        <div className="context-toolbar-controls">
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
          <button
            className="secondary-button"
            disabled={isLoading || !selectedViewId}
            onClick={onRegenerate}
            type="button"
          >
            {isLoading ? 'Regenerating...' : 'Regenerate view'}
          </button>
        </div>
      </article>
      {(view?.sections ?? []).map((section) => (
        <article className="section-card context-view-section" key={section.id}>
          <div className="context-decision-block">
            <div>
              <p className="card-kicker">{profile?.emphasis ?? 'Synthesis'}</p>
              <h3>{section.title}</h3>
            </div>
            <div className="context-section-badges">
              <span>{confidenceLabel(section)}</span>
              <span>
                {groupedEvidence(section.evidence_links).length} sources
              </span>
            </div>
          </div>
          <PerspectiveSectionBody section={section} view={view} />
          <EvidenceList
            artifacts={artifacts}
            domain={domain}
            evidenceLinks={section.evidence_links}
            onSelectArtifact={onOpenArtifact}
          />
        </article>
      ))}
    </div>
  );
}

function PerspectiveSectionBody({
  section,
  view,
}: Readonly<{ section: ViewSection; view: PerspectiveView | null }>) {
  const lines = contentLines(section.content);
  const conclusion = lines[0] ?? 'No synthesized conclusion yet.';
  const supportingSignals = lines.slice(1, 4);
  return (
    <div className="context-section-body">
      <div className="context-synthesis">
        <p className="context-label">Decision summary</p>
        <p>{conclusion}</p>
      </div>
      <div className="context-rationale">
        <p className="context-label">Why it matters</p>
        <p>{sectionRationale(section)}</p>
        <p>{sectionImplication(view, section)}</p>
      </div>
      {supportingSignals.length ? (
        <div className="context-inferred-signals">
          <p className="context-label">Additional signals</p>
          <ul>
            {supportingSignals.map((line, index) => (
              <li key={`${section.id}-signal-${index}`}>{line}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function taskRationale(task: Task) {
  if (typeof task.metadata?.rationale === 'string') {
    return task.metadata.rationale;
  }
  return 'Generated from source-linked context that suggests this work may reduce uncertainty or move the opportunity forward.';
}

function taskSuitability(task: Task) {
  const ownerType = task.metadata?.owner_type;
  if (ownerType === 'agent') {
    return 'Agent-suitable after human review of the linked evidence.';
  }
  if (ownerType === 'shared') {
    return 'Shared work: a human should review the evidence before delegation.';
  }
  if (ownerType === 'human') {
    return 'Human-owned because judgment, missing evidence, or personal preference is involved.';
  }
  return task.readiness_status === 'ready_for_agent'
    ? 'Agent-suitable after human review of the linked evidence.'
    : 'Human-owned until the readiness state changes.';
}

function ItemsPanel({
  artifacts,
  domain,
  onOpenArtifact,
  tasks,
}: Readonly<{
  artifacts: Artifact[];
  domain: DomainDetail | null;
  onOpenArtifact: (artifactId: string) => void;
  tasks: Task[];
}>) {
  const groupedTasks = READINESS_ORDER.map((status) => ({
    status,
    tasks: tasks.filter((task) => task.readiness_status === status),
  })).filter((group) => group.tasks.length);
  const unknownTasks = tasks.filter(
    (task) => !READINESS_ORDER.includes(task.readiness_status),
  );
  if (unknownTasks.length) {
    groupedTasks.push({ status: 'other', tasks: unknownTasks });
  }
  return (
    <div className="context-panel-stack">
      {tasks.length ? (
        groupedTasks.map((group) => (
          <section className="context-task-group" key={group.status}>
            <div className="context-task-group-heading">
              <h3>{READY_LABELS[group.status] ?? 'Other readiness'}</h3>
              <span>{group.tasks.length}</span>
            </div>
            {group.tasks.map((task) => (
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
                    {READY_LABELS[task.readiness_status] ??
                      task.readiness_status}
                  </span>
                </div>
                {task.description && (
                  <p className="section-detail">{task.description}</p>
                )}
                <div className="context-action-rationale">
                  <div>
                    <p className="context-label">Why this exists</p>
                    <p>{taskRationale(task)}</p>
                  </div>
                  <div>
                    <p className="context-label">Suitability</p>
                    <p>{taskSuitability(task)}</p>
                  </div>
                </div>
                <EvidenceList
                  artifacts={artifacts}
                  domain={domain}
                  evidenceLinks={task.source_links.map((source) => ({
                    source,
                    confidence: null,
                    note: task.title,
                  }))}
                  onSelectArtifact={onOpenArtifact}
                />
              </article>
            ))}
          </section>
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
  const [expanded, setExpanded] = useState(false);
  const evidenceGroups = groupedEvidence(evidenceLinks);
  const visibleEvidence = expanded
    ? evidenceGroups
    : evidenceGroups.slice(0, 3);
  const hiddenCount = evidenceGroups.length - visibleEvidence.length;

  if (!evidenceLinks.length) {
    return <p className="section-detail">No supporting evidence yet.</p>;
  }
  return (
    <div className="context-evidence-wrap">
      <div className="context-evidence-header">
        <p className="context-label">Supporting evidence</p>
        <span>
          {evidenceGroups.length} grouped source
          {evidenceGroups.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="context-evidence-list">
        {visibleEvidence.map((evidence, index) => (
          <button
            className="context-evidence"
            key={`${evidence.source.artifact_id}-${evidence.source.chunk_id ?? index}-${index}`}
            onClick={() => onSelectArtifact(evidence.source.artifact_id)}
            type="button"
          >
            <strong>{sourceLabel(evidence.source, artifacts, domain)}</strong>
            <span>
              {evidenceKindLabel(evidenceKindFromNote(evidence.note))} ·{' '}
              {evidence.note ?? 'Supporting source'}
              {evidence.count > 1 ? ` · repeated ${evidence.count}x` : ''}
            </span>
            {evidence.source.excerpt && <q>{evidence.source.excerpt}</q>}
          </button>
        ))}
      </div>
      {hiddenCount > 0 || expanded ? (
        <button
          className="ghost-button context-evidence-toggle"
          onClick={() => setExpanded((current) => !current)}
          type="button"
        >
          {expanded
            ? 'Show top evidence only'
            : `Show ${hiddenCount} more evidence source${hiddenCount === 1 ? '' : 's'}`}
        </button>
      ) : null}
    </div>
  );
}
