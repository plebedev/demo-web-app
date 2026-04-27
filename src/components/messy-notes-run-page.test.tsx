import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessyNotesRunPage } from '@/components/messy-notes-run-page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
}));

vi.mock('@/hooks/use-protected-access', () => ({
  useProtectedAccess: () => ({
    accessToken: 'demo-token',
    isChecking: false,
  }),
}));

describe('MessyNotesRunPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders accepted, rejected, and warning states from ingestion results', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url.endsWith('/api/bff/runs/7')) {
          return new Response(
            JSON.stringify({
              id: 7,
              status: 'draft',
              title: 'Board prep',
              created_at: '2026-04-27T00:00:00Z',
              updated_at: '2026-04-27T00:00:00Z',
              submitted_at: null,
              completed_at: null,
              failed_at: null,
              input_text: 'Need renewal narrative',
              normalized_input_text:
                'Pasted notes:\nNeed renewal narrative\n\nFile: notes.txt\nBudget pressure',
              input_metadata_json: { source_kind: 'mixed_input' },
              uploaded_files_json: [
                {
                  file_name: 'notes.txt',
                  content_type: 'text/plain',
                  file_size_bytes: 128,
                  extracted_text: 'Budget pressure',
                  extracted_text_bytes: 15,
                  trimmed: false,
                },
              ],
              ingestion_summary_json: {
                warnings: ['I trimmed this to fit the demo brain.'],
                counts: {
                  accepted_files: 1,
                  rejected_files: 1,
                  trimmed_files: 0,
                  accepted_pasted_text: 1,
                  trimmed_pasted_text: 0,
                },
                accepted_files: [],
                rejected_files: [
                  {
                    file_name: 'scan.pdf',
                    content_type: 'application/pdf',
                    reason:
                      'That PDF looks image-only or otherwise non-extractable. This demo only reads selectable PDF text.',
                  },
                ],
                limits: {
                  max_files_per_run: 3,
                  max_file_size_bytes: 5242880,
                  max_extracted_text_bytes: 250000,
                  max_total_workflow_text_bytes: 400000,
                  max_pasted_text_bytes: 200000,
                  strategy: 'Keep the first bytes that fit.',
                },
                workflow_text_bytes: 64,
              },
              output_brief_json: null,
              follow_up_count: 0,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.endsWith('/api/bff/runs')) {
          return new Response(
            JSON.stringify({
              runs: [
                {
                  id: 7,
                  status: 'draft',
                  title: 'Board prep',
                  created_at: '2026-04-27T00:00:00Z',
                  updated_at: '2026-04-27T00:00:00Z',
                  submitted_at: null,
                  completed_at: null,
                  failed_at: null,
                  input_text: 'Need renewal narrative',
                  normalized_input_text: null,
                  input_metadata_json: null,
                  uploaded_files_json: [],
                  ingestion_summary_json: null,
                  output_brief_json: null,
                  follow_up_count: 0,
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      }),
    );

    render(<MessyNotesRunPage runId={7} />);

    expect(
      await screen.findByText('What made it into the run'),
    ).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('notes.txt')).toBeInTheDocument();
    });
    expect(screen.getByText('scan.pdf')).toBeInTheDocument();
    expect(
      screen.getByText('I trimmed this to fit the demo brain.'),
    ).toBeInTheDocument();
  });

  it('submits without re-ingesting when there are no unsaved changes', async () => {
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url.endsWith('/api/bff/runs/7')) {
          return new Response(
            JSON.stringify({
              id: 7,
              status: 'draft',
              title: 'Board prep',
              created_at: '2026-04-27T00:00:00Z',
              updated_at: '2026-04-27T00:00:00Z',
              submitted_at: null,
              completed_at: null,
              failed_at: null,
              input_text: 'Need renewal narrative',
              normalized_input_text:
                'Pasted notes:\nNeed renewal narrative\n\nFile: notes.txt\nBudget pressure',
              input_metadata_json: {
                source_kind: 'mixed_input',
                accepted_file_count: 1,
                rejected_file_count: 0,
                warning_count: 0,
              },
              uploaded_files_json: [
                {
                  file_name: 'notes.txt',
                  content_type: 'text/plain',
                  file_size_bytes: 128,
                  extracted_text: 'Budget pressure',
                  extracted_text_bytes: 15,
                  trimmed: false,
                },
              ],
              ingestion_summary_json: {
                warnings: [],
                counts: {
                  accepted_files: 1,
                  rejected_files: 0,
                  trimmed_files: 0,
                  accepted_pasted_text: 1,
                  trimmed_pasted_text: 0,
                },
                accepted_files: [],
                rejected_files: [],
                limits: {
                  max_files_per_run: 3,
                  max_file_size_bytes: 5242880,
                  max_extracted_text_bytes: 250000,
                  max_total_workflow_text_bytes: 400000,
                  max_pasted_text_bytes: 200000,
                  strategy: 'Keep the first bytes that fit.',
                },
                workflow_text_bytes: 64,
              },
              output_brief_json: null,
              follow_up_count: 0,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.endsWith('/api/bff/runs')) {
          return new Response(
            JSON.stringify({
              runs: [
                {
                  id: 7,
                  status: 'draft',
                  title: 'Board prep',
                  created_at: '2026-04-27T00:00:00Z',
                  updated_at: '2026-04-27T00:00:00Z',
                  submitted_at: null,
                  completed_at: null,
                  failed_at: null,
                  input_text: 'Need renewal narrative',
                  normalized_input_text: null,
                  input_metadata_json: null,
                  uploaded_files_json: [],
                  ingestion_summary_json: null,
                  output_brief_json: null,
                  follow_up_count: 0,
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.endsWith('/api/bff/runs/7/submit')) {
          expect(init?.body).toBeUndefined();
          return new Response(
            JSON.stringify({
              id: 7,
              status: 'submitted',
              title: 'Board prep',
              created_at: '2026-04-27T00:00:00Z',
              updated_at: '2026-04-27T00:00:00Z',
              submitted_at: '2026-04-27T01:00:00Z',
              completed_at: null,
              failed_at: null,
              input_text: 'Need renewal narrative',
              normalized_input_text:
                'Pasted notes:\nNeed renewal narrative\n\nFile: notes.txt\nBudget pressure',
              input_metadata_json: {
                source_kind: 'mixed_input',
                accepted_file_count: 1,
                rejected_file_count: 0,
                warning_count: 0,
              },
              uploaded_files_json: [
                {
                  file_name: 'notes.txt',
                  content_type: 'text/plain',
                  file_size_bytes: 128,
                  extracted_text: 'Budget pressure',
                  extracted_text_bytes: 15,
                  trimmed: false,
                },
              ],
              ingestion_summary_json: {
                warnings: [],
                counts: {
                  accepted_files: 1,
                  rejected_files: 0,
                  trimmed_files: 0,
                  accepted_pasted_text: 1,
                  trimmed_pasted_text: 0,
                },
                accepted_files: [],
                rejected_files: [],
                limits: {
                  max_files_per_run: 3,
                  max_file_size_bytes: 5242880,
                  max_extracted_text_bytes: 250000,
                  max_total_workflow_text_bytes: 400000,
                  max_pasted_text_bytes: 200000,
                  strategy: 'Keep the first bytes that fit.',
                },
                workflow_text_bytes: 64,
              },
              output_brief_json: null,
              follow_up_count: 0,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.endsWith('/api/bff/runs/7/ingest')) {
          throw new Error('Submit should not re-ingest when nothing changed.');
        }

        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<MessyNotesRunPage runId={7} />);

    await screen.findByText('What made it into the run');
    fireEvent.click(screen.getAllByRole('button', { name: 'Submit run' })[0]);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Run submitted. The ingestion is real; the later workflow is still intentionally bounded.',
        ),
      ).toBeInTheDocument();
    });
    const submitCall = fetchMock.mock.calls.find(
      ([url]) => url === '/api/bff/runs/7/submit',
    );
    expect(submitCall).toBeDefined();
    expect(submitCall?.[1]).toEqual(
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect((submitCall?.[1] as RequestInit | undefined)?.body).toBeUndefined();
  });
});
