'use client';

import React, { FormEvent, ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { BackendStatusCard } from '@/components/backend-status-card';
import {
  clearStoredAccessToken,
  persistAccessToken,
  readStoredAccessToken,
} from '@/lib/access-token';
import { formatByteLimit, phase1DemoConfig } from '@/lib/phase1-demo';

type AccessVerificationPayload = {
  expires_at: string;
};

type AccessRedeemPayload = {
  access_token: string;
  expires_at: string;
};

type AccessState = 'checking' | 'invite' | 'authenticated';
type InviteRequestForm = {
  name: string;
  email: string;
  reason: string;
};

type FeatureSectionProps = {
  title: string;
  description: string;
  items: string[];
};

function FeatureSection({
  title,
  description,
  items,
}: Readonly<FeatureSectionProps>) {
  return (
    <article className="section-card">
      <p className="card-kicker">{title}</p>
      <p className="section-detail">{description}</p>
      <ul className="section-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </article>
  );
}

function AccessPanel({
  accessState,
  code,
  error,
  inviteRequest,
  inviteRequestError,
  inviteRequestNotice,
  inviteRequestSubmitting,
  requestFormOpen,
  submitting,
  onCodeChange,
  onInviteRequestChange,
  onInviteRequestSubmit,
  onRequestFormToggle,
  onSubmit,
}: Readonly<{
  accessState: AccessState;
  code: string;
  error: string | null;
  inviteRequest: InviteRequestForm;
  inviteRequestError: string | null;
  inviteRequestNotice: string | null;
  inviteRequestSubmitting: boolean;
  requestFormOpen: boolean;
  submitting: boolean;
  onCodeChange: (value: string) => void;
  onInviteRequestChange: (
    field: keyof InviteRequestForm,
    value: string,
  ) => void;
  onInviteRequestSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onRequestFormToggle: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}>) {
  if (accessState === 'checking') {
    return (
      <section className="access-panel" aria-live="polite">
        <p className="card-kicker">Access check</p>
        <h2>Verifying this browser’s signed token</h2>
        <p className="section-detail">
          If the stored token is still valid, this browser stays inside the demo
          without re-entering an invitation code.
        </p>
      </section>
    );
  }

  if (accessState === 'authenticated') {
    return (
      <section className="access-panel">
        <p className="card-kicker">Authenticated</p>
        <h2>Signed access is active</h2>
        <p className="section-detail">
          This browser already holds a signed backend token. The public invite
          shell stays here at `/`, and the protected demo experience now lives
          under the `/messy-notes` slug.
        </p>
        <Link
          className="primary-button primary-button--link"
          href="/messy-notes"
        >
          Open messy notes
        </Link>
      </section>
    );
  }

  return (
    <section className="access-panel">
      <p className="card-kicker">Phase-1 access</p>
      <h2>Enter invitation code</h2>
      <p className="section-detail">
        Invitation codes are validated by the backend, then redeemed into a
        signed access token stored in localStorage for this browser only.
      </p>
      <form className="invite-form" onSubmit={onSubmit}>
        <label className="field-label" htmlFor="invitation-code">
          Invitation code
        </label>
        <input
          id="invitation-code"
          autoComplete="off"
          className="text-input"
          name="invitation-code"
          onChange={(event) => onCodeChange(event.target.value)}
          placeholder="demo-..."
          value={code}
        />
        <button
          className="primary-button"
          disabled={submitting || !code.trim()}
          type="submit"
        >
          {submitting ? 'Checking code…' : 'Continue to demo'}
        </button>
      </form>
      {error ? <p className="error-text">{error}</p> : null}
      <div className="invite-request-block">
        <p className="section-detail">
          No code yet? Request an invite for manual review. No automatic
          approval, no surprise sales funnel.
        </p>
        <button
          className="secondary-button"
          onClick={onRequestFormToggle}
          type="button"
        >
          {requestFormOpen ? 'Hide request form' : 'Request invite'}
        </button>
        {requestFormOpen ? (
          <form className="invite-form" onSubmit={onInviteRequestSubmit}>
            <label className="field-label" htmlFor="invite-request-name">
              Name
            </label>
            <input
              id="invite-request-name"
              autoComplete="name"
              className="text-input"
              onChange={(event) =>
                onInviteRequestChange('name', event.target.value)
              }
              value={inviteRequest.name}
            />
            <label className="field-label" htmlFor="invite-request-email">
              Email
            </label>
            <input
              id="invite-request-email"
              autoComplete="email"
              className="text-input"
              onChange={(event) =>
                onInviteRequestChange('email', event.target.value)
              }
              type="email"
              value={inviteRequest.email}
            />
            <label className="field-label" htmlFor="invite-request-reason">
              Short reason
            </label>
            <textarea
              id="invite-request-reason"
              className="text-area text-area--request"
              onChange={(event) =>
                onInviteRequestChange('reason', event.target.value)
              }
              placeholder="A sentence or two is enough."
              rows={4}
              value={inviteRequest.reason}
            />
            <button
              className="primary-button"
              disabled={
                inviteRequestSubmitting ||
                !inviteRequest.name.trim() ||
                !inviteRequest.email.trim() ||
                !inviteRequest.reason.trim()
              }
              type="submit"
            >
              {inviteRequestSubmitting ? 'Sending request…' : 'Send request'}
            </button>
          </form>
        ) : null}
        {inviteRequestNotice ? (
          <p className="success-text">{inviteRequestNotice}</p>
        ) : null}
        {inviteRequestError ? (
          <p className="error-text">{inviteRequestError}</p>
        ) : null}
      </div>
    </section>
  );
}

function ShellFrame({
  accessState,
  children,
}: Readonly<{
  accessState: AccessState;
  children: ReactNode;
}>) {
  return (
    <main className="shell">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">D</span>
          <span>
            <strong>{phase1DemoConfig.appTitle}</strong>
            <small>Invite-only phase-1 demo</small>
          </span>
        </a>

        <nav className="topnav" aria-label="Primary">
          <a href="#infrastructure">Infrastructure</a>
          <a href="#architecture">Architecture</a>
          <a href="#features">Features</a>
        </nav>

        <p className="topbar-status">
          {accessState === 'authenticated'
            ? 'Signed access active'
            : accessState === 'checking'
              ? 'Checking token'
              : 'Invite required'}
        </p>
      </header>

      {children}
    </main>
  );
}

export function DemoExperience() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [inviteRequest, setInviteRequest] = useState<InviteRequestForm>({
    name: '',
    email: '',
    reason: '',
  });
  const [inviteRequestError, setInviteRequestError] = useState<string | null>(
    null,
  );
  const [inviteRequestNotice, setInviteRequestNotice] = useState<string | null>(
    null,
  );
  const [inviteRequestSubmitting, setInviteRequestSubmitting] = useState(false);
  const [requestFormOpen, setRequestFormOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const storedToken = readStoredAccessToken();
    if (!storedToken) {
      setAccessState('invite');
      return;
    }
    const storedAccessToken = storedToken.accessToken;

    let active = true;

    async function verifyStoredToken() {
      try {
        const response = await fetch('/api/bff/access/verify', {
          cache: 'no-store',
          headers: {
            Authorization: `Bearer ${storedAccessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Stored access token is no longer valid.');
        }

        const payload = (await response.json()) as AccessVerificationPayload;
        if (!active) {
          return;
        }

        persistAccessToken({
          accessToken: storedAccessToken,
          expiresAt: payload.expires_at,
        });
        setAccessState('authenticated');
        setError(null);
      } catch {
        if (!active) {
          return;
        }

        clearStoredAccessToken();
        setAccessState('invite');
        setError('Your invitation session expired or is no longer valid.');
      }
    }

    void verifyStoredToken();
    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);

    try {
      const response = await fetch('/api/bff/access/redeem', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      });

      const payload = (await response.json()) as AccessRedeemPayload & {
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(payload.detail || 'Invitation code validation failed.');
      }

      persistAccessToken({
        accessToken: payload.access_token,
        expiresAt: payload.expires_at,
      });
      setAccessState('authenticated');
      setError(null);
      setCode('');
      router.replace('/messy-notes');
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Invitation code validation failed.',
      );
      clearStoredAccessToken();
      setAccessState('invite');
    } finally {
      setSubmitting(false);
    }
  }

  function handleInviteRequestChange(
    field: keyof InviteRequestForm,
    value: string,
  ) {
    setInviteRequest((current) => ({ ...current, [field]: value }));
  }

  async function handleInviteRequestSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setInviteRequestSubmitting(true);
    setInviteRequestError(null);
    setInviteRequestNotice(null);

    try {
      const response = await fetch('/api/bff/access/invite-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(inviteRequest),
      });

      const payload = (await response.json().catch(() => null)) as {
        detail?: string;
        message?: string;
      } | null;

      if (!response.ok) {
        throw new Error(
          typeof payload?.detail === 'string'
            ? payload.detail
            : 'Unable to submit invite request.',
        );
      }

      setInviteRequest({ name: '', email: '', reason: '' });
      setInviteRequestNotice(
        payload?.message ||
          'Invite request received for manual review. No auto-approval magic.',
      );
    } catch (requestError) {
      setInviteRequestError(
        requestError instanceof Error
          ? requestError.message
          : 'Unable to submit invite request.',
      );
    } finally {
      setInviteRequestSubmitting(false);
    }
  }

  return (
    <ShellFrame accessState={accessState}>
      <section className="hero" id="top">
        <div className="hero-copy">
          <p className="eyebrow">Structured workflows, not generic chat</p>
          <h1>Practical AI tooling with a real protected shell.</h1>
          <p className="lede">
            This demo is intentionally narrow: invite-only access, backend
            persistence for messy-note runs, bounded workflow execution,
            structured audit events, and a deployment shape that matches how the
            system is actually run on Oracle infrastructure.
          </p>
          <div className="hero-badges">
            <span>Invite-only access</span>
            <span>Signed backend tokens</span>
            <span>Protected `/messy-notes` app</span>
            <span>Workflow audit trail</span>
          </div>
        </div>

        <AccessPanel
          accessState={accessState}
          code={code}
          error={error}
          inviteRequest={inviteRequest}
          inviteRequestError={inviteRequestError}
          inviteRequestNotice={inviteRequestNotice}
          inviteRequestSubmitting={inviteRequestSubmitting}
          requestFormOpen={requestFormOpen}
          onCodeChange={setCode}
          onInviteRequestChange={handleInviteRequestChange}
          onInviteRequestSubmit={handleInviteRequestSubmit}
          onRequestFormToggle={() => setRequestFormOpen((current) => !current)}
          onSubmit={handleSubmit}
          submitting={submitting}
        />
      </section>

      <section className="section-grid" id="infrastructure">
        <div className="section-heading">
          <p className="eyebrow">Infrastructure</p>
          <h2>Local and production setups are intentionally different.</h2>
          <p className="lede lede--compact">
            Local development prioritizes fast feedback. Production prioritizes
            a simple but real deployment model for an invite-only demo.
          </p>
        </div>

        <div className="section-columns">
          <FeatureSection
            description="What the product uses during day-to-day development."
            items={[
              'Next.js frontend/BFF on localhost:3000.',
              'FastAPI backend API on localhost:8000.',
              'Postgres via Docker Compose under local/.',
              'Browser traffic goes through BFF routes, not direct backend calls.',
              'The public invite shell lives at `/`, while the protected demo slug lives at `/messy-notes`.',
            ]}
            title="Local development"
          />
          <FeatureSection
            description="How the demo is deployed and operated today."
            items={[
              'Single-node k3s cluster on an Oracle Cloud VM.',
              'Public ingress exposes the web app, not the internal admin API.',
              'Backend stays behind cluster-internal service DNS.',
              'Images are built locally, tagged with git SHA, shipped as tar, imported into k3s, and deployed via Helm.',
              'This lightweight deploy path is deliberate for a cost-constrained invite-only demo.',
            ]}
            title="Production deployment"
          />
          <FeatureSection
            description="How backend secrets reach the running service."
            items={[
              'Backend config is environment-variable driven.',
              'Runtime secrets are synced into Kubernetes Secrets before deployment.',
              'Pods consume those Kubernetes Secrets directly at runtime.',
              'Oracle Secret Manager / OCI Vault is deliberately not used in this demo to keep the operating model simple on Always Free resources.',
            ]}
            title="Secrets and config"
          />
        </div>
      </section>

      <section className="section-grid" id="architecture">
        <div className="section-heading">
          <p className="eyebrow">Architecture</p>
          <h2>Two repos, one product.</h2>
          <p className="lede lede--compact">
            The browser-facing invite gate and demo workspace live in the
            frontend/BFF. Persistence, invite validation, token issuance, and
            internal admin behavior live in the backend service.
          </p>
        </div>

        <div className="architecture-grid">
          <article className="section-card section-card--tall">
            <p className="card-kicker">Frontend / BFF</p>
            <h3>demo-web-app</h3>
            <p className="section-detail">
              Source:{' '}
              <a href="https://github.com/plebedev/demo-web-app">
                github.com/plebedev/demo-web-app
              </a>
            </p>
            <ul className="section-list">
              <li>Framework: Next.js App Router with React 19.</li>
              <li>
                Owns browser UI, invite entry flow, redirect into protected demo
                slugs, and the messy-notes workspace.
              </li>
              <li>
                Stores the signed phase-1 token in localStorage for this
                browser.
              </li>
              <li>
                Proxies backend calls through `/api/bff/*` instead of exposing
                backend URLs to browser code.
              </li>
            </ul>
          </article>

          <article className="section-card section-card--tall">
            <p className="card-kicker">Backend API</p>
            <h3>demo-service</h3>
            <p className="section-detail">
              Source:{' '}
              <a href="https://github.com/plebedev/demo-service">
                github.com/plebedev/demo-service
              </a>
            </p>
            <ul className="section-list">
              <li>
                Framework: FastAPI with SQLAlchemy, Pydantic settings, and
                Alembic migrations.
              </li>
              <li>
                Owns invitation code validation, redemption tracking, signed
                token issuance, persisted runs, and protected endpoints.
              </li>
              <li>
                Provides internal-only admin APIs for creating, listing,
                deactivating, and inspecting invite codes.
              </li>
              <li>
                Uses Postgres locally and Oracle as the production target.
              </li>
              <li>
                Receives secrets through Kubernetes Secret-backed environment
                variables rather than a separate managed secret delivery layer.
              </li>
            </ul>
          </article>

          <article className="section-card">
            <p className="card-kicker">Auth model</p>
            <h3>Simple by design</h3>
            <ul className="section-list">
              <li>No full login system.</li>
              <li>No browser-only `validated=true` flags.</li>
              <li>Backend-issued signed tokens gate protected routes.</li>
              <li>
                Invalid or expired tokens send the browser back to invite entry.
              </li>
            </ul>
          </article>

          <article className="section-card">
            <p className="card-kicker">Guardrail model</p>
            <h3>Explicit constraints</h3>
            <ul className="section-list">
              <li>
                Hard limits are enforced for file count, file size, extracted
                text, and total workflow text.
              </li>
              <li>One generated brief per run.</li>
              <li>
                Follow-up count is tracked for later guarded follow-up behavior.
              </li>
              <li>
                The brief is generated by a bounded workflow with deterministic
                tools and visible event logging.
              </li>
              <li>
                Agent/tool orchestration stays config-driven rather than
                open-ended.
              </li>
            </ul>
          </article>
        </div>
      </section>

      <section className="section-grid" id="features">
        <div className="section-heading">
          <p className="eyebrow">Features</p>
          <h2>What exists now, what is intentionally missing.</h2>
          <p className="lede lede--compact">
            This section is meant to be honest. Some capabilities are present,
            some are intentionally small, and some are blocked out on purpose to
            keep phase 1 real.
          </p>
        </div>

        <div className="section-columns section-columns--triple">
          <FeatureSection
            description="Implemented in the current milestone."
            items={[
              'Invite code entry and signed token persistence.',
              'Backend invite redemption, usage counting, and redemption records.',
              'Protected `/messy-notes` workspace and run-history shell.',
              'Run creation, draft persistence, retrieval, and bounded workflow execution.',
              'Generated brief storage, structured run events, and post-run audit summaries.',
              'Protected API access through the BFF.',
              'Internal admin invitation management endpoints and script.',
            ]}
            title="Implemented"
          />
          <FeatureSection
            description="Supported input types for the current briefing scope."
            items={[
              ...phase1DemoConfig.supportedInputs,
              `${phase1DemoConfig.limits.maxFilesPerRun} files per run.`,
              `${formatByteLimit(phase1DemoConfig.limits.maxFileSizeBytes)} max per file.`,
            ]}
            title="Phase-1 supported"
          />
          <FeatureSection
            description="Explicitly not part of this phase."
            items={[
              ...phase1DemoConfig.unsupportedInputs,
              'No public admin UI.',
              'No full user accounts or password login.',
              'No broad follow-up chat yet.',
              'No open-ended autonomous agent loop.',
            ]}
            title="Not implemented"
          />
        </div>

        <div className="overview-strip">
          <article className="mini-card">
            <p className="card-kicker">Follow-up policy</p>
            <ul className="section-list">
              {phase1DemoConfig.followUpRules.map((rule) => (
                <li key={rule}>{rule}</li>
              ))}
            </ul>
          </article>

          <article className="mini-card">
            <p className="card-kicker">Next useful polish</p>
            <p className="section-detail">
              The next additions should improve extraction and synthesis quality
              from the saved run model, while keeping the execution path bounded
              and inspectable.
            </p>
          </article>

          <BackendStatusCard />
        </div>
      </section>
    </ShellFrame>
  );
}
