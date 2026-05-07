import Link from 'next/link';

export const metadata = {
  title: 'Privacy Policy | Messy Notes Demo',
};

export default function PrivacyPolicyPage() {
  return (
    <main className="shell policy-shell">
      <header className="topbar">
        <Link className="brand" href="/">
          <span className="brand-mark">D</span>
          <span>
            <strong>Messy Notes Demo</strong>
            <small>Limited-access demo</small>
          </span>
        </Link>

        <nav className="topnav" aria-label="Privacy navigation">
          <Link href="/">Invite shell</Link>
          <Link href="/messy-notes">Workspace</Link>
          <Link href="/terms">Terms</Link>
        </nav>

        <p className="topbar-status">Privacy</p>
      </header>

      <article className="policy-document">
        <p className="eyebrow">Privacy Policy</p>
        <h1>Privacy Policy</h1>
        <p className="section-detail">Effective date: May 1, 2026</p>

        <p>This site is a limited-access demo operated by Peter Lebedev.</p>

        <h2>Information We Collect</h2>
        <p>We may collect:</p>
        <ul>
          <li>
            information you submit directly, such as your name, email address,
            invitation code requests, phone number, and any notes, files, or
            text you provide in the demo
          </li>
          <li>
            basic technical information, such as IP address, browser type,
            device information, and basic usage logs
          </li>
          <li>
            message history related to demo notifications, including email or
            SMS messages you choose to receive
          </li>
        </ul>

        <h2>How We Use Information</h2>
        <p>We use collected information to:</p>
        <ul>
          <li>provide and operate the demo</li>
          <li>process invitation requests</li>
          <li>generate invitation codes</li>
          <li>send invitation emails</li>
          <li>send optional SMS notifications if you choose to receive them</li>
          <li>process limited SMS replies related to the demo</li>
          <li>
            improve reliability, monitor performance, troubleshoot issues, and
            prevent misuse
          </li>
        </ul>

        <h2>SMS Disclosures</h2>
        <p>
          If you choose to provide your phone number and opt in, we may send SMS
          messages related to your demo experience, such as run completion
          notifications and limited reply handling.
        </p>
        <p>
          Message frequency varies. Message and data rates may apply. You can
          opt out at any time by replying STOP.
        </p>
        <p>
          We do not sell or share your mobile number or SMS opt-in data with
          third parties for their marketing purposes.
        </p>

        <h2>How We Share Information</h2>
        <p>We do not sell your personal information.</p>
        <p>
          We may share information only as needed with service providers that
          help operate the demo, such as cloud hosting, email delivery, SMS
          delivery, and AI model providers, solely for the purpose of running
          the demo and related communications.
        </p>

        <h2>Data Retention</h2>
        <p>
          We retain information only for as long as reasonably necessary to
          operate, review, secure, and improve the demo, or as needed to
          maintain opt-out and abuse-prevention records.
        </p>

        <h2>Security</h2>
        <p>
          We use reasonable administrative and technical measures to protect
          information, but no method of transmission or storage is completely
          secure.
        </p>

        <h2>Your Choices</h2>
        <p>
          You may choose not to submit invitation requests, notes, files, or
          phone numbers.
        </p>
        <p>You may opt out of SMS at any time by replying STOP.</p>
        <p>
          If you want information removed, contact us using the email below.
        </p>

        <h2>Children</h2>
        <p>This demo is not intended for children under 13.</p>

        <h2>Changes</h2>
        <p>
          We may update this Privacy Policy from time to time by posting the
          updated version on this site.
        </p>

        <h2>Contact</h2>
        <p>If you have questions about this Privacy Policy, contact:</p>
        <p>
          <a href="mailto:pete.lebedev@gmail.com">pete.lebedev@gmail.com</a>
        </p>
      </article>
    </main>
  );
}
