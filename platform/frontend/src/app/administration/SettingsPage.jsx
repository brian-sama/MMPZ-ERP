import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { apiClient } from "../../services/apiClient";
import { hasPermission } from "../../utils/permissions";

export const SettingsPage = () => {
  const { user } = useOutletContext();
  const [health, setHealth] = useState(null);
  const [cacheStats, setCacheStats] = useState([]);
  const [queueJobs, setQueueJobs] = useState([]);
  const [status, setStatus] = useState("");

  const canViewOperational = useMemo(() => hasPermission(user, "members.view"), [user]);

  useEffect(() => {
    const load = async () => {
      const [healthResponse, cacheResponse, queueResponse] = await Promise.all([
        fetch("/health/").then((res) => res.json()),
        apiClient.get("/admin/cache/", { params: { page_size: 20 } }),
        apiClient.get("/admin/queues/jobs/", { params: { page_size: 20 } })
      ]);
      setHealth(healthResponse);
      setCacheStats(cacheResponse.data.results || []);
      setQueueJobs(queueResponse.data.results || []);
    };
    load().catch(() => setStatus("Failed to load operational settings"));
  }, []);

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">System Settings</h2>
        <p className="text-sm text-slate-600">
          Operational configuration and runtime health visibility for production support.
        </p>
      </header>

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Environment Contract</h3>
          <dl className="mt-3 space-y-2 text-sm text-slate-700">
            <div>
              <dt className="text-slate-500">API Base</dt>
              <dd>{import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">WS Base</dt>
              <dd>{import.meta.env.VITE_WS_BASE || "ws://localhost:8000"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Current Host</dt>
              <dd>{window.location.origin}</dd>
            </div>
          </dl>
        </article>

        <article className="rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Runtime Health</h3>
          {!health ? (
            <p className="mt-3 text-sm text-slate-500">Loading health status...</p>
          ) : (
            <dl className="mt-3 space-y-2 text-sm text-slate-700">
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd>{health.status || "unknown"}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Timestamp</dt>
                <dd>{health.timestamp || "-"}</dd>
              </div>
            </dl>
          )}
        </article>
      </div>

      {canViewOperational ? (
        <div className="grid gap-4 md:grid-cols-2">
          <article className="rounded-xl bg-white p-4 shadow-panel">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Cache Metrics</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {cacheStats.length === 0 ? (
                <li className="text-slate-500">No cache metrics available.</li>
              ) : (
                cacheStats.map((entry) => (
                  <li key={entry.id} className="rounded bg-slate-50 px-3 py-2">
                    {entry.cache_key}: {entry.hit_count} hits / {entry.miss_count} misses
                  </li>
                ))
              )}
            </ul>
          </article>

          <article className="rounded-xl bg-white p-4 shadow-panel">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Queue Jobs</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-700">
              {queueJobs.length === 0 ? (
                <li className="text-slate-500">No queue jobs available.</li>
              ) : (
                queueJobs.map((job) => (
                  <li key={job.id} className="rounded bg-slate-50 px-3 py-2">
                    {job.task_name} - {job.status}
                  </li>
                ))
              )}
            </ul>
          </article>
        </div>
      ) : null}

      <article className="rounded-xl bg-white p-4 shadow-panel">
        <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Operations Links</h3>
        <ul className="mt-2 space-y-1 text-sm">
          <li>
            <a className="text-brand-700 underline" href="/api/v1/auth/session/" target="_blank" rel="noreferrer">
              API Session Endpoint
            </a>
          </li>
          <li>
            <a className="text-brand-700 underline" href="/api/v2/" target="_blank" rel="noreferrer">
              API v2 Contract Lane
            </a>
          </li>
          <li>
            <a className="text-brand-700 underline" href="/health/" target="_blank" rel="noreferrer">
              Health Endpoint
            </a>
          </li>
        </ul>
      </article>
    </section>
  );
};
