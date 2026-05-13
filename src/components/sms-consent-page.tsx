'use client';

import Link from 'next/link';
import React from 'react';

const checkboxText = 'Text me when it is done';
const disclosureText =
  'By checking this box, you agree to receive SMS notifications related to your demo run. Message frequency varies. Message and data rates may apply. Reply STOP to opt out.';
const implementationText =
  'Twilio sends the completion text from backend code. Replies are limited to two AI-generated SMS turns.';

export function SmsConsentPage() {
  return (
    <main className="shell policy-shell sms-consent-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">D</span>
          <span>
            <strong>Messy Notes Demo</strong>
            <small>Limited-access demo</small>
          </span>
        </Link>

        <nav className="topnav" aria-label="SMS consent navigation">
          <Link href="/">Access hub</Link>
          <Link href="/architecture">Architecture</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </nav>

        <p className="topbar-status">SMS consent</p>
      </header>

      <article className="policy-document sms-consent-document">
        <p className="eyebrow">A2P 10DLC verification</p>
        <h1>SMS consent for demo notifications</h1>
        <p>
          This page documents the opt-in surface used by the invite-only Messy
          Notes demo. SMS notifications are optional, user initiated, and
          limited to run-completion updates plus a short bounded reply flow.
        </p>

        <section aria-labelledby="mockups-heading">
          <h2 id="mockups-heading">Screenshots / Mockups</h2>
          <div className="sms-mockup-grid">
            <ConsentMockup checked={false} />
            <ConsentMockup checked />
          </div>
        </section>

        <section aria-labelledby="checkbox-heading">
          <h2 id="checkbox-heading">Exact Checkbox Text</h2>
          <dl className="sms-copy-list">
            <div>
              <dt>Checkbox label</dt>
              <dd>{checkboxText}</dd>
            </div>
            <div>
              <dt>Consent disclosure</dt>
              <dd>{disclosureText}</dd>
            </div>
            <div>
              <dt>Implementation note shown in the UI</dt>
              <dd>{implementationText}</dd>
            </div>
          </dl>
        </section>

        <section aria-labelledby="messages-heading">
          <h2 id="messages-heading">Exact Sample Messages</h2>
          <div className="sms-message-list">
            <MessageCard
              label="Completion notification"
              text="Your messy-notes run is complete: Vendor launch brief. Open the demo app to review the brief and audit summary."
            />
            <MessageCard
              label="Opt-out confirmation"
              text="Understood - we won't send future messages to this number."
            />
            <MessageCard
              label="Reply limit message"
              text="This SMS thread is limited for the demo. Please return to the app for the full run details."
            />
            <MessageCard
              label="Fallback reply"
              text="Thanks for the reply. I could not generate a useful SMS answer right now; please return to the app for the run details."
            />
          </div>
        </section>

        <section aria-labelledby="call-consent-heading">
          <h2 id="call-consent-heading">Phone-Call Consent</h2>
          <p>
            The SMS checkbox is consent only for text messages related to the
            selected demo run. It does not authorize marketing texts, marketing
            calls, sales calls, or unrelated phone outreach.
          </p>
          <p>
            The separate Voice Demo uses phone calls only when a user actively
            calls the configured Twilio number or starts a browser voice
            session. Checking the SMS notification box does not opt the user
            into outbound phone calls.
          </p>
          <p>
            Users can opt out of SMS at any time by replying STOP. The backend
            stores opted-out numbers and blocks future SMS notification
            enablement for those numbers.
          </p>
        </section>
      </article>
    </main>
  );
}

function ConsentMockup({ checked }: { checked: boolean }) {
  return (
    <div
      className="sms-consent-mockup"
      aria-label={
        checked ? 'Checked SMS consent mockup' : 'Unchecked SMS consent mockup'
      }
    >
      <label className="sms-consent-mockup__label">
        <input checked={checked} readOnly type="checkbox" />
        <span>{checkboxText}</span>
      </label>
      {checked ? (
        <input
          aria-label="US phone number mockup"
          className="sms-consent-mockup__phone"
          placeholder="US phone number"
          readOnly
          value=""
        />
      ) : null}
      <p className="sms-consent-mockup__action">Save notification preference</p>
      <p>{disclosureText}</p>
      <p>{implementationText}</p>
    </div>
  );
}

function MessageCard({ label, text }: { label: string; text: string }) {
  return (
    <div className="sms-message-card">
      <strong>{label}</strong>
      <p>{text}</p>
    </div>
  );
}
