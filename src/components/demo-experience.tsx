'use client';

import React, {
  FormEvent,
  ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  clearStoredAccessToken,
  persistAccessToken,
  readStoredAccessTokens,
  StoredAccessToken,
  StoredAccessTokens,
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
type InviteRequestForm = {
  name: string;
  email: string;
  reason: string;
};

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
  const [tokens, setTokens] = useState<StoredAccessTokens>({});
  const [selectedAccessibleExperienceId, setSelectedAccessibleExperienceId] =
    useState<ExperienceId>('messy-notes');
  const [selectedLockedExperienceId, setSelectedLockedExperienceId] =
    useState<ExperienceId>('messy-notes');
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
      const verifiedEntries = await Promise.all(
        Object.entries(storedTokens).map(
          async ([experienceId, storedToken]) => {
            try {
              const response = await fetch('/api/bff/access/verify', {
                cache: 'no-store',
                headers: {
                  Authorization: `Bearer ${storedToken.accessToken}`,
                },
              });
              if (!response.ok) {
                throw new Error('Stored access token is no longer valid.');
              }
              const payload =
                (await response.json()) as AccessVerificationPayload;
              if (payload.experience_id !== experienceId) {
                throw new Error(
                  'Stored access token is for another experience.',
                );
              }
              persistAccessToken({
                accessToken: storedToken.accessToken,
                experienceId: payload.experience_id,
                expiresAt: payload.expires_at,
              });
              return [payload.experience_id, storedToken] as const;
            } catch {
              clearStoredAccessToken(experienceId as ExperienceId);
              return null;
            }
          },
        ),
      );

      if (!active) {
        return;
      }
      const verifiedTokens = verifiedEntries.filter(
        (entry): entry is readonly [ExperienceId, StoredAccessToken] =>
          entry !== null,
      );
      setTokens(Object.fromEntries(verifiedTokens));
      setAccessState('ready');
    }

    void loadExperiences();
    void verifyStoredTokens();

    return () => {
      active = false;
    };
  }, []);

  const unlockedExperienceIds = useMemo(
    () => new Set(Object.keys(tokens) as ExperienceId[]),
    [tokens],
  );
  const accessibleExperiences = useMemo(
    () =>
      experiences.filter((experience) =>
        unlockedExperienceIds.has(experience.id),
      ),
    [experiences, unlockedExperienceIds],
  );
  const lockedExperiences = useMemo(
    () =>
      experiences.filter(
        (experience) =>
          experience.available && !unlockedExperienceIds.has(experience.id),
      ),
    [experiences, unlockedExperienceIds],
  );
  const selectedLockedExperience = lockedExperiences.find(
    (experience) => experience.id === selectedLockedExperienceId,
  );

  useEffect(() => {
    if (
      accessibleExperiences.length > 0 &&
      !accessibleExperiences.some(
        (experience) => experience.id === selectedAccessibleExperienceId,
      )
    ) {
      setSelectedAccessibleExperienceId(accessibleExperiences[0].id);
    }
  }, [accessibleExperiences, selectedAccessibleExperienceId]);

  useEffect(() => {
    if (
      lockedExperiences.length > 0 &&
      !lockedExperiences.some(
        (experience) => experience.id === selectedLockedExperienceId,
      )
    ) {
      setSelectedLockedExperienceId(lockedExperiences[0].id);
    }
  }, [lockedExperiences, selectedLockedExperienceId]);

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
      setTokens(readStoredAccessTokens());
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
        body: JSON.stringify({
          ...inviteRequest,
          experience_id: selectedLockedExperienceId,
        }),
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
          'Invite request received. Your invite is being prepared and emailed.',
      );
      setRequestFormOpen(false);
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
          <h2>Choose what you need.</h2>
          <p className="lede lede--compact">
            Use existing access to open a demo, or request access to one this
            browser has not unlocked yet.
          </p>
        </div>

        <div className="experience-actions">
          {accessibleExperiences.length > 0 ? (
            <article className="section-card experience-action-card">
              <div>
                <p className="card-kicker">Available to you</p>
                <h3>Go to an experience</h3>
                <p className="section-detail">
                  This browser has a valid signed token for these experiences.
                </p>
              </div>
              <div className="experience-control-row">
                <label className="field-label" htmlFor="accessible-experience">
                  Experience
                </label>
                <select
                  className="select-input"
                  id="accessible-experience"
                  onChange={(event) =>
                    setSelectedAccessibleExperienceId(
                      event.target.value as ExperienceId,
                    )
                  }
                  value={selectedAccessibleExperienceId}
                >
                  {accessibleExperiences.map((experience) => (
                    <option key={experience.id} value={experience.id}>
                      {experience.label}
                    </option>
                  ))}
                </select>
                <button
                  className="primary-button"
                  onClick={() => {
                    const target = accessibleExperiences.find(
                      (experience) =>
                        experience.id === selectedAccessibleExperienceId,
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
          ) : null}

          {lockedExperiences.length > 0 ? (
            <article className="section-card experience-action-card">
              <div>
                <p className="card-kicker">Request access</p>
                <h3>Ask for an invite</h3>
                <p className="section-detail">
                  Pick one experience this browser does not have access to yet.
                </p>
              </div>
              <div className="experience-control-row">
                <label className="field-label" htmlFor="locked-experience">
                  Experience
                </label>
                <select
                  className="select-input"
                  id="locked-experience"
                  onChange={(event) =>
                    setSelectedLockedExperienceId(
                      event.target.value as ExperienceId,
                    )
                  }
                  value={selectedLockedExperienceId}
                >
                  {lockedExperiences.map((experience) => (
                    <option key={experience.id} value={experience.id}>
                      {experience.label}
                    </option>
                  ))}
                </select>
                <button
                  className="secondary-button"
                  onClick={() => setRequestFormOpen(true)}
                  type="button"
                >
                  Request invite
                </button>
              </div>
              {inviteRequestNotice ? (
                <p className="success-text">{inviteRequestNotice}</p>
              ) : null}
            </article>
          ) : null}
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

      {requestFormOpen && selectedLockedExperience ? (
        <div
          aria-labelledby="invite-request-title"
          aria-modal="true"
          className="invite-request-modal-overlay"
          role="dialog"
        >
          <div className="invite-request-modal">
            <div className="modal-heading-row">
              <div>
                <p className="card-kicker">Invite request</p>
                <h3 id="invite-request-title">
                  Request {selectedLockedExperience.label}
                </h3>
              </div>
              <button
                className="secondary-button"
                onClick={() => setRequestFormOpen(false)}
                type="button"
              >
                Close
              </button>
            </div>
            <p className="section-detail">
              The request is saved with the selected experience, then the invite
              email is prepared in the background.
            </p>
            <form
              className="invite-form invite-request-modal-form"
              onSubmit={handleInviteRequestSubmit}
            >
              <label className="field-label" htmlFor="invite-request-name">
                Name
              </label>
              <input
                id="invite-request-name"
                autoComplete="name"
                className="text-input"
                onChange={(event) =>
                  handleInviteRequestChange('name', event.target.value)
                }
                required
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
                  handleInviteRequestChange('email', event.target.value)
                }
                required
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
                  handleInviteRequestChange('reason', event.target.value)
                }
                placeholder="A sentence or two is enough."
                required
                rows={4}
                value={inviteRequest.reason}
              />
              {inviteRequestError ? (
                <p className="error-text">{inviteRequestError}</p>
              ) : null}
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
                {inviteRequestSubmitting
                  ? 'Sending request...'
                  : 'Send request'}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </ShellFrame>
  );
}
