'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { clearStoredAccessToken } from '@/lib/access-token';
import { useProtectedAccess } from '@/hooks/use-protected-access';

export function RagComingSoon() {
  const router = useRouter();
  const { isChecking } = useProtectedAccess('rag-demo');

  function handleSignOut() {
    clearStoredAccessToken('rag-demo');
    router.replace('/');
  }

  return (
    <main className="shell shell--workspace">
      <header className="topbar topbar--workspace">
        <Link className="brand" href="/rag-demo">
          <span className="brand-mark">R</span>
          <span>
            <strong>RAG Demo</strong>
            <small>Protected retrieval workspace</small>
          </span>
        </Link>

        <nav className="topnav" aria-label="RAG demo">
          <Link className="topnav-link-active" href="/rag-demo">
            Overview
          </Link>
          <Link href="/">Access hub</Link>
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

      <section className="workspace-hero">
        <div className="hero-copy">
          <p className="eyebrow">RAG demo</p>
          <h1>
            {isChecking
              ? 'Checking your saved RAG access.'
              : 'RAG experience is coming soon.'}
          </h1>
          <p className="lede">
            Your invitation code unlocked the protected RAG destination. The
            next step is the actual retrieval workflow: scoped document ingest,
            grounded search, and answers that cite the retrieved context.
          </p>
          <div className="hero-badges">
            <span>Protected route active</span>
            <span>RAG token required</span>
            <span>Document workflow planned</span>
          </div>
        </div>

        <section className="access-panel">
          <p className="card-kicker">Status</p>
          <h2>Coming soon</h2>
          <p className="section-detail">
            This page is intentionally honest: access control is wired, but the
            browser-facing RAG workflow is not exposed yet.
          </p>
          <Link className="secondary-button secondary-button--link" href="/">
            Back to access hub
          </Link>
        </section>
      </section>
    </main>
  );
}
