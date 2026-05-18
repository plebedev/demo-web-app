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
            <p className="card-kicker">How to read it</p>
            <ul className="section-list">
              <li>
                Start with the decision summary at the top of each section.
              </li>
              <li>
                Use why-it-matters text to understand the operational meaning.
              </li>
              <li>Inspect grouped evidence only when you need verification.</li>
              <li>
                Treat additional signals as supporting context, not the main UI.
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
            <p className="card-kicker">Evidence model</p>
            <ul className="section-list">
              <li>Synthesized conclusions are visually primary.</li>
              <li>
                Explicit evidence and inferred conclusions are labeled
                separately.
              </li>
              <li>
                Top evidence appears first; repeated snippets are grouped.
              </li>
              <li>
                Provenance remains available without becoming the primary layer.
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
                Readiness separates agent-suitable, human-owned, decision, and
                blocked work.
              </li>
              <li>
                Every item shows why it exists and which evidence supports it.
              </li>
              <li>
                Execution agents are intentionally out of scope for this
                milestone.
              </li>
            </ul>
          </article>

          <article className="section-card section-card--wide">
            <p className="card-kicker">Perspectives</p>
            <p className="section-copy">
              Each perspective answers a different operational question. Role
              Fit asks how strong the fit appears. Interview Prep asks what to
              prepare. Resume Positioning asks how to frame the source material.
              Application Pipeline asks what should happen next. Compensation
              and Scope Risk asks whether the opportunity needs structural
              clarification before more commitment.
            </p>
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
            <p className="card-kicker">LLM assistance</p>
            <p className="section-copy">
              Model-backed extraction and synthesis are bounded by configured
              Context Engine flows. Outputs must cite provided source chunks,
              distinguish explicit facts from inferences, and fall back to
              deterministic context if model execution is disabled or
              unavailable.
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
