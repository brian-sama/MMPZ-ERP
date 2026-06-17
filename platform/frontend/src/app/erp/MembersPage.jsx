import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useOutletContext, useSearchParams } from "react-router-dom";
import { z } from "zod";

import { Button } from "../../components/ui/Button";
import { apiClient } from "../../services/apiClient";
import { hasPermission } from "../../utils/permissions";

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Validation schema ────────────────────────────────────────────────────────
const memberSchema = z.object({
  member_id: z.string().min(1, "Member ID is required"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  joined_on: z.string().optional(),
});

// ─── Field helper ─────────────────────────────────────────────────────────────
function Field({ label, error, children }) {
  return (
    <div className="flex flex-col gap-1">
      {children}
      {error && <p className="text-xs text-rose-600">{error}</p>}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export const MembersPage = () => {
  const { user } = useOutletContext();
  const [searchParams] = useSearchParams();

  const [members, setMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [selected, setSelected] = useState([]);
  const [categoryForBulk, setCategoryForBulk] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [status, setStatus] = useState("");

  const canEdit = useMemo(() => hasPermission(user, "members.edit"), [user]);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(memberSchema),
    defaultValues: { member_id: "", first_name: "", last_name: "", joined_on: "" },
  });

  const load = async () => {
    const [membersRes, categoriesRes] = await Promise.all([
      apiClient.get("/members/", {
        params: {
          q: query || undefined,
          include_deleted: includeDeleted ? 1 : undefined,
          page_size: 100,
        },
      }),
      apiClient.get("/membership-categories/", { params: { page_size: 100 } }),
    ]);
    setMembers(membersRes.data.results || []);
    setCategories(categoriesRes.data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load members"));
  }, [query, includeDeleted]);

  const onSubmit = async (data) => {
    try {
      if (editingId) {
        await apiClient.patch(`/members/${editingId}/`, data);
        setStatus("Member updated");
      } else {
        await apiClient.post("/members/", data);
        setStatus("Member created");
      }
      reset();
      setEditingId(null);
      await load();
    } catch {
      setStatus("Save failed — check required fields and try again.");
    }
  };

  const startEdit = (member) => {
    setEditingId(member.id);
    setValue("member_id", member.member_id);
    setValue("first_name", member.first_name);
    setValue("last_name", member.last_name);
    setValue("joined_on", member.joined_on ?? "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    reset();
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
    const res = await apiClient.get("/members/export/", { responseType: "blob" });
    downloadBlob(res.data, "members.csv");
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Membership Management</h2>
        <p className="text-sm text-slate-600">Search, maintain, and bulk-manage member records.</p>
      </header>

      {/* Search + toolbar */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 shadow-panel">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm flex-1 min-w-48"
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search member id, name, email…"
          value={query}
        />
        <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            checked={includeDeleted}
            onChange={(e) => setIncludeDeleted(e.target.checked)}
            type="checkbox"
          />
          Include deleted
        </label>
        <Button type="button" onClick={load} className="bg-slate-800 hover:bg-slate-900">
          Refresh
        </Button>
        <Button type="button" onClick={exportCsv} className="bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50">
          Export CSV
        </Button>
      </div>

      {/* Member form */}
      {canEdit && (
        <form
          className="grid gap-3 rounded-xl bg-white p-4 shadow-panel md:grid-cols-5"
          onSubmit={handleSubmit(onSubmit)}
          noValidate
        >
          <Field label="Member ID" error={errors.member_id?.message}>
            <input
              {...register("member_id")}
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
              placeholder="Member ID"
            />
          </Field>
          <Field label="First name" error={errors.first_name?.message}>
            <input
              {...register("first_name")}
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
              placeholder="First name"
            />
          </Field>
          <Field label="Last name" error={errors.last_name?.message}>
            <input
              {...register("last_name")}
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
              placeholder="Last name"
            />
          </Field>
          <Field label="Joined on">
            <input
              {...register("joined_on")}
              className="rounded border border-slate-300 px-3 py-2 text-sm focus:border-brand-700 focus:outline-none"
              type="date"
            />
          </Field>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? "Saving…" : editingId ? "Update" : "Add Member"}
            </Button>
            {editingId && (
              <Button
                type="button"
                onClick={cancelEdit}
                className="bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      )}

      {/* Bulk actions */}
      {canEdit && (
        <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            onChange={(e) => setCategoryForBulk(e.target.value)}
            value={categoryForBulk}
          >
            <option value="">Select category for bulk update</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
          <Button
            type="button"
            onClick={() =>
              runBulk("/members/bulk-update-category/", {
                member_ids: selected,
                category_id: Number(categoryForBulk),
              })
            }
            className="bg-transparent border border-slate-300 text-slate-700 hover:bg-slate-50"
          >
            Bulk Category
          </Button>
          <Button
            type="button"
            onClick={() => runBulk("/members/bulk-soft-delete/", { member_ids: selected })}
            className="bg-transparent border border-rose-300 text-rose-700 hover:bg-rose-50"
          >
            Bulk Soft Delete
          </Button>
          <Button
            type="button"
            onClick={() => runBulk("/members/bulk-restore/", { member_ids: selected })}
            className="bg-transparent border border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            Bulk Restore
          </Button>
        </div>
      )}

      {status && (
        <p className="rounded-md border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700">
          {status}
        </p>
      )}

      {/* Members table */}
      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5"></th>
              <th className="px-3 py-2.5">Member ID</th>
              <th className="px-3 py-2.5">Name</th>
              <th className="px-3 py-2.5">Joined</th>
              <th className="px-3 py-2.5">Balance</th>
              <th className="px-3 py-2.5">Deleted</th>
              {canEdit && <th className="px-3 py-2.5">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-t border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2">
                  <input
                    checked={selected.includes(member.id)}
                    onChange={(e) =>
                      setSelected((prev) =>
                        e.target.checked
                          ? [...prev, member.id]
                          : prev.filter((id) => id !== member.id),
                      )
                    }
                    type="checkbox"
                  />
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600">{member.member_id}</td>
                <td className="px-3 py-2 font-medium text-slate-900">
                  {member.first_name} {member.last_name}
                </td>
                <td className="px-3 py-2 tabular-nums text-slate-600">{member.joined_on}</td>
                <td className="px-3 py-2 tabular-nums text-slate-900">{member.balance}</td>
                <td className="px-3 py-2">
                  {member.deleted_at ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                      Yes
                    </span>
                  ) : (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                      Active
                    </span>
                  )}
                </td>
                {canEdit && (
                  <td className="px-3 py-2">
                    <button
                      className="rounded border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      onClick={() => startEdit(member)}
                      type="button"
                    >
                      Edit
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {members.length === 0 && (
              <tr>
                <td className="px-3 py-10 text-center text-slate-500" colSpan={7}>
                  No members found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};
