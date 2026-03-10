import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";

import { apiClient } from "../../services/apiClient";
import { hasPermission } from "../../utils/permissions";

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
};

export const MembersPage = () => {
  const { user } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [selected, setSelected] = useState([]);
  const [categoryForBulk, setCategoryForBulk] = useState("");
  const [form, setForm] = useState({ member_id: "", first_name: "", last_name: "", joined_on: "" });
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState("");

  const canEdit = useMemo(() => hasPermission(user, "members.edit"), [user]);

  const load = async () => {
    const [membersRes, categoriesRes] = await Promise.all([
      apiClient.get("/members/", {
        params: { q: query || undefined, include_deleted: includeDeleted ? 1 : undefined, page_size: 100 }
      }),
      apiClient.get("/membership-categories/", { params: { page_size: 100 } })
    ]);
    setMembers(membersRes.data.results || []);
    setCategories(categoriesRes.data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load members"));
  }, [query, includeDeleted]);

  const submit = async () => {
    try {
      if (editingId) {
        await apiClient.patch(`/members/${editingId}/`, form);
        setStatus("Member updated");
      } else {
        await apiClient.post("/members/", form);
        setStatus("Member created");
      }
      setForm({ member_id: "", first_name: "", last_name: "", joined_on: "" });
      setEditingId(null);
      await load();
    } catch {
      setStatus("Save failed");
    }
  };

  const runBulk = async (path, payload) => {
    try {
      await apiClient.post(path, payload);
      setStatus("Bulk action completed");
      setSelected([]);
      await load();
    } catch {
      setStatus("Bulk action failed");
    }
  };

  const exportCsv = async () => {
    const response = await apiClient.get("/members/export/", { responseType: "blob" });
    downloadBlob(response.data, "members.csv");
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Membership Management</h2>
        <p className="text-sm text-slate-600">Search, maintain, and bulk-manage member records.</p>
      </header>
      <div className="grid gap-3 rounded-xl bg-white p-4 shadow-panel md:grid-cols-5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search member id, name, email..."
          className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
        />
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
          />
          Include deleted
        </label>
        <button onClick={load} className="rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-white">
          Refresh
        </button>
        <button onClick={exportCsv} className="rounded border border-slate-300 px-3 py-2 text-sm">
          Export CSV
        </button>
      </div>

      {canEdit ? (
        <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-5">
          <input
            placeholder="Member ID"
            value={form.member_id}
            onChange={(e) => setForm((prev) => ({ ...prev, member_id: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            placeholder="First name"
            value={form.first_name}
            onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            placeholder="Last name"
            value={form.last_name}
            onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          />
          <input
            type="date"
            value={form.joined_on}
            onChange={(e) => setForm((prev) => ({ ...prev, joined_on: e.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          />
          <button onClick={submit} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
            {editingId ? "Update" : "Add Member"}
          </button>
        </div>
      ) : null}

      {canEdit ? (
        <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
          <select
            value={categoryForBulk}
            onChange={(e) => setCategoryForBulk(e.target.value)}
            className="rounded border border-slate-300 px-3 py-2"
          >
            <option value="">Select category for bulk update</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            onClick={() =>
              runBulk("/members/bulk-update-category/", {
                member_ids: selected,
                category_id: Number(categoryForBulk)
              })
            }
            className="rounded border border-slate-300 px-3 py-2 text-sm"
          >
            Bulk Category
          </button>
          <button
            onClick={() => runBulk("/members/bulk-soft-delete/", { member_ids: selected })}
            className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700"
          >
            Bulk Soft Delete
          </button>
          <button
            onClick={() => runBulk("/members/bulk-restore/", { member_ids: selected })}
            className="rounded border border-emerald-300 px-3 py-2 text-sm text-emerald-700"
          >
            Bulk Restore
          </button>
        </div>
      ) : null}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Sel</th>
              <th className="px-3 py-2">Member ID</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Joined</th>
              <th className="px-3 py-2">Balance</th>
              <th className="px-3 py-2">Deleted</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-slate-200">
                <td className="px-3 py-2">
                  <input
                    type="checkbox"
                    checked={selected.includes(member.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked ? [...prev, member.id] : prev.filter((id) => id !== member.id)
                      )
                    }
                  />
                </td>
                <td className="px-3 py-2">{member.member_id}</td>
                <td className="px-3 py-2">
                  {member.first_name} {member.last_name}
                </td>
                <td className="px-3 py-2">{member.joined_on}</td>
                <td className="px-3 py-2">{member.balance}</td>
                <td className="px-3 py-2">{member.deleted_at ? "Yes" : "No"}</td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <button
                      onClick={() => {
                        setEditingId(member.id);
                        setForm({
                          member_id: member.member_id,
                          first_name: member.first_name,
                          last_name: member.last_name,
                          joined_on: member.joined_on
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
