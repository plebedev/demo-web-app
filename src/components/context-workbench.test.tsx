import React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
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

  it('discovers domains before loading selected domain metadata', async () => {
    const fetchMock = vi.fn(async (url: string) => {
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
      if (url.endsWith('/api/bff/context/domains/job_search/tasks')) {
        return new Response(
          JSON.stringify({
            tasks: [
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
                  content: '- Staff Platform Engineer',
                  evidence_links: [
                    {
                      source: {
                        artifact_id: 'art_1',
                        chunk_id: 'chunk_1',
                        label: 'role title',
                        excerpt: 'Staff Platform Engineer',
                      },
                      confidence: 0.95,
                      note: 'Role title (explicit)',
                    },
                  ],
                  metadata: { evidence_kinds: ['explicit'] },
                },
              ],
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        );
      }
      return new Response('{}', { status: 404 });
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
    });
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
