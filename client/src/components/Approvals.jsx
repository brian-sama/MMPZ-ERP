import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    AlertCircle,
    CheckCircle,
    Clock,
    Link as LinkIcon,
    TrendingUp,
    XCircle,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import Pagination from './Pagination';
import usePagination from '../hooks/usePagination';

export default function Approvals({ user }) {
    const [pending, setPending] = useState({ progress: [], kobo: [] });
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [loading, setLoading] = useState(true);

    const { currentData: paginatedKobo, currentPage: koboPage, totalPages: koboTotalPages, goToPage: setKoboPage } = usePagination(pending.kobo, 5);
    const { currentData: paginatedProgress, currentPage: progressPage, totalPages: progressTotalPages, goToPage: setProgressPage } = usePagination(pending.progress, 5);

    useEffect(() => {
        fetchApprovals();
    }, []);

    const fetchApprovals = async () => {
        try {
            const res = await axios.get(`${API_BASE}/approvals`, {
                params: { role: user.role, userId: user.id },
            });
            if (Array.isArray(res.data)) {
                setPending({ progress: res.data, kobo: [] });
            } else {
                setPending(res.data || { progress: [], kobo: [] });
            }
        } catch (err) {
            console.error('Fetch approvals error', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (id, type, action) => {
        try {
            await axios.patch(`${API_BASE}/approvals`, {
                id,
                type,
                action,
                userId: user.id,
                userRole: user.role,
            });
            setMsg({
                type: 'success',
                text: `${type === 'kobo_link' ? 'Request' : 'Update'} ${action} successfully.`,
            });
            fetchApprovals();
        } catch (err) {
            setMsg({ type: 'error', text: 'Action failed. Please try again.' });
        }
    };

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner" />
                <p>Loading pending approvals...</p>
            </div>
        );
    }

    return (
        <div className="content-stack fade-in">
            <div>
                <h1 className="page-title">Approvals Center</h1>
                <p className="page-subtitle">Review pending progress updates and Kobo link requests.</p>
            </div>

            {msg.text && (
                <div className={`page-alert ${msg.type === 'error' ? 'error' : 'success'}`}>
                    {msg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                    <p>{msg.text}</p>
                </div>
            )}

            <div className="panels-row">
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Kobo Link Requests</h2>
                            <p className="panel-subtitle">Forms waiting to be attached to project indicators.</p>
                        </div>
                        <span className="badge badge-warning">{pending.kobo.length} Pending</span>
                    </div>

                    {pending.kobo.length === 0 ? (
                        <div className="empty-state" style={{ padding: '32px 16px' }}>
                            <div className="empty-state-icon">
                                <LinkIcon size={24} />
                            </div>
                            <div className="empty-state-title">No pending link requests</div>
                            <p className="empty-state-text">New Kobo approval items will appear here.</p>
                        </div>
                    ) : (
                        <div className="stack-list">
                            {paginatedKobo.map((request) => (
                                <div key={request.id} className="status-card">
                                    <div className="status-card-header">
                                        <div>
                                            <div className="status-card-title">{request.kobo_form_name}</div>
                                            <div className="status-card-copy">
                                                Requested by {request.updated_by_name || 'Unknown Volunteer'}
                                            </div>
                                        </div>
                                        <span className="badge badge-warning">
                                            <Clock size={12} />
                                            Pending
                                        </span>
                                    </div>
                                    <div className="status-card-meta">
                                        Target indicator: <strong>{request.indicator_title}</strong>
                                    </div>
                                    <div className="status-card-actions">
                                        <button className="btn btn-primary btn-sm" onClick={() => handleAction(request.id, 'kobo_link', 'approved')}>
                                            <CheckCircle size={14} />
                                            Approve
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleAction(request.id, 'kobo_link', 'rejected')}>
                                            <XCircle size={14} />
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <Pagination currentPage={koboPage} totalPages={koboTotalPages} onPageChange={setKoboPage} />
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Progress Updates</h2>
                            <p className="panel-subtitle">Indicator changes that need review before publication.</p>
                        </div>
                        <span className="badge badge-info">{pending.progress.length} Pending</span>
                    </div>

                    {pending.progress.length === 0 ? (
                        <div className="empty-state" style={{ padding: '32px 16px' }}>
                            <div className="empty-state-icon">
                                <TrendingUp size={24} />
                            </div>
                            <div className="empty-state-title">No pending progress updates</div>
                            <p className="empty-state-text">Approved reporting requests will clear this queue automatically.</p>
                        </div>
                    ) : (
                        <div className="stack-list">
                            {paginatedProgress.map((request) => (
                                <div key={request.id} className="status-card">
                                    <div className="status-card-header">
                                        <div>
                                            <div className="status-card-title">{request.indicator_title}</div>
                                            <div className="status-card-copy">Updated by {request.updated_by_name}</div>
                                        </div>
                                        <span className="badge badge-info">
                                            {new Date(request.update_date).toLocaleDateString()}
                                        </span>
                                    </div>

                                    <div className="form-row">
                                        <div className="status-card-meta">
                                            Previous value: <strong>{request.previous_value}</strong>
                                        </div>
                                        <div className="status-card-meta">
                                            New value: <strong>{request.new_value}</strong>
                                        </div>
                                    </div>

                                    {request.notes && (
                                        <div className="status-card-meta">
                                            <strong>Notes:</strong> {request.notes}
                                        </div>
                                    )}

                                    <div className="status-card-actions">
                                        <button className="btn btn-primary btn-sm" onClick={() => handleAction(request.id, 'progress_update', 'approved')}>
                                            <CheckCircle size={14} />
                                            Approve
                                        </button>
                                        <button className="btn btn-danger btn-sm" onClick={() => handleAction(request.id, 'progress_update', 'rejected')}>
                                            <XCircle size={14} />
                                            Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <Pagination currentPage={progressPage} totalPages={progressTotalPages} onPageChange={setProgressPage} />
                </div>
            </div>
        </div>
    );
}
