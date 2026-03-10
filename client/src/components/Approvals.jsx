
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE from '../apiConfig';
import { CheckCircle, XCircle, Link, TrendingUp, AlertCircle, Clock } from 'lucide-react';
import Pagination from './Pagination';
import usePagination from '../hooks/usePagination';

const Approvals = ({ user }) => {
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
                params: { role: user.role, userId: user.id }
            });
            // Handle both legacy array (if backend not deployed yet) and new object
            if (Array.isArray(res.data)) {
                setPending({ progress: res.data, kobo: [] });
            } else {
                setPending(res.data);
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
                userRole: user.role
            });
            setMsg({ type: 'success', text: `${type === 'kobo_link' ? 'Request' : 'Update'} ${action} successfully.` });
            fetchApprovals();
        } catch (err) {
            setMsg({ type: 'error', text: 'Action failed. Please try again.' });
        }
    };

    if (loading) return <div className="p-8 text-center text-slate-500"><Clock className="animate-spin mx-auto mb-2" /> Loading pending approvals...</div>;

    return (
        <div className="space-y-8 animate-slideIn">
            <header>
                <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Approvals Center</h1>
                <p className="text-slate-500 mt-1">Review and action pending requests.</p>
            </header>

            {msg.text && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${msg.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-100' : 'bg-emerald-50 text-emerald-700 border border-emerald-100'}`}>
                    {msg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    <span className="font-medium">{msg.text}</span>
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Kobo Link Requests */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                        <span className="p-1.5 bg-orange-100 text-orange-600 rounded-lg"><Link size={18} /></span>
                        Kobo Link Requests
                        <span className="ml-auto text-xs font-medium bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                            {pending.kobo.length} Pending
                        </span>
                    </h3>

                    {pending.kobo.length === 0 ? (
                        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
                            No pending link requests.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {paginatedKobo.map(req => (
                                <div key={req.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">{req.kobo_form_name}</h4>
                                            <p className="text-sm text-slate-500">Requested by <span className="font-semibold text-slate-700 dark:text-slate-300">{req.updated_by_name || 'Unknown Volunteer'}</span></p>
                                        </div>
                                        <div className="px-2 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-lg border border-amber-100">
                                            Pending
                                        </div>
                                    </div>
                                    <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-sm border border-slate-100 dark:border-slate-800">
                                        <span className="text-slate-500">Target Indicator:</span>
                                        <div className="font-semibold text-slate-800 dark:text-slate-200">{req.indicator_title}</div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAction(req.id, 'kobo_link', 'approved')}
                                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={16} /> Approve
                                        </button>
                                        <button
                                            onClick={() => handleAction(req.id, 'kobo_link', 'rejected')}
                                            className="flex-1 py-2 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={16} /> Reject
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                        <Pagination currentPage={koboPage} totalPages={koboTotalPages} onPageChange={setKoboPage} />
                </div>

                {/* Progress Update Requests */}
                <div className="space-y-4">
                    <h3 className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                        <span className="p-1.5 bg-blue-100 text-blue-600 rounded-lg"><TrendingUp size={18} /></span>
                        Progress Updates
                        <span className="ml-auto text-xs font-medium bg-slate-100 px-2 py-1 rounded-full text-slate-600">
                            {pending.progress.length} Pending
                        </span>
                    </h3>

                    {pending.progress.length === 0 ? (
                        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 text-slate-400">
                            No pending progress updates.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {paginatedProgress.map(req => (
                                <div key={req.id} className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                                    <div className="flex justify-between items-start mb-3">
                                        <div>
                                            <h4 className="font-bold text-slate-900 dark:text-white">{req.indicator_title}</h4>
                                            <p className="text-sm text-slate-500">Updated by <span className="font-semibold text-slate-700 dark:text-slate-300">{req.updated_by_name}</span></p>
                                        </div>
                                        <div className="text-xs text-slate-400">
                                            {new Date(req.update_date).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <div className="mb-4 flex items-center gap-4">
                                        <div className="flex-1 p-3 bg-slate-50 dark:bg-slate-900 rounded-xl text-center border border-slate-100 dark:border-slate-800">
                                            <div className="text-xs text-slate-400 uppercase font-bold">Previous</div>
                                            <div className="text-lg font-bold text-slate-600 dark:text-slate-400">{req.previous_value}</div>
                                        </div>
                                        <div className="text-slate-300"><TrendingUp size={20} /></div>
                                        <div className="flex-1 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-center border border-emerald-100 dark:border-emerald-900/30">
                                            <div className="text-xs text-emerald-600/70 uppercase font-bold">New Value</div>
                                            <div className="text-lg font-bold text-emerald-700 dark:text-emerald-400">{req.new_value}</div>
                                        </div>
                                    </div>
                                    {req.notes && (
                                        <div className="mb-4 text-sm text-slate-600 italic bg-amber-50 p-2 rounded-lg">
                                            "{req.notes}"
                                        </div>
                                    )}
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleAction(req.id, 'progress_update', 'approved')}
                                            className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle size={16} /> Approve
                                        </button>
                                        <button
                                            onClick={() => handleAction(req.id, 'progress_update', 'rejected')}
                                            className="flex-1 py-2 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-600 font-bold rounded-xl text-sm transition-colors flex items-center justify-center gap-2"
                                        >
                                            <XCircle size={16} /> Reject
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
};

export default Approvals;
