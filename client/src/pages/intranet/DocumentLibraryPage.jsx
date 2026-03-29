import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { BookOpen, Download, FileText, Folder, Plus, Trash2 } from 'lucide-react';
import API_BASE from '../../apiConfig';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';

const blankForm = {
    title: '',
    description: '',
    category: 'General',
    file: null,
};

const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

export default function DocumentLibraryPage() {
    const { user } = useAuth();
    const [documents, setDocuments] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState(blankForm);
    const [submitting, setSubmitting] = useState(false);
    const canManageDocuments = user?.role_code !== 'DEVELOPMENT_FACILITATOR';

    const fetchDocuments = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/documents`, {
                params: {
                    userId: user.id,
                    category: selectedCategory === 'All' ? undefined : selectedCategory,
                },
            });
            setDocuments(res.data?.items || []);
            setCategories(['All', ...(res.data?.categories || [])]);
        } catch (error) {
            console.error('Failed to fetch documents', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, [selectedCategory]);

    const categoryOptions = useMemo(() => {
        const defaults = ['General', 'Human Resources', 'Finance Forms', 'IT & Security', 'Program Guidelines', 'Brand Assets'];
        return [...new Set([...defaults, ...categories.filter((item) => item !== 'All')])];
    }, [categories]);

    const uploadDocument = async (event) => {
        event.preventDefault();
        if (!form.file) {
            alert('Select a file to upload.');
            return;
        }

        setSubmitting(true);
        try {
            const fileData = await fileToBase64(form.file);
            await axios.post(`${API_BASE}/documents`, {
                userId: user.id,
                title: form.title,
                description: form.description,
                category: form.category,
                fileData,
                fileName: form.file.name,
                mimeType: form.file.type,
            });
            setForm(blankForm);
            setShowModal(false);
            await fetchDocuments();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to upload document');
        } finally {
            setSubmitting(false);
        }
    };

    const deleteDocument = async (id) => {
        if (!window.confirm('Delete this document from the library?')) return;
        try {
            await axios.delete(`${API_BASE}/documents/${id}`, {
                data: { userId: user.id },
            });
            await fetchDocuments();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to delete document');
        }
    };

    return (
        <div className="fade-in">
            <PageHeader
                title="Document Library"
                subtitle="Central repository for shared policies, templates, and organizational resources."
                actions={
                    canManageDocuments ? (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                            <Plus size={16} /> Upload Document
                        </button>
                    ) : null
                }
            />

            <div className="panels-row document-library-layout">
                <div className="document-library-sidebar" style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div className="panel" style={{ padding: '16px' }}>
                        <h3 style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '12px', fontWeight: 600 }}>
                            Categories
                        </h3>
                        {categories.map((category) => (
                            <button
                                key={category}
                                className="control-row"
                                onClick={() => setSelectedCategory(category)}
                                style={{
                                    padding: '10px 12px',
                                    background: selectedCategory === category ? 'var(--brand-primary-light)' : 'transparent',
                                }}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Folder size={14} /> <span style={{ fontSize: '13px' }}>{category}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="panel" style={{ flex: 1 }}>
                    {loading ? (
                        <div className="page-loading">
                            <div className="spinner" />
                        </div>
                    ) : documents.length === 0 ? (
                        <div className="empty-state" style={{ padding: '60px 20px' }}>
                            <div className="empty-state-icon">
                                <BookOpen size={32} />
                            </div>
                            <div className="empty-state-title">No documents in this category</div>
                            <p className="empty-state-text">
                                Upload the first file to make this library useful across the organization.
                            </p>
                        </div>
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Name</th>
                                        <th>Category</th>
                                        <th>Uploaded By</th>
                                        <th>Date Modified</th>
                                        <th style={{ width: '120px' }}>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {documents.map((document) => (
                                        <tr key={document.id}>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <FileText size={14} style={{ color: '#7B2CBF' }} />
                                                    <div>
                                                        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                                            {document.title}
                                                        </div>
                                                        <div className="form-hint">{document.file_name}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td>
                                                <span className="badge badge-info">{document.category}</span>
                                            </td>
                                            <td>{document.uploaded_by_name || 'System'}</td>
                                            <td>{new Date(document.updated_at || document.created_at).toLocaleDateString()}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <a
                                                        className="btn btn-ghost btn-sm"
                                                        title="Download"
                                                        href={document.file_path}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                    >
                                                        <Download size={14} />
                                                    </a>
                                                    {canManageDocuments && (
                                                        <button className="btn btn-ghost btn-sm" title="Delete" onClick={() => deleteDocument(document.id)}>
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-box" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Upload Document</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}>
                                ×
                            </button>
                        </div>
                        <form onSubmit={uploadDocument}>
                            <div className="modal-body" style={{ display: 'grid', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Document Title</label>
                                    <input
                                        className="form-input"
                                        value={form.title}
                                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Category</label>
                                    <select
                                        className="form-input"
                                        value={form.category}
                                        onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))}
                                    >
                                        {categoryOptions.map((category) => (
                                            <option key={category} value={category}>
                                                {category}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea
                                        className="form-input"
                                        style={{ minHeight: '120px' }}
                                        value={form.description}
                                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">File</label>
                                    <input
                                        type="file"
                                        className="form-input"
                                        accept=".pdf,.doc,.docx,.xls,.xlsx,.txt"
                                        onChange={(event) => setForm((current) => ({ ...current, file: event.target.files?.[0] || null }))}
                                        required
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Uploading...' : 'Save Document'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
