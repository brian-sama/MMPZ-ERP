import { useEffect, useState } from "react";

import { apiClient } from "../../services/apiClient";

export const ActivityFeed = () => {
  const [items, setItems] = useState([]);

  useEffect(() => {
    apiClient
      .get("/audit-logs/", { params: { page_size: 8 } })
      .then(({ data }) => setItems(data.results || []))
      .catch(() => setItems([]));
  }, []);

  return (
    <section className="rounded-2xl bg-white p-6 shadow-panel">
      <h2 className="text-lg font-semibold text-slate-800">Activity Feed</h2>
      <ul className="mt-3 space-y-2">
        {items.length === 0 ? (
          <li className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
            No recent activity yet.
          </li>
        ) : (
          items.map((item) => (
            <li key={`${item.id}`} className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {item.action} • {item.entity} {item.entity_id ? `#${item.entity_id}` : ""}
            </li>
          ))
        )}
      </ul>
    </section>
  );
};
