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

export const EventsPage = () => {
  const { user } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [startsFrom, setStartsFrom] = useState("");
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    starts_at: "",
    ends_at: "",
    location: ""
  });

  const canEdit = useMemo(() => hasPermission(user, "members.edit"), [user]);

  const load = async () => {
    const { data } = await apiClient.get("/events/", {
      params: { q: query || undefined, starts_from: startsFrom || undefined, page_size: 100 }
    });
    setEvents(data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load events"));
  }, [query, startsFrom]);

  const submit = async () => {
    const payload = {
      title: form.title,
      description: form.description,
      starts_at: new Date(form.starts_at).toISOString(),
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      location: form.location
    };
    try {
      if (editingId) {
        await apiClient.patch(`/events/${editingId}/`, payload);
        setStatus("Event updated");
      } else {
        await apiClient.post("/events/", payload);
        setStatus("Event created");
      }
      setForm({ title: "", description: "", starts_at: "", ends_at: "", location: "" });
      setEditingId(null);
      await load();
    } catch {
      setStatus("Event save failed");
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Events</h2>
        <p className="text-sm text-slate-600">Schedule, manage, and broadcast upcoming organizational events.</p>
      </header>

      <div className="grid gap-3 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search events"
          className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
        />
        <input
          type="date"
          value={startsFrom}
          onChange={(event) => setStartsFrom(event.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
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
            placeholder="Event title"
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            value={form.location}
            onChange={(event) => setForm((prev) => ({ ...prev, location: event.target.value }))}
            placeholder="Location"
            className="rounded border border-slate-300 px-3 py-2"
          />
          <textarea
            value={form.description}
            onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="Description"
            className="h-24 rounded border border-slate-300 px-3 py-2 md:col-span-2"
          />
          <input
            type="datetime-local"
            value={form.starts_at}
            onChange={(event) => setForm((prev) => ({ ...prev, starts_at: event.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            type="datetime-local"
            value={form.ends_at}
            onChange={(event) => setForm((prev) => ({ ...prev, ends_at: event.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          />
          <button onClick={submit} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
            {editingId ? "Update Event" : "Create Event"}
          </button>
        </div>
      ) : null}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Start</th>
              <th className="px-3 py-2">End</th>
              <th className="px-3 py-2">Location</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => (
              <tr key={event.id} className="border-t border-slate-200">
                <td className="px-3 py-2">{event.title}</td>
                <td className="px-3 py-2">{new Date(event.starts_at).toLocaleString()}</td>
                <td className="px-3 py-2">{event.ends_at ? new Date(event.ends_at).toLocaleString() : "-"}</td>
                <td className="px-3 py-2">{event.location || "-"}</td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <button
                      onClick={() => {
                        setEditingId(event.id);
                        setForm({
                          title: event.title || "",
                          description: event.description || "",
                          starts_at: toDateTimeLocal(event.starts_at),
                          ends_at: toDateTimeLocal(event.ends_at),
                          location: event.location || ""
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
