'use client';

import React, { FormEvent, ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  clearStoredAccessToken,
  isHardAccessVerificationFailure,
  persistAccessToken,
  readStoredAccessTokens,
} from '@/lib/access-token';
import {
  Experience,
  ExperienceId,
  ExperienceListResponse,
  fallbackExperiences,
} from '@/lib/experiences';
import { phase1DemoConfig } from '@/lib/phase1-demo';

type AccessVerificationPayload = {
  experience_id: ExperienceId;
  expires_at: string;
};

type AccessRedeemPayload = {
  access_token: string;
  experience_id: ExperienceId;
  redirect_path: string;
  expires_at: string;
};

type AccessState = 'checking' | 'ready';

function ShellFrame({
  accessState,
  children,
}: Readonly<{
  accessState: AccessState;
  children: ReactNode;
}>) {
  return (
    <main className="shell access-hub-shell">
      <header className="topbar">
        <a className="brand" href="#top">
          <span className="brand-mark">D</span>
          <span>
            <strong>{phase1DemoConfig.appTitle}</strong>
            <small>Invite-only demo experiences</small>
          </span>
        </a>

        <nav className="topnav" aria-label="Primary">
          <a href="#experiences">Experiences</a>
          <a href="#guardrails">Guardrails</a>
          <Link href="/architecture">Architecture</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>

        <p className="topbar-status">
          {accessState === 'checking' ? 'Checking tokens' : 'Access hub'}
        </p>
      </header>

      {children}
    </main>
  );
}

export function DemoExperience() {
  const router = useRouter();
  const [accessState, setAccessState] = useState<AccessState>('checking');
  const [experiences, setExperiences] =
    useState<Experience[]>(fallbackExperiences);
  const [selectedExperienceId, setSelectedExperienceId] =
    useState<ExperienceId>('messy-notes');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadExperiences() {
      try {
        const response = await fetch('/api/bff/experiences', {
          cache: 'no-store',
        });
        if (!response.ok) {
          throw new Error('Unable to load experiences.');
        }
        const payload = (await response.json()) as ExperienceListResponse;
        if (active && payload.experiences.length > 0) {
          setExperiences(payload.experiences);
        }
      } catch {
        if (active) {
          setExperiences(fallbackExperiences);
        }
      }
    }

    async function verifyStoredTokens() {
      const storedTokens = readStoredAccessTokens();
      await Promise.all(
        Object.entries(storedTokens).map(
          async ([experienceId, storedToken]) => {
            try {
              const response = await fetch('/api/bff/access/verify', {
                cache: 'no-store',
                headers: { Authorization: `Bearer ${storedToken.accessToken}` },
              });
              if (!response.ok) {
                if (isHardAccessVerificationFailure(response.status)) {
                  clearStoredAccessToken(experienceId as ExperienceId);
                }
                return;
              }
              const payload =
                (await response.json()) as AccessVerificationPayload;
              if (payload.experience_id !== experienceId) {
                clearStoredAccessToken(experienceId as ExperienceId);
                return;
              }
              persistAccessToken({
                accessToken: storedToken.accessToken,
                experienceId: payload.experience_id,
                expiresAt: payload.expires_at,
              });
            } catch {
              // transient failure — keep the stored token as-is
            }
          },
        ),
      );
      if (!active) {
        return;
      }
      setAccessState('ready');
    }

    void loadExperiences();
    void verifyStoredTokens();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (
      experiences.length > 0 &&
      !experiences.some((e) => e.id === selectedExperienceId)
    ) {
      setSelectedExperienceId(experiences[0].id);
    }
  }, [experiences, selectedExperienceId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

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
        experienceId: payload.experience_id,
        expiresAt: payload.expires_at,
      });
      setCode('');
      router.replace(payload.redirect_path);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : 'Invitation code validation failed.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ShellFrame accessState={accessState}>
      <section className="hero access-hub-hero" id="top">
        <div className="hero-copy access-hub-intro">
          <p className="eyebrow">Structured workflows, not generic chat</p>
          <h1>Choose a protected demo experience.</h1>
          <p className="lede">
            Invitation codes are scoped to one experience. This browser can keep
            separate signed tokens for Messy Notes and RAG Demo, so access to
            one never silently unlocks the other.
          </p>
          <div className="hero-badges">
            <span>Invite-only access</span>
            <span>Per-experience tokens</span>
            <span>Backend-scoped redirects</span>
            <span>Typed experience ids</span>
          </div>
        </div>

        <section className="access-panel access-hub-redeem">
          <p className="card-kicker">Access</p>
          <h2>
            {accessState === 'checking'
              ? 'Checking saved access'
              : 'Enter invitation code'}
          </h2>
          <p className="section-detail">
            Redeem a code for the experience it was issued for. The backend
            decides the destination from the code label.
          </p>
          <form className="invite-form" onSubmit={handleSubmit}>
            <label className="field-label" htmlFor="invitation-code">
              Invitation code
            </label>
            <input
              id="invitation-code"
              autoComplete="off"
              className="text-input"
              name="invitation-code"
              onChange={(event) => setCode(event.target.value)}
              placeholder="demo-..."
              value={code}
            />
            <button
              className="primary-button"
              disabled={submitting || !code.trim()}
              type="submit"
            >
              {submitting ? 'Checking code...' : 'Continue'}
            </button>
          </form>
          {error ? <p className="error-text">{error}</p> : null}
        </section>
      </section>

      <section className="section-grid access-hub-experiences" id="experiences">
        <div className="section-heading access-hub-section-heading">
          <p className="eyebrow">Experiences</p>
          <h2>Go to an experience.</h2>
          <p className="lede lede--compact">
            Each experience is publicly accessible. An invitation code unlocks
            the full workspace.
          </p>
        </div>

        <div className="experience-actions">
          <article className="section-card experience-action-card">
            <div>
              <p className="card-kicker">Demo experiences</p>
              <h3>Go to an experience</h3>
              <p className="section-detail">
                Open an experience to explore it or redeem an invitation code
                inline.
              </p>
            </div>
            <div className="experience-control-row">
              <label className="field-label" htmlFor="experience-select">
                Experience
              </label>
              <select
                className="select-input"
                id="experience-select"
                onChange={(event) =>
                  setSelectedExperienceId(event.target.value as ExperienceId)
                }
                value={selectedExperienceId}
              >
                {experiences.map((experience) => (
                  <option key={experience.id} value={experience.id}>
                    {experience.label}
                  </option>
                ))}
              </select>
              <button
                className="primary-button"
                onClick={() => {
                  const target = experiences.find(
                    (e) => e.id === selectedExperienceId,
                  );
                  if (target) {
                    router.push(target.route);
                  }
                }}
                type="button"
              >
                Go
              </button>
            </div>
          </article>
        </div>
      </section>

      <section className="section-grid" id="guardrails">
        <div className="section-heading">
          <p className="eyebrow">Guardrails</p>
          <h2>Access is explicit and experience-scoped.</h2>
        </div>
        <div className="section-columns">
          <article className="section-card">
            <p className="card-kicker">Backend boundary</p>
            <p className="section-detail">
              Invitation-code labels become token experience claims. Protected
              backend APIs accept only the token for their own experience.
            </p>
          </article>
          <article className="section-card">
            <p className="card-kicker">Browser storage</p>
            <p className="section-detail">
              Tokens are stored by experience id, which lets the same browser
              hold access to one demo, both demos, or future demos
              independently.
            </p>
          </article>
        </div>
      </section>
    </ShellFrame>
  );
}
