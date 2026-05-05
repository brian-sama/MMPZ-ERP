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
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.display_type?.toUpperCase() || item.entity_type.replace('_', ' ').toUpperCase()}</div>
                                            <div className="form-hint">ID: {item.entity_id.slice(0, 8)}</div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <User size={16} style={{ color: 'var(--text-muted)' }} />
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{item.requester_name}</div>
                                                    <div className="form-hint">{item.requester_role}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Clock size={14} style={{ color: 'var(--text-muted)' }} />
                                                <div>
                                                    <div>{new Date(item.created_at).toLocaleDateString()}</div>
                                                    <div className="form-hint">{new Date(item.created_at).toLocaleTimeString()}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detail Panel */}
                {selectedItem && (
                    <div className="panel" style={{ flex: '1' }}>
                        <div className="panel-header">
                            <h2 className="panel-title">Request Details</h2>
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

                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <div className="form-label">Request Type</div>
                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>
                                        {selectedItem.display_type?.toUpperCase() || selectedItem.entity_type?.replace('_', ' ').toUpperCase()}
                                    </div>
                                </div>
                                <div>
                                    <div className="form-label">Status</div>
                                    <div className={`badge ${selectedItem.status === 'approved' ? 'badge-success' : selectedItem.status === 'rejected' ? 'badge-danger' : 'badge-muted'}`}>
                                        {selectedItem.status?.toUpperCase() || 'PENDING'}
                                    </div>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' }}>
                                <div>
                                    <div className="form-label">Requester</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <User size={16} style={{ color: 'var(--text-muted)' }} />
                                        <div>
                                            <div style={{ fontWeight: 600, fontSize: '14px' }}>{selectedItem.requester_name}</div>
                                            <div className="form-hint">{selectedItem.requester_role}</div>
                                        </div>
                                    </div>
                                </div>
                                <div>
                                    <div className="form-label">Date Requested</div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                                        <div>
                                            <div>{new Date(selectedItem.created_at).toLocaleDateString()}</div>
                                            <div className="form-hint">{new Date(selectedItem.created_at).toLocaleTimeString()}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {selectedItem.entity_data && (
                            <div style={{ marginBottom: '16px' }}>
                                <div className="form-label">Request Details</div>
                                <div className="surface-muted" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                                    {Object.entries(selectedItem.entity_data).map(([key, value]) => (
                                        <div key={key} style={{ marginBottom: '8px' }}>
                                            <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                {key.replace(/_/g, ' ').toUpperCase()}
                                            </div>
                                            <div style={{ fontSize: '13px' }}>
                                                {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {selectedItem.attachments && selectedItem.attachments.length > 0 && (
                            <div style={{ marginBottom: '16px' }}>
                                <div className="form-label">Attachments</div>
                                {selectedItem.attachments.map((attachment, index) => (
                                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '8px' }}>
                                        <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{attachment.filename}</div>
                                            <div className="form-hint">{attachment.file_size}</div>
                                        </div>
                                        <a 
                                            href={attachment.url} 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="btn btn-ghost btn-sm"
                                        >
                                            <ExternalLink size={14} />
                                            View
                                        </a>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedItem.comments && (
                            <div style={{ marginBottom: '16px' }}>
                                <div className="form-label">Comments</div>
                                <div className="surface-muted" style={{ padding: '16px', borderRadius: 'var(--radius-md)' }}>
                                    <div style={{ whiteSpace: 'pre-wrap', fontSize: '13px' }}>
                                        {selectedItem.comments}
                                    </div>
                                </div>
                            </div>
                        )}

                        {canAction && selectedItem.status === 'pending' && (
                            <div>
                                <div className="form-label">Action & Comments</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <textarea
                                    className="form-textarea"
                                    placeholder="Add comments for this action..."
                                    value={comments}
                                    onChange={(e) => setComments(e.target.value)}
                                    rows={3}
                                />
                            </div>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button
                                    className="btn btn-success"
                                    onClick={() => handleAction('approve')}
                                    disabled={actionLoading || !comments.trim()}
                                >
                                    <CheckCircle2 size={16} />
                                    Approve
                                </button>
                                <button
                                    className="btn btn-danger"
                                    onClick={() => handleAction('reject')}
                                    disabled={actionLoading || !comments.trim()}
                                >
                                    <XCircle size={16} />
                                    Reject
                                </button>
                            </div>
                        </div>
                    )}

                    {!canAction && selectedItem.status === 'pending' && (
                        <div className="page-message error">
                            <AlertTriangle size={16} style={{ marginRight: '8px' }} />
                            You don't have permission to approve or reject requests. Only users with DIRECTOR role can take action.
                        </div>
                    )}
                </div>
                )}
            </div>
        </div>
    );
}
