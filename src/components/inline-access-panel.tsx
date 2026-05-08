'use client';

import React, { FormEvent, useState } from 'react';

import { persistAccessToken } from '@/lib/access-token';
import { ExperienceId, fallbackExperiences } from '@/lib/experiences';

type RedeemPayload = {
  access_token: string;
  experience_id: ExperienceId;
  expires_at: string;
};

type RequestForm = { name: string; email: string; reason: string };

const emptyRequestForm: RequestForm = { name: '', email: '', reason: '' };

export function InlineAccessPanel({
  experienceId,
  onAccessGranted,
}: {
  experienceId: ExperienceId;
  onAccessGranted: (token: string) => void;
}) {
  const experience = fallbackExperiences.find((e) => e.id === experienceId);

  const [code, setCode] = useState('');
  const [isRedeeming, setIsRedeeming] = useState(false);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestForm, setRequestForm] = useState<RequestForm>(emptyRequestForm);
  const [isRequesting, setIsRequesting] = useState(false);
  const [requestError, setRequestError] = useState<string | null>(null);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);

  async function handleRedeem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRedeeming(true);
    setRedeemError(null);
    try {
      const response = await fetch('/api/bff/access/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const payload = (await response.json()) as RedeemPayload & {
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
      onAccessGranted(payload.access_token);
    } catch (err) {
      setRedeemError(
        err instanceof Error
          ? err.message
          : 'Invitation code validation failed.',
      );
    } finally {
      setIsRedeeming(false);
    }
  }

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsRequesting(true);
    setRequestError(null);
    try {
      const response = await fetch('/api/bff/access/invite-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...requestForm, experience_id: experienceId }),
      });
      const payload = (await response.json().catch(() => null)) as {
        detail?: string;
        message?: string;
      } | null;
      if (!response.ok) {
        throw new Error(
          typeof payload?.detail === 'string'
            ? payload.detail
            : 'Unable to submit request.',
        );
      }
      setRequestForm(emptyRequestForm);
      setRequestNotice(
        payload?.message ||
          'Request received. Your invite is being prepared and emailed.',
      );
      setRequestOpen(false);
    } catch (err) {
      setRequestError(
        err instanceof Error ? err.message : 'Unable to submit request.',
      );
    } finally {
      setIsRequesting(false);
    }
  }

  return (
    <section className="section-grid">
      <div className="section-heading">
        <p className="eyebrow">{experience?.label ?? experienceId}</p>
        <h2>Access required.</h2>
        <p className="lede lede--compact">{experience?.description}</p>
      </div>

      <div className="section-columns">
        <article className="section-card">
          <p className="card-kicker">Have an invitation code?</p>
          <form className="invite-form" onSubmit={handleRedeem}>
            <label className="field-label" htmlFor="inline-redeem-code">
              Invitation code
            </label>
            <input
              className="text-input"
              id="inline-redeem-code"
              onChange={(e) => setCode(e.target.value)}
              placeholder="demo-..."
              type="text"
              value={code}
            />
            {redeemError ? <p className="error-text">{redeemError}</p> : null}
            <button
              className="primary-button"
              disabled={isRedeeming || !code.trim()}
              type="submit"
            >
              {isRedeeming ? 'Checking...' : 'Redeem'}
            </button>
          </form>
        </article>

        <article className="section-card">
          <p className="card-kicker">Need access?</p>
          <p className="section-detail">
            Request an invitation code for this experience.
          </p>
          {requestNotice ? (
            <p className="success-text">{requestNotice}</p>
          ) : (
            <button
              className="secondary-button"
              onClick={() => setRequestOpen(true)}
              type="button"
            >
              Request access
            </button>
          )}
        </article>
      </div>

      {requestOpen ? (
        <div
          aria-modal="true"
          className="invite-request-modal-overlay"
          role="dialog"
        >
          <div className="invite-request-modal">
            <h3 id="inline-request-title">
              Request {experience?.label ?? experienceId} access
            </h3>
            <form
              aria-labelledby="inline-request-title"
              className="invite-form invite-request-modal-form"
              onSubmit={handleRequest}
            >
              <label className="field-label" htmlFor="inline-req-name">
                Name
              </label>
              <input
                className="text-input"
                id="inline-req-name"
                onChange={(e) =>
                  setRequestForm((f) => ({ ...f, name: e.target.value }))
                }
                type="text"
                value={requestForm.name}
              />
              <label className="field-label" htmlFor="inline-req-email">
                Email
              </label>
              <input
                className="text-input"
                id="inline-req-email"
                onChange={(e) =>
                  setRequestForm((f) => ({ ...f, email: e.target.value }))
                }
                type="email"
                value={requestForm.email}
              />
              <label className="field-label" htmlFor="inline-req-reason">
                Why are you interested?
              </label>
              <textarea
                className="text-input"
                id="inline-req-reason"
                onChange={(e) =>
                  setRequestForm((f) => ({ ...f, reason: e.target.value }))
                }
                value={requestForm.reason}
              />
              {requestError ? (
                <p className="error-text">{requestError}</p>
              ) : null}
              <div className="invite-request-modal-actions">
                <button
                  className="primary-button"
                  disabled={isRequesting}
                  type="submit"
                >
                  {isRequesting ? 'Sending...' : 'Send request'}
                </button>
                <button
                  className="secondary-button"
                  onClick={() => {
                    setRequestOpen(false);
                    setRequestError(null);
                  }}
                  type="button"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
