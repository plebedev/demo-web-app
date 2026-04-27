export type RunStatus =
  | 'draft'
  | 'submitted'
  | 'processing'
  | 'completed'
  | 'failed';

export type DemoRun = {
  id: number;
  status: RunStatus;
  title: string | null;
  created_at: string;
  updated_at: string;
  submitted_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  input_text: string | null;
  input_metadata_json: Record<string, unknown> | null;
  output_brief_json: Record<string, unknown> | null;
  follow_up_count: number;
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
];

const noteRotations = [
  'sticky-note--tilt-left',
  'sticky-note--tilt-right',
  'sticky-note--tilt-soft',
  'sticky-note--tilt-flat',
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
