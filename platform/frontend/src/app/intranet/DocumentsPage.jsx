import { useEffect, useMemo, useState } from "react";
import { useOutletContext, useSearchParams } from "react-router-dom";

import { apiClient } from "../../services/apiClient";
import { hasPermission } from "../../utils/permissions";

const categories = [
  { value: "POLICIES", label: "Policies" },
  { value: "REPORTS", label: "Reports" },
  { value: "FORMS", label: "Forms" },
  { value: "MEETING_MINUTES", label: "Meeting Minutes" }
];

export const DocumentsPage = () => {
  const { user } = useOutletContext();
  const [searchParams] = useSearchParams();
  const [documents, setDocuments] = useState([]);
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState("");
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState("");
  const [uploadForm, setUploadForm] = useState({
    title: "",
    category: "POLICIES",
    file: null,
    is_public: false
  });
  const [versionForm, setVersionForm] = useState({
    documentId: "",
    file_path: "",
    file: null,
    change_log: ""
  });

  const canUpload = useMemo(() => hasPermission(user, "documents.upload"), [user]);

  const load = async () => {
    const { data } = await apiClient.get("/documents/", {
      params: { q: query || undefined, category: category || undefined, page_size: 100 }
    });
    setDocuments(data.results || []);
  };

  useEffect(() => {
    load().catch(() => setStatus("Failed to load documents"));
  }, [query, category]);

  const upload = async () => {
    if (!uploadForm.file) {
      setStatus("Select a file before upload");
      return;
    }
    try {
      const payload = new FormData();
      payload.append("title", uploadForm.title);
      payload.append("category", uploadForm.category);
      payload.append("file", uploadForm.file);
      payload.append("is_public", uploadForm.is_public ? "true" : "false");
      await apiClient.post("/documents/upload-file/", payload, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setUploadForm({ title: "", category: "POLICIES", file: null, is_public: false });
      setStatus("Document uploaded");
      await load();
    } catch {
      setStatus("Document upload failed");
    }
  };

  const openPreview = async (id) => {
    try {
      const { data } = await apiClient.get(`/documents/${id}/preview/`);
      setPreview(data);
    } catch {
      setStatus("Failed to load preview");
    }
  };

  const addVersion = async () => {
    if (!versionForm.documentId || (!versionForm.file_path && !versionForm.file)) {
      setStatus("Select document and provide file upload or file path");
      return;
    }
    try {
      if (versionForm.file) {
        const payload = new FormData();
        payload.append("file", versionForm.file);
        payload.append("change_log", versionForm.change_log || "");
        await apiClient.post(`/documents/${versionForm.documentId}/versions/`, payload, {
          headers: { "Content-Type": "multipart/form-data" }
        });
      } else {
        await apiClient.post(`/documents/${versionForm.documentId}/versions/`, {
          file_path: versionForm.file_path,
          change_log: versionForm.change_log
        });
      }
      setVersionForm({ documentId: "", file_path: "", file: null, change_log: "" });
      setStatus("Version added");
      if (preview?.id === Number(versionForm.documentId)) {
        await openPreview(Number(versionForm.documentId));
      }
      await load();
    } catch {
      setStatus("Failed to add version");
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Document Management</h2>
        <p className="text-sm text-slate-600">Upload, categorize, version, preview, and permission documents.</p>
      </header>

      <div className="grid gap-3 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search title"
          className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
        />
        <select
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          className="rounded border border-slate-300 px-3 py-2"
        >
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <button onClick={load} className="rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-white">
          Refresh
        </button>
      </div>

      {canUpload ? (
        <>
          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-5">
            <input
              value={uploadForm.title}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, title: event.target.value }))}
              placeholder="Document title"
              className="rounded border border-slate-300 px-3 py-2 md:col-span-2"
            />
            <select
              value={uploadForm.category}
              onChange={(event) => setUploadForm((prev) => ({ ...prev, category: event.target.value }))}
              className="rounded border border-slate-300 px-3 py-2"
            >
              {categories.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              type="file"
              onChange={(event) => setUploadForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
              className="rounded border border-slate-300 px-3 py-2"
            />
            <button onClick={upload} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
              Upload
            </button>
            <label className="flex items-center gap-2 text-sm text-slate-700 md:col-span-5">
              <input
                type="checkbox"
                checked={uploadForm.is_public}
                onChange={(event) => setUploadForm((prev) => ({ ...prev, is_public: event.target.checked }))}
              />
              Public document
            </label>
          </div>

          <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
            <select
              value={versionForm.documentId}
              onChange={(event) => setVersionForm((prev) => ({ ...prev, documentId: event.target.value }))}
              className="rounded border border-slate-300 px-3 py-2"
            >
              <option value="">Select document for version</option>
              {documents.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </select>
            <input
              value={versionForm.file_path}
              onChange={(event) => setVersionForm((prev) => ({ ...prev, file_path: event.target.value }))}
              placeholder="Existing file path (optional)"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              type="file"
              onChange={(event) => setVersionForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))}
              className="rounded border border-slate-300 px-3 py-2"
            />
            <input
              value={versionForm.change_log}
              onChange={(event) => setVersionForm((prev) => ({ ...prev, change_log: event.target.value }))}
              placeholder="Change log"
              className="rounded border border-slate-300 px-3 py-2"
            />
            <button onClick={addVersion} className="rounded border border-slate-300 px-3 py-2 text-sm">
              Add Version
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
                <th className="px-3 py-2">Title</th>
                <th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Version</th>
                <th className="px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((document) => (
                <tr key={document.id} className="border-t border-slate-200">
                  <td className="px-3 py-2">{document.title}</td>
                  <td className="px-3 py-2">{document.category}</td>
                  <td className="px-3 py-2">{document.current_version}</td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => openPreview(document.id)}
                      className="rounded border border-slate-300 px-2 py-1 text-xs"
                    >
                      Preview
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Document Preview</h3>
          {!preview ? (
            <p className="mt-3 text-sm text-slate-500">Select a document to view latest versions.</p>
          ) : (
            <div className="mt-3 space-y-2 text-sm text-slate-700">
              <p className="font-medium text-slate-900">{preview.title}</p>
              <p>Category: {preview.category}</p>
              <p>Current version: {preview.current_version}</p>
              <a className="text-brand-700 underline" href={preview.file_path} target="_blank" rel="noreferrer">
                Open current file
              </a>
              <ul className="space-y-1">
                {preview.versions?.map((version) => (
                  <li key={version.id} className="rounded bg-slate-50 px-2 py-1">
                    v{version.version_number}: {version.file_path}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
