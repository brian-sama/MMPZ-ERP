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
    Calendar,
    UserCheck,
    CheckSquare,
    Stamp,
    Download,
    Eye
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const SUBMISSION_TYPES = [
    { value: 'leave_application', label: 'Leave Application', icon: Calendar },
    { value: 'request_for_funds', label: 'Request for Funds', icon: FilePlus },
    { value: 'general_report', label: 'General Staff Report', icon: FileText },
    { value: 'other', label: 'Other Official Document', icon: ClipboardList },
];

const FINANCE_REVIEW_ROLES = [
    'FINANCE_OFFICER',
    'ADMIN_FINANCE_ASSISTANT',
    'FINANCE_ADMIN_OFFICER',
    'ADMIN_ASSISTANT',
    'LOGISTICS_ASSISTANT',
];

export default function StaffSubmissionsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [leaveBalance, setLeaveBalance] = useState(null);
    const [managerQueue, setManagerQueue] = useState([]);
    const [activeTab, setActiveTab] = useState('my_submissions'); // 'my_submissions' or 'pending_actions'
    const [selectedSub, setSelectedSub] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [comment, setComment] = useState('');
    
    // RFF and Liquidation details state
    const [rffDetails, setRffDetails] = useState(null);
    const [loadingRff, setLoadingRff] = useState(false);
    const [detailTab, setDetailTab] = useState('overview'); // 'overview' or 'liquidation'
    const [liqNotes, setLiqNotes] = useState('');
    const [liqReceipts, setLiqReceipts] = useState('');
    const [liqItems, setLiqItems] = useState([]);
    const [submittingLiq, setSubmittingLiq] = useState(false);
    const [liqComment, setLiqComment] = useState('');
    
    const [formData, setFormData] = useState({
        submission_type: 'leave_application',
        title: '',
        description: '',
        file: null,
        metadata: {
            leave_type: 'annual',
            start_date: '',
            end_date: '',
            days_requested: 0
        }
    });

    const isFinanceReviewer = FINANCE_REVIEW_ROLES.includes(user?.role_code);
    const isManager = ['DIRECTOR', 'SYSTEM_ADMIN'].includes(user?.role_code) || isFinanceReviewer;

    useEffect(() => {
        fetchSubmissions();
        fetchLeaveBalance();
        if (isManager) fetchManagerQueue();
    }, [isManager]);

    useEffect(() => {
        if (selectedSub && selectedSub.submission_type === 'request_for_funds') {
            setDetailTab('overview');
            fetchRffDetails(selectedSub.related_entity_id);
        } else {
            setRffDetails(null);
        }
    }, [selectedSub]);

    const fetchRffDetails = async (id) => {
        setLoadingRff(true);
        try {
            const res = await axios.get(`${API_BASE}/funding-requests/${id}`);
            const data = res.data;
            setRffDetails(data);
            if (data.liquidation) {
                setLiqNotes(data.liquidation.notes || '');
                setLiqReceipts(data.liquidation.receipts?.[0] || '');
                setLiqItems(data.liquidation.items || data.items.map(item => ({
                    ...item,
                    actual_cost: item.actual_cost !== undefined ? item.actual_cost : item.total_cost
                })));
            } else {
                setLiqNotes('');
                setLiqReceipts('');
                setLiqItems(data.items.map(item => ({
                    ...item,
                    actual_cost: item.total_cost
                })));
            }
        } catch (error) {
            console.error('Failed to fetch RFF details', error);
        } finally {
            setLoadingRff(false);
        }
    };

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

    const fetchLeaveBalance = async () => {
        try {
            const res = await axios.get(`${API_BASE}/me/leave`, { params: { userId: user.id } });
            setLeaveBalance(res.data.balance);
        } catch (error) {
            console.error('Failed to fetch leave balance', error);
        }
    };

    const fetchManagerQueue = async () => {
        try {
            const res = await axios.get(`${API_BASE}/submissions`, { params: { userId: user.id, view: 'admin' } });
            setManagerQueue(res.data || []);
        } catch (error) {
            console.error('Failed to fetch manager queue', error);
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
                metadata: formData.metadata
            });
            setShowModal(false);
            setFormData({ 
                submission_type: 'leave_application', 
                title: '', 
                description: '', 
                file: null,
                metadata: { leave_type: 'annual', start_date: '', end_date: '', days_requested: 0 }
            });
            await fetchSubmissions();
            await fetchLeaveBalance();
        } catch (error) {
            alert('Failed to submit: ' + (error.response?.data?.error || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    const handleAction = async (subId, action) => {
        if (!comment && action !== 'approve') {
            alert('Comment is required for this action.');
            return;
        }
        setSubmitting(true);
        try {
            await axios.post(`${API_BASE}/submissions/${subId}/action`, {
                action,
                comment,
                userId: user.id
            });
            setComment('');
            setSelectedSub(null);
            await fetchSubmissions();
            if (isManager) await fetchManagerQueue();
            await fetchLeaveBalance();
        } catch (error) {
            alert('Action failed: ' + (error.response?.data?.error || error.message));
        } finally {
            setSubmitting(false);
        }
    };

    const calculateDays = (start, end) => {
        if (!start || !end) return 0;
        const s = new Date(start);
        const e = new Date(end);
        const diffTime = Math.abs(e - s);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
        return diffDays;
    };

    const handleDateChange = (field, value) => {
        const newMeta = { ...formData.metadata, [field]: value };
        if (field === 'start_date' || field === 'end_date') {
            newMeta.days_requested = calculateDays(newMeta.start_date, newMeta.end_date);
        }
        setFormData({ ...formData, metadata: newMeta });
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

            <div className="tab-container" style={{ marginBottom: '20px' }}>
                <button 
                    className={`tab-item ${activeTab === 'my_submissions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('my_submissions')}
                >
                    <FileText size={16} /> My Submissions
                </button>
                {isManager && (
                    <button 
                        className={`tab-item ${activeTab === 'pending_actions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pending_actions')}
                    >
                        <CheckSquare size={16} /> Pending My Action ({managerQueue.length})
                    </button>
                )}
            </div>

            <div className="panels-row">
                <div style={{ flex: 1 }}>
                    {activeTab === 'my_submissions' ? (
                        <div className="panel">
                            <div className="panel-header">
                                <h2 className="panel-title">Recent Submissions</h2>
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
                                                {sub.metadata?.days_requested && ` · ${sub.metadata.days_requested} Days`}
                                            </div>
                                        </div>
                                        <button className="btn btn-secondary btn-sm" onClick={() => setSelectedSub(sub)}>Details</button>
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
                    ) : (
                        <div className="panel">
                            <div className="panel-header">
                                <h2 className="panel-title">Pending Approvals / Verifications</h2>
                            </div>
                            <div className="control-stack">
                                {managerQueue.map(sub => (
                                    <div key={sub.id} className="control-row static" style={{ padding: '20px' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                                <span className="badge badge-info">PENDING {user.role_code.replace(/_/g, ' ')}</span>
                                                <span className="text-muted" style={{ fontSize: '12px' }}>
                                                    From: {sub.submitter_name} · {new Date(sub.created_at).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <div style={{ fontWeight: 700, fontSize: '15px' }}>{sub.title}</div>
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                Type: {sub.submission_type.replace(/_/g, ' ')}
                                                {sub.metadata?.days_requested && ` · ${sub.metadata.days_requested} Days`}
                                            </div>
                                        </div>
                                        <button className="btn btn-primary btn-sm" onClick={() => setSelectedSub(sub)}>Action</button>
                                    </div>
                                ))}
                                {managerQueue.length === 0 && (
                                    <div className="empty-state" style={{ padding: '60px 20px' }}>
                                        <div className="empty-state-icon"><CheckCircle size={40} /></div>
                                        <div className="empty-state-title">All Clear!</div>
                                        <p className="empty-state-text">No pending submissions for your role at the moment.</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {leaveBalance && (
                        <div className="panel" style={{ padding: '20px', background: 'var(--surface-sunken)' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Calendar size={18} className="text-primary" /> Leave Entitlement
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                <div className="stat-card mini">
                                    <div className="stat-label">Allocated</div>
                                    <div className="stat-value" style={{ fontSize: '18px' }}>{leaveBalance.allocated_days}</div>
                                </div>
                                <div className="stat-card mini">
                                    <div className="stat-label">Used</div>
                                    <div className="stat-value" style={{ fontSize: '18px', color: 'var(--brand-danger)' }}>{leaveBalance.used_days}</div>
                                </div>
                            </div>
                            <div className="stat-card mini primary" style={{ marginTop: '12px' }}>
                                <div className="stat-label">Remaining Balance</div>
                                <div className="stat-value" style={{ fontSize: '24px' }}>
                                    {(Number(leaveBalance.allocated_days) - Number(leaveBalance.used_days)).toFixed(1)}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="panel" style={{ padding: '20px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Submission Guidelines</h3>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <CheckCircle size={14} className="text-success" style={{ flexShrink: 0 }} />
                                <span>Ensure all fund requests have supporting invoices attached.</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <CheckCircle size={14} className="text-success" style={{ flexShrink: 0 }} />
                                <span>Leave applications require a 2-tier approval (Finance & Director).</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <AlertCircle size={14} className="text-info" style={{ flexShrink: 0 }} />
                                <span>Approval signatures are digitally recorded and stamped on documents.</span>
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

                                {formData.submission_type === 'request_for_funds' ? (
                                    <div className="surface-muted" style={{ padding: '20px', borderRadius: '8px', textAlign: 'center', margin: '10px 0', border: '1px solid var(--border)' }}>
                                        <FilePlus size={36} className="text-primary" style={{ margin: '0 auto 12px' }} />
                                        <div style={{ fontWeight: 700, fontSize: '15px', marginBottom: '8px' }}>Launch Guided RFF Wizard</div>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: '1.5' }}>
                                            We have fully digitized the Request for Funds (RFF) workflow! Use our guided, multi-step interactive wizard to compile budget grids, narratives, and projects.
                                        </p>
                                        <button type="button" className="btn btn-primary" style={{ margin: '0 auto' }} onClick={() => { setShowModal(false); navigate('/submissions/request-funds'); }}>
                                            Launch RFF Wizard
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {formData.submission_type === 'leave_application' && (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', padding: '16px', background: 'var(--surface-muted)', borderRadius: '8px' }}>
                                                <div className="form-group">
                                                    <label className="form-label">Start Date</label>
                                                    <input type="date" className="form-input" required value={formData.metadata.start_date} onChange={e => handleDateChange('start_date', e.target.value)} />
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">End Date</label>
                                                    <input type="date" className="form-input" required value={formData.metadata.end_date} onChange={e => handleDateChange('end_date', e.target.value)} />
                                                </div>
                                                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                                                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--brand-primary)' }}>
                                                        Total Days Requested: {formData.metadata.days_requested}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

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
                                    </>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                {formData.submission_type !== 'request_for_funds' && (
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>
                                        {submitting ? 'Submitting...' : 'Send Submission'}
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedSub && (
                <div className="modal-overlay" onClick={() => setSelectedSub(null)}>
                    <div className="modal-box lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Submission Details</div>
                            <button className="modal-close" onClick={() => setSelectedSub(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            {selectedSub.submission_type === 'request_for_funds' ? (
                                loadingRff ? (
                                    <div className="page-loading" style={{ minHeight: '200px' }}><div className="spinner" /></div>
                                ) : !rffDetails ? (
                                    <div className="surface-muted" style={{ padding: '20px', borderRadius: '8px', textAlign: 'center' }}>
                                        <AlertCircle size={24} className="text-danger" style={{ margin: '0 auto 8px' }} />
                                        <p>Failed to load Request for Funds database record.</p>
                                    </div>
                                ) : (
                                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                                        <div>
                                            <div style={{ marginBottom: '20px' }}>
                                                <span className={`badge badge-${getStatusColor(selectedSub.status)}`} style={{ marginBottom: '8px' }}>
                                                    {selectedSub.status.toUpperCase()}
                                                </span>
                                                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{selectedSub.title}</h2>
                                                <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                                    Submitted by {selectedSub.submitter_name || 'Me'} on {new Date(selectedSub.created_at).toLocaleString()}
                                                </p>
                                            </div>

                                            {selectedSub.status === 'approved' && (
                                                <div className="tab-container" style={{ marginBottom: '20px' }}>
                                                    <button 
                                                        className={`tab-item ${detailTab === 'overview' ? 'active' : ''}`}
                                                        onClick={() => setDetailTab('overview')}
                                                        style={{ padding: '8px 16px', fontSize: '13px' }}
                                                    >
                                                        RFF Overview
                                                    </button>
                                                    <button 
                                                        className={`tab-item ${detailTab === 'liquidation' ? 'active' : ''}`}
                                                        onClick={() => setDetailTab('liquidation')}
                                                        style={{ padding: '8px 16px', fontSize: '13px' }}
                                                    >
                                                        Activity Liquidation {rffDetails.liquidation && `(${rffDetails.liquidation.status.toUpperCase()})`}
                                                    </button>
                                                </div>
                                            )}

                                            {detailTab === 'overview' || selectedSub.status !== 'approved' ? (
                                                <>
                                                    <div className="panel" style={{ padding: '16px', marginBottom: '20px' }}>
                                                        <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Operational Context</h3>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px' }}>
                                                            <div><strong>Project:</strong> {rffDetails.project_name || 'N/A'}</div>
                                                            <div><strong>Program:</strong> {rffDetails.program_name || 'N/A'}</div>
                                                            <div><strong>District:</strong> {rffDetails.district_name || 'N/A'} ({rffDetails.district_code || 'N/A'})</div>
                                                            <div><strong>Activity Name:</strong> {rffDetails.activity_name}</div>
                                                        </div>
                                                    </div>

                                                    <div className="panel" style={{ padding: '16px', marginBottom: '20px' }}>
                                                        <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Activity Justification</h3>
                                                        <div style={{ fontSize: '13px', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{rffDetails.narrative_justification}</div>
                                                    </div>

                                                    <div className="panel" style={{ padding: '16px', marginBottom: '20px' }}>
                                                        <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Itemized Budget Breakdown</h3>
                                                        <div className="data-table-wrap">
                                                            <table className="data-table" style={{ fontSize: '12px' }}>
                                                                <thead>
                                                                    <tr>
                                                                        <th>Description</th>
                                                                        <th>Category</th>
                                                                        <th style={{ textAlign: 'right' }}>Qty</th>
                                                                        <th style={{ textAlign: 'right' }}>Unit Cost</th>
                                                                        <th style={{ textAlign: 'right' }}>Subtotal</th>
                                                                    </tr>
                                                                </thead>
                                                                <tbody>
                                                                    {rffDetails.items?.map((item, idx) => (
                                                                        <tr key={idx}>
                                                                            <td>{item.description}</td>
                                                                            <td><span className="badge badge-secondary" style={{ fontSize: '9px', textTransform: 'uppercase' }}>{item.category}</span></td>
                                                                            <td style={{ textAlign: 'right' }}>{item.quantity}</td>
                                                                            <td style={{ textAlign: 'right' }}>${Number(item.unit_cost).toFixed(2)}</td>
                                                                            <td style={{ textAlign: 'right', fontWeight: 600 }}>${Number(item.total_cost).toFixed(2)}</td>
                                                                        </tr>
                                                                    ))}
                                                                    <tr style={{ background: 'var(--surface-sunken)', fontWeight: 'bold' }}>
                                                                        <td colSpan="4" style={{ textAlign: 'right' }}>Grand Total Requested:</td>
                                                                        <td style={{ textAlign: 'right', color: 'var(--brand-primary)' }}>${Number(rffDetails.total_requested_amount).toFixed(2)}</td>
                                                                    </tr>
                                                                </tbody>
                                                            </table>
                                                        </div>
                                                    </div>

                                                    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => window.open(`${API_BASE}/funding-requests/${rffDetails.id}/print`, '_blank')}
                                                        >
                                                            🖨️ Print RFF Report
                                                        </button>
                                                        <button 
                                                            type="button" 
                                                            className="btn btn-secondary btn-sm"
                                                            onClick={() => window.open(`${API_BASE}/funding-requests/${rffDetails.id}/excel`, '_blank')}
                                                        >
                                                            📥 Download Excel Workbook
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="panel" style={{ padding: '16px', marginBottom: '20px' }}>
                                                    <h3 style={{ fontSize: '13px', fontWeight: 600, marginBottom: '16px' }}>Activity Spending & Receipts Liquidation</h3>

                                                    {rffDetails.liquidation && rffDetails.liquidation.status === 'verified' && (
                                                        <div className="surface-muted" style={{ borderColor: 'var(--brand-success)', background: 'rgba(47, 93, 80, 0.05)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--brand-success)', fontWeight: 700 }}>
                                                                <CheckSquare size={18} /> Liquidation Verified & Approved
                                                            </div>
                                                            <p style={{ fontSize: '12px', marginTop: '6px', color: 'var(--text-main)' }}>
                                                                Actual Spent: <strong>${Number(rffDetails.liquidation.actual_amount_spent).toFixed(2)}</strong> (Budget Variance: <strong>${Number(rffDetails.liquidation.variance_amount).toFixed(2)}</strong>)
                                                            </p>
                                                            <p style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '8px', color: 'var(--text-muted)' }}>
                                                                Notes: {rffDetails.liquidation.notes}
                                                            </p>
                                                        </div>
                                                    )}

                                                    {rffDetails.liquidation && rffDetails.liquidation.status === 'pending' && (
                                                        <div className="surface-muted" style={{ borderColor: 'var(--brand-warning)', background: 'rgba(230, 150, 20, 0.05)', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--brand-warning)', fontWeight: 700 }}>
                                                                <Clock size={18} /> Liquidation Submitted - Under Review
                                                            </div>
                                                            <p style={{ fontSize: '12px', marginTop: '6px' }}>
                                                                Actual Spent: <strong>${Number(rffDetails.liquidation.actual_amount_spent).toFixed(2)}</strong> (Budget Variance: <strong>${Number(rffDetails.liquidation.variance_amount).toFixed(2)}</strong>)
                                                            </p>
                                                            <p style={{ fontSize: '11px', fontStyle: 'italic', marginTop: '8px', color: 'var(--text-muted)' }}>
                                                                Notes: "{rffDetails.liquidation.notes}"
                                                            </p>
                                                        </div>
                                                    )}

                                                    {(!rffDetails.liquidation || rffDetails.liquidation.status === 'rejected') && (
                                                        <form onSubmit={async (e) => {
                                                            e.preventDefault();
                                                            setSubmittingLiq(true);
                                                            try {
                                                                const grandActual = liqItems.reduce((acc, curr) => acc + Number(curr.actual_cost || 0), 0);
                                                                await axios.post(`${API_BASE}/funding-requests/${rffDetails.id}/liquidate`, {
                                                                    actual_amount_spent: grandActual,
                                                                    notes: liqNotes,
                                                                    receipts: [liqReceipts],
                                                                    items: liqItems
                                                                });
                                                                alert('Liquidation submitted for review!');
                                                                fetchRffDetails(rffDetails.id);
                                                            } catch (err) {
                                                                alert('Failed to submit liquidation: ' + (err.response?.data?.error || err.message));
                                                            } finally {
                                                                setSubmittingLiq(false);
                                                            }
                                                        }}>
                                                            {rffDetails.liquidation && rffDetails.liquidation.status === 'rejected' && (
                                                                <div className="surface-muted" style={{ borderColor: 'var(--brand-danger)', background: 'rgba(180, 35, 24, 0.05)', padding: '12px', borderRadius: '8px', marginBottom: '16px', color: 'var(--brand-danger)', fontSize: '12px' }}>
                                                                    <strong>Liquidation Rejected:</strong> {rffDetails.liquidation.notes}
                                                                </div>
                                                            )}

                                                            <div className="data-table-wrap" style={{ marginBottom: '16px' }}>
                                                                <table className="data-table" style={{ fontSize: '12px' }}>
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Budget Line Description</th>
                                                                            <th style={{ textAlign: 'right' }}>Budget Cost</th>
                                                                            <th style={{ textAlign: 'right', width: '30%' }}>Actual Spend (USD)</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {liqItems.map((item, idx) => (
                                                                            <tr key={idx}>
                                                                                <td>{item.description}</td>
                                                                                <td style={{ textAlign: 'right' }}>${Number(item.total_cost).toFixed(2)}</td>
                                                                                <td>
                                                                                    <input 
                                                                                        type="number" 
                                                                                        className="form-input" 
                                                                                        style={{ margin: 0, height: '30px', textAlign: 'right', fontSize: '12px' }}
                                                                                        min="0"
                                                                                        step="0.01"
                                                                                        value={item.actual_cost}
                                                                                        onChange={e => {
                                                                                            const updated = [...liqItems];
                                                                                            updated[idx].actual_cost = parseFloat(e.target.value || 0);
                                                                                            setLiqItems(updated);
                                                                                        }}
                                                                                    />
                                                                                </td>
                                                                            </tr>
                                                                        ))}
                                                                        <tr style={{ background: 'var(--surface-sunken)', fontWeight: 'bold' }}>
                                                                            <td>Grand Totals:</td>
                                                                            <td style={{ textAlign: 'right' }}>${Number(rffDetails.total_requested_amount).toFixed(2)}</td>
                                                                            <td style={{ textAlign: 'right', color: 'var(--brand-primary)' }}>
                                                                                ${liqItems.reduce((acc, curr) => acc + Number(curr.actual_cost || 0), 0).toFixed(2)}
                                                                            </td>
                                                                        </tr>
                                                                        <tr style={{ background: 'var(--surface-sunken)', fontWeight: 'bold', fontSize: '11px' }}>
                                                                            <td>Estimated Variance (Unspent):</td>
                                                                            <td colSpan="2" style={{ textAlign: 'right', color: (Number(rffDetails.total_requested_amount) - liqItems.reduce((acc, curr) => acc + Number(curr.actual_cost || 0), 0)) >= 0 ? 'var(--brand-success)' : 'var(--brand-danger)' }}>
                                                                                ${(Number(rffDetails.total_requested_amount) - liqItems.reduce((acc, curr) => acc + Number(curr.actual_cost || 0), 0)).toFixed(2)}
                                                                            </td>
                                                                        </tr>
                                                                    </tbody>
                                                                </table>
                                                            </div>

                                                            <div className="form-group" style={{ marginBottom: '12px' }}>
                                                                <label className="form-label">Receipt File Link / Ref ID</label>
                                                                <input 
                                                                    type="text" 
                                                                    className="form-input"
                                                                    placeholder="e.g. Receipt_Invoice_BYO_102.pdf or image link"
                                                                    value={liqReceipts}
                                                                    onChange={e => setLiqReceipts(e.target.value)}
                                                                />
                                                            </div>

                                                            <div className="form-group" style={{ marginBottom: '16px' }}>
                                                                <label className="form-label">Liquidation Justification & Comments</label>
                                                                <textarea 
                                                                    className="form-input" 
                                                                    style={{ minHeight: '80px' }}
                                                                    placeholder="Detail any cost variations or outline activity outputs..."
                                                                    value={liqNotes}
                                                                    onChange={e => setLiqNotes(e.target.value)}
                                                                />
                                                            </div>

                                                            <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%' }} disabled={submittingLiq}>
                                                                {submittingLiq ? 'Submitting...' : 'Submit Activity Liquidation'}
                                                            </button>
                                                        </form>
                                                    )}

                                                    {rffDetails.liquidation && (rffDetails.liquidation.status === 'pending' || rffDetails.liquidation.status === 'verified') && (
                                                        <div style={{ marginTop: '16px' }}>
                                                            <div className="data-table-wrap">
                                                                <table className="data-table" style={{ fontSize: '12px' }}>
                                                                    <thead>
                                                                        <tr>
                                                                            <th>Budget Line Description</th>
                                                                            <th style={{ textAlign: 'right' }}>Budget Cost</th>
                                                                            <th style={{ textAlign: 'right' }}>Actual Spent</th>
                                                                        </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                        {rffDetails.liquidation.items?.map((item, idx) => (
                                                                            <tr key={idx}>
                                                                                <td>{item.description}</td>
                                                                                <td style={{ textAlign: 'right' }}>${Number(item.total_cost).toFixed(2)}</td>
                                                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>${Number(item.actual_cost || item.total_cost).toFixed(2)}</td>
                                                                            </tr>
                                                                        ))}
                                                                    </tbody>
                                                                </table>
                                                            </div>
                                                            <div style={{ marginTop: '12px', fontSize: '12px' }}>
                                                                <strong>Supporting Receipt Reference:</strong> {rffDetails.liquidation.receipts?.[0] || 'None'}
                                                            </div>

                                                            {rffDetails.liquidation.status === 'pending' && isFinanceReviewer && (
                                                                <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                                                                    <label className="form-label" style={{ fontWeight: 'bold' }}>Finance Verification Comment</label>
                                                                    <textarea 
                                                                        className="form-input" 
                                                                        style={{ minHeight: '60px', marginBottom: '12px' }}
                                                                        placeholder="Required comment..."
                                                                        value={liqComment}
                                                                        onChange={e => setLiqComment(e.target.value)}
                                                                    />
                                                                    <div style={{ display: 'flex', gap: '10px' }}>
                                                                        <button 
                                                                            type="button" 
                                                                            className="btn btn-success btn-sm"
                                                                            style={{ flex: 1 }}
                                                                            onClick={async () => {
                                                                                if (!liqComment) { alert('Comment is required for verification.'); return; }
                                                                                try {
                                                                                    await axios.post(`${API_BASE}/funding-requests/${rffDetails.id}/liquidate/verify`, {
                                                                                        action: 'verify',
                                                                                        comments: liqComment
                                                                                    });
                                                                                    alert('Liquidation verified and applied to budget!');
                                                                                    setLiqComment('');
                                                                                    fetchRffDetails(rffDetails.id);
                                                                                } catch (err) {
                                                                                    alert('Action failed: ' + (err.response?.data?.error || err.message));
                                                                                }
                                                                            }}
                                                                        >
                                                                            Verify & Commit Budget
                                                                        </button>
                                                                        <button 
                                                                            type="button" 
                                                                            className="btn btn-danger btn-sm"
                                                                            style={{ flex: 1 }}
                                                                            onClick={async () => {
                                                                                if (!liqComment) { alert('Comment is required for rejection.'); return; }
                                                                                try {
                                                                                    await axios.post(`${API_BASE}/funding-requests/${rffDetails.id}/liquidate/verify`, {
                                                                                        action: 'reject',
                                                                                        comments: liqComment
                                                                                    });
                                                                                    alert('Liquidation rejected!');
                                                                                    setLiqComment('');
                                                                                    fetchRffDetails(rffDetails.id);
                                                                                } catch (err) {
                                                                                    alert('Action failed: ' + (err.response?.data?.error || err.message));
                                                                                }
                                                                            }}
                                                                        >
                                                                            Reject & Return
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        <div>
                                            <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Digital Signatures</h3>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
                                                {selectedSub.signatures?.length > 0 ? selectedSub.signatures.map((sig, idx) => (
                                                    <div key={idx} style={{ padding: '12px', borderLeft: '3px solid var(--brand-success)', background: 'var(--surface-sunken)', borderRadius: '4px' }}>
                                                        <div style={{ fontWeight: 700, fontSize: '13px' }}>{sig.name}</div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sig.role.replace(/_/g, ' ')}</div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '11px', color: 'var(--brand-success)', fontWeight: 600 }}>
                                                            <Stamp size={12} /> {sig.action.toUpperCase()}D
                                                        </div>
                                                        {sig.comment && (
                                                            <div style={{ marginTop: '6px', fontSize: '12px', fontStyle: 'italic', color: 'var(--text-main)' }}>
                                                                "{sig.comment}"
                                                            </div>
                                                        )}
                                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                            {new Date(sig.timestamp).toLocaleString()}
                                                        </div>
                                                    </div>
                                                )) : (
                                                    <div className="empty-state mini">
                                                        <Clock size={20} />
                                                        <p>No signatures yet</p>
                                                    </div>
                                                )}
                                            </div>

                                            {activeTab === 'pending_actions' && selectedSub.status !== 'approved' && (
                                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                                                    <label className="form-label">Action Comments</label>
                                                    <textarea 
                                                        className="form-input" 
                                                        placeholder="Required for rejections/changes..."
                                                        value={comment}
                                                        onChange={e => setComment(e.target.value)}
                                                        style={{ minHeight: '80px', marginBottom: '12px' }}
                                                    />
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {isFinanceReviewer && selectedSub.status === 'submitted' && (
                                                            <button className="btn btn-success" onClick={() => handleAction(selectedSub.id, 'verify')} disabled={submitting}>
                                                                <UserCheck size={16} /> Verify & Pass to Director
                                                            </button>
                                                        )}
                                                        {user.role_code === 'DIRECTOR' && (selectedSub.status === 'verified' || selectedSub.submission_type !== 'leave_application') && (
                                                            <button className="btn btn-success" onClick={() => handleAction(selectedSub.id, 'approve')} disabled={submitting}>
                                                                <Stamp size={16} /> Authorize & Approve
                                                            </button>
                                                        )}
                                                        <button className="btn btn-warning btn-sm" onClick={() => handleAction(selectedSub.id, 'request_changes')} disabled={submitting}>
                                                            Request Changes
                                                        </button>
                                                        <button className="btn btn-danger btn-sm" onClick={() => handleAction(selectedSub.id, 'reject')} disabled={submitting}>
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )
                            ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                                    <div>
                                        <div style={{ marginBottom: '20px' }}>
                                            <span className={`badge badge-${getStatusColor(selectedSub.status)}`} style={{ marginBottom: '8px' }}>
                                                {selectedSub.status.toUpperCase()}
                                            </span>
                                            <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{selectedSub.title}</h2>
                                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                                Submitted by {selectedSub.submitter_name || 'Me'} on {new Date(selectedSub.created_at).toLocaleString()}
                                            </p>
                                        </div>

                                        <div className="panel" style={{ padding: '16px', marginBottom: '20px' }}>
                                            <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '10px' }}>Description</h3>
                                            <div style={{ fontSize: '14px', lineHeight: 1.6 }}>{selectedSub.description || 'No description provided.'}</div>
                                            
                                            {selectedSub.metadata?.start_date && (
                                                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--surface-sunken)', borderRadius: '8px', display: 'flex', gap: '20px' }}>
                                                    <div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>START</div>
                                                        <div style={{ fontWeight: 600 }}>{selectedSub.metadata.start_date}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>END</div>
                                                        <div style={{ fontWeight: 600 }}>{selectedSub.metadata.end_date}</div>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>TOTAL DAYS</div>
                                                        <div style={{ fontWeight: 600, color: 'var(--brand-primary)' }}>{selectedSub.metadata.days_requested}</div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {selectedSub.file_name && (
                                            <div className="panel" style={{ padding: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <FileText size={24} className="text-primary" />
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{selectedSub.file_name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Click to view attachment</div>
                                                </div>
                                                <button className="btn btn-ghost btn-sm"><Eye size={16} /> View</button>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <h3 style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px' }}>Digital Signatures</h3>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                            {selectedSub.signatures?.length > 0 ? selectedSub.signatures.map((sig, idx) => (
                                                <div key={idx} style={{ padding: '12px', borderLeft: '3px solid var(--brand-success)', background: 'var(--surface-sunken)', borderRadius: '4px' }}>
                                                    <div style={{ fontWeight: 700, fontSize: '13px' }}>{sig.name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{sig.role.replace(/_/g, ' ')}</div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '11px', color: 'var(--brand-success)', fontWeight: 600 }}>
                                                        <Stamp size={12} /> {sig.action.toUpperCase()}D
                                                    </div>
                                                    {sig.comment && (
                                                        <div style={{ marginTop: '6px', fontSize: '12px', fontStyle: 'italic', color: 'var(--text-main)' }}>
                                                            "{sig.comment}"
                                                        </div>
                                                    )}
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                                        {new Date(sig.timestamp).toLocaleString()}
                                                    </div>
                                                </div>
                                            )) : (
                                                <div className="empty-state mini">
                                                    <Clock size={20} />
                                                    <p>No signatures yet</p>
                                                </div>
                                            )}
                                        </div>

                                        {activeTab === 'pending_actions' && selectedSub.status !== 'approved' && (
                                            <div style={{ marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
                                                <label className="form-label">Action Comments</label>
                                                <textarea 
                                                    className="form-input" 
                                                    placeholder="Required for rejections/changes..."
                                                    value={comment}
                                                    onChange={e => setComment(e.target.value)}
                                                    style={{ minHeight: '80px', marginBottom: '12px' }}
                                                />
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                    {isFinanceReviewer && selectedSub.status === 'submitted' && (
                                                        <button className="btn btn-success" onClick={() => handleAction(selectedSub.id, 'verify')} disabled={submitting}>
                                                            <UserCheck size={16} /> Verify & Pass to Director
                                                        </button>
                                                    )}
                                                    {user.role_code === 'DIRECTOR' && (selectedSub.status === 'verified' || selectedSub.submission_type !== 'leave_application') && (
                                                        <button className="btn btn-success" onClick={() => handleAction(selectedSub.id, 'approve')} disabled={submitting}>
                                                            <Stamp size={16} /> Authorize & Approve
                                                        </button>
                                                    )}
                                                    <button className="btn btn-warning btn-sm" onClick={() => handleAction(selectedSub.id, 'request_changes')} disabled={submitting}>
                                                        Request Changes
                                                    </button>
                                                    <button className="btn btn-danger btn-sm" onClick={() => handleAction(selectedSub.id, 'reject')} disabled={submitting}>
                                                        Reject
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSelectedSub(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
