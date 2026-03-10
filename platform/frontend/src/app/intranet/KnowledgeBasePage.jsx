import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";

import { apiClient } from "../../services/apiClient";
import { hasPermission } from "../../utils/permissions";

const slugify = (value) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

export const KnowledgeBasePage = () => {
  const { user } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [articles, setArticles] = useState([]);
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [statusFilter, setStatusFilter] = useState("");
  const [status, setStatus] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: "",
    slug: "",
    content: "",
    status: "draft"
  });

  const canEdit = useMemo(() => hasPermission(user, "members.edit"), [user]);

  const load = async () => {
    const { data } = await apiClient.get("/knowledge-base/", {
      params: { q: query || undefined, status: statusFilter || undefined, page_size: 100 }
    });
    setArticles(data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load knowledge base"));
  }, [query, statusFilter]);

  const submit = async () => {
    try {
      const payload = {
        ...form,
        slug: form.slug || slugify(form.title),
        published_at: form.status === "published" ? new Date().toISOString() : null
      };
      if (editingId) {
        await apiClient.patch(`/knowledge-base/${editingId}/`, payload);
        setStatus("Article updated");
      } else {
        await apiClient.post("/knowledge-base/", payload);
        setStatus("Article created");
      }
      setForm({ title: "", slug: "", content: "", status: "draft" });
      setEditingId(null);
      await load();
    } catch {
      setStatus("Save failed");
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Knowledge Base</h2>
        <p className="text-sm text-slate-600">Institutional knowledge, SOPs, and reference articles.</p>
      </header>

      <div className="grid gap-3 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search articles"
          className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
        />
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="published">Published</option>
          <option value="archived">Archived</option>
        </select>
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
          <input
            value={form.slug}
            onChange={(event) => setForm((prev) => ({ ...prev, slug: event.target.value }))}
            placeholder="Slug (optional)"
            className="rounded border border-slate-300 px-3 py-2"
          />
          <select
            value={form.status}
            onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </select>
          <button onClick={submit} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
            {editingId ? "Update Article" : "Create Article"}
          </button>
          <textarea
            value={form.content}
            onChange={(event) => setForm((prev) => ({ ...prev, content: event.target.value }))}
            placeholder="Article content"
            className="h-36 rounded border border-slate-300 px-3 py-2 md:col-span-2"
          />
        </div>
      ) : null}

      {status ? <p className="text-sm text-slate-700">{status}</p> : null}

      <div className="overflow-auto rounded-xl bg-white shadow-panel">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="px-3 py-2">Title</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Published</th>
              <th className="px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-t border-slate-200">
                <td className="px-3 py-2">{article.title}</td>
                <td className="px-3 py-2">{article.slug}</td>
                <td className="px-3 py-2">{article.status}</td>
                <td className="px-3 py-2">
                  {article.published_at ? new Date(article.published_at).toLocaleString() : "-"}
                </td>
                <td className="px-3 py-2">
                  {canEdit ? (
                    <button
                      onClick={() => {
                        setEditingId(article.id);
                        setForm({
                          title: article.title || "",
                          slug: article.slug || "",
                          content: article.content || "",
                          status: article.status || "draft"
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
