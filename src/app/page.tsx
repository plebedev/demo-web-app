import { getRuntimeConfig } from "@/lib/config";
import { BackendStatusCard } from "@/components/backend-status-card";

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
          <article className="card">
            <span className="label">Backend target</span>
            <strong>{backendConfigured ? config.backendBaseUrl : "not configured yet"}</strong>
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
            Use <code>BACKEND_BASE_URL</code> as an explicit override, or set
            <code> BACKEND_LOCAL_URL</code> and <code>BACKEND_CLUSTER_URL</code>
            so local development and the shipped cluster runtime can resolve the
            backend cleanly without changing application code.
          </p>
        </article>
        <BackendStatusCard />
      </section>
    </main>
  );
}
