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

export type StickyNote = {
  id: string;
  text: string;
  accentClassName: string;
  rotationClassName: string;
};

const noteAccents = [
  'sticky-note--butter',
  'sticky-note--mint',
  'sticky-note--blush',
  'sticky-note--sky',
  'sticky-note--paper',
  'sticky-note--lavender',
];

const noteRotations = [
  'sticky-note--tilt-left',
  'sticky-note--tilt-right',
  'sticky-note--tilt-soft',
  'sticky-note--tilt-flat',
  'sticky-note--tilt-sharp-left',
  'sticky-note--tilt-sharp-right',
];

export function buildStickyNotes(inputText: string): StickyNote[] {
  return inputText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text, index) => ({
      id: `${index}-${text.slice(0, 24)}`,
      text,
      accentClassName: noteAccents[index % noteAccents.length],
      rotationClassName: noteRotations[index % noteRotations.length],
    }));
}

export function deriveRunTitle(inputText: string): string {
  const firstLine = inputText
    .split(/\n+/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLine) {
    return 'Untitled run';
  }

  return firstLine.length > 52 ? `${firstLine.slice(0, 49)}...` : firstLine;
}

export function formatRunStatus(status: RunStatus): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function formatEventType(eventType: string): string {
  return eventType
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function summarizeStickyBoardText(
  run: DemoRun | null,
  draftText: string,
): string {
  if (draftText.trim()) {
    return draftText;
  }

  if (run?.uploaded_files_json?.length) {
    return run.uploaded_files_json
      .map((file) => file.extracted_text)
      .join('\n');
  }

  return '';
}
