import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";

import { apiClient } from "../../services/apiClient";
import { hasPermission } from "../../utils/permissions";

export const DirectoryPage = () => {
  const { user } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    title: "",
    department: "",
    email: "",
    phone: ""
  });

  const canEdit = useMemo(() => hasPermission(user, "members.edit"), [user]);

  const load = async () => {
    const { data } = await apiClient.get("/directory/", {
      params: { q: query || undefined, page_size: 100 }
    });
    setEntries(data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load directory"));
  }, [query]);

  const submit = async () => {
    try {
      if (editingId) {
        await apiClient.patch(`/directory/${editingId}/`, form);
        setStatus("Directory entry updated");
      } else {
        await apiClient.post("/directory/", form);
        setStatus("Directory entry created");
      }
      setForm({ name: "", title: "", department: "", email: "", phone: "" });
      setEditingId(null);
      await load();
    } catch {
      setStatus("Save failed");
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Directory</h2>
        <p className="text-sm text-slate-600">Internal staff and member contact listings.</p>
      </header>

      <div className="grid gap-3 rounded-xl bg-white p-4 shadow-panel md:grid-cols-3">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search by name"
          className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
        />
        <button onClick={load} className="rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-white">
          Refresh
        </button>
      </div>

      {canEdit ? (
        <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-3">
          <input
            value={form.name}
            onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Name"
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            value={form.title}
            onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="Title"
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            value={form.department}
            onChange={(event) => setForm((prev) => ({ ...prev, department: event.target.value }))}
            placeholder="Department"
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            value={form.email}
            onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
            placeholder="Email"
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            placeholder="Phone"
            className="rounded border border-slate-300 px-3 py-2"
          />
          <button onClick={submit} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
            {editingId ? "Update Entry" : "Add Entry"}
          </button>
        </div>
      ) : null}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Department</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => (
              <tr key={entry.id} className="border-t border-slate-200">
                <td className="px-3 py-2">{entry.name}</td>
                <td className="px-3 py-2">{entry.title || "-"}</td>
                <td className="px-3 py-2">{entry.department || "-"}</td>
                <td className="px-3 py-2">{entry.email || "-"}</td>
                <td className="px-3 py-2">{entry.phone || "-"}</td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <button
                      onClick={() => {
                        setEditingId(entry.id);
                        setForm({
                          name: entry.name || "",
                          title: entry.title || "",
                          department: entry.department || "",
                          email: entry.email || "",
                          phone: entry.phone || ""
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
