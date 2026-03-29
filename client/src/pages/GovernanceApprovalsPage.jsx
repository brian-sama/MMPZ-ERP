import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
    ShieldCheck, Clock, CheckCircle2, XCircle,
    MessageSquare, User, FileText, ChevronRight,
    Search, Filter, ExternalLink, AlertTriangle
} from 'lucide-react';

export default function GovernanceApprovalsPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [queue, setQueue] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedItem, setSelectedItem] = useState(null);
    const [comments, setComments] = useState('');
    const [actionLoading, setActionLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const canAction = user?.role_code === 'DIRECTOR';

    useEffect(() => {
        fetchQueue();
    }, []);

    useEffect(() => {
        const approvalId = searchParams.get('approvalId');
        if (approvalId) {
            fetchDetail(approvalId);
        }
    }, [searchParams]);

    const fetchQueue = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/governance/queue`, { params: { userId: user.id } });
            setQueue(res.data);
        } catch (err) {
            console.error('Failed to fetch governance queue');
        } finally {
            setLoading(false);
        }
    };

    const fetchDetail = async (id) => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/governance/${id}`, { params: { userId: user.id } });
            setSelectedItem(res.data);
            setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.set('approvalId', id);
                return next;
            });
        } catch (err) {
            console.error('Failed to fetch approval details');
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (action) => {
        if (!selectedItem || actionLoading) return;
        setActionLoading(true);
        try {
            await axios.post(`${API_BASE}/governance/action`, {
                approval_id: selectedItem.id,
                action,
                comments,
                userId: user.id
            });
            setComments('');
            setSelectedItem(null);
            setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.delete('approvalId');
                return next;
            });
            fetchQueue();
        } catch (err) {
            alert('Failed to process approval action');
        } finally {
            setActionLoading(false);
        }
    };

    if (loading && !selectedItem) return <div className="page-loading"><div className="spinner"></div></div>;

    return (
        <div className="fade-in">
            <PageHeader
                title="Governance & Approvals"
                subtitle="Centralized organizational oversight and compliance queue."
            />

            <div className="panels-row">
                {/* Queue Panel */}
                <div className="panel" style={{ flex: selectedItem ? '0 0 400px' : '1' }}>
                    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h2 className="panel-title">Active Queue ({queue.filter(q => q.status === 'pending').length})</h2>
                        <div className="search-box" style={{ width: '180px' }}>
                            <Search size={14} className="search-icon" />
                            <input 
                                type="text" 
                                placeholder="Filter queue..." 
                                className="form-input" 
                                style={{ height: '30px', fontSize: '12px', paddingLeft: '28px' }} 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Request</th>
                                    <th>Requester</th>
                                    <th>Date</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {queue.filter(q => 
                                    (q.entity_type || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                                    (q.requester_name || '').toLowerCase().includes(searchTerm.toLowerCase())
                                ).map(item => (
                                    <tr
                                        key={item.id}
                                        className={`${item.status === 'pending' ? 'priority-high' : ''} ${selectedItem?.id === item.id ? 'active-row' : ''}`}
                                        onClick={() => fetchDetail(item.id)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.entity_type.replace('_', ' ').toUpperCase()}</div>
                                            <div className="form-hint">ID: {item.entity_id.slice(0, 8)}</div>
                                        </td>
                                        <td>{item.requester_name}</td>
                                        <td>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <ChevronRight size={16} className="text-muted" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {queue.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon"><CheckCircle2 size={32} /></div>
                                <div className="empty-state-title">No pending approvals</div>
                                <p className="empty-state-text">Your governance queue is currently empty.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Action Panel */}
                {selectedItem && (
                    <div className="panel animate-slide-in">
                        <div className="panel-header">
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <div className="kpi-icon-wrap" style={{ background: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}>
                                        <ShieldCheck size={20} />
                                    </div>
                                    <div>
                                        <h2 className="panel-title" style={{ textTransform: 'capitalize' }}>{selectedItem.entity_type.replace('_', ' ')} Review</h2>
                                        <p className="panel-subtitle">Governance Audit ID: {selectedItem.id.slice(0, 13)}</p>
                                    </div>
                                </div>
                                <button
                                    className="btn btn-ghost btn-sm"
                                    onClick={() => {
                                        setSelectedItem(null);
                                        setSearchParams((current) => {
                                            const next = new URLSearchParams(current);
                                            next.delete('approvalId');
                                            return next;
                                        });
                                    }}
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div style={{ padding: '24px' }}>
                            <div className="kpi-card info" style={{ marginBottom: '24px', background: 'var(--bg-app)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div className="form-hint">Current Status</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                            <span className={`badge badge-${selectedItem.status === 'pending' ? 'warning' : 'success'}`}>
                                                {selectedItem.status.toUpperCase()}
                                            </span>
                                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Step {selectedItem.current_step} of workflow</span>
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div className="form-hint">Requested By</div>
                                        <div style={{ fontWeight: 600, fontSize: '14px' }}>{selectedItem.requester_name}</div>
                                    </div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FileText size={16} className="text-muted" /> Transaction Details
                                </h3>
                                <div style={{ background: 'var(--bg-app)', padding: '16px', borderRadius: '8px', border: '1px dashed var(--border)' }}>
                                    {selectedItem.procurement ? (
                                        <div style={{ display: 'grid', gap: '12px' }}>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                <strong>{selectedItem.procurement.title}</strong> totals{' '}
                                                <strong>{Number(selectedItem.procurement.total_estimated_cost || 0).toLocaleString()}</strong> USD
                                                and is linked to {selectedItem.procurement.project_name || 'an unassigned project'}.
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                {selectedItem.procurement.policy?.control_note || 'Review itemization, budget line and procurement evidence before actioning.'}
                                            </div>
                                            <div className="data-table-wrap">
                                                <table className="data-table">
                                                    <thead>
                                                        <tr>
                                                            <th>Description</th>
                                                            <th>Qty</th>
                                                            <th>Unit Cost</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {selectedItem.procurement.items?.map((item) => (
                                                            <tr key={item.id}>
                                                                <td>{item.description}</td>
                                                                <td>{item.quantity}</td>
                                                                <td>{Number(item.estimated_unit_cost || 0).toLocaleString()}</td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            </div>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                style={{ marginTop: '12px', color: 'var(--brand-primary)' }}
                                                onClick={() => navigate(`/finance?procurement=${selectedItem.entity_id}`)}
                                            >
                                                <ExternalLink size={14} style={{ marginRight: '6px' }} /> Cross-reference Entity Record
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                                The system has linked this request to entity <strong>{selectedItem.entity_id}</strong>.
                                                Please review the primary module's record for detailed breakdown of items and costs.
                                            </div>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                style={{ marginTop: '12px', color: 'var(--brand-primary)' }}
                                                onClick={() => {
                                                    if (selectedItem.entity_type === 'procurement') {
                                                        navigate(`/finance?procurement=${selectedItem.entity_id}`);
                                                    }
                                                }}
                                            >
                                                <ExternalLink size={14} style={{ marginRight: '6px' }} /> Cross-reference Entity Record
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Approval Actions</h3>
                                <textarea
                                    className="form-input"
                                    placeholder="Enter review comments or justification..."
                                    style={{ height: '100px', marginBottom: '16px', padding: '12px' }}
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                ></textarea>

                                {selectedItem.status === 'pending' && canAction && (
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button
                                            className="btn btn-primary"
                                            style={{ flex: 1 }}
                                            onClick={() => handleAction('approve')}
                                            disabled={actionLoading}
                                        >
                                            <CheckCircle2 size={18} style={{ marginRight: '8px' }} /> {actionLoading ? 'Processing...' : 'Approve Request'}
                                        </button>
                                        <button
                                            className="btn btn-danger"
                                            style={{ flex: 1 }}
                                            onClick={() => handleAction('reject')}
                                            disabled={actionLoading}
                                        >
                                            <XCircle size={18} style={{ marginRight: '8px' }} /> {actionLoading ? 'Processing...' : 'Reject / Send Back'}
                                        </button>
                                    </div>
                                )}
                                {selectedItem.status === 'pending' && !canAction && (
                                    <div className="form-hint">
                                        Queue visibility is enabled for oversight roles, but only the Director can record the final approval action.
                                    </div>
                                )}
                            </div>

                            <div className="divider" style={{ margin: '24px 0' }}></div>

                            <div>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Clock size={16} className="text-muted" /> Audit History
                                </h3>
                                <div className="timeline">
                                    {selectedItem.logs?.map((log, idx) => (
                                        <div key={log.id} style={{ display: 'flex', gap: '16px', marginBottom: '20px', position: 'relative' }}>
                                            <div style={{
                                                width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-surface)',
                                                border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                zIndex: 1
                                            }}>
                                                {log.action === 'approve' ? <CheckCircle2 size={16} color="var(--brand-success)" /> : <XCircle size={16} color="var(--brand-danger)" />}
                                            </div>
                                            <div style={{ flex: 1 }}>
                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{log.actor_name}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(log.created_at).toLocaleString()}</div>
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                    {log.comments || 'No comments provided.'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                    {(!selectedItem.logs || selectedItem.logs.length === 0) && (
                                        <div className="form-hint" style={{ textAlign: 'center', padding: '20px' }}>No audit history for this request yet.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
