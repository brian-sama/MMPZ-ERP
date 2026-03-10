import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

import { WidgetCard } from "../../components/widgets/WidgetCard";
import { apiClient } from "../../services/apiClient";
import { connectNotifications } from "../../services/websocketService";
import { dashboardWidgets } from "../../utils/navigation";

export const DashboardPage = () => {
  const [metrics, setMetrics] = useState(null);
  const [financeSummary, setFinanceSummary] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      const [metricsResponse, financeResponse, notificationResponse, activityResponse] = await Promise.all([
        apiClient.get("/reports/dashboard-metrics"),
        apiClient.get("/finance/"),
        apiClient.get("/notifications/", { params: { page_size: 5 } }),
        apiClient.get("/audit-logs/", { params: { page_size: 5 } })
      ]);
      setMetrics(metricsResponse.data);
      setFinanceSummary(financeResponse.data);
      setNotifications(notificationResponse.data.results || []);
      setRecentActivity(activityResponse.data.results || []);
    };

    load().catch(() => setError("Unable to load live dashboard data."));

    const socket = connectNotifications((payload) => {
      if (payload?.event === "notification.created" && payload.notification) {
        setNotifications((prev) => [payload.notification, ...prev].slice(0, 5));
      }
      if (payload?.event === "audit.log.created" && payload.audit_log) {
        setRecentActivity((prev) => [payload.audit_log, ...prev].slice(0, 5));
      }
      load().catch(() => {});
    });

    return () => socket.close();
  }, []);

  const widgetValues = useMemo(() => {
    if (!metrics || !financeSummary) {
      return {
        announcements: "...",
        events: "...",
        messages: "...",
        "financial-summary": "...",
        "inventory-alerts": "...",
        "new-members": "...",
        "recent-activity": "..."
      };
    }
    return {
      announcements: `${metrics.announcements_live ?? 0}`,
      events: `${metrics.upcoming_events ?? 0}`,
      messages: `${metrics.unread_messages ?? 0}`,
      "financial-summary": `$${Number(financeSummary.net ?? metrics.net_position ?? 0).toLocaleString()}`,
      "inventory-alerts": `${metrics.low_stock_count ?? 0}`,
      "new-members": `${metrics.new_members_last_30_days ?? 0}`,
      "recent-activity": `${recentActivity.length || metrics.recent_activity_count || 0}`
    };
  }, [metrics, financeSummary, recentActivity]);

  return (
    <section>
      <header className="mb-5">
        <h2 className="text-2xl font-bold text-slate-900">ERP + Intranet Unified Dashboard</h2>
        <p className="text-sm text-slate-600">One portal view for operations, collaboration, and oversight.</p>
      </header>
      {error ? <p className="mb-4 text-sm text-rose-600">{error}</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {dashboardWidgets.map((widget, idx) => (
          <motion.div
            key={widget.id}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.05 }}
          >
            <WidgetCard
              title={widget.title}
              icon={widget.icon}
              value={widgetValues[widget.id]}
              hint="Realtime + cached data"
            />
          </motion.div>
        ))}
      </div>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Latest Notifications</h3>
          <ul className="mt-2 space-y-2">
            {notifications.length === 0 ? (
              <li className="text-sm text-slate-500">No recent notifications.</li>
            ) : (
              notifications.map((notification) => (
                <li key={notification.id} className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {notification.title}: {notification.message}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Recent Activity</h3>
          <ul className="mt-2 space-y-2">
            {recentActivity.length === 0 ? (
              <li className="text-sm text-slate-500">No recent activity.</li>
            ) : (
              recentActivity.map((activity) => (
                <li key={activity.id} className="rounded bg-slate-50 px-3 py-2 text-sm text-slate-700">
                  {activity.action} ({activity.entity})
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </section>
  );
};
