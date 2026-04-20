import { BackendStatusCard } from '@/components/backend-status-card';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Preview</p>
        <h1>Coming soon</h1>
        <p className="lede">
          The product UI is on its way. For now, this page stays intentionally
          minimal and only shows whether backend services are ready.
        </p>
      </section>

      <BackendStatusCard />
    </main>
  );
}
