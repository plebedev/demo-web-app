import { getRuntimeConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function Home() {
  const config = getRuntimeConfig();
  const backendConfigured = Boolean(config.backendBaseUrl);

  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Deployable frontend/BFF starter</p>
        <h1>{config.appName}</h1>
        <p className="lede">
          The public entrypoint is online, the container is ready for Kubernetes,
          and the BFF layer has a home for future backend proxy routes.
        </p>
        <div className="card-row">
          <article className="card">
            <span className="label">Stage</span>
            <strong>{config.stage}</strong>
          </article>
          <article className="card">
            <span className="label">BFF route base</span>
            <strong>{backendConfigured ? "/api/bff/*" : "not configured yet"}</strong>
          </article>
        </div>
      </section>

      <section className="status-grid">
        <article className="panel">
          <h2>Coming soon</h2>
          <p>
            This starter intentionally begins with a simple landing page, while
            keeping a conventional Node.js service shape for future product work.
          </p>
        </article>
        <article className="panel">
          <h2>Ready for later backend integration</h2>
          <p>
            Set <code>BACKEND_BASE_URL</code> to enable pass-through requests
            under <code>/api/bff/*</code> without changing the deployment shape.
          </p>
        </article>
      </section>
    </main>
  );
}
