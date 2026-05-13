'use client';

import React from 'react';
import { ProtectedDemoShell } from '@/components/protected-demo-shell';
import { useProtectedAccess } from '@/hooks/use-protected-access';

export function MessyNotesAbout() {
  const { accessToken, isChecking } = useProtectedAccess('messy-notes', {
    redirect: false,
  });

  if (isChecking) {
    return (
      <ProtectedDemoShell activePath="about" hasAccess={false}>
        <section className="workspace-hero">
          <p className="eyebrow">Messy Notes</p>
          <h1>Loading…</h1>
        </section>
      </ProtectedDemoShell>
    );
  }

  return (
    <ProtectedDemoShell activePath="about" hasAccess={!!accessToken}>
      <section className="section-grid">
        <div className="section-heading">
          <p className="eyebrow">Messy Notes — about</p>
          <h2>Bounded, honest, and structured on purpose.</h2>
          <p className="lede lede--compact">
            This experience takes raw human notes and produces a structured
            brief. It is deliberately not a general chatbot and does not pretend
            unsupported input types work.
          </p>
        </div>

        <div className="architecture-grid">
          <article className="section-card section-card--tall">
            <p className="card-kicker">What it does</p>
            <ul className="section-list">
              <li>
                Accepts pasted text, text file uploads, and PDFs with
                extractable text.
              </li>
              <li>
                Runs either the hosted bounded multi-agent workflow or a local
                Ollama workflow backed by a LoRA-tuned small model.
              </li>
              <li>
                Persists run events, tool call arguments, the final brief, and a
                post-run audit.
              </li>
              <li>
                Allows one follow-up question per completed run, scoped to the
                generated brief.
              </li>
            </ul>
          </article>

          <article className="section-card section-card--tall">
            <p className="card-kicker">Workflow</p>
            {/*
              Horizontal flow: Input → Backend → Workflow (extract + brief) → Audit → DB
              Each stage uses a distinct pastel fill so stages are easy to distinguish.
            */}
            <svg
              aria-label="Messy Notes workflow diagram"
              viewBox="0 0 340 90"
              width="100%"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <marker
                  id="mn-arr"
                  markerHeight="5"
                  markerWidth="5"
                  orient="auto"
                  refX="5"
                  refY="2.5"
                  viewBox="0 0 5 5"
                >
                  <path d="M0,0 L5,2.5 L0,5 Z" fill="#64748b" />
                </marker>
              </defs>
              <rect fill="#f8f9ff" height="90" rx="6" width="340" x="0" y="0" />

              {/* Input: x=6 w=58 cx=35 */}
              <rect
                fill="#eff6ff"
                height="30"
                rx="4"
                stroke="#3b82f6"
                strokeWidth="1.5"
                width="58"
                x="6"
                y="30"
              />
              <text
                fill="#1e293b"
                fontSize="8"
                fontWeight="600"
                textAnchor="middle"
                x="35"
                y="44"
              >
                Input
              </text>
              <text
                fill="#64748b"
                fontSize="6.5"
                textAnchor="middle"
                x="35"
                y="54"
              >
                text / file / PDF
              </text>

              <line
                markerEnd="url(#mn-arr)"
                stroke="#64748b"
                strokeWidth="1"
                x1="64"
                x2="76"
                y1="45"
                y2="45"
              />

              {/* BFF→Backend: x=78 w=62 cx=109 */}
              <rect
                fill="#f5f3ff"
                height="30"
                rx="4"
                stroke="#7c3aed"
                strokeWidth="1.5"
                width="62"
                x="78"
                y="30"
              />
              <text
                fill="#1e293b"
                fontSize="8"
                fontWeight="600"
                textAnchor="middle"
                x="109"
                y="44"
              >
                Submit
              </text>
              <text
                fill="#64748b"
                fontSize="6.5"
                textAnchor="middle"
                x="109"
                y="54"
              >
                BFF → backend
              </text>

              <line
                markerEnd="url(#mn-arr)"
                stroke="#64748b"
                strokeWidth="1"
                x1="140"
                x2="152"
                y1="45"
                y2="45"
              />

              {/* Extract + Brief: x=154 w=70 cx=189 */}
              <rect
                fill="#ecfdf5"
                height="30"
                rx="4"
                stroke="#059669"
                strokeWidth="1.5"
                width="70"
                x="154"
                y="30"
              />
              <text
                fill="#1e293b"
                fontSize="8"
                fontWeight="600"
                textAnchor="middle"
                x="189"
                y="43"
              >
                Extract
              </text>
              <text
                fill="#64748b"
                fontSize="6.5"
                textAnchor="middle"
                x="189"
                y="53"
              >
                + brief agent
              </text>

              <line
                markerEnd="url(#mn-arr)"
                stroke="#64748b"
                strokeWidth="1"
                x1="224"
                x2="236"
                y1="45"
                y2="45"
              />

              {/* Audit: x=238 w=50 cx=263 */}
              <rect
                fill="#fef9c3"
                height="30"
                rx="4"
                stroke="#d97706"
                strokeWidth="1.5"
                width="50"
                x="238"
                y="30"
              />
              <text
                fill="#1e293b"
                fontSize="8"
                fontWeight="600"
                textAnchor="middle"
                x="263"
                y="48"
              >
                Audit
              </text>

              <line
                markerEnd="url(#mn-arr)"
                stroke="#64748b"
                strokeWidth="1"
                x1="288"
                x2="300"
                y1="45"
                y2="45"
              />

              {/* DB: x=302 w=32 cx=318 */}
              <rect
                fill="#fdf2f8"
                height="30"
                rx="4"
                stroke="#be185d"
                strokeWidth="1.5"
                width="32"
                x="302"
                y="30"
              />
              <text
                fill="#1e293b"
                fontSize="8"
                fontWeight="600"
                textAnchor="middle"
                x="318"
                y="48"
              >
                DB
              </text>

              <text
                fill="#64748b"
                fontSize="6.5"
                textAnchor="middle"
                x="170"
                y="80"
              >
                run events · brief output · audit results persisted per run
              </text>
            </svg>
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

          <article className="section-card">
            <p className="card-kicker">Local SLM option</p>
            <ul className="section-list">
              <li>
                Local development can switch to{' '}
                <code>messy-notes-local-slm</code>, which calls Ollama model{' '}
                <code>messy-brief-local</code>.
              </li>
              <li>
                That model is a Qwen2.5 1.5B LoRA experiment trained to practice
                the notes-to-JSON transformation.
              </li>
              <li>
                It is included for learning and demonstration purposes, not as a
                production serving recommendation.
              </li>
              <li>
                The local path is intentionally simpler than the hosted
                multi-agent workflow, so its audit has fewer tool and handoff
                events.
              </li>
            </ul>
          </article>

          <article className="section-card">
            <p className="card-kicker">Guardrails</p>
            <ul className="section-list">
              <li>No OCR, images, audio/video, or web lookup.</li>
              <li>Samples are curated canned inputs, not live generation.</li>
              <li>
                Follow-up accepts one question scoped to the generated brief
                only.
              </li>
              <li>Rejected files and trimming warnings are shown plainly.</li>
            </ul>
          </article>

          <article className="section-card">
            <p className="card-kicker">Not yet implemented</p>
            <ul className="section-list">
              <li>Broad follow-up chat beyond one scoped question.</li>
              <li>
                OCR, images, audio, video, and web lookup are not supported by
                design.
              </li>
            </ul>
          </article>

          <article className="section-card">
            <p className="card-kicker">Why the audit exists</p>
            <ul className="section-list">
              <li>
                Run events record tool calls, handoffs, and lifecycle state.
              </li>
              <li>
                The post-processor checks whether execution stayed in bounds.
              </li>
              <li>It is review visibility, not a second hidden workflow.</li>
            </ul>
          </article>
        </div>
      </section>
    </ProtectedDemoShell>
  );
}
