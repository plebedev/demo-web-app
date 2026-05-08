import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessyNotesAbout } from '@/components/messy-notes-about';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock('@/hooks/use-protected-access', () => ({
  useProtectedAccess: () => ({ accessToken: 'demo-token', isChecking: false }),
}));

describe('MessyNotesAbout', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders without crashing', () => {
    render(<MessyNotesAbout />);
    expect(screen.getByText('Messy Notes — about')).toBeInTheDocument();
  });

  it('shows accurate about content with no phase-1 language', () => {
    render(<MessyNotesAbout />);
    expect(screen.getByText('What it does')).toBeInTheDocument();
    expect(screen.getByText('Guardrails')).toBeInTheDocument();
    expect(screen.getByText('Not yet implemented')).toBeInTheDocument();
    expect(screen.queryByText(/phase.?1/i)).toBeNull();
    expect(screen.queryByText(/phase-1/i)).toBeNull();
  });

  it('shows Access hub and Architecture nav links', () => {
    render(<MessyNotesAbout />);
    const accessHubLinks = screen.getAllByRole('link', { name: 'Access hub' });
    expect(accessHubLinks.length).toBeGreaterThan(0);
    const archLinks = screen.getAllByRole('link', { name: 'Architecture' });
    expect(archLinks.length).toBeGreaterThan(0);
  });
});
