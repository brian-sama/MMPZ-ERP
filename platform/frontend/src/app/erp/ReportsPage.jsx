import { useEffect, useState } from "react";

import { apiClient } from "../../services/apiClient";

export const ReportsPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [definitions, setDefinitions] = useState([]);
  const [runs, setRuns] = useState([]);
  const [status, setStatus] = useState("");

  const load = async () => {
    const [metricsRes, defsRes, runsRes] = await Promise.all([
      apiClient.get("/reports/dashboard-metrics"),
      apiClient.get("/reports/definitions/", { params: { page_size: 100 } }),
      apiClient.get("/reports/runs/", { params: { page_size: 100 } })
    ]);
    setMetrics(metricsRes.data);
    setDefinitions(defsRes.data.results || []);
    setRuns(runsRes.data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load reports"));
  }, []);

  const runReport = async (id) => {
    try {
      await apiClient.post(`/reports/definitions/${id}/run/`);
      setStatus("Report queued");
      await load();
    } catch {
      setStatus("Failed to queue report");
    }
  };

  const definitionById = Object.fromEntries(definitions.map((definition) => [definition.id, definition]));

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Reports and Analytics</h2>
        <p className="text-sm text-slate-600">Live dashboard metrics and report execution history.</p>
      </header>
      {metrics ? (
        <div className="grid gap-3 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Members</p>
            <p className="text-xl font-semibold text-slate-900">{metrics.members_total}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Net Position</p>
            <p className="text-xl font-semibold text-slate-900">${Number(metrics.net_position).toLocaleString()}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Low Stock</p>
            <p className="text-xl font-semibold text-slate-900">{metrics.low_stock_count}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-500">Unread Messages</p>
            <p className="text-xl font-semibold text-slate-900">{metrics.unread_messages}</p>
          </div>
        </div>
      ) : null}
      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold text-slate-900">Report Definitions</h3>
          <ul className="mt-2 space-y-2">
            {definitions.map((definition) => (
              <li key={definition.id} className="flex items-center justify-between rounded bg-slate-50 p-2">
                <span className="text-sm text-slate-700">{definition.name}</span>
                <button
                  onClick={() => runReport(definition.id)}
                  className="rounded bg-brand-700 px-2 py-1 text-xs font-semibold text-white"
                >
                  Run
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold text-slate-900">Recent Runs</h3>
          <ul className="mt-2 space-y-2">
            {runs.map((run) => (
              <li key={run.id} className="rounded bg-slate-50 p-2 text-sm text-slate-700">
                {definitionById[run.report]?.name || `Report ${run.report}`} - {run.status}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
};
