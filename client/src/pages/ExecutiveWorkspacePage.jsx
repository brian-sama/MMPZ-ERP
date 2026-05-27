import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Eye,
    FileLock2,
    Lock,
    Plus,
    RefreshCw,
    ShieldCheck,
    UserCheck,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import {
    EmptyState,
    MetricCard,
    badgeTone,
    formatDate,
    formatNumber,
    formatStatus,
    getErrorMessage,
} from './operationsUtils.jsx';

const initialDocument = {
    category: 'executive_report',
    title: '',
    sensitivity_level: 'restricted',
    file_name: '',
    file_url: '',
    view_only: true,
    watermark_required: true,
    expiry_date: '',
};

const canManageConfidential = (user) =>
    user?.system_role === 'SUPER_ADMIN' ||
    ['DIRECTOR', 'SYSTEM_ADMIN'].includes(user?.role_code);

export default function ExecutiveWorkspacePage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [restricted, setRestricted] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [data, setData] = useState({ metrics: {}, documents: [], access_logs: [] });
    const [modal, setModal] = useState(false);
    const [documentForm, setDocumentForm] = useState(initialDocument);
    const [submitting, setSubmitting] = useState(false);

    const manager = canManageConfidential(user);

    const fetchWorkspace = async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError('');
        setRestricted(false);
        try {
            const res = await axios.get(`${API_BASE}/operations/confidential`);
            setData({
                metrics: res.data?.metrics || {},
                documents: Array.isArray(res.data?.documents) ? res.data.documents : [],
                access_logs: Array.isArray(res.data?.access_logs) ? res.data.access_logs : [],
            });
        } catch (err) {
            if (err?.response?.status === 403) {
                setRestricted(true);
            } else {
                setError(getErrorMessage(err, 'Executive workspace is unavailable.'));
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchWorkspace();
    }, []);

    const submitDocument = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await axios.post(`${API_BASE}/operations/confidential-documents`, documentForm);
            setDocumentForm(initialDocument);
            setModal(false);
            setMessage('Confidential document registered.');
            await fetchWorkspace({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not register confidential document.'));
        } finally {
            setSubmitting(false);
        }
    };

    const logView = async (document) => {
        setError('');
        try {
            const res = await axios.post(`${API_BASE}/operations/confidential-access`, {
                document_id: document.id,
                action: 'viewed',
            });
            setMessage(res.data?.watermark_text || 'Confidential view logged.');
            await fetchWorkspace({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not log document view.'));
        }
    };

    if (loading) {
        return <div className="page-loading"><div className="spinner" /></div>;
    }

    if (restricted) {
        return (
            <div className="fade-in governance-workspace">
                <PageHeader
                    title="Secure Executive Workspace"
                    subtitle="Restricted governance records require executive authorization."
                />
                <section className="domain-hero">
                    <div>
                        <div className="domain-kicker">Ultra-Restricted Access</div>
                        <h2>This area is locked to authorized executive roles.</h2>
                        <p>
                            Confidential audits, investigations, safeguarding escalations, grievances, legal matters, and strategic board documents are protected with access logging.
                        </p>
                    </div>
                    <div className="hero-control-card">
                        <Lock size={36} />
                        <div className="hero-control-value">Restricted</div>
                        <p>Your current role does not include confidential workspace access.</p>
                    </div>
                </section>
            </div>
        );
    }

    return (
        <div className="fade-in governance-workspace">
            <PageHeader
                title="Secure Executive Workspace"
                subtitle="Confidential records, watermark controls, view-only flags, and access traceability."
                actions={
                    <div className="governance-toolbar">
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchWorkspace({ silent: true })} disabled={refreshing}>
                            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                            Refresh
                        </button>
                        {manager && (
                            <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
                                <Plus size={14} />
                                Document
                            </button>
                        )}
                    </div>
                }
            />

            {error && <div className="page-message error">{error}</div>}
            {message && <div className="page-message success">{message}</div>}

            <section className="domain-hero">
                <div>
                    <div className="domain-kicker">Executive Governance Security</div>
                    <h2>Sensitive records are separated from normal document storage.</h2>
                    <p>
                        Documents can be marked view-only, watermarked, restricted to board or executive review, and every access event is written to the audit trail.
                    </p>
                </div>
                <div className="hero-control-card">
                    <div className="hero-control-label">Watermark Example</div>
                    <div className="confidential-watermark">CONFIDENTIAL</div>
                    <p>Viewed by {user?.name || 'Authorized User'} on {formatDate(new Date())}</p>
                </div>
            </section>

            <div className="metric-grid">
                <MetricCard icon={FileLock2} label="Documents" value={formatNumber(data.metrics.total_documents)} note="Restricted records" />
                <MetricCard icon={UserCheck} tone="primary" label="Board Only" value={formatNumber(data.metrics.board_only_count)} note="Highest sensitivity level" />
                <MetricCard icon={Eye} tone="warning" label="View Only" value={formatNumber(data.metrics.view_only_count)} note="Download prevention flag" />
                <MetricCard icon={ShieldCheck} tone="info" label="Access Events" value={formatNumber(data.metrics.access_30_days)} note="Logged in the last 30 days" />
            </div>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Confidential Documents</h2>
                        <p className="panel-subtitle">Access events should be logged before viewing sensitive material.</p>
                    </div>
                </div>
                {data.documents.length === 0 ? (
                    <EmptyState icon={FileLock2} title="No confidential documents registered" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>Category</th>
                                    <th>Sensitivity</th>
                                    <th>Mode</th>
                                    <th>Access</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.documents.map((document) => (
                                    <tr key={document.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{document.title}</div>
                                            <div className="form-hint">{document.file_name || 'No file name'} / expires {formatDate(document.expiry_date)}</div>
                                        </td>
                                        <td>{formatStatus(document.category)}</td>
                                        <td><span className={`badge badge-${badgeTone(document.sensitivity_level)}`}>{formatStatus(document.sensitivity_level)}</span></td>
                                        <td>{document.view_only ? 'View only' : 'Download allowed'}</td>
                                        <td>{formatNumber(document.access_count)} event{Number(document.access_count || 0) === 1 ? '' : 's'}</td>
                                        <td>
                                            <button className="btn btn-secondary btn-sm" onClick={() => logView(document)}>
                                                <Eye size={14} />
                                                Log View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Access Log</h2>
                        <p className="panel-subtitle">Who opened a document, when, and the watermark applied.</p>
                    </div>
                </div>
                {data.access_logs.length === 0 ? (
                    <EmptyState icon={ShieldCheck} title="No access events logged" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Document</th>
                                    <th>User</th>
                                    <th>Action</th>
                                    <th>Watermark</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.access_logs.map((log) => (
                                    <tr key={log.id}>
                                        <td>{formatDate(log.opened_at)}</td>
                                        <td>{log.document_title}</td>
                                        <td>{log.user_name || 'Unknown'}</td>
                                        <td>{formatStatus(log.action)}</td>
                                        <td>{log.watermark_text || 'Not captured'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {modal && (
                <div className="modal-overlay" onMouseDown={() => setModal(false)}>
                    <div className="modal-box lg" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Register Confidential Document</h3>
                            <button className="modal-close" onClick={() => setModal(false)}>x</button>
                        </div>
                        <form onSubmit={submitDocument}>
                            <div className="modal-body form-grid">
                                <label className="form-field">
                                    <span>Category</span>
                                    <select className="form-input" value={documentForm.category} onChange={(event) => setDocumentForm({ ...documentForm, category: event.target.value })}>
                                        <option value="audit">Audit</option>
                                        <option value="disciplinary">Disciplinary</option>
                                        <option value="safeguarding_escalation">Safeguarding Escalation</option>
                                        <option value="executive_report">Executive Report</option>
                                        <option value="legal_issue">Legal Issue</option>
                                        <option value="donor_investigation">Donor Investigation</option>
                                        <option value="hr_grievance">HR Grievance</option>
                                        <option value="strategic_plan">Strategic Plan</option>
                                        <option value="board_document">Board Document</option>
                                        <option value="other">Other</option>
                                    </select>
                                </label>
                                <label className="form-field">
                                    <span>Sensitivity</span>
                                    <select className="form-input" value={documentForm.sensitivity_level} onChange={(event) => setDocumentForm({ ...documentForm, sensitivity_level: event.target.value })}>
                                        <option value="restricted">Restricted</option>
                                        <option value="strictly_confidential">Strictly Confidential</option>
                                        <option value="board_only">Board Only</option>
                                    </select>
                                </label>
                                <label className="form-field full">
                                    <span>Title</span>
                                    <input className="form-input" value={documentForm.title} onChange={(event) => setDocumentForm({ ...documentForm, title: event.target.value })} required />
                                </label>
                                <label className="form-field">
                                    <span>File Name</span>
                                    <input className="form-input" value={documentForm.file_name} onChange={(event) => setDocumentForm({ ...documentForm, file_name: event.target.value })} />
                                </label>
                                <label className="form-field">
                                    <span>File URL</span>
                                    <input className="form-input" value={documentForm.file_url} onChange={(event) => setDocumentForm({ ...documentForm, file_url: event.target.value })} />
                                </label>
                                <label className="form-field">
                                    <span>Expiry Date</span>
                                    <input className="form-input" type="date" value={documentForm.expiry_date} onChange={(event) => setDocumentForm({ ...documentForm, expiry_date: event.target.value })} />
                                </label>
                                <label className="form-field inline-check">
                                    <input type="checkbox" checked={documentForm.view_only} onChange={(event) => setDocumentForm({ ...documentForm, view_only: event.target.checked })} />
                                    <span>View only</span>
                                </label>
                                <label className="form-field inline-check">
                                    <input type="checkbox" checked={documentForm.watermark_required} onChange={(event) => setDocumentForm({ ...documentForm, watermark_required: event.target.checked })} />
                                    <span>Watermark required</span>
                                </label>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Document'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
