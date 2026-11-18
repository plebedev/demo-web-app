import { RequestControl, requestJson } from './http';

export type RunStatus =
  | 'draft'
  | 'submitted'
  | 'processing'
  | 'completed'
  | 'failed';

export type DemoRun = {
  id: number;
  status: RunStatus;
  workflow_key: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  failure_message: string | null;
  failure_internal_reason: string | null;
  input_text: string | null;
  normalized_input_text: string | null;
  input_metadata_json: Record<string, unknown> | null;
  uploaded_files_json: UploadedRunFile[] | null;
  ingestion_summary_json: RunIngestionSummary | null;
  output_brief_json: Record<string, unknown> | null;
  post_processor_results_json: Record<string, PostProcessorAuditResult> | null;
  follow_up_count: number;
  follow_up_response_json: FollowUpResponse | null;
  notification_preference_json: NotificationPreference | null;
};

export type FollowUpResponse = {
  question: string;
  answer: string;
  category: string;
};

export type NotificationPreference = {
  wants_sms: boolean;
  phone_number: string | null;
  phone_number_blocked: boolean;
};

export type SampleChaosSet = {
  key: string;
  title: string;
  description: string;
  notes: string[];
};

export type SampleChaosListResponse = {
  samples: SampleChaosSet[];
};

export type RunEvent = {
  id: number;
  run_id: number;
  event_type: string;
  status: string | null;
  agent_role: string | null;
  tool_name: string | null;
  tool_arguments: Record<string, unknown> | null;
  tool_result: Record<string, unknown> | null;
  handoff_source_role: string | null;
  handoff_target_role: string | null;
  post_processor_key: string | null;
  message: string | null;
  created_at: string;
};

export type RunExecutionSummary = {
  run_id: number;
  status: RunStatus;
  failure_message: string | null;
  phase_summary: string[];
  tool_usage_summary: string[];
  handoff_summary: string[];
  audit_summary: string | null;
  post_processor_summary: string[];
};

export type PostProcessorAuditResult = {
  type: string;
  overall_assessment: string;
  tool_usage_findings: string[];
  handoff_findings: string[];
  suspicious_actions: string[];
  summary: string;
};

export type UploadedRunFile = {
  file_name: string;
  content_type: string;
  file_size_bytes: number;
  extracted_text: string;
  extracted_text_bytes: number;
  trimmed: boolean;
};

export type RejectedRunFile = {
  file_name: string;
  content_type: string;
  reason: string;
};

export type RunIngestionSummary = {
  warnings: string[];
  counts: {
    accepted_files: number;
    rejected_files: number;
    trimmed_files: number;
    accepted_pasted_text: number;
    trimmed_pasted_text: number;
  };
  accepted_files: Array<{
    file_name: string;
    content_type: string;
    file_size_bytes: number;
    extracted_text_bytes: number;
    trimmed: boolean;
  }>;
  rejected_files: RejectedRunFile[];
  limits: {
    max_files_per_run: number;
    max_file_size_bytes: number;
    max_extracted_text_bytes: number;
    max_total_workflow_text_bytes: number;
    max_pasted_text_bytes: number;
    strategy: string;
  };
  workflow_text_bytes: number;
};

export type DemoRunListResponse = {
  runs: DemoRun[];
};

export type NotificationPreferenceRequest = {
  wants_sms: boolean;
  phone_number: string | null;
};

export type SmsStatusResponse = {
  valid: boolean;
  phone_number: string | null;
  phone_number_blocked: boolean;
};

const runPath = (runId: number) => `/api/bff/runs/${runId}`;

export function listRuns(
  accessToken: string,
  control?: RequestControl,
): Promise<DemoRunListResponse> {
  return requestJson<DemoRunListResponse>('/api/bff/runs', {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

export function createRun(
  accessToken: string,
  control?: RequestControl,
): Promise<DemoRun> {
  return requestJson<DemoRun>('/api/bff/runs', {
    ...control,
    method: 'POST',
    accessToken,
    json: {},
  });
}

export function getRun(
  accessToken: string,
  runId: number,
  control?: RequestControl,
): Promise<DemoRun> {
  return requestJson<DemoRun>(runPath(runId), {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

export function listRunEvents(
  accessToken: string,
  runId: number,
  control?: RequestControl,
): Promise<RunEvent[]> {
  return requestJson<RunEvent[]>(`${runPath(runId)}/events`, {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

export function getRunSummary(
  accessToken: string,
  runId: number,
  control?: RequestControl,
): Promise<RunExecutionSummary> {
  return requestJson<RunExecutionSummary>(`${runPath(runId)}/summary`, {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

export function listSampleChaos(
  accessToken: string,
  control?: RequestControl,
): Promise<SampleChaosListResponse> {
  return requestJson<SampleChaosListResponse>('/api/bff/runs/samples', {
    ...control,
    accessToken,
    cache: 'no-store',
  });
}

/** Multipart upload of the draft title, pasted text and files. */
export function ingestRun(
  accessToken: string,
  runId: number,
  payload: FormData,
  control?: RequestControl,
): Promise<DemoRun> {
  return requestJson<DemoRun>(`${runPath(runId)}/ingest`, {
    ...control,
    method: 'POST',
    accessToken,
    formData: payload,
  });
}

export function saveNotificationPreference(
  accessToken: string,
  runId: number,
  payload: NotificationPreferenceRequest,
  control?: RequestControl,
): Promise<DemoRun> {
  return requestJson<DemoRun>(`${runPath(runId)}/notification-preference`, {
    ...control,
    method: 'POST',
    accessToken,
    json: payload,
  });
}

export function loadSampleIntoRun(
  accessToken: string,
  runId: number,
  sampleKey: string,
  control?: RequestControl,
): Promise<DemoRun> {
  return requestJson<DemoRun>(`${runPath(runId)}/sample`, {
    ...control,
    method: 'POST',
    accessToken,
    json: { sample_key: sampleKey },
  });
}

export function checkSmsStatus(
  accessToken: string,
  phoneNumber: string,
  control?: RequestControl,
): Promise<SmsStatusResponse> {
  return requestJson<SmsStatusResponse>('/api/bff/runs/sms-status', {
    ...control,
    method: 'POST',
    accessToken,
    json: { phone_number: phoneNumber },
  });
}

export function askRunFollowUp(
  accessToken: string,
  runId: number,
  question: string,
  control?: RequestControl,
): Promise<DemoRun> {
  return requestJson<DemoRun>(`${runPath(runId)}/follow-up`, {
    ...control,
    method: 'POST',
    accessToken,
    json: { question },
  });
}

/** Submits the run for processing. The request has no body. */
export function submitRun(
  accessToken: string,
  runId: number,
  control?: RequestControl,
): Promise<DemoRun> {
  return requestJson<DemoRun>(`${runPath(runId)}/submit`, {
    ...control,
    method: 'POST',
    accessToken,
  });
}
