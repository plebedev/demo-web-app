import { RequestControl, requestJson } from './http';

export type ArtifactType = {
  id: string;
  display_name: string;
};

export type DomainDetail = {
  id: string;
  display_name: string;
  artifact_types: ArtifactType[];
  views: { id: string; display_name: string; description: string | null }[];
};

export type DomainSummary = {
  id: string;
  display_name: string;
};

export type SourceLink = {
  artifact_id: string;
  chunk_id: string | null;
  label: string | null;
  excerpt: string | null;
  start_offset?: number | null;
  end_offset?: number | null;
};

export type EvidenceLink = {
  source: SourceLink;
  confidence: number | null;
  note: string | null;
};

export type Artifact = {
  id: string;
  artifact_type_id: string;
  title: string | null;
  text: string;
  source_uri: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type ArtifactChunk = {
  id: string;
  artifact_id: string;
  chunk_index: number;
  text: string;
  start_offset: number;
  end_offset: number;
  source_link: SourceLink;
};

export type ArtifactDetail = {
  artifact: Artifact;
  chunks: ArtifactChunk[];
};

export type ViewSection = {
  id: string;
  title: string;
  content: string | null;
  evidence_links: EvidenceLink[];
  metadata: Record<string, unknown>;
};

export type PerspectiveView = {
  id: string;
  view_definition_id: string;
  title: string;
  sections: ViewSection[];
  metadata: Record<string, unknown>;
};

export type Task = {
  id: string;
  item_type: string;
  title: string;
  description: string | null;
  readiness_status: string;
  source_links: SourceLink[];
  metadata?: Record<string, unknown>;
};

export type IngestResponse = {
  artifact: Artifact;
  chunks: unknown[];
  signals: unknown[];
  actionable_items: Task[];
  extractor_ids: string[];
};

export type DomainListResponse = {
  domains: DomainSummary[];
};

export type ArtifactListResponse = {
  artifacts: Artifact[];
};

export type ActionableItemListResponse = {
  actionable_items: Task[];
};

export type PerspectiveViewResponse = {
  view: PerspectiveView;
};

export type ArtifactTextIngestRequest = {
  artifact_type_id: string;
  title: string | null;
  text: string;
  source_uri: string | null;
  metadata: unknown;
};

const domainPath = (domainId: string) => `/api/bff/context/domains/${domainId}`;

export function listContextDomains(
  accessToken: string,
  control?: RequestControl,
): Promise<DomainListResponse> {
  return requestJson<DomainListResponse>('/api/bff/context/domains', {
    ...control,
    accessToken,
  });
}

export function getContextDomain(
  accessToken: string,
  domainId: string,
  control?: RequestControl,
): Promise<DomainDetail> {
  return requestJson<DomainDetail>(domainPath(domainId), {
    ...control,
    accessToken,
  });
}

export function listContextArtifacts(
  accessToken: string,
  domainId: string,
  control?: RequestControl,
): Promise<ArtifactListResponse> {
  return requestJson<ArtifactListResponse>(
    `${domainPath(domainId)}/artifacts`,
    { ...control, accessToken },
  );
}

export function listActionableItems(
  accessToken: string,
  domainId: string,
  control?: RequestControl,
): Promise<ActionableItemListResponse> {
  return requestJson<ActionableItemListResponse>(
    `${domainPath(domainId)}/actionable-items`,
    { ...control, accessToken },
  );
}

export function getPerspectiveView(
  accessToken: string,
  domainId: string,
  viewId: string,
  options: RequestControl & { regenerate?: boolean } = {},
): Promise<PerspectiveViewResponse> {
  const { regenerate, ...control } = options;
  return requestJson<PerspectiveViewResponse>(
    `${domainPath(domainId)}/views/${viewId}${
      regenerate ? '?regenerate=true' : ''
    }`,
    { ...control, accessToken },
  );
}

export function getArtifactDetail(
  accessToken: string,
  domainId: string,
  artifactId: string,
  control?: RequestControl,
): Promise<ArtifactDetail> {
  return requestJson<ArtifactDetail>(
    `${domainPath(domainId)}/artifacts/${artifactId}`,
    { ...control, accessToken },
  );
}

export function ingestArtifactText(
  accessToken: string,
  domainId: string,
  payload: ArtifactTextIngestRequest,
  control?: RequestControl,
): Promise<IngestResponse> {
  return requestJson<IngestResponse>(`${domainPath(domainId)}/artifacts`, {
    ...control,
    method: 'POST',
    accessToken,
    json: payload,
  });
}

/** Multipart upload of an artifact file plus its form fields. */
export function uploadArtifactFile(
  accessToken: string,
  domainId: string,
  payload: FormData,
  control?: RequestControl,
): Promise<IngestResponse> {
  return requestJson<IngestResponse>(
    `${domainPath(domainId)}/artifact-uploads`,
    { ...control, method: 'POST', accessToken, formData: payload },
  );
}
