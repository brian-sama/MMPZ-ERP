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

export const RolesPage = () => {
  const { user } = useOutletContext();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [userRoles, setUserRoles] = useState([]);
  const [status, setStatus] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [roleForm, setRoleForm] = useState({
    code: "",
    name: "",
    description: "",
    is_executive: false
  });
  const [assignForm, setAssignForm] = useState({
    user: "",
    role: "",
    is_primary: false
  });
  const [bulkRoleCode, setBulkRoleCode] = useState("");

  const canManage = useMemo(() => hasPermission(user, "members.edit"), [user]);

  const load = async () => {
    const [rolesRes, usersRes, userRolesRes] = await Promise.all([
      apiClient.get("/roles/", { params: { page_size: 100 } }),
      apiClient.get("/users/", { params: { page_size: 100 } }),
      apiClient.get("/user-roles/", { params: { page_size: 100 } })
    ]);
    setRoles(rolesRes.data.results || []);
    setUsers(usersRes.data.results || []);
    setUserRoles(userRolesRes.data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load roles"));
  }, []);

  const createRole = async () => {
    try {
      await apiClient.post("/roles/", roleForm);
      setRoleForm({ code: "", name: "", description: "", is_executive: false });
      setStatus("Role created");
      await load();
    } catch {
      setStatus("Failed to create role");
    }
  };

  const assignSingle = async () => {
    if (!assignForm.user || !assignForm.role) {
      setStatus("Select both user and role");
      return;
    }
    try {
      await apiClient.post("/user-roles/", {
        user: Number(assignForm.user),
        role: assignForm.role,
        is_primary: assignForm.is_primary
      });
      setAssignForm({ user: "", role: "", is_primary: false });
      setStatus("Role assigned");
      await load();
    } catch {
      setStatus("Failed to assign role");
    }
  };

  const assignBulk = async () => {
    if (!bulkRoleCode || selectedUsers.length === 0) {
      setStatus("Select role and users for bulk assignment");
      return;
    }
    try {
      await apiClient.post("/user-roles/bulk-assign/", {
        assignments: selectedUsers.map((userId) => ({
          user_id: userId,
          role_code: bulkRoleCode,
          is_primary: false
        }))
      });
      setSelectedUsers([]);
      setStatus("Bulk role assignment complete");
      await load();
    } catch {
      setStatus("Bulk role assignment failed");
    }
  };

  const exportCsv = async () => {
    const response = await apiClient.get("/roles/export/", { responseType: "blob" });
    downloadBlob(response.data, "roles.csv");
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Role Permissions</h2>
        <p className="text-sm text-slate-600">Manage role-based access control and module permissions.</p>
      </header>

      <div className="rounded-xl bg-white p-4 shadow-panel">
        <button onClick={exportCsv} className="rounded border border-slate-300 px-3 py-2 text-sm">
          Export Roles CSV
        </button>
      </div>

      {canManage ? (
        <>
          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
            <input
              value={roleForm.code}
              onChange={(event) => setRoleForm((prev) => ({ ...prev, code: event.target.value }))}
              placeholder="Role code"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={roleForm.name}
              onChange={(event) => setRoleForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Role name"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={roleForm.description}
              onChange={(event) => setRoleForm((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Description"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <button onClick={createRole} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
              Create Role
            </button>
          </div>

          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
            <select
              value={assignForm.user}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, user: event.target.value }))}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value="">Select user</option>
              {users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.email}
                </option>
              ))}
            </select>
            <select
              value={assignForm.role}
              onChange={(event) => setAssignForm((prev) => ({ ...prev, role: event.target.value }))}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={assignForm.is_primary}
                onChange={(event) => setAssignForm((prev) => ({ ...prev, is_primary: event.target.checked }))}
              />
              Primary role
            </label>
            <button onClick={assignSingle} className="rounded border border-slate-300 px-3 py-2 text-sm">
              Assign Role
            </button>
          </div>

          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
            <select
              value={bulkRoleCode}
              onChange={(event) => setBulkRoleCode(event.target.value)}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value="">Bulk role selection</option>
              {roles.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
            <button onClick={assignBulk} className="rounded border border-slate-300 px-3 py-2 text-sm">
              Bulk Assign Role
            </button>
          </div>
        </>
      ) : null}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="overflow-auto rounded-xl bg-white shadow-panel">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Executive</th>
              </tr>
            </thead>
            <tbody>
              {roles.map((role) => (
                <tr key={role.code} className="border-t border-slate-200">
                  <td className="px-3 py-2">{role.code}</td>
                  <td className="px-3 py-2">{role.name}</td>
                  <td className="px-3 py-2">{role.description || "-"}</td>
                  <td className="px-3 py-2">{role.is_executive ? "Yes" : "No"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-auto rounded-xl bg-white shadow-panel">
          <table className="min-w-full text-sm">
            <thead className="bg-slate-100 text-left">
              <tr>
                {canManage ? <th className="px-3 py-2">Sel</th> : null}
                <th className="px-3 py-2">User</th>
                <th className="px-3 py-2">Roles</th>
              </tr>
            </thead>
            <tbody>
              {users.map((item) => (
                <tr key={item.id} className="border-t border-slate-200">
                  {canManage ? (
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(item.id)}
                        onChange={(event) =>
                          setSelectedUsers((prev) =>
                            event.target.checked ? [...prev, item.id] : prev.filter((id) => id !== item.id)
                          )
                        }
                      />
                    </td>
                  ) : null}
                  <td className="px-3 py-2">{item.email}</td>
                  <td className="px-3 py-2">{(item.roles || []).join(", ") || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">User</th>
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Primary</th>
              <th className="px-3 py-2">Assigned At</th>
            </tr>
          </thead>
          <tbody>
            {userRoles.map((assignment) => (
              <tr key={assignment.id} className="border-t border-slate-200">
                <td className="px-3 py-2">{assignment.user_email}</td>
                <td className="px-3 py-2">{assignment.role_code}</td>
                <td className="px-3 py-2">{assignment.is_primary ? "Yes" : "No"}</td>
                <td className="px-3 py-2">{new Date(assignment.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};
