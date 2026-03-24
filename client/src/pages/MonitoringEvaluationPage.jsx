import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import {
    BarChart3, Target, TrendingUp, Filter, Search,
    ExternalLink, Clock, Plus, Download, AlertCircle,
    ChevronRight, Calendar, RefreshCw, Info, Database
} from 'lucide-react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, LineChart, Line
} from 'recharts';

export default function MonitoringEvaluationPage() {
    const { user } = useAuth();
    const [indicators, setIndicators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [performance, setPerformance] = useState([]);
    const [selectedInd, setSelectedInd] = useState(null);
    const [showReportForm, setShowReportForm] = useState(false);

    // KoBo State
    const [koboLinks, setKoboLinks] = useState([]);
    const [syncing, setSyncing] = useState(false);

    // Form State
    const [reportValue, setReportValue] = useState('');
    const [reportNotes, setReportNotes] = useState('');

    useEffect(() => {
        fetchMEData();
        fetchKoboLinks();
    }, []);

    const fetchKoboLinks = async () => {
        try {
            const res = await axios.get(`${API_BASE}/kobo/links`, { params: { userId: user.id } });
            setKoboLinks(res.data);
        } catch (err) {
            console.error('Failed to fetch KoBo links');
        }
    };

    const handleSync = async (linkId = null) => {
        setSyncing(true);
        try {
            const endpoint = linkId ? `${API_BASE}/kobo/sync/${linkId}` : `${API_BASE}/kobo/sync-all`;
            const res = await axios.post(endpoint, { userId: user.id });
            alert(res.data.message || 'Sync successful');
            fetchMEData();
            fetchKoboLinks();
        } catch (err) {
            alert('Sync failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSyncing(false);
        }
    };

    const fetchMEData = async () => {
        setLoading(true);
        try {
            const indRes = await axios.get(`${API_BASE}/indicators`, { params: { userId: user.id } });
            setIndicators(indRes.data);

            const perfRes = await axios.get(`${API_BASE}/me/summary`, { params: { userId: user.id } });
            setPerformance(perfRes.data.reverse());
        } catch (err) {
            console.error('Failed to fetch M&E data');
        } finally {
            setLoading(false);
        }
    };

    const handleReportProgress = async (e) => {
        e.preventDefault();
        if (!selectedInd || !reportValue) return;

        try {
            const period = new Date().toISOString().slice(0, 7); // YYYY-MM
            await axios.post(`${API_BASE}/me/progress`, {
                indicator_id: selectedInd.id,
                reporting_period: period,
                value: parseInt(reportValue),
                notes: reportNotes,
                userId: user.id
            });
            setShowReportForm(false);
            setReportValue('');
            setReportNotes('');
            fetchMEData();
        } catch (err) {
            alert('Failed to submit progress report');
        }
    };

    if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

    return (
        <div className="fade-in">
            <PageHeader
                title="Monitoring & Evaluation"
                subtitle="Track organizational indicators, verify field evidence, and analyze performance trends."
                actions={
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm"><Download size={16} /> Export Framework</button>
                        <button className="btn btn-primary btn-sm"><Plus size={16} /> New Indicator</button>
                    </div>
                }
            />

            <div className="kpi-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="kpi-card info">
                        <div className="kpi-icon-wrap"><Target size={22} /></div>
                        <div className="kpi-label">Indicators Tracking</div>
                        <div className="kpi-value">{indicators.length}</div>
                        <div className="kpi-sub">{indicators.filter(i => i.status === 'active').length} active targets</div>
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title">Cumulative Performance</h2>
                        </div>
                        <div style={{ height: '200px', width: '100%', padding: '0 10px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={performance}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="reporting_period" hide />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                        itemStyle={{ color: 'var(--text-primary)' }}
                                    />
                                    <Bar dataKey="total_reached" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                            Actual Reached vs Targets (Last 6 Months)
                        </div>
                    </div>

                    <div className="panel" style={{ borderTop: '4px solid var(--brand-primary)' }}>
                        <div className="panel-header" style={{ border: 'none', paddingBottom: '0' }}>
                            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <RefreshCw size={16} className={syncing ? 'spin' : ''} /> External Data Sync
                            </h2>
                        </div>
                        <div style={{ padding: '20px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <div>
                                    <div style={{ fontSize: '13px', fontWeight: 600 }}>KoBoToolbox Connection</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{koboLinks.length} active form bridges</div>
                                </div>
                                <button 
                                    className="btn btn-secondary btn-sm" 
                                    onClick={() => handleSync()} 
                                    disabled={syncing || koboLinks.length === 0}
                                >
                                    {syncing ? 'Syncing...' : 'Sync All'}
                                </button>
                            </div>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {koboLinks.slice(0, 3).map(link => (
                                    <div key={link.id} style={{ fontSize: '12px', padding: '10px', background: 'var(--bg-app)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>
                                            <div style={{ fontWeight: 600 }}>{link.kobo_form_name}</div>
                                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>Linked to: {link.indicator_title}</div>
                                        </div>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleSync(link.id)} disabled={syncing}>
                                            <RefreshCw size={12} />
                                        </button>
                                    </div>
                                ))}
                                {koboLinks.length === 0 && (
                                    <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: '8px' }}>
                                        No KoBo forms linked.
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h2 className="panel-title">Strategic Indicator Framework</h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div className="search-box">
                                <Search size={14} className="search-icon" />
                                <input type="text" placeholder="Filter indicators..." className="form-input" style={{ height: '32px', fontSize: '12px' }} />
                            </div>
                        </div>
                    </div>

                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Indicator / Priority</th>
                                    <th>Current vs Target</th>
                                    <th>Progress</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {indicators.map(ind => (
                                    <tr key={ind.id} onClick={() => setSelectedInd(ind)} style={{ cursor: 'pointer' }} className={selectedInd?.id === ind.id ? 'active-row' : ''}>
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{ind.title}</div>
                                            <span className={`badge badge-${ind.priority === 'critical' ? 'danger' : ind.priority === 'high' ? 'warning' : 'primary'}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                                                {ind.priority.toUpperCase()}
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: '14px', fontWeight: 700 }}>{ind.current_value.toLocaleString()}</div>
                                            <div className="form-hint">of {ind.target_value.toLocaleString()} targeted</div>
                                        </td>
                                        <td style={{ width: '150px' }}>
                                            <div className="progress-bar-wrap" style={{ height: '6px', marginBottom: '4px' }}>
                                                <div
                                                    className="progress-bar-fill"
                                                    style={{
                                                        width: `${ind.progress_percentage}%`,
                                                        background: ind.progress_percentage > 90 ? 'var(--brand-success)' : ind.progress_percentage > 50 ? 'var(--brand-primary)' : 'var(--brand-warning)'
                                                    }}
                                                ></div>
                                            </div>
                                            <div style={{ fontSize: '11px', fontWeight: 600 }}>{ind.progress_percentage}% achieved</div>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                {koboLinks.some(l => l.indicator_id === ind.id) && (
                                                    <div title="Synced with KoBo" style={{ color: 'var(--brand-primary)', display: 'flex', alignItems: 'center' }}>
                                                        <Database size={14} />
                                                    </div>
                                                )}
                                                <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedInd(ind); setShowReportForm(true); }}>
                                                    Report
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Reporting Modal */}
            {showReportForm && selectedInd && (
                <div className="modal-overlay" onClick={() => setShowReportForm(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="kpi-icon-wrap" style={{ width: '32px', height: '32px', background: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}><TrendingUp size={16} /></div>
                                <div>
                                    <div className="modal-title" style={{ fontSize: '16px' }}>Report Progress</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{selectedInd.title}</div>
                                </div>
                            </div>
                            <button className="modal-close" onClick={() => setShowReportForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleReportProgress}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">New Value Reached (This Period)</label>
                                    <input
                                        type="number"
                                        className="form-input"
                                        placeholder="e.g. 15"
                                        value={reportValue}
                                        onChange={(e) => setReportValue(e.target.value)}
                                        required
                                    />
                                    <p className="form-hint"><Info size={12} /> This will be added to the current total of {selectedInd.current_value}.</p>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Evidence / Notes</label>
                                    <textarea
                                        className="form-input"
                                        style={{ height: '100px', padding: '12px' }}
                                        placeholder="Describe implementation activities or link to evidence..."
                                        value={reportNotes}
                                        onChange={(e) => setReportNotes(e.target.value)}
                                    ></textarea>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowReportForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">Submit Report</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
