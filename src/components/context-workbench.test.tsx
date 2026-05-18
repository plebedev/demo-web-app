import React from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ContextWorkbench } from '@/components/context-workbench';
import { ContextWorkbenchAbout } from '@/components/context-workbench-about';

const mockUseProtectedAccess = vi.fn<
  (
    experienceId: string,
    options?: { redirect?: boolean },
  ) => { accessToken: string | null; isChecking: boolean }
>(() => ({
  accessToken: 'context-token',
  isChecking: false,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/hooks/use-protected-access', () => ({
  useProtectedAccess: (
    experienceId: string,
    options?: { redirect?: boolean },
  ) => mockUseProtectedAccess(experienceId, options),
}));

describe('ContextWorkbench', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockUseProtectedAccess.mockReturnValue({
      accessToken: 'context-token',
      isChecking: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  function contextResponse(url: string) {
    if (url.endsWith('/api/bff/context/domains')) {
      return new Response(
        JSON.stringify({
          domains: [
            {
              id: 'job_search',
              display_name: 'Job Search / Career Context',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.endsWith('/api/bff/context/domains/job_search')) {
      return new Response(
        JSON.stringify({
          id: 'job_search',
          display_name: 'Job Search / Career Context',
          artifact_types: [
            { id: 'job_description', display_name: 'Job Description' },
            { id: 'resume', display_name: 'Resume' },
          ],
          views: [{ id: 'role_fit', display_name: 'Role Fit' }],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.endsWith('/api/bff/context/domains/job_search/artifacts')) {
      return new Response(
        JSON.stringify({
          artifacts: [
            {
              id: 'art_1',
              artifact_type_id: 'job_description',
              title: 'Platform role',
              text: 'Title: Staff Platform Engineer',
              source_uri: 'memory://role',
              metadata: { stage: 'screen' },
              created_at: '2026-05-17T00:00:00Z',
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.endsWith('/api/bff/context/domains/job_search/actionable-items')) {
      return new Response(
        JSON.stringify({
          actionable_items: [
            {
              id: 'task_1',
              item_type: 'prepare_interview_brief',
              title: 'Prepare interview brief',
              description: 'Create a source-grounded brief.',
              readiness_status: 'needs_review',
              source_links: [
                {
                  artifact_id: 'art_1',
                  chunk_id: 'chunk_1',
                  label: 'job_description',
                  excerpt: 'Title: Staff Platform Engineer',
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.endsWith('/api/bff/context/domains/job_search/artifacts/art_1')) {
      return new Response(
        JSON.stringify({
          artifact: {
            id: 'art_1',
            artifact_type_id: 'job_description',
            title: 'Platform role',
            text: 'Title: Staff Platform Engineer',
            source_uri: 'memory://role',
            metadata: { stage: 'screen' },
            created_at: '2026-05-17T00:00:00Z',
          },
          chunks: [
            {
              id: 'chunk_1',
              artifact_id: 'art_1',
              chunk_index: 0,
              text: 'Title: Staff Platform Engineer',
              start_offset: 0,
              end_offset: 30,
              source_link: {
                artifact_id: 'art_1',
                chunk_id: 'chunk_1',
                label: 'job_description',
                excerpt: 'Title: Staff Platform Engineer',
              },
            },
          ],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    if (url.endsWith('/api/bff/context/domains/job_search/views/role_fit')) {
      return new Response(
        JSON.stringify({
          view: {
            id: 'view_1',
            view_definition_id: 'role_fit',
            title: 'Role Fit',
            sections: [
              {
                id: 'strong_matches',
                title: 'Strong Matches',
                content:
                  '- Staff Platform Engineer\n- TypeScript platform experience\n- AI agent workflow exposure',
                evidence_links: [
                  {
                    source: {
                      artifact_id: 'art_1',
                      chunk_id: 'chunk_1',
                      label: 'role title',
                      excerpt: 'Staff Platform Engineer',
                    },
                    confidence: null,
                    note: 'Role title (explicit)',
                  },
                  {
                    source: {
                      artifact_id: 'art_1',
                      chunk_id: 'chunk_2',
                      label: 'technical skill',
                      excerpt: 'TypeScript platform experience',
                    },
                    confidence: null,
                    note: 'Technical skill (explicit)',
                  },
                  {
                    source: {
                      artifact_id: 'art_1',
                      chunk_id: 'chunk_2',
                      label: 'technical skill',
                      excerpt: 'TypeScript platform experience',
                    },
                    confidence: null,
                    note: 'Technical skill (explicit)',
                  },
                  {
                    source: {
                      artifact_id: 'art_1',
                      chunk_id: 'chunk_3',
                      label: 'risk',
                      excerpt: 'Broad platform ownership may be underspecified',
                    },
                    confidence: null,
                    note: 'Scope risk (inferred)',
                  },
                  {
                    source: {
                      artifact_id: 'art_1',
                      chunk_id: 'chunk_4',
                      label: 'agent work',
                      excerpt: 'AI agent workflow exposure',
                    },
                    confidence: null,
                    note: 'Agent experience (explicit)',
                  },
                ],
                metadata: {
                  evidence_kinds: ['explicit', 'inferred'],
                  signal_types: ['role_title', 'technical_skill'],
                },
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return null;
  }

  function contextResponseWithDuplicatePerspectiveLines(url: string) {
    if (url.endsWith('/api/bff/context/domains/job_search/views/role_fit')) {
      return new Response(
        JSON.stringify({
          view: {
            id: 'view_1',
            view_definition_id: 'role_fit',
            title: 'Role Fit',
            sections: [
              {
                id: 'strong_matches',
                title: 'Strong Matches',
                content:
                  '- Repeated source-grounded line\n- Repeated source-grounded line',
                evidence_links: [],
                metadata: { evidence_kinds: ['explicit'] },
              },
            ],
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }
    return contextResponse(url);
  }

  it('discovers domains before loading selected domain metadata', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      return contextResponse(url) ?? new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ContextWorkbench />);

    expect(await screen.findByText('Job Search / Career Context')).toBeTruthy();
    expect(screen.getByText('Job Description: 1')).toBeTruthy();
    expect(await screen.findByText('Strong Matches')).toBeTruthy();
    expect(screen.getByText('Role Fit')).toBeTruthy();
    await waitFor(() => {
      expect(mockUseProtectedAccess).toHaveBeenCalledWith('context-workbench', {
        redirect: false,
      });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bff/context/domains',
        expect.any(Object),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bff/context/domains/job_search',
        expect.any(Object),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bff/context/domains/job_search/artifacts',
        expect.any(Object),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bff/context/domains/job_search/actionable-items',
        expect.any(Object),
      );
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/bff/context/domains/job_search/artifacts/art_1',
        expect.any(Object),
      );
    });
  });

  it('renders duplicate perspective lines without duplicate React keys', async () => {
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => {});
    const fetchMock = vi.fn(async (url: string) => {
      return (
        contextResponseWithDuplicatePerspectiveLines(url) ??
        new Response('{}', { status: 404 })
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ContextWorkbench />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Perspectives' }));
    expect(
      await screen.findAllByText('Repeated source-grounded line'),
    ).toHaveLength(2);
    expect(consoleError).not.toHaveBeenCalledWith(
      expect.stringContaining('Encountered two children with the same key'),
      expect.anything(),
    );
  });

  it('renders perspective sections as synthesis with confidence and evidence grouping', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      return contextResponse(url) ?? new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ContextWorkbench />);

    fireEvent.click(await screen.findByRole('tab', { name: 'Perspectives' }));

    expect(await screen.findByText('How strong is my fit?')).toBeTruthy();
    expect(screen.getByText('Decision summary')).toBeTruthy();
    expect(screen.getByText('Why it matters')).toBeTruthy();
    expect(screen.getByText('High confidence')).toBeTruthy();
    expect(screen.getByText(/explicit · Technical skill/)).toBeTruthy();
    expect(screen.getByText(/repeated 2x/)).toBeTruthy();
    expect(
      screen.queryByText(/explicit · Agent experience/),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Show 1 more evidence source'));

    expect(screen.getAllByText('AI agent workflow exposure')).toHaveLength(2);
  });

  it('groups actionable items by readiness and explains suitability', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      return contextResponse(url) ?? new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ContextWorkbench />);

    fireEvent.click(
      await screen.findByRole('tab', { name: 'Actionable Items' }),
    );

    expect(await screen.findAllByText('Needs review')).toHaveLength(2);
    expect(screen.getByText('Why this exists')).toBeTruthy();
    expect(screen.getByText('Suitability')).toBeTruthy();
    expect(
      screen.getByText('Human-owned until the readiness state changes.'),
    ).toBeTruthy();
  });

  it('renders generic workbench copy before domain details are loaded', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ domains: [] }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          }),
      ),
    );

    render(<ContextWorkbench />);

    expect(screen.getByText('Contextual workbench.')).toBeTruthy();
    expect(
      screen.queryByText('Job Search domain pack shell.'),
    ).not.toBeInTheDocument();
    expect(await screen.findByText('No domains registered.')).toBeTruthy();
  });

  it('clears the visible file selection after successful upload ingestion', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (
        url.endsWith('/api/bff/context/domains/job_search/artifact-uploads')
      ) {
        return new Response(
          JSON.stringify({
            artifact: {
              id: 'art_2',
              artifact_type_id: 'resume',
              title: 'resume.txt',
              text: 'Resume text',
              source_uri: 'upload://resume.txt',
              metadata: {},
              created_at: '2026-05-17T00:00:00Z',
            },
            chunks: [],
            entities: [],
            relationships: [],
            signals: [],
            actionable_items: [],
            extractor_ids: ['resume-extractor'],
          }),
          { status: 201, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return contextResponse(url) ?? new Response('{}', { status: 404 });
    });
    vi.stubGlobal('fetch', fetchMock);

    render(<ContextWorkbench />);

    const fileInput = (await screen.findByLabelText(
      'Upload source',
    )) as HTMLInputElement;
    const pasteInput = screen.getByLabelText(
      'Paste text',
    ) as HTMLTextAreaElement;
    const file = new File(['Resume text'], 'resume.txt', {
      type: 'text/plain',
    });

    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(await screen.findByText('Clear file')).toBeTruthy();
    expect(pasteInput.disabled).toBe(true);

    fireEvent.click(screen.getByText('Ingest and extract'));

    await waitFor(() => {
      expect(screen.queryByText('Clear file')).not.toBeInTheDocument();
      expect(pasteInput.disabled).toBe(false);
      expect(screen.getByLabelText('Title')).toHaveValue('');
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/bff/context/domains/job_search/artifact-uploads',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('shows inline access instead of redirecting when no token is stored', () => {
    mockUseProtectedAccess.mockReturnValue({
      accessToken: null,
      isChecking: false,
    });

    render(<ContextWorkbench />);

    expect(screen.getByText('Access required.')).toBeTruthy();
    expect(screen.getByLabelText('Invitation code')).toBeTruthy();
    expect(mockUseProtectedAccess).toHaveBeenCalledWith('context-workbench', {
      redirect: false,
    });
  });

  it('renders the Context Engine about page with limitations', () => {
    render(<ContextWorkbenchAbout />);

    expect(
      screen.getByText('Source-grounded context, not another chat box.'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'No autonomous execution, MCP exposure, graph DB, or separate vector DB.',
      ),
    ).toBeTruthy();
  });
});
