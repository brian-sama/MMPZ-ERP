import { useEffect, useState } from "react";

import { apiClient } from "../../services/apiClient";
import { connectNotifications } from "../../services/websocketService";

export const SmartNotifications = () => {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let socket;
    apiClient
      .get("/notifications/", { params: { page_size: 3 } })
      .then(({ data }) => setNotifications(data.results || []))
      .catch(() => setNotifications([]));

    socket = connectNotifications((payload) => {
      if (!payload) return;
      const next = {
        id: payload.id || `${Date.now()}`,
        title: payload.title || payload.action || "Notification",
        message: payload.message || payload.entity || "New system event"
      };
      setNotifications((prev) => [next, ...prev].slice(0, 3));
    });
    return () => {
      if (socket) socket.close();
    };
  }, []);

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
      <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-amber-700">
        Smart Notifications
      </h2>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {notifications.length === 0 ? (
          <article className="rounded-xl bg-white/80 p-3">
            <h3 className="text-sm font-semibold text-slate-800">No alerts</h3>
            <p className="mt-1 text-xs text-slate-600">You are up to date.</p>
          </article>
        ) : (
          notifications.map((notification) => (
            <article key={notification.id} className="rounded-xl bg-white/80 p-3">
              <h3 className="text-sm font-semibold text-slate-800">{notification.title}</h3>
              <p className="mt-1 text-xs text-slate-600">{notification.message || notification.detail}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
};
