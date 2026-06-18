import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
    Download,
    FileText,
    Lock,
    Plus,
    ShieldCheck,
    Trash2,
    Upload,
    X,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

const ALLOWED_EXTENSIONS = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg';
const MAX_MB = 20;

const UPLOAD_ROLES = new Set([
    'DIRECTOR',
    'FINANCE_OFFICER',
    'ADMIN_FINANCE_ASSISTANT',
    'LOGISTICS_FINANCE_ASSISTANT',
    'SYSTEM_ADMIN',
]);

const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

const formatBytes = (bytes) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso) =>
    iso ? new Date(iso).toLocaleDateString('en-ZW', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export default function FinanceVaultPage() {
    const { user } = useAuth();
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUpload, setShowUpload] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const fileInputRef = useRef(null);

    const [form, setForm] = useState({ title: '', description: '', file: null });

    const canUpload = UPLOAD_ROLES.has(user?.role_code) || user?.system_role === 'SUPER_ADMIN';

    const fetchDocuments = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_BASE}/vault`, { params: { userId: user.id } });
            setDocuments(res.data?.items || []);
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to load vault documents.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_MB * 1024 * 1024) {
            setError(`File exceeds the ${MAX_MB} MB limit.`);
            return;
        }
        setError('');
        setForm((prev) => ({ ...prev, file }));
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!form.title.trim() || !form.file) {
            setError('Title and file are required.');
            return;
        }
        setSubmitting(true);
        setError('');
        try {
            const fileData = await fileToBase64(form.file);
            await axios.post(`${API_BASE}/vault`, {
                userId: user.id,
                title: form.title.trim(),
                description: form.description.trim() || null,
                fileData,
                fileName: form.file.name,
                mimeType: form.file.type,
            });
            setForm({ title: '', description: '', file: null });
            if (fileInputRef.current) fileInputRef.current.value = '';
            setShowUpload(false);
            await fetchDocuments();
        } catch (err) {
            setError(err.response?.data?.error || 'Upload failed. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDownload = async (doc) => {
        try {
            const res = await axios.get(`${API_BASE}/vault/${doc.id}/download`, {
                params: { userId: user.id },
            });
            const { file_data, file_name, mime_type } = res.data;
            const link = document.createElement('a');
            link.href = file_data;
            link.download = file_name || doc.title;
            link.click();
        } catch {
            setError('Download failed. The file may no longer be available.');
        }
    };

    const handleDelete = async (doc) => {
        if (!window.confirm(`Remove "${doc.title}" from the vault? This cannot be undone.`)) return;
        try {
            await axios.delete(`${API_BASE}/vault/${doc.id}`, { params: { userId: user.id } });
            await fetchDocuments();
        } catch {
            setError('Delete failed. Please try again.');
        }
    };

    const filtered = documents.filter(
        (doc) =>
            !search ||
            doc.title.toLowerCase().includes(search.toLowerCase()) ||
            (doc.description || '').toLowerCase().includes(search.toLowerCase()) ||
            (doc.uploaded_by_name || '').toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <div className="fade-in">
            <PageHeader
                title="Finance Vault"
                subtitle="Secure storage for sensitive financial documents. Access is restricted to finance and administration roles."
                actions={
                    canUpload && (
                        <button
                            className="btn btn-primary btn-sm"
                            onClick={() => setShowUpload(true)}
                        >
                            <Plus size={16} /> Add Document
                        </button>
                    )
                }
            />

            {/* Access badge */}
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <Lock size={15} className="shrink-0 text-amber-600" />
                <span>
                    <strong>Restricted access</strong> — visible to Director, Finance Officer,
                    Admin &amp; Finance Assistant, Logistics &amp; Finance Assistant, and System Admin only.
                    Documents here are excluded from the shared Document Library.
                </span>
            </div>

            {/* Search */}
            <div className="mb-4">
                <input
                    type="search"
                    placeholder="Search vault documents…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
            </div>

            {error && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    <X size={15} className="mt-0.5 shrink-0" />
                    {error}
                </div>
            )}

            {/* Upload modal */}
            {showUpload && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-base font-semibold text-slate-900">
                                <ShieldCheck size={18} className="text-amber-600" />
                                Add to Finance Vault
                            </div>
                            <button
                                onClick={() => { setShowUpload(false); setError(''); }}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X size={18} />
                            </button>
                        </div>
                        <form onSubmit={handleUpload} className="space-y-4">
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">
                                    Document title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.title}
                                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                                    placeholder="e.g. Q2 2025 Grant Reconciliation"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">
                                    Description <span className="text-slate-400">(optional)</span>
                                </label>
                                <textarea
                                    rows={2}
                                    value={form.description}
                                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                                    placeholder="Brief note about this document"
                                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-xs font-semibold text-slate-700">
                                    File <span className="text-red-500">*</span>
                                    <span className="ml-1 font-normal text-slate-400">(max {MAX_MB} MB)</span>
                                </label>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept={ALLOWED_EXTENSIONS}
                                    required
                                    onChange={handleFileChange}
                                    className="block w-full text-sm text-slate-700 file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:font-semibold hover:file:bg-slate-200"
                                />
                                {form.file && (
                                    <p className="mt-1 text-xs text-slate-500">
                                        {form.file.name} — {formatBytes(form.file.size)}
                                    </p>
                                )}
                            </div>
                            {error && (
                                <p className="text-xs text-red-600">{error}</p>
                            )}
                            <div className="flex justify-end gap-2 pt-1">
                                <button
                                    type="button"
                                    onClick={() => { setShowUpload(false); setError(''); }}
                                    className="btn btn-ghost btn-sm"
                                    disabled={submitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="btn btn-primary btn-sm"
                                >
                                    {submitting ? (
                                        <span className="flex items-center gap-1.5">
                                            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
                                                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" className="opacity-25" />
                                                <path fill="currentColor" d="M4 12a8 8 0 018-8v8z" className="opacity-75" />
                                            </svg>
                                            Uploading…
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1.5">
                                            <Upload size={14} /> Upload to Vault
                                        </span>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Document list */}
            {loading ? (
                <div className="py-12 text-center text-sm text-slate-500">Loading vault…</div>
            ) : filtered.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300 py-16 text-center">
                    <Lock size={32} className="text-slate-300" />
                    <p className="text-sm text-slate-500">
                        {search ? 'No documents match your search.' : 'The vault is empty. Add the first document.'}
                    </p>
                    {!search && canUpload && (
                        <button
                            className="btn btn-primary btn-sm mt-1"
                            onClick={() => setShowUpload(true)}
                        >
                            <Plus size={14} /> Add Document
                        </button>
                    )}
                </div>
            ) : (
                <div className="overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <table className="min-w-full text-sm">
                        <thead>
                            <tr className="border-b border-slate-100 bg-slate-50 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                                <th className="px-4 py-3">Document</th>
                                <th className="px-4 py-3">Description</th>
                                <th className="px-4 py-3">Uploaded by</th>
                                <th className="px-4 py-3">Date</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filtered.map((doc) => (
                                <tr key={doc.id} className="transition hover:bg-slate-50">
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <FileText size={15} className="shrink-0 text-amber-500" />
                                            <div>
                                                <div className="font-medium text-slate-900">{doc.title}</div>
                                                <div className="text-xs text-slate-400">{doc.file_name}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="max-w-xs px-4 py-3 text-slate-600">
                                        {doc.description || <span className="text-slate-300">—</span>}
                                    </td>
                                    <td className="px-4 py-3 text-slate-600">
                                        {doc.uploaded_by_name || '—'}
                                    </td>
                                    <td className="px-4 py-3 text-slate-500">
                                        {formatDate(doc.created_at)}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex justify-end gap-1">
                                            <button
                                                onClick={() => handleDownload(doc)}
                                                title="Download"
                                                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                                            >
                                                <Download size={15} />
                                            </button>
                                            {canUpload && (
                                                <button
                                                    onClick={() => handleDelete(doc)}
                                                    title="Remove from vault"
                                                    className="rounded-lg p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
                                                >
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-400">
                        {filtered.length} document{filtered.length !== 1 ? 's' : ''} in vault
                        {search && ` matching "${search}"`}
                    </div>
                </div>
            )}
        </div>
    );
}
