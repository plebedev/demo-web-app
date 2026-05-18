'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { ReactNode } from 'react';

import { clearStoredAccessToken } from '@/lib/access-token';
import { ExperienceId } from '@/lib/experiences';

export function ProtectedDemoShell({
  activePath,
  aboutHref,
  brandMark = 'M',
  brandSubtitle = 'Protected workflow workspace',
  brandTitle = 'Messy Notes Demo',
  children,
  experienceId = 'messy-notes',
  hasAccess = true,
  workspaceHref,
}: Readonly<{
  activePath: 'workspace' | 'about';
  aboutHref?: string;
  brandMark?: string;
  brandSubtitle?: string;
  brandTitle?: string;
  children: ReactNode;
  experienceId?: ExperienceId;
  hasAccess?: boolean;
  workspaceHref?: string;
}>) {
  const router = useRouter();

  function handleSignOut() {
    clearStoredAccessToken(experienceId);
    router.replace('/');
  }

  const resolvedWorkspaceHref = workspaceHref ?? '/messy-notes';
  const resolvedAboutHref = aboutHref ?? '/messy-notes/about';

  return (
    <main className="shell shell--workspace">
      <header className="topbar topbar--workspace">
        <Link className="brand" href={resolvedWorkspaceHref}>
          <span className="brand-mark">{brandMark}</span>
          <span>
            <strong>{brandTitle}</strong>
            <small>{brandSubtitle}</small>
          </span>
        </Link>

        <nav className="topnav" aria-label="Protected demo">
          <Link
            className={activePath === 'workspace' ? 'topnav-link-active' : ''}
            href={resolvedWorkspaceHref}
          >
            Workspace
          </Link>
          <Link
            className={activePath === 'about' ? 'topnav-link-active' : ''}
            href={resolvedAboutHref}
          >
            About
          </Link>
          <Link href="/">Access hub</Link>
          <Link href="/architecture">Architecture</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>

        {hasAccess && (
          <button
            className="secondary-button"
            onClick={handleSignOut}
            type="button"
          >
            Leave demo
          </button>
        )}
      </header>

      {children}
    </main>
  );
}
