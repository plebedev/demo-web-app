'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import React, { ReactNode } from 'react';

import { clearStoredAccessToken } from '@/lib/access-token';
import { ExperienceId } from '@/lib/experiences';

export function ProtectedDemoShell({
  activePath,
  children,
  experienceId = 'messy-notes',
}: Readonly<{
  activePath: 'workspace' | 'about';
  children: ReactNode;
  experienceId?: ExperienceId;
}>) {
  const router = useRouter();

  function handleSignOut() {
    clearStoredAccessToken(experienceId);
    router.replace('/');
  }

  return (
    <main className="shell shell--workspace">
      <header className="topbar topbar--workspace">
        <Link className="brand" href="/messy-notes">
          <span className="brand-mark">M</span>
          <span>
            <strong>Messy Notes Demo</strong>
            <small>Protected workflow workspace</small>
          </span>
        </Link>

        <nav className="topnav" aria-label="Protected demo">
          <Link
            className={activePath === 'workspace' ? 'topnav-link-active' : ''}
            href="/messy-notes"
          >
            Workspace
          </Link>
          <Link
            className={activePath === 'about' ? 'topnav-link-active' : ''}
            href="/messy-notes/about"
          >
            About
          </Link>
          <Link href="/">Invite shell</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>

        <button
          className="secondary-button"
          onClick={handleSignOut}
          type="button"
        >
          Leave demo
        </button>
      </header>

      {children}
    </main>
  );
}
