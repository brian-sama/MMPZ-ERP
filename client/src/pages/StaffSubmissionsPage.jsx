import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
    FileText,
    Send,
    History,
    Plus,
    FilePlus,
    ClipboardList,
    AlertCircle,
    CheckCircle,
    Clock,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

const SUBMISSION_TYPES = [
    { value: 'leave_application', label: 'Leave Application', icon: Calendar },
    { value: 'request_for_funds', label: 'Request for Funds', icon: FilePlus },
    { value: 'general_report', label: 'General Staff Report', icon: FileText },
    { value: 'other', label: 'Other Official Document', icon: ClipboardList },
];

export default function StaffSubmissionsPage() {
    const { user } = useAuth();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    
    const [formData, setFormData] = useState({
        submission_type: 'leave_application',
        title: '',
        description: '',
        file: null
    });

    useEffect(() => {
        fetchSubmissions();
    }, []);

    const fetchSubmissions = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/submissions`, { params: { userId: user.id } });
            setSubmissions(res.data || []);
        } catch (error) {
            console.error('Failed to fetch submissions', error);
        } finally {
            setLoading(false);
        }
    };

    const fileToBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const fileData = formData.file ? await fileToBase64(formData.file) : null;
            await axios.post(`${API_BASE}/submissions`, {
                submission_type: formData.submission_type,
                title: formData.title,
                description: formData.description,
                file_path: fileData,
                file_name: formData.file?.name,
                mime_type: formData.file?.type,
            });
            setShowModal(false);
            setFormData({ submission_type: 'leave_application', title: '', description: '', file: null });
            await fetchSubmissions();
        } catch (error) {
            alert('Failed to submit: ' + (error.response?.data?.error || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'approved': return 'success';
            case 'rejected': return 'danger';
            case 'submitted': return 'info';
            case 'pending_changes': return 'warning';
            default: return 'secondary';
        }
    };

    if (loading) return <div className="page-loading"><div className="spinner" /></div>;

    return (
        <div className="fade-in">
            <PageHeader
                title="Staff Submissions"
                subtitle="Submit official documents, leave applications, and funding requests for management review."
                actions={
                    <button className="btn btn-primary" onClick={() => setShowModal(true)}>
                        <Plus size={18} />
                        New Submission
                    </button>
                }
            />

            <div className="panels-row">
                <div style={{ flex: 1 }}>
                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title">My Recent Submissions</h2>
                        </div>
                        <div className="control-stack">
                            {submissions.map(sub => (
                                <div key={sub.id} className="control-row static" style={{ padding: '20px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <span className={`badge badge-${getStatusColor(sub.status)}`}>
                                                {sub.status.toUpperCase()}
                                            </span>
                                            <span className="text-muted" style={{ fontSize: '12px' }}>
                                                {new Date(sub.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '15px' }}>{sub.title}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Type: {sub.submission_type.replace(/_/g, ' ')}
                                        </div>
                                    </div>
                                    <button className="btn btn-secondary btn-sm">View Details</button>
                                </div>
                            ))}
                            {submissions.length === 0 && (
                                <div className="empty-state" style={{ padding: '60px 20px' }}>
                                    <div className="empty-state-icon"><History size={40} /></div>
                                    <div className="empty-state-title">No Submissions</div>
                                    <p className="empty-state-text">Your official document submissions will appear here.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="panel" style={{ padding: '20px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Submission Guidelines</h3>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <CheckCircle size={14} className="text-success" style={{ flexShrink: 0 }} />
                                <span>Ensure all fund requests have supporting invoices attached.</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <CheckCircle size={14} className="text-success" style={{ flexShrink: 0 }} />
                                <span>Leave applications should be submitted at least 48 hours in advance.</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <AlertCircle size={14} className="text-info" style={{ flexShrink: 0 }} />
                                <span>Documents are routed automatically to Finance or the Director based on type.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-box md" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">New Official Submission</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Submission Type</label>
                                    <select 
                                        className="form-input" 
                                        value={formData.submission_type}
                                        onChange={e => setFormData({...formData, submission_type: e.target.value})}
                                    >
                                        {SUBMISSION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Title / Reference</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        required 
                                        placeholder="e.g. Annual Leave Request - June"
                                        value={formData.title}
                                        onChange={e => setFormData({...formData, title: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Additional Details</label>
                                    <textarea 
                                        className="form-input" 
                                        style={{ minHeight: '100px' }}
                                        value={formData.description}
                                        onChange={e => setFormData({...formData, description: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Attachment (PDF/Image)</label>
                                    <input 
                                        type="file" 
                                        className="form-input"
                                        onChange={e => setFormData({...formData, file: e.target.files?.[0]})}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Submitting...' : 'Send Submission'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
