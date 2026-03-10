import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";

import { apiClient } from "../../services/apiClient";
import { hasPermission } from "../../utils/permissions";

const toDateTimeLocal = (isoValue) => {
  if (!isoValue) return "";
  const date = new Date(isoValue);
  if (Number.isNaN(date.getTime())) return "";
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

export const AnnouncementsPage = () => {
  const { user } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [announcements, setAnnouncements] = useState([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    content: "",
    is_pinned: false,
    published_at: "",
    expires_at: ""
  });

  const canEdit = useMemo(() => hasPermission(user, "members.edit"), [user]);

  const load = async () => {
    const { data } = await apiClient.get("/announcements/", {
      params: { q: query || undefined, page_size: 100 }
    });
    setAnnouncements(data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load announcements"));
  }, [query]);

  const submit = async () => {
    const payload = {
      title: form.title,
      content: form.content,
      is_pinned: form.is_pinned,
      published_at: form.published_at ? new Date(form.published_at).toISOString() : null,
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null
    };
    try {
      if (editingId) {
        await apiClient.patch(`/announcements/${editingId}/`, payload);
        setStatus("Announcement updated");
      } else {
        await apiClient.post("/announcements/", payload);
        setStatus("Announcement created");
      }
      setForm({ title: "", content: "", is_pinned: false, published_at: "", expires_at: "" });
      setEditingId(null);
      await load();
    } catch {
      setStatus("Announcement save failed");
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Announcements</h2>
        <p className="text-sm text-slate-600">Broadcast updates, policies, and urgent organization notices.</p>
      </header>

      <div className="grid gap-3 rounded-xl bg-white p-4 shadow-panel md:grid-cols-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search announcements"
          className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
        />
        <button onClick={load} className="rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-white">
          Refresh
        </button>
      </div>

      {canEdit ? (
        <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-2">
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Title"
            className="rounded border border-slate-300 px-3 py-2"
          />
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.is_pinned}
              onChange={(event) => setForm((prev) => ({ ...prev, is_pinned: event.target.checked }))}
            />
            Pin announcement
          </label>
          <textarea
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
            placeholder="Content"
            className="h-28 rounded border border-slate-300 px-3 py-2 md:col-span-2"
          />
          <input
            type="datetime-local"
            value={form.published_at}
            onChange={(event) => setForm((prev) => ({ ...prev, published_at: event.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            type="datetime-local"
            value={form.expires_at}
            onChange={(event) => setForm((prev) => ({ ...prev, expires_at: event.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          />
          <button onClick={submit} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
            {editingId ? "Update Announcement" : "Create Announcement"}
          </button>
        </div>
      ) : null}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Pinned</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Expires</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {announcements.map((item) => (
              <tr key={item.id} className="border-t border-slate-200">
                <td className="px-3 py-2">
                  <p className="font-medium text-slate-900">{item.title}</p>
                  <p className="text-xs text-slate-500">{item.content}</p>
                </td>
                <td className="px-3 py-2">{item.is_pinned ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{item.published_at ? new Date(item.published_at).toLocaleString() : "-"}</td>
                <td className="px-3 py-2">{item.expires_at ? new Date(item.expires_at).toLocaleString() : "-"}</td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <button
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          title: item.title || "",
                          content: item.content || "",
                          is_pinned: Boolean(item.is_pinned),
                          published_at: toDateTimeLocal(item.published_at),
                          expires_at: toDateTimeLocal(item.expires_at)
                        });
                      }}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      Edit
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
