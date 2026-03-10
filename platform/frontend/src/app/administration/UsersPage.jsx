import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

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

export const UsersPage = () => {
  const { user } = useOutletContext();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState([]);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [suspendedFilter, setSuspendedFilter] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    email: "",
    username: "",
    first_name: "",
    last_name: "",
    phone_number: "",
    is_active: true,
    is_suspended: false,
    must_reset_password: false,
    password: ""
  });

  const canManage = useMemo(() => hasPermission(user, "members.edit"), [user]);

  const load = async () => {
    const [usersRes, rolesRes] = await Promise.all([
      apiClient.get("/users/", {
        params: {
          q: query || undefined,
          role: roleFilter || undefined,
          is_active: activeFilter || undefined,
          is_suspended: suspendedFilter || undefined,
          page_size: 100
        }
      }),
      apiClient.get("/roles/", { params: { page_size: 100 } })
    ]);
    setUsers(usersRes.data.results || []);
    setRoles(rolesRes.data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load users"));
  }, [query, roleFilter, activeFilter, suspendedFilter]);

  const submit = async () => {
    try {
      const payload = { ...form };
      if (!payload.password) {
        delete payload.password;
      }
      if (editingId) {
        await apiClient.patch(`/users/${editingId}/`, payload);
        setStatus("User updated");
      } else {
        await apiClient.post("/users/", payload);
        setStatus("User created");
      }
      setEditingId(null);
      setForm({
        email: "",
        username: "",
        first_name: "",
        last_name: "",
        phone_number: "",
        is_active: true,
        is_suspended: false,
        must_reset_password: false,
        password: ""
      });
      await load();
    } catch {
      setStatus("User save failed");
    }
  };

  const runBulk = async (payload) => {
    if (selected.length === 0) {
      setStatus("Select at least one user");
      return;
    }
    try {
      await apiClient.post("/users/bulk-update/", { user_ids: selected, ...payload });
      setSelected([]);
      setStatus("Bulk update complete");
      await load();
    } catch {
      setStatus("Bulk update failed");
    }
  };

  const exportCsv = async () => {
    const response = await apiClient.get("/users/export/", { responseType: "blob" });
    downloadBlob(response.data, "users.csv");
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">User Management</h2>
        <p className="text-sm text-slate-600">Create, edit, suspend, and audit platform users.</p>
      </header>

      <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-6">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search name, email, username"
          className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
        />
        <select
          value={roleFilter}
          onChange={(event) => setRoleFilter(event.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
        >
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role.code} value={role.code}>
              {role.name}
            </option>
          ))}
        </select>
        <select
          value={activeFilter}
          onChange={(event) => setActiveFilter(event.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
        >
          <option value="">All active states</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        <select
          value={suspendedFilter}
          onChange={(event) => setSuspendedFilter(event.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
        >
          <option value="">All suspension states</option>
          <option value="true">Suspended</option>
          <option value="false">Not suspended</option>
        </select>
        <button onClick={exportCsv} className="rounded border border-slate-300 px-3 py-2 text-sm">
          Export CSV
        </button>
      </div>

      {canManage ? (
        <>
          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
            <input
              value={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
              placeholder="Email"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={form.username}
              onChange={(event) => setForm((prev) => ({ ...prev, username: event.target.value }))}
              placeholder="Username"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={form.first_name}
              onChange={(event) => setForm((prev) => ({ ...prev, first_name: event.target.value }))}
              placeholder="First name"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={form.last_name}
              onChange={(event) => setForm((prev) => ({ ...prev, last_name: event.target.value }))}
              placeholder="Last name"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={form.phone_number}
              onChange={(event) => setForm((prev) => ({ ...prev, phone_number: event.target.value }))}
              placeholder="Phone"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              type="password"
              value={form.password}
              onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
              placeholder={editingId ? "New password (optional)" : "Password"}
              className="rounded border border-slate-300 px-3 py-2"
            />
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
              />
              Active
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={form.is_suspended}
                onChange={(event) => setForm((prev) => ({ ...prev, is_suspended: event.target.checked }))}
              />
              Suspended
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-2">
              <input
                type="checkbox"
                checked={form.must_reset_password}
                onChange={(event) => setForm((prev) => ({ ...prev, must_reset_password: event.target.checked }))}
              />
              Must reset password
            </label>
            <button onClick={submit} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
              {editingId ? "Update User" : "Create User"}
            </button>
          </div>

          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
            <button
              onClick={() => runBulk({ is_active: true, is_suspended: false })}
              className="rounded border border-emerald-300 px-3 py-2 text-sm text-emerald-700"
            >
              Bulk Activate
            </button>
            <button
              onClick={() => runBulk({ is_active: false, is_suspended: true })}
              className="rounded border border-rose-300 px-3 py-2 text-sm text-rose-700"
            >
              Bulk Suspend
            </button>
            <button
              onClick={() => runBulk({ must_reset_password: true })}
              className="rounded border border-amber-300 px-3 py-2 text-sm text-amber-700"
            >
              Bulk Force Reset
            </button>
          </div>
        </>
      ) : null}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Sel</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Roles</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((item) => (
              <tr key={item.id} className="border-t border-slate-200">
                <td className="px-3 py-2">
                  {canManage ? (
                    <input
                      type="checkbox"
                      checked={selected.includes(item.id)}
                      onChange={(event) =>
                        setSelected((prev) =>
                          event.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                        )
                      }
                    />
                  ) : null}
                </td>
                <td className="px-3 py-2">{item.email}</td>
                <td className="px-3 py-2">
                  {item.first_name} {item.last_name}
                </td>
                <td className="px-3 py-2">{(item.roles || []).join(", ") || "-"}</td>
                <td className="px-3 py-2">
                  {item.is_suspended ? "Suspended" : item.is_active ? "Active" : "Inactive"}
                </td>
                <td className="px-3 py-2">
                  {canManage ? (
                    <button
                      onClick={() => {
                        setEditingId(item.id);
                        setForm({
                          email: item.email || "",
                          username: item.username || "",
                          first_name: item.first_name || "",
                          last_name: item.last_name || "",
                          phone_number: item.phone_number || "",
                          is_active: Boolean(item.is_active),
                          is_suspended: Boolean(item.is_suspended),
                          must_reset_password: Boolean(item.must_reset_password),
                          password: ""
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
