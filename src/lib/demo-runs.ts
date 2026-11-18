import type { DemoRun, RunStatus } from '@/lib/api/runs';

export type {
  DemoRun,
  DemoRunListResponse,
  FollowUpResponse,
  NotificationPreference,
  PostProcessorAuditResult,
  RejectedRunFile,
  RunEvent,
  RunExecutionSummary,
  RunIngestionSummary,
  RunStatus,
  SampleChaosListResponse,
  SampleChaosSet,
  UploadedRunFile,
} from '@/lib/api/runs';

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
