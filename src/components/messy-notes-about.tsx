'use client';

import React from 'react';
import { ProtectedDemoShell } from '@/components/protected-demo-shell';
import { useProtectedAccess } from '@/hooks/use-protected-access';
import { phase1DemoConfig } from '@/lib/phase1-demo';

export function MessyNotesAbout() {
  const { isChecking } = useProtectedAccess();

  if (isChecking) {
    return (
      <ProtectedDemoShell activePath="about">
        <section className="workspace-hero">
          <p className="eyebrow">Protected about page</p>
          <h1>Checking your saved demo access.</h1>
        </section>
      </ProtectedDemoShell>
    );
  }

  return (
    <ProtectedDemoShell activePath="about">
      <section className="section-grid">
        <div className="section-heading">
          <p className="eyebrow">About this demo</p>
          <h2>Invite-only, bounded, and practical on purpose.</h2>
          <p className="lede lede--compact">
            This demo takes messy human notes and moves them toward a structured
            brief. It is deliberately not a general chatbot, and it does not
            pretend the heuristic brief is a formal analysis engine.
          </p>
        </div>

        <div className="architecture-grid">
          <article className="section-card section-card--tall">
            <p className="card-kicker">What it is</p>
            <ul className="section-list">
              <li>Invite-only access with backend-issued signed tokens.</li>
              <li>A practical demo for turning messy notes into a brief.</li>
              <li>Bounded follow-up behavior rather than open-ended chat.</li>
              <li>Honest phase-1 limits and visible workflow states.</li>
            </ul>
          </article>

          <article className="section-card section-card--tall">
            <p className="card-kicker">Phase-1 inputs</p>
            <ul className="section-list">
              {phase1DemoConfig.supportedInputs.map((item) => (
                <li key={item}>{item}</li>
              ))}
              <li>One generated brief is produced per submitted run.</li>
              <li>
                Follow-up count is tracked for later guarded follow-up behavior.
              </li>
            </ul>
          </article>

          <article className="section-card">
            <p className="card-kicker">Current stack</p>
            <ul className="section-list">
              <li>Frontend/BFF: Next.js App Router.</li>
              <li>Backend API: FastAPI with protected run endpoints.</li>
              <li>Database: Oracle in production, Postgres locally.</li>
              <li>Deployment: k3s, Helm, Oracle Cloud VM.</li>
            </ul>
          </article>

          <article className="section-card">
            <p className="card-kicker">Workflow direction</p>
            <ul className="section-list">
              <li>Workflow definitions load from typed YAML config.</li>
              <li>
                Agent prompts are assembled from base prompts plus tool
                instructions.
              </li>
              <li>
                Bounded handoffs, a narrow parallel extraction branch, and
                post-run audits are configured explicitly.
              </li>
              <li>
                Run events, tool arguments, final brief output, and audit
                results are persisted for inspection.
              </li>
            </ul>
          </article>
        </div>
      </section>
    </ProtectedDemoShell>
  );
}
