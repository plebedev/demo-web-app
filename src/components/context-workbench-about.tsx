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
          <h2>Source-grounded context, not another chat box.</h2>
          <p className="lede lede--compact">
            Context Engine is shared platform infrastructure that turns
            user-provided artifacts into durable source records, extracted
            signals, contextual perspectives, and actionable items. Job Search /
            Career Context is the first domain pack using that infrastructure.
          </p>
        </div>

        <div className="architecture-grid">
          <article className="section-card section-card--tall">
            <p className="card-kicker">Core concepts</p>
            <ul className="section-list">
              <li>
                Artifacts preserve the original source text and provenance.
              </li>
              <li>
                Chunks give derived outputs precise links back to source spans.
              </li>
              <li>Signals capture explicit facts and labeled inferences.</li>
              <li>
                Views assemble signals into perspective-specific sections.
              </li>
            </ul>
          </article>

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
              <li>
                Let future domains reuse ingestion, storage, and provenance.
              </li>
            </ul>
          </article>

          <article className="section-card section-card--tall">
            <p className="card-kicker">Provenance philosophy</p>
            <ul className="section-list">
              <li>
                Outputs should show the source material that justifies them.
              </li>
              <li>Unsupported claims should remain absent, not polished up.</li>
              <li>
                Inferred signals are labeled separately from explicit evidence.
              </li>
              <li>
                Human judgment remains visible where evidence is incomplete.
              </li>
            </ul>
          </article>

          <article className="section-card section-card--tall">
            <p className="card-kicker">Actionable model</p>
            <ul className="section-list">
              <li>
                Items are triaged by readiness, not automatically executed.
              </li>
              <li>
                Ready-for-agent work still points back to supporting sources.
              </li>
              <li>
                Human clarification, decisions, blockers, and source gaps stay
                explicit.
              </li>
              <li>
                Execution agents are intentionally out of scope for this
                milestone.
              </li>
            </ul>
          </article>

          <article className="section-card section-card--wide">
            <p className="card-kicker">Why this differs from basic RAG</p>
            <p className="section-copy">
              A document search tool answers arbitrary questions against indexed
              text. Context Workbench is perspective-driven: registered domain
              packs decide which artifacts are meaningful, which signals can be
              extracted, which contextual views matter, and which actions are
              ready for a person or a future agent. Retrieval supports
              grounding; it is not the primary interaction model.
            </p>
          </article>

          <article className="section-card section-card--wide">
            <p className="card-kicker">Current limits</p>
            <ul className="section-list">
              <li>
                Text, text files, and extractable PDFs are supported inputs.
              </li>
              <li>
                No OCR, image understanding, audio/video parsing, or web lookup.
              </li>
              <li>
                No autonomous execution, MCP exposure, graph DB, or separate
                vector DB.
              </li>
              <li>
                The workbench is invite-gated and owner-scoped by invitation
                token.
              </li>
            </ul>
          </article>
        </div>
      </section>
    </ProtectedDemoShell>
  );
}
