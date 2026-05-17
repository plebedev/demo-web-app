'use client';

import React from 'react';

import { ProtectedDemoShell } from '@/components/protected-demo-shell';
import { useProtectedAccess } from '@/hooks/use-protected-access';

export function ContextWorkbenchAbout() {
  const { accessToken, isChecking } = useProtectedAccess('context-workbench', {
    redirect: false,
  });

  return (
    <ProtectedDemoShell
      activePath="about"
      brandMark="C"
      brandSubtitle="Source-grounded context workspace"
      brandTitle="Context Workbench"
      experienceId="context-workbench"
      hasAccess={!isChecking && !!accessToken}
      workspaceHref="/context-workbench"
      aboutHref="/context-workbench/about"
    >
      <section className="section-grid">
        <div className="section-heading">
          <p className="eyebrow">Context Workbench — about</p>
          <h2>Reusable context, grounded in source material.</h2>
          <p className="lede lede--compact">
            Context Engine is shared platform infrastructure for turning
            user-provided artifacts into source-linked signals, views, and
            actionable items. Job Search is the first domain pack, not the core
            product.
          </p>
        </div>

        <div className="architecture-grid">
          <article className="section-card section-card--tall">
            <p className="card-kicker">Domain packs</p>
            <ul className="section-list">
              <li>
                Register artifact types, extractors, perspectives, and tasks.
              </li>
              <li>
                Keep domain interpretation outside shared platform modules.
              </li>
              <li>
                Can be replaced without changing core Context Engine code.
              </li>
            </ul>
          </article>

          <article className="section-card section-card--tall">
            <p className="card-kicker">Provenance</p>
            <ul className="section-list">
              <li>Derived signals preserve source links back to artifacts.</li>
              <li>
                Views include evidence links instead of unsupported claims.
              </li>
              <li>
                Tasks inherit the source material that made them relevant.
              </li>
            </ul>
          </article>

          <article className="section-card section-card--tall">
            <p className="card-kicker">Architecture</p>
            <ul className="section-list">
              <li>Frontend stays invite-gated and talks through the BFF.</li>
              <li>
                Backend owns registration, ingestion, extraction, and storage.
              </li>
              <li>Domain outputs use generic Context Engine primitives.</li>
            </ul>
          </article>

          <article className="section-card section-card--tall">
            <p className="card-kicker">Current limits</p>
            <ul className="section-list">
              <li>
                Text, text files, and extractable PDFs are the supported inputs.
              </li>
              <li>
                No OCR, image understanding, audio/video parsing, or web lookup.
              </li>
              <li>
                No autonomous execution or production-grade dashboard yet.
              </li>
            </ul>
          </article>
        </div>
      </section>
    </ProtectedDemoShell>
  );
}
