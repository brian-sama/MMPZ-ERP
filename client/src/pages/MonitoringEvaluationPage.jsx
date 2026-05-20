import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import {
    BarChart3, Target, TrendingUp, Filter, Search,
    ExternalLink, Clock, Plus, Download, AlertCircle,
    ChevronRight, Calendar, RefreshCw, Info, Database,
    Link as LinkIcon, Unlink, Eye
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
    const [riskSummary, setRiskSummary] = useState(null);
    const [selectedInd, setSelectedInd] = useState(null);
    const [showReportForm, setShowReportForm] = useState(false);
    const [showIndicatorForm, setShowIndicatorForm] = useState(false);
    const [projects, setProjects] = useState([]);
    const [indicatorSearch, setIndicatorSearch] = useState('');
    const [creatingIndicator, setCreatingIndicator] = useState(false);
    const [newIndicator, setNewIndicator] = useState({
        title: '',
        project_id: '',
        target_value: '',
        total_budget: '',
        priority: 'medium',
    });

    // KoBo State
    const [koboConfig, setKoboConfig] = useState(null);
    const [koboForms, setKoboForms] = useState([]);
    const [koboLinks, setKoboLinks] = useState([]);
    const [koboLoading, setKoboLoading] = useState(false);
    const [koboLinkSelections, setKoboLinkSelections] = useState({});
    const [koboFields, setKoboFields] = useState({});
    const [inspectingForm, setInspectingForm] = useState('');
    const [syncing, setSyncing] = useState(false);

    // Form State
    const [reportValue, setReportValue] = useState('');
    const [reportNotes, setReportNotes] = useState('');
    const hasPerformanceData = performance.length > 0;

    useEffect(() => {
        fetchMEData();
        fetchKoboWorkspace();
    }, []);

    const fetchKoboWorkspace = async () => {
        setKoboLoading(true);
        try {
            const [configRes, linkRes] = await Promise.all([
                axios.get(`${API_BASE}/kobo/config`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/kobo/links`, { params: { userId: user.id } }),
            ]);
            setKoboConfig(configRes.data || null);
            setKoboLinks(linkRes.data || []);

            if (configRes.data?.is_connected) {
                const formsRes = await axios.get(`${API_BASE}/kobo/forms`, { params: { userId: user.id } });
                setKoboForms(formsRes.data || []);
            } else {
                setKoboForms([]);
            }
        } catch (err) {
            console.error('Failed to fetch KoBo workspace', err);
        } finally {
            setKoboLoading(false);
        }
    };

    const handleSync = async (linkId = null) => {
        setSyncing(true);
        try {
            const endpoint = linkId ? `${API_BASE}/kobo/sync/${linkId}` : `${API_BASE}/kobo/sync-all`;
            const res = await axios.post(endpoint, { userId: user.id });
            alert(res.data.message || 'Sync successful');
            fetchMEData();
            fetchKoboWorkspace();
        } catch (err) {
            alert('Sync failed: ' + (err.response?.data?.message || err.message));
        } finally {
            setSyncing(false);
        }
    };

    const handleLinkForm = async (form) => {
        const indicatorId = koboLinkSelections[form.uid];
        if (!indicatorId) {
            alert('Select an indicator before linking this form.');
            return;
        }

        try {
            await axios.post(`${API_BASE}/kobo/link`, {
                userId: user.id,
                kobo_form_uid: form.uid,
                kobo_form_name: form.name,
                indicator_id: indicatorId,
            });
            setKoboLinkSelections((current) => ({ ...current, [form.uid]: '' }));
            await fetchKoboWorkspace();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to link Kobo form.');
        }
    };

    const handleUnlinkForm = async (link) => {
        if (!window.confirm(`Unlink "${link.kobo_form_name}" from this indicator?`)) return;

        try {
            await axios.delete(`${API_BASE}/kobo/link/${link.id}`, { params: { userId: user.id } });
            await fetchKoboWorkspace();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to unlink Kobo form.');
        }
    };

    const handleInspectFields = async (formUid) => {
        setInspectingForm(formUid);
        try {
            const res = await axios.get(`${API_BASE}/kobo/fields/${formUid}`, { params: { userId: user.id } });
            setKoboFields((current) => ({ ...current, [formUid]: res.data || [] }));
        } catch (err) {
            alert(err.response?.data?.error || 'No fields available for this form yet.');
        } finally {
            setInspectingForm('');
        }
    };

    const fetchMEData = async () => {
        setLoading(true);
        try {
            const [indRes, compassIndRes, perfRes, projectRes, riskRes] = await Promise.all([
                axios.get(`${API_BASE}/indicators`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/me/compass-indicators`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/me/summary`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/projects`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/analytics/risk-summary`, { params: { userId: user.id } }),
            ]);
            const riskById = new Map((riskRes.data?.indicators || []).map((item) => [item.id, item]));
            const compassIndicators = (compassIndRes.data || []).map((item) => ({
                ...item,
                isCompassSynced: true,
            }));
            const localIndicators = (indRes.data || []).map((item) => ({
                ...item,
                ...(riskById.get(item.id) || {}),
                isCompassSynced: false,
            }));
            setIndicators([...compassIndicators, ...localIndicators]);
            setPerformance(perfRes.data.reverse());
            setProjects(projectRes.data || []);
            setRiskSummary(riskRes.data || null);
        } catch (err) {
            console.error('Failed to fetch M&E data', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExportFramework = async () => {
        try {
            const res = await axios.get(`${API_BASE}/export/indicators`, {
                responseType: 'blob',
                params: { userId: user.id },
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const link = document.createElement('a');
            link.href = url;
            link.download = 'mmpz-indicators-export.csv';
            link.click();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            alert('Failed to export framework');
        }
    };

    const handleCreateIndicator = async (e) => {
        e.preventDefault();
        setCreatingIndicator(true);
        try {
            await axios.post(`${API_BASE}/indicators`, {
                userId: user.id,
                ...newIndicator,
                target_value: Number(newIndicator.target_value || 0),
                total_budget: Number(newIndicator.total_budget || 0),
            });
            setShowIndicatorForm(false);
            setNewIndicator({
                title: '',
                project_id: '',
                target_value: '',
                total_budget: '',
                priority: 'medium',
            });
            fetchMEData();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to create indicator');
        } finally {
            setCreatingIndicator(false);
        }
    };

    const filteredIndicators = indicators.filter((ind) =>
        ind.title.toLowerCase().includes(indicatorSearch.toLowerCase())
    );
    const linkedFormUids = new Set(koboLinks.map((link) => link.kobo_form_uid));
    const hasCompassSync = indicators.some((ind) => ind.isCompassSynced);

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
                    <div className="page-action-group" style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={handleExportFramework}>
                            <Download size={16} /> Export Framework
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => setShowIndicatorForm(true)}>
                            <Plus size={16} /> New Indicator
                        </button>
                    </div>
                }
            />

            <div className="kpi-grid me-overview-grid" style={{ gridTemplateColumns: '1fr 2fr' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', minWidth: 0 }}>
                    <div className="kpi-card info">
                        <div className="kpi-icon-wrap"><Target size={22} /></div>
                        <div className="kpi-label">Indicators Tracking</div>
                        <div className="kpi-value">{indicators.length}</div>
                        <div className="kpi-sub">{indicators.filter(i => i.status === 'active').length} active targets</div>
                    </div>

                    <div className="kpi-card danger">
                        <div className="kpi-icon-wrap"><AlertCircle size={22} /></div>
                        <div className="kpi-label">High Risk Indicators</div>
                        <div className="kpi-value">{riskSummary?.high_risk_count || 0}</div>
                        <div className="kpi-sub">Budget, progress, and stale update risk</div>
                    </div>

                    <div className="panel" style={{ minWidth: 0 }}>
                        <div className="panel-header">
                            <h2 className="panel-title">Cumulative Performance</h2>
                        </div>
                        <div style={{ height: '220px', width: '100%', minWidth: 0, minHeight: '220px', padding: '0 10px' }}>
                            {hasPerformanceData ? (
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
                            ) : (
                                <div className="empty-state" style={{ height: '100%', minHeight: 0 }}>
                                    <div className="empty-state-icon"><BarChart3 size={24} /></div>
                                    <p className="empty-state-text">Performance data will appear once reports are submitted.</p>
                                </div>
                            )}
                        </div>
                        <div style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-muted)', marginTop: '8px' }}>
                            Actual Reached vs Targets (Last 6 Months)
                        </div>
                    </div>

                    <div className="panel" style={{ borderTop: '4px solid var(--brand-primary)' }}>
                        <div className="panel-header" style={{ border: 'none', paddingBottom: '0' }}>
                            <div>
                                <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <RefreshCw size={16} className={syncing ? 'spin' : ''} /> KoBoToolbox
                                </h2>
                                <div className="panel-subtitle">
                                    {hasCompassSync
                                        ? 'KoBo forms and field submissions are managed in Compass; approved summaries sync into ERP.'
                                        : koboConfig?.is_connected
                                        ? `${koboLinks.length} active form bridge${koboLinks.length === 1 ? '' : 's'}`
                                        : 'Not connected. Configure the API token in Settings first.'}
                                </div>
                            </div>
                            <button
                                className="btn btn-secondary btn-sm"
                                onClick={() => handleSync()}
                                disabled={syncing || hasCompassSync || !koboConfig?.is_connected || koboLinks.length === 0}
                            >
                                {syncing ? 'Syncing...' : hasCompassSync ? 'Compass Managed' : 'Sync All'}
                            </button>
                        </div>
                        <div style={{ padding: '20px', display: 'grid', gap: '16px' }}>
                            {koboLoading ? (
                                <div className="page-loading" style={{ minHeight: '120px' }}><div className="spinner" /></div>
                            ) : (
                                <>
                                    {hasCompassSync && (
                                        <div className="surface-muted">
                                            <div className="domain-kicker">Compass Link Active</div>
                                            <div className="control-copy">
                                                This ERP page is reading approved M&E indicator summaries from Compass. Raw KoBo forms,
                                                field submissions, evidence, client case records, and clinical details stay in Compass.
                                            </div>
                                        </div>
                                    )}
                                    <div className="control-stack compact">
                                        {koboLinks.slice(0, 5).map(link => (
                                            <div key={link.id} className="control-row static" style={{ alignItems: 'center' }}>
                                                <div>
                                                    <div className="control-title">{link.kobo_form_name}</div>
                                                    <div className="control-copy">
                                                        {link.indicator_title} · {link.submissions_count || 0} submissions
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleSync(link.id)} disabled={syncing}>
                                                        <RefreshCw size={12} /> Sync
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => handleUnlinkForm(link)}>
                                                        <Unlink size={12} /> Unlink
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                        {koboLinks.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: '20px', fontSize: '11px', color: 'var(--text-muted)', border: '2px dashed var(--border)', borderRadius: '8px' }}>
                                                No KoBo forms linked.
                                            </div>
                                        )}
                                    </div>

                                    {koboConfig?.is_connected && (
                                        <div className="surface-muted">
                                            <div className="domain-kicker">Available Forms</div>
                                            <div className="control-stack compact">
                                                {koboForms.slice(0, 6).map((form) => {
                                                    const isLinked = linkedFormUids.has(form.uid);
                                                    return (
                                                        <div key={form.uid} className="control-row static" style={{ alignItems: 'center' }}>
                                                            <div style={{ minWidth: 0 }}>
                                                                <div className="control-title">{form.name}</div>
                                                                <div className="control-copy">{form.uid}</div>
                                                                {koboFields[form.uid]?.length > 0 && (
                                                                    <div className="form-hint" style={{ marginTop: '6px' }}>
                                                                        Fields: {koboFields[form.uid].slice(0, 6).join(', ')}
                                                                        {koboFields[form.uid].length > 6 ? '...' : ''}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ display: 'grid', gap: '8px', minWidth: '220px' }}>
                                                                {isLinked ? (
                                                                    <span className="badge badge-success">Linked</span>
                                                                ) : (
                                                                    <>
                                                                        <select
                                                                            className="form-input"
                                                                            style={{ height: '34px', fontSize: '12px', margin: 0 }}
                                                                            value={koboLinkSelections[form.uid] || ''}
                                                                            onChange={(event) =>
                                                                                setKoboLinkSelections((current) => ({
                                                                                    ...current,
                                                                                    [form.uid]: event.target.value,
                                                                                }))
                                                                            }
                                                                        >
                                                                            <option value="">Select indicator</option>
                                                                            {indicators.map((indicator) => (
                                                                                <option key={indicator.id} value={indicator.id}>{indicator.title}</option>
                                                                            ))}
                                                                        </select>
                                                                        <button className="btn btn-primary btn-sm" onClick={() => handleLinkForm(form)}>
                                                                            <LinkIcon size={12} /> Link Form
                                                                        </button>
                                                                    </>
                                                                )}
                                                                <button className="btn btn-ghost btn-sm" onClick={() => handleInspectFields(form.uid)} disabled={inspectingForm === form.uid}>
                                                                    <Eye size={12} /> {inspectingForm === form.uid ? 'Inspecting...' : 'Inspect Fields'}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                                {koboForms.length === 0 && (
                                                    <div className="form-hint">No deployed survey forms were returned by KoboToolbox.</div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="panel" style={{ minWidth: 0 }}>
                    <div className="panel-header me-framework-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <h2 className="panel-title">Strategic Indicator Framework</h2>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <div className="search-box">
                                <Search size={14} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder="Filter indicators..."
                                    className="form-input"
                                    style={{ height: '32px', fontSize: '12px' }}
                                    value={indicatorSearch}
                                    onChange={(event) => setIndicatorSearch(event.target.value)}
                                />
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
                                {filteredIndicators.map(ind => (
                                    <tr key={ind.id} onClick={() => setSelectedInd(ind)} style={{ cursor: 'pointer' }} className={selectedInd?.id === ind.id ? 'active-row' : ''}>
                                        <td>
                                            <div style={{ fontWeight: 600, fontSize: '13px' }}>{ind.title}</div>
                                            {ind.isCompassSynced && (
                                                <span className="badge badge-success" style={{ fontSize: '9px', padding: '2px 6px', marginRight: '6px' }}>
                                                    COMPASS SYNCED
                                                </span>
                                            )}
                                            <span className={`badge badge-${ind.priority === 'critical' ? 'danger' : ind.priority === 'high' ? 'warning' : 'primary'}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                                                {ind.priority.toUpperCase()}
                                            </span>
                                            {ind.risk_level && (
                                                <span className={`badge badge-${ind.risk_level === 'high' ? 'danger' : ind.risk_level === 'medium' ? 'warning' : 'success'}`} style={{ fontSize: '9px', padding: '2px 6px', marginLeft: '6px' }}>
                                                    {ind.risk_level.toUpperCase()} RISK
                                                </span>
                                            )}
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
                                            {ind.budget_utilization_percent !== undefined && (
                                                <div className="form-hint">{ind.budget_utilization_percent}% budget used</div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                                {koboLinks.some(l => l.indicator_id === ind.id) && (
                                                    <div title="Synced with KoBo" style={{ color: 'var(--brand-primary)', display: 'flex', alignItems: 'center' }}>
                                                        <Database size={14} />
                                                    </div>
                                                )}
                                                {ind.isCompassSynced ? (
                                                    <span className="badge badge-success" title="Progress is reported in Compass and pushed into ERP.">
                                                        Linked
                                                    </span>
                                                ) : (
                                                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedInd(ind); setShowReportForm(true); }}>
                                                        Report
                                                    </button>
                                                )}
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

            {showIndicatorForm && (
                <div className="modal-overlay" onClick={() => setShowIndicatorForm(false)}>
                    <div className="modal-box" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Create Indicator</div>
                            <button className="modal-close" onClick={() => setShowIndicatorForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreateIndicator}>
                            <div className="modal-body" style={{ display: 'grid', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Title</label>
                                    <input
                                        className="form-input"
                                        value={newIndicator.title}
                                        onChange={(event) => setNewIndicator((current) => ({ ...current, title: event.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Project</label>
                                    <select
                                        className="form-input"
                                        value={newIndicator.project_id}
                                        onChange={(event) => setNewIndicator((current) => ({ ...current, project_id: event.target.value }))}
                                    >
                                        <option value="">Unassigned</option>
                                        {projects.map((project) => (
                                            <option key={project.id} value={project.id}>{project.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Target Value</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            min="0"
                                            value={newIndicator.target_value}
                                            onChange={(event) => setNewIndicator((current) => ({ ...current, target_value: event.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Budget</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            min="0"
                                            value={newIndicator.total_budget}
                                            onChange={(event) => setNewIndicator((current) => ({ ...current, total_budget: event.target.value }))}
                                            required
                                        />
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Priority</label>
                                    <select
                                        className="form-input"
                                        value={newIndicator.priority}
                                        onChange={(event) => setNewIndicator((current) => ({ ...current, priority: event.target.value }))}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                        <option value="critical">Critical</option>
                                    </select>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowIndicatorForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={creatingIndicator}>
                                    {creatingIndicator ? 'Saving...' : 'Save Indicator'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
