import React from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ArchitecturePage } from '@/components/architecture-page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}));

describe('ArchitecturePage', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders without crashing', () => {
    render(<ArchitecturePage />);
    expect(screen.getByText('System architecture')).toBeInTheDocument();
  });

  it('shows GitHub repository links', () => {
    render(<ArchitecturePage />);
    const webAppLink = screen.getByRole('link', {
      name: 'github.com/plebedev/demo-web-app',
    });
    expect(webAppLink).toHaveAttribute(
      'href',
      'https://github.com/plebedev/demo-web-app',
    );
    const serviceLink = screen.getByRole('link', {
      name: 'github.com/plebedev/demo-service',
    });
    expect(serviceLink).toHaveAttribute(
      'href',
      'https://github.com/plebedev/demo-service',
    );
  });

  it('shows Access hub nav link', () => {
    render(<ArchitecturePage />);
    const accessHubLinks = screen.getAllByRole('link', { name: 'Access hub' });
    expect(accessHubLinks.length).toBeGreaterThan(0);
  });

  it('shows tech stack and deployment sections', () => {
    render(<ArchitecturePage />);
    expect(screen.getByText('Tech stack')).toBeInTheDocument();
    expect(screen.getByText('Deployment')).toBeInTheDocument();
    expect(screen.getByText('Repositories')).toBeInTheDocument();
  });
});
