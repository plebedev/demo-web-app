import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessyNotesHome } from '@/components/messy-notes-home';

const pushMock = vi.fn();
const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
  }),
}));

vi.mock('@/hooks/use-protected-access', () => ({
  useProtectedAccess: () => ({
    accessToken: 'demo-token',
    isChecking: false,
  }),
}));

describe('MessyNotesHome', () => {
  beforeEach(() => {
    pushMock.mockReset();
    replaceMock.mockReset();
    vi.restoreAllMocks();
  });

  it('renders protected run history from the backend', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

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
                  input_text: null,
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

    render(<MessyNotesHome />);

    expect(await screen.findByText('Create new run')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('Board prep')).toBeInTheDocument();
    });
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('Workflow messy-notes-v1.')).toBeInTheDocument();
  });
});
