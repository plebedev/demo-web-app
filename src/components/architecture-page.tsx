'use client';

import Link from 'next/link';
import React from 'react';

export function ArchitecturePage() {
  return (
    <main className="shell policy-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">D</span>
          <span>
            <strong>Demo Platform</strong>
            <small>Invite-only demo experiences</small>
          </span>
        </Link>

        <nav className="topnav" aria-label="Architecture navigation">
          <Link href="/">Access hub</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>

        <p className="topbar-status">Architecture</p>
      </header>

      <section className="section-grid">
        <div className="section-heading">
          <p className="eyebrow">System architecture</p>
          <h1>How this platform is built and deployed.</h1>
          <p className="lede lede--compact">
            Three bounded AI experiences running on a single-node k3s cluster.
            The frontend is public; the backend is internal-only.
          </p>
        </div>

        <div className="architecture-grid">
          <article className="section-card section-card--tall">
            <p className="card-kicker">System topology</p>
            {/*
              Rows:
                1 (y=18):  Internet → Traefik → Next.js BFF  (public / blue)
                2 (y=112): Oracle DB  ←  FastAPI backend  →  text-tools (Rust sidecar)
                3 (y=214): LLM APIs   Voice APIs   Twilio     (external services)
              LLM APIs = Claude + OpenAI; local dev can also route Messy Notes
              to Ollama with a LoRA-tuned SLM. Providers are swappable via config.
              Twilio: solid arrow = inbound call (Twilio→Backend),
              dashed arrow = Media Streams (bidirectional).
              text-tools: x=270 w=64 cx=302 cy=73, slate color (internal).
            */}
            <svg
              className="topology-diagram"
              aria-label="System topology diagram"
              viewBox="0 0 340 300"
              width="100%"
              xmlns="http://www.w3.org/2000/svg"
            >
              <defs>
                <marker
                  id="a-slate"
                  markerHeight="5"
                  markerWidth="5"
                  orient="auto"
                  refX="5"
                  refY="2.5"
                  viewBox="0 0 5 5"
                >
                  <path d="M0,0 L5,2.5 L0,5 Z" fill="#64748b" />
                </marker>
                <marker
                  id="a-pink"
                  markerHeight="5"
                  markerWidth="5"
                  orient="auto"
                  refX="5"
                  refY="2.5"
                  viewBox="0 0 5 5"
                >
                  <path d="M0,0 L5,2.5 L0,5 Z" fill="#be185d" />
                </marker>
              </defs>

              {/* background */}
              <rect
                fill="#f8f9ff"
                height="300"
                rx="8"
                width="340"
                x="0"
                y="0"
              />

              {/* ── Row 1: public path ─────────────────────────────────── */}
              {/* Internet: x=6 w=62 cx=37 cy=43 bottom=68 */}
              <rect
                fill="#eff6ff"
                height="50"
                rx="4"
                stroke="#3b82f6"
                strokeWidth="1.5"
                width="62"
                x="6"
                y="18"
              />
              <text
                fill="#1e293b"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
                x="37"
                y="47"
              >
                Internet
              </text>

              {/* Internet → Traefik */}
              <line
                markerEnd="url(#a-slate)"
                stroke="#64748b"
                strokeWidth="1"
                x1="68"
                x2="82"
                y1="43"
                y2="43"
              />

              {/* Traefik: x=84 w=72 cx=120 cy=43 right=156 bottom=68 */}
              <rect
                fill="#eff6ff"
                height="50"
                rx="4"
                stroke="#3b82f6"
                strokeWidth="1.5"
                width="72"
                x="84"
                y="18"
              />
              <text
                fill="#1e293b"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
                x="120"
                y="39"
              >
                Traefik
              </text>
              <text
                fill="#64748b"
                fontSize="7"
                textAnchor="middle"
                x="120"
                y="53"
              >
                ingress
              </text>

              {/* Traefik → BFF */}
              <line
                markerEnd="url(#a-slate)"
                stroke="#64748b"
                strokeWidth="1"
                x1="156"
                x2="174"
                y1="43"
                y2="43"
              />

              {/* BFF: x=176 w=86 cx=219 cy=43 bottom=72 */}
              <rect
                fill="#eff6ff"
                height="58"
                rx="4"
                stroke="#3b82f6"
                strokeWidth="1.5"
                width="86"
                x="176"
                y="14"
              />
              <text
                fill="#1e293b"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
                x="219"
                y="38"
              >
                Next.js BFF
              </text>
              <text
                fill="#64748b"
                fontSize="7"
                textAnchor="middle"
                x="219"
                y="53"
              >
                port 3000 · public
              </text>

              {/* ── Row 2: internal ───────────────────────────────────── */}
              {/* BFF ↓ Backend */}
              <line
                markerEnd="url(#a-slate)"
                stroke="#64748b"
                strokeWidth="1"
                x1="219"
                x2="219"
                y1="72"
                y2="112"
              />

              {/* Backend: x=176 w=86 cx=219 cy=136 top=112 bottom=160 */}
              <rect
                fill="#f5f3ff"
                height="48"
                rx="4"
                stroke="#7c3aed"
                strokeWidth="1.5"
                width="86"
                x="176"
                y="112"
              />
              <text
                fill="#1e293b"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
                x="219"
                y="132"
              >
                FastAPI backend
              </text>
              <text
                fill="#64748b"
                fontSize="7"
                textAnchor="middle"
                x="219"
                y="147"
              >
                port 8000 · internal
              </text>

              {/* Backend → Oracle */}
              <line
                markerEnd="url(#a-slate)"
                stroke="#64748b"
                strokeWidth="1"
                x1="176"
                x2="82"
                y1="136"
                y2="136"
              />

              {/* Oracle: x=8 w=72 cx=44 cy=136 right=80 */}
              <rect
                fill="#fefce8"
                height="48"
                rx="4"
                stroke="#d97706"
                strokeWidth="1.5"
                width="72"
                x="8"
                y="112"
              />
              <text
                fill="#1e293b"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
                x="44"
                y="132"
              >
                Oracle DB
              </text>
              <text
                fill="#64748b"
                fontSize="7"
                textAnchor="middle"
                x="44"
                y="147"
              >
                production
              </text>

              {/* Backend → text-tools (Rust sidecar) */}
              <line
                markerEnd="url(#a-slate)"
                stroke="#64748b"
                strokeWidth="1"
                x1="262"
                x2="270"
                y1="136"
                y2="136"
              />
              {/* text-tools: x=270 w=64 cx=302 cy=136 */}
              <rect
                fill="#f1f5f9"
                height="42"
                rx="4"
                stroke="#475569"
                strokeWidth="1.5"
                width="64"
                x="270"
                y="115"
              />
              <text
                fill="#1e293b"
                fontSize="8"
                fontWeight="600"
                textAnchor="middle"
                x="302"
                y="133"
              >
                text-tools
              </text>
              <text
                fill="#64748b"
                fontSize="6.5"
                textAnchor="middle"
                x="302"
                y="147"
              >
                Rust · internal
              </text>

              {/* ── Row 3: external services ──────────────────────────── */}
              {/* Backend bottom → LLM APIs top-center */}
              <line
                markerEnd="url(#a-slate)"
                stroke="#64748b"
                strokeWidth="1"
                x1="185"
                x2="43"
                y1="160"
                y2="214"
              />

              {/* Backend bottom → Voice APIs top-center */}
              <line
                markerEnd="url(#a-slate)"
                stroke="#64748b"
                strokeWidth="1"
                x1="201"
                x2="127"
                y1="160"
                y2="214"
              />

              {/* Twilio → Backend: inbound call (solid, arrow points up) */}
              <line
                markerEnd="url(#a-pink)"
                stroke="#be185d"
                strokeWidth="1.3"
                x1="212"
                x2="212"
                y1="214"
                y2="160"
              />

              {/* Backend ↔ Twilio: Media Streams (dashed, arrow points down) */}
              <line
                markerEnd="url(#a-pink)"
                stroke="#be185d"
                strokeDasharray="3,2"
                strokeWidth="1.3"
                x1="226"
                x2="226"
                y1="160"
                y2="214"
              />

              {/* LLM APIs: x=8 w=70 cx=43 top=214 — model-agnostic, Claude+OpenAI */}
              <rect
                fill="#ecfdf5"
                height="50"
                rx="4"
                stroke="#059669"
                strokeWidth="1.5"
                width="70"
                x="8"
                y="214"
              />
              <text
                fill="#1e293b"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
                x="43"
                y="235"
              >
                LLM APIs
              </text>
              <text
                fill="#64748b"
                fontSize="7"
                textAnchor="middle"
                x="43"
                y="250"
              >
                Claude · OpenAI
              </text>

              {/* Voice APIs: x=88 w=78 cx=127 top=214 */}
              <rect
                fill="#fff7ed"
                height="50"
                rx="4"
                stroke="#ea580c"
                strokeWidth="1.5"
                width="78"
                x="88"
                y="214"
              />
              <text
                fill="#1e293b"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
                x="127"
                y="235"
              >
                Voice APIs
              </text>
              <text
                fill="#64748b"
                fontSize="7"
                textAnchor="middle"
                x="127"
                y="250"
              >
                xAI · OpenAI
              </text>

              {/* Twilio: x=176 w=84 cx=218 top=214 */}
              <rect
                fill="#fdf2f8"
                height="50"
                rx="4"
                stroke="#be185d"
                strokeWidth="1.5"
                width="84"
                x="176"
                y="214"
              />
              <text
                fill="#1e293b"
                fontSize="9"
                fontWeight="600"
                textAnchor="middle"
                x="218"
                y="232"
              >
                Twilio
              </text>
              <text
                fill="#64748b"
                fontSize="7"
                textAnchor="middle"
                x="218"
                y="247"
              >
                inbound voice
              </text>
              <text
                fill="#64748b"
                fontSize="7"
                textAnchor="middle"
                x="218"
                y="258"
              >
                Media Streams
              </text>

              {/* footnotes */}
              <text
                fill="#64748b"
                fontSize="7"
                textAnchor="middle"
                x="170"
                y="276"
              >
                cluster-internal DNS — backend not exposed through ingress
              </text>
              <text
                fill="#64748b"
                fontSize="7"
                textAnchor="middle"
                x="170"
                y="287"
              >
                Oracle Autonomous DB in production · Postgres locally
              </text>
              <text fill="#be185d" fontSize="6.5" x="8" y="298">
                ── inbound call (Twilio → backend) · - - - Media Streams
                (bidirectional)
              </text>
            </svg>
          </article>

          <article className="section-card section-card--tall">
            <p className="card-kicker">Repositories</p>
            <ul className="section-list">
              <li>
                <strong>Frontend / BFF</strong>
                <br />
                <a
                  href="https://github.com/plebedev/demo-web-app"
                  rel="noreferrer"
                  target="_blank"
                >
                  github.com/plebedev/demo-web-app
                </a>
                <br />
                <span className="section-detail">
                  Next.js 15 App Router · TypeScript · standalone container
                </span>
              </li>
              <li>
                <strong>Backend API</strong>
                <br />
                <a
                  href="https://github.com/plebedev/demo-service"
                  rel="noreferrer"
                  target="_blank"
                >
                  github.com/plebedev/demo-service
                </a>
                <br />
                <span className="section-detail">
                  FastAPI · Python 3.14 · SQLAlchemy 2 · Alembic
                </span>
              </li>
              <li>
                <strong>Local SLM training</strong>
                <br />
                <a
                  href="https://github.com/plebedev/messy-brief-slm"
                  rel="noreferrer"
                  target="_blank"
                >
                  github.com/plebedev/messy-brief-slm
                </a>
                <br />
                <span className="section-detail">
                  MLX-LM LoRA dataset, adapter training, GGUF export, and Ollama
                  packaging for the local Messy Notes model
                </span>
              </li>
            </ul>
          </article>

          <article className="section-card">
            <p className="card-kicker">Tech stack</p>
            <ul className="section-list">
              <li>Frontend/BFF: Next.js 15 App Router, TypeScript.</li>
              <li>
                Backend API: FastAPI (Python 3.14), SQLAlchemy 2.x, Alembic
                migrations, Pydantic 2.
              </li>
              <li>
                Database: Oracle Autonomous Database in production, Postgres
                locally.
              </li>
              <li>
                AI: LLM APIs (Claude, OpenAI) for workflow and retrieval; xAI
                and OpenAI realtime for voice. Workflows are model-agnostic —
                providers are swappable via config.
              </li>
              <li>
                Local learning path: Messy Notes can run through Ollama model{' '}
                <code>messy-brief-local</code>, a LoRA-tuned Qwen2.5 1.5B
                adapter packaged as GGUF for local demonstration.
              </li>
              <li>
                Text processing: a small Rust service (axum) handles
                deterministic chunking and normalization for RAG ingest. It runs
                as an internal sidecar — it exists as hands-on Rust practice,
                not because Python couldn&apos;t do it.
              </li>
            </ul>
          </article>

          <article className="section-card">
            <p className="card-kicker">Deployment</p>
            <ul className="section-list">
              <li>Single-node k3s on Oracle Cloud VM.</li>
              <li>
                Traefik ingress — frontend is public, backend is internal-only
                via cluster DNS.
              </li>
              <li>
                No image registry: build locally → save tar → scp to VM →{' '}
                <code>k3s ctr images import</code> → <code>helm upgrade</code>.
              </li>
              <li>Image tags are the current short git SHA.</li>
              <li>
                Public URL:{' '}
                <a
                  href="https://demo.lebedev.ai"
                  rel="noreferrer"
                  target="_blank"
                >
                  demo.lebedev.ai
                </a>
              </li>
            </ul>
          </article>

          <article className="section-card">
            <p className="card-kicker">Access model</p>
            <ul className="section-list">
              <li>User enters an invitation code on the Access Hub.</li>
              <li>
                Backend validates and issues a signed access token scoped to the
                experience.
              </li>
              <li>Frontend stores the token in localStorage per-experience.</li>
              <li>Protected routes and API calls require a valid token.</li>
            </ul>
          </article>

          <article className="section-card">
            <p className="card-kicker">Experiences</p>
            <ul className="section-list">
              <li>
                <strong>Messy Notes</strong> — bounded multi-agent workflow that
                turns raw notes into a structured brief. Local development can
                switch to a simpler Ollama-backed LoRA SLM workflow for learning
                and demonstration.
              </li>
              <li>
                <strong>RAG Demo</strong> — persona-scoped document retrieval
                with grounded answers and citations.
              </li>
              <li>
                <strong>Voice Demo</strong> — browser and phone access to a
                persona-configured voice advisor via xAI or OpenAI realtime.
              </li>
            </ul>
          </article>
        </div>
      </section>
    </main>
  );
}
