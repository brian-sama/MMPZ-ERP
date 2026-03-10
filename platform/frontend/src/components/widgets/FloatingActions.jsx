import { useState } from "react";
import { motion } from "framer-motion";

import { apiClient } from "../../services/apiClient";
import { quickActions } from "../../utils/navigation";
import { hasPermission } from "../../utils/permissions";

const initialForm = {
  first_name: "",
  last_name: "",
  member_id: "",
  amount: "",
  donated_on: "",
  donor_name: "",
  title: "",
  category: "POLICIES",
  file: null,
  content: ""
};

export const FloatingActions = ({ user }) => {
  const [activeAction, setActiveAction] = useState("");
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState("");

  const visibleActions = quickActions.filter((action) => hasPermission(user, action.requiredPermission));

  const closeModal = () => {
    setActiveAction("");
    setForm(initialForm);
  };

  const submit = async () => {
    setStatus("Saving...");
    try {
      if (activeAction === "add-member") {
        await apiClient.post("/members/", {
          member_id: form.member_id,
          first_name: form.first_name,
          last_name: form.last_name,
          joined_on: new Date().toISOString().slice(0, 10)
        });
      } else if (activeAction === "record-donation") {
        await apiClient.post("/finance-donations/", {
          amount: form.amount,
          donated_on: form.donated_on || new Date().toISOString().slice(0, 10),
          donor_name: form.donor_name
        });
      } else if (activeAction === "upload-document") {
        const payload = new FormData();
        payload.append("title", form.title);
        payload.append("category", form.category);
        if (form.file) payload.append("file", form.file);
        await apiClient.post("/documents/upload-file/", payload, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else if (activeAction === "create-announcement") {
        await apiClient.post("/announcements/", {
          title: form.title,
          content: form.content,
          published_at: new Date().toISOString()
        });
      }
      setStatus("Saved");
      setTimeout(closeModal, 500);
    } catch (error) {
      const message = error?.response?.data?.error?.message || "Action failed";
      setStatus(message);
    }
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-30 space-y-2">
      {visibleActions.map((action, index) => {
        const Icon = action.icon;
        return (
          <motion.button
            key={action.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            onClick={() => setActiveAction(action.id)}
            className="flex items-center gap-2 rounded-full bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-lg hover:bg-accent-400"
          >
            <Icon size={16} />
            <span>{action.label}</span>
          </motion.button>
        );
      })}
      </div>
      {activeAction ? (
        <div className="fixed inset-0 z-40 grid place-items-center bg-slate-900/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-panel">
            <h3 className="text-lg font-semibold text-slate-900">Quick Action</h3>
            <div className="mt-3 space-y-3">
              {activeAction === "add-member" ? (
                <>
                  <input
                    placeholder="Member ID"
                    value={form.member_id}
                    onChange={(e) => setForm((prev) => ({ ...prev, member_id: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  />
                  <input
                    placeholder="First name"
                    value={form.first_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  />
                  <input
                    placeholder="Last name"
                    value={form.last_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  />
                </>
              ) : null}
              {activeAction === "record-donation" ? (
                <>
                  <input
                    type="number"
                    placeholder="Amount"
                    value={form.amount}
                    onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  />
                  <input
                    type="date"
                    value={form.donated_on}
                    onChange={(e) => setForm((prev) => ({ ...prev, donated_on: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  />
                  <input
                    placeholder="Donor name"
                    value={form.donor_name}
                    onChange={(e) => setForm((prev) => ({ ...prev, donor_name: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  />
                </>
              ) : null}
              {activeAction === "upload-document" ? (
                <>
                  <input
                    placeholder="Document title"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  />
                  <select
                    value={form.category}
                    onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  >
                    <option value="POLICIES">Policies</option>
                    <option value="REPORTS">Reports</option>
                    <option value="FORMS">Forms</option>
                    <option value="MEETING_MINUTES">Meeting Minutes</option>
                  </select>
                  <input
                    type="file"
                    onChange={(e) => setForm((prev) => ({ ...prev, file: e.target.files?.[0] || null }))}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  />
                </>
              ) : null}
              {activeAction === "create-announcement" ? (
                <>
                  <input
                    placeholder="Announcement title"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-3 py-2"
                  />
                  <textarea
                    placeholder="Announcement content"
                    value={form.content}
                    onChange={(e) => setForm((prev) => ({ ...prev, content: e.target.value }))}
                    className="h-28 w-full rounded border border-slate-300 px-3 py-2"
                  />
                </>
              ) : null}
            </div>
            {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={closeModal} className="rounded border border-slate-300 px-3 py-2 text-sm">
                Cancel
              </button>
              <button
                onClick={submit}
                className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-600"
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};
