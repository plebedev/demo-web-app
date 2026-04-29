import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  afterEach(() => {
    cleanup();
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
              workflow_key: 'messy-notes-v1',
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
              post_processor_results_json: null,
              follow_up_count: 0,
              follow_up_response_json: null,
              notification_preference_json: null,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.endsWith('/api/bff/runs/7/events')) {
          return new Response(JSON.stringify([]), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          });
        }

        if (url.endsWith('/api/bff/runs/7/summary')) {
          return Response.json({
            run_id: 7,
            status: 'draft',
            failure_message: null,
            phase_summary: [],
            tool_usage_summary: [],
            handoff_summary: [],
            audit_summary: null,
            post_processor_summary: [],
          });
        }

        if (url.endsWith('/api/bff/runs')) {
          return new Response(
            JSON.stringify({
              runs: [
                {
                  id: 7,
                  status: 'draft',
                  workflow_key: 'messy-notes-v1',
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
                  post_processor_results_json: null,
                  follow_up_count: 0,
                  follow_up_response_json: null,
                  notification_preference_json: null,
                },
              ],
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.endsWith('/api/bff/runs/samples')) {
          return new Response(
            JSON.stringify({
              samples: [
                {
                  key: 'product-planning',
                  title: 'Product planning mess',
                  description: 'Roadmap fragments.',
                  notes: ['Decision: keep it narrow.'],
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
              workflow_key: 'messy-notes-v1',
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
              post_processor_results_json: null,
              follow_up_count: 0,
              follow_up_response_json: null,
              notification_preference_json: null,
            }),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.endsWith('/api/bff/runs/7/events')) {
          return new Response(
            JSON.stringify([
              {
                id: 1,
                run_id: 7,
                event_type: 'tool_called',
                status: 'processing',
                agent_role: 'extractor',
                tool_name: 'extract_action_items',
                tool_arguments: {
                  sections: [{ section_id: 's1', text: 'Need legal summary' }],
                },
                tool_result: null,
                handoff_source_role: null,
                handoff_target_role: null,
                post_processor_key: null,
                message: null,
                created_at: '2026-04-27T01:00:00Z',
              },
              {
                id: 2,
                run_id: 7,
                event_type: 'handoff_occurred',
                status: 'processing',
                agent_role: null,
                tool_name: null,
                tool_arguments: null,
                tool_result: null,
                handoff_source_role: 'extractor',
                handoff_target_role: 'reconciler',
                post_processor_key: null,
                message: 'extractor handed off to reconciler.',
                created_at: '2026-04-27T01:00:01Z',
              },
              {
                id: 3,
                run_id: 7,
                event_type: 'run_completed',
                status: 'completed',
                agent_role: null,
                tool_name: null,
                tool_arguments: null,
                tool_result: null,
                handoff_source_role: null,
                handoff_target_role: null,
                post_processor_key: null,
                message: 'Workflow completed.',
                created_at: '2026-04-27T01:00:00Z',
              },
            ]),
            {
              status: 200,
              headers: { 'Content-Type': 'application/json' },
            },
          );
        }

        if (url.endsWith('/api/bff/runs/7/summary')) {
          return Response.json({
            run_id: 7,
            status: 'completed',
            failure_message: null,
            phase_summary: [
              'run_execution_started: Started workflow messy-notes-v1.',
              'agent_started: extractor',
            ],
            tool_usage_summary: ['extract_action_items: 1 result event'],
            handoff_summary: ['extractor to reconciler'],
            audit_summary:
              'Tool use and handoffs stayed inside the configured workflow.',
            post_processor_summary: [
              'audit-tool-usage-and-handoffs: Post-processor audit-tool-usage-and-handoffs completed.',
            ],
          });
        }

        if (url.endsWith('/api/bff/runs')) {
          return new Response(
            JSON.stringify({
              runs: [
                {
                  id: 7,
                  status: 'draft',
                  workflow_key: 'messy-notes-v1',
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
                  post_processor_results_json: null,
                  follow_up_count: 0,
                  follow_up_response_json: null,
                  notification_preference_json: null,
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
              status: 'completed',
              workflow_key: 'messy-notes-v1',
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
              output_brief_json: {
                title: 'Board prep',
                executive_summary: 'This brief summarizes the notes.',
                sections: [
                  {
                    heading: 'Action items',
                    content: '- Ask legal for a one-page summary',
                  },
                ],
                open_questions: [],
              },
              post_processor_results_json: {
                'audit-tool-usage-and-handoffs': {
                  type: 'audit_tool_usage_and_handoffs',
                  overall_assessment: 'ok',
                  tool_usage_findings: [],
                  handoff_findings: [],
                  suspicious_actions: [],
                  summary:
                    'Tool use and handoffs stayed inside the configured workflow.',
                },
              },
              follow_up_count: 0,
              follow_up_response_json: null,
              notification_preference_json: null,
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

        if (url.endsWith('/api/bff/runs/samples')) {
          return new Response(
            JSON.stringify({
              samples: [
                {
                  key: 'product-planning',
                  title: 'Product planning mess',
                  description: 'Roadmap fragments.',
                  notes: ['Decision: keep it narrow.'],
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
      },
    );

    vi.stubGlobal('fetch', fetchMock);

    render(<MessyNotesRunPage runId={7} />);

    await screen.findByText('What made it into the run');
    fireEvent.click(screen.getAllByRole('button', { name: 'Submit run' })[0]);

    await waitFor(() => {
      expect(
        screen.getByText(
          'Run completed. The workflow produced a bounded brief and audit.',
        ),
      ).toBeInTheDocument();
    });
    expect(
      screen.getByText('This brief summarizes the notes.'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        'Tool use and handoffs stayed inside the configured workflow.',
      ).length,
    ).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: 'ok' }));
    expect(screen.getByText('Audit details')).toBeInTheDocument();
    expect(screen.getByText('extract_action_items')).toBeInTheDocument();
    expect(screen.getByText(/Need legal summary/)).toBeInTheDocument();
    expect(
      screen.getAllByText('extractor to reconciler').length,
    ).toBeGreaterThan(0);
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

  it('loads sample chaos into a draft run', async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const draftRun = {
        id: 7,
        status: 'draft',
        workflow_key: 'messy-notes-v1',
        title: null,
        created_at: '2026-04-27T00:00:00Z',
        updated_at: '2026-04-27T00:00:00Z',
        submitted_at: null,
        completed_at: null,
        failed_at: null,
        input_text: '',
        normalized_input_text: null,
        input_metadata_json: null,
        uploaded_files_json: [],
        ingestion_summary_json: null,
        output_brief_json: null,
        post_processor_results_json: null,
        follow_up_count: 0,
        follow_up_response_json: null,
        notification_preference_json: null,
      };

      if (url.endsWith('/api/bff/runs/7')) {
        return Response.json(draftRun);
      }
      if (url.endsWith('/api/bff/runs/7/events')) {
        return Response.json([]);
      }
      if (url.endsWith('/api/bff/runs/7/summary')) {
        return Response.json({
          run_id: 7,
          status: 'draft',
          failure_message: null,
          phase_summary: [],
          tool_usage_summary: [],
          handoff_summary: [],
          audit_summary: null,
          post_processor_summary: [],
        });
      }
      if (url.endsWith('/api/bff/runs')) {
        return Response.json({ runs: [draftRun] });
      }
      if (url.endsWith('/api/bff/runs/samples')) {
        return Response.json({
          samples: [
            {
              key: 'product-planning',
              title: 'Product planning mess',
              description: 'Roadmap fragments.',
              notes: ['Decision: keep it narrow.'],
            },
          ],
        });
      }
      if (url.endsWith('/api/bff/runs/7/sample')) {
        return Response.json({
          ...draftRun,
          title: 'Product planning mess',
          input_text: 'Decision: keep it narrow.',
        });
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<MessyNotesRunPage runId={7} />);

    fireEvent.click(
      await screen.findByRole('button', { name: 'Load sample chaos' }),
    );

    expect(
      await screen.findByDisplayValue('Product planning mess'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Sample chaos loaded. It is curated, not freshly hallucinated.',
      ),
    ).toBeInTheDocument();
  });

  it('captures notification preference and shows exhausted follow-up state', async () => {
    const completedRun = {
      id: 7,
      status: 'completed',
      workflow_key: 'messy-notes-v1',
      title: 'Board prep',
      created_at: '2026-04-27T00:00:00Z',
      updated_at: '2026-04-27T00:00:00Z',
      submitted_at: '2026-04-27T01:00:00Z',
      completed_at: '2026-04-27T01:00:02Z',
      failed_at: null,
      input_text: 'Decision approved',
      normalized_input_text: 'Decision approved',
      input_metadata_json: null,
      uploaded_files_json: [],
      ingestion_summary_json: null,
      output_brief_json: {
        title: 'Board prep',
        executive_summary: 'This brief summarizes the notes.',
        sections: [{ heading: 'Decisions', content: '- Decision approved' }],
        open_questions: [],
      },
      post_processor_results_json: null,
      follow_up_count: 0,
      follow_up_response_json: null,
      notification_preference_json: null,
    };
    const fetchMock = vi.fn(
      async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url.endsWith('/api/bff/runs/7')) {
          return Response.json(completedRun);
        }
        if (url.endsWith('/api/bff/runs/7/events')) {
          return Response.json([]);
        }
        if (url.endsWith('/api/bff/runs/7/summary')) {
          return Response.json({
            run_id: 7,
            status: 'completed',
            failure_message: null,
            phase_summary: [],
            tool_usage_summary: [],
            handoff_summary: [],
            audit_summary: null,
            post_processor_summary: [],
          });
        }
        if (url.endsWith('/api/bff/runs')) {
          return Response.json({ runs: [completedRun] });
        }
        if (url.endsWith('/api/bff/runs/samples')) {
          return Response.json({ samples: [] });
        }
        if (url.endsWith('/api/bff/runs/7/notification-preference')) {
          expect(init?.body).toContain('415');
          return Response.json({
            ...completedRun,
            notification_preference_json: {
              wants_sms: true,
              phone_number: '+14155550134',
            },
          });
        }
        if (url.endsWith('/api/bff/runs/7/follow-up')) {
          return Response.json({
            ...completedRun,
            follow_up_count: 1,
            follow_up_response_json: {
              question: 'Summarize only decisions?',
              answer: '- Decision approved',
              category: 'decisions',
            },
          });
        }
        throw new Error(`Unexpected fetch URL: ${url}`);
      },
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<MessyNotesRunPage runId={7} />);

    fireEvent.click(await screen.findByLabelText('Text me when it is done'));
    fireEvent.change(screen.getByLabelText('US phone number'), {
      target: { value: '(415) 555-0134' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Save notification preference' }),
    );
    expect(await screen.findByText(/Preference saved/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Follow-up question'), {
      target: { value: 'Summarize only decisions?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Ask follow-up' }));

    expect(
      await screen.findByText('One follow-up used. Boundaries restored.'),
    ).toBeInTheDocument();
  });
});
