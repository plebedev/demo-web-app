type Phase1DemoConfig = {
  appTitle: string;
  supportedInputs: string[];
  unsupportedInputs: string[];
  limits: {
    maxFilesPerRun: number;
    maxFileSizeBytes: number;
    maxExtractedTextBytes: number;
    maxPastedTextBytes: number;
    maxTotalWorkflowTextBytes: number;
  };
  followUpRules: string[];
};

function readInt(name: string, fallback: number): number {
  const rawValue = process.env[name];
  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsedValue) ? parsedValue : fallback;
}

export const phase1DemoConfig: Phase1DemoConfig = {
  appTitle: process.env.NEXT_PUBLIC_APP_NAME || 'Very Serious Prototype :)',
  supportedInputs: [
    'Pasted text',
    'Text file upload',
    'PDF upload with extractable text',
  ],
  unsupportedInputs: ['Images', 'OCR', 'Audio/video', 'Web lookup'],
  limits: {
    maxFilesPerRun: readInt('NEXT_PUBLIC_MAX_FILES_PER_RUN', 3),
    maxFileSizeBytes: readInt('NEXT_PUBLIC_MAX_FILE_SIZE_BYTES', 5242880),
    maxExtractedTextBytes: readInt(
      'NEXT_PUBLIC_MAX_EXTRACTED_TEXT_BYTES',
      250000,
    ),
    maxPastedTextBytes: readInt('NEXT_PUBLIC_MAX_PASTED_TEXT_BYTES', 200000),
    maxTotalWorkflowTextBytes: readInt(
      'NEXT_PUBLIC_MAX_TOTAL_WORKFLOW_TEXT_BYTES',
      400000,
    ),
  },
  followUpRules: [
    'One generated brief per run.',
    'At most one follow-up question after the brief.',
    'The follow-up must be about the generated brief.',
    'After that, the user must start a new run.',
  ],
};

export function formatByteLimit(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (bytes >= 1024) {
    return `${Math.round(bytes / 1024)} KB`;
  }

  return `${bytes} bytes`;
}
