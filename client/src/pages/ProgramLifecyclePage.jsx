import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    Activity,
    AlertTriangle,
    BarChart3,
    CheckCircle,
    ClipboardList,
    DollarSign,
    FileText,
    Package,
    Receipt,
    RefreshCw,
    ShieldCheck,
    Upload,
    WalletCards,
    Workflow,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

const formatNumber = (value) => Number(value || 0).toLocaleString();

const STAGE_ICONS = {
    plan: ClipboardList,
    budget: WalletCards,
    approve: ShieldCheck,
    release: DollarSign,
    prepare: Package,
    implement: Activity,
    submit: Upload,
    liquidate: Receipt,
    verify: CheckCircle,
    publish: BarChart3,
    replan: RefreshCw,
};

const GAP_TONE = {
    ready: 'success',
    partial: 'warning',
    missing: 'danger',
};

const sourceLabel = (source) => String(source || '').replace(/_/g, ' ');

export default function ProgramLifecyclePage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [lifecycle, setLifecycle] = useState(null);

    const loadLifecycle = async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_BASE}/program-lifecycle`, {
                params: { userId: user.id },
            });
            setLifecycle(res.data);
        } catch (err) {
            console.error('Failed to load program lifecycle', err);
            setError(err.response?.data?.error || 'Unable to load the program lifecycle workspace.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        if (user?.id) loadLifecycle();
    }, [user?.id]);

    const summary = lifecycle?.summary || {};
    const finance = lifecycle?.finance || {};
    const stages = lifecycle?.stages || [];
    const gaps = lifecycle?.architectureGaps || [];
    const recentSignals = lifecycle?.recentSignals || [];

    const openLoopCount = useMemo(
        () => stages.reduce((total, stage) => total + Number(stage.count || 0), 0),
        [stages]
    );

    if (loading) {
        return <div className="page-loading"><div className="spinner" /><p>Loading lifecycle...</p></div>;
    }

    if (error) {
        return (
            <div className="content-stack fade-in">
                <PageHeader title="Program Lifecycle" subtitle="Planning, finance, field execution, verification, and learning in one operating cycle." />
                <div className="page-alert danger">
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="content-stack fade-in">
            <PageHeader
                title="Program Lifecycle"
                subtitle="Planning, finance, field execution, verification, and learning in one operating cycle."
                actions={
                    <button className="btn btn-secondary" onClick={() => loadLifecycle({ silent: true })} disabled={refreshing}>
                        <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
                        Refresh
                    </button>
                }
            />

            <section className="domain-hero lifecycle-hero">
                <div>
                    <div className="domain-kicker">MMPZ Operating Model</div>
                    <h2>Program Governance & Financial Accountability Engine</h2>
                    <p>
                        Every activity should move through authorization, release, execution, liquidation,
                        verification, publishing, reporting, and replanning as one traceable cycle.
                    </p>
                </div>
                <div className="hero-control-card">
                    <div className="hero-control-label">Open Cycle Signals</div>
                    <div className="hero-control-value">{formatNumber(openLoopCount)}</div>
                    <p>{formatNumber(summary.pending_control_count)} governance controls and {formatNumber(summary.open_finance_count)} finance/logistics items are active.</p>
                </div>
            </section>

            <div className="kpi-grid">
                <div className="kpi-card primary">
                    <div className="kpi-icon-wrap"><Workflow size={20} /></div>
                    <div className="kpi-label">Projects</div>
                    <div className="kpi-value">{formatNumber(summary.project_count)}</div>
                    <div className="kpi-sub">Program plans in scope</div>
                </div>
                <div className="kpi-card success">
                    <div className="kpi-icon-wrap"><WalletCards size={20} /></div>
                    <div className="kpi-label">Available Balance</div>
                    <div className="kpi-value">{formatCurrency(summary.available_balance_total)}</div>
                    <div className="kpi-sub">After spend and commitments</div>
                </div>
                <div className="kpi-card warning">
                    <div className="kpi-icon-wrap"><ShieldCheck size={20} /></div>
                    <div className="kpi-label">Pending Controls</div>
                    <div className="kpi-value">{formatNumber(summary.pending_control_count)}</div>
                    <div className="kpi-sub">Approvals, reviews, and verifications</div>
                </div>
                <div className="kpi-card info">
                    <div className="kpi-icon-wrap"><FileText size={20} /></div>
                    <div className="kpi-label">Documents</div>
                    <div className="kpi-value">{formatNumber(summary.document_count)}</div>
                    <div className="kpi-sub">Digital files in the ERP library</div>
                </div>
            </div>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Operational Cycle</h2>
                        <p className="panel-subtitle">Live ERP records arranged in the real program flow.</p>
                    </div>
                </div>
                <div className="lifecycle-stage-grid">
                    {stages.map((stage) => {
                        const Icon = STAGE_ICONS[stage.id] || Workflow;
                        return (
                            <article key={stage.id} className={`lifecycle-stage-card ${stage.tone || 'primary'}`}>
                                <div className="lifecycle-stage-top">
                                    <span className={`metric-icon ${stage.tone || 'primary'}`}><Icon size={18} /></span>
                                    <span className={`badge badge-${stage.tone || 'primary'}`}>{stage.owner}</span>
                                </div>
                                <div>
                                    <h3>{stage.label}</h3>
                                    <div className="lifecycle-stage-value">{formatNumber(stage.count)}</div>
                                    <div className="lifecycle-stage-status">{stage.status}</div>
                                </div>
                                <p>{stage.note}</p>
                            </article>
                        );
                    })}
                </div>
            </section>

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Financial Accountability</h2>
                            <p className="panel-subtitle">Budget, commitments, releases, and paid records.</p>
                        </div>
                    </div>
                    <div className="metric-grid">
                        <div className="metric-card">
                            <div className="metric-title">Allocated</div>
                            <div className="metric-value">{formatCurrency(finance.allocated_total)}</div>
                            <div className="metric-text">{formatNumber(finance.budget_line_count)} budget lines</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-title">Spent</div>
                            <div className="metric-value">{formatCurrency(finance.spent_total)}</div>
                            <div className="metric-text">Recorded against budget lines</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-title">Committed</div>
                            <div className="metric-value">{formatCurrency(finance.committed_procurement_total)}</div>
                            <div className="metric-text">Approved or ordered procurement</div>
                        </div>
                        <div className="metric-card">
                            <div className="metric-title">Released / Paid</div>
                            <div className="metric-value">{formatCurrency(finance.paid_expense_total)}</div>
                            <div className="metric-text">{formatNumber(finance.paid_expense_count)} paid expense records</div>
                        </div>
                    </div>
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Integration Readiness</h2>
                            <p className="panel-subtitle">Schema and workflow areas needed for full lifecycle control.</p>
                        </div>
                    </div>
                    <div className="control-stack">
                        {gaps.map((gap) => (
                            <div key={gap.key} className="control-row static">
                                <div className="control-copy">
                                    <div className="control-title">{gap.title}</div>
                                    <p>{gap.note}</p>
                                </div>
                                <span className={`badge badge-${GAP_TONE[gap.status] || 'muted'}`}>{gap.status}</span>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Recent Lifecycle Signals</h2>
                        <p className="panel-subtitle">Latest movement across field activity, submission, and procurement records.</p>
                    </div>
                </div>
                {recentSignals.length > 0 ? (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Source</th>
                                    <th>Record</th>
                                    <th>Status</th>
                                    <th>Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {recentSignals.map((signal, index) => (
                                    <tr key={`${signal.source}-${signal.signal_at}-${index}`}>
                                        <td>{sourceLabel(signal.source)}</td>
                                        <td>{signal.title}</td>
                                        <td><span className="badge badge-muted">{sourceLabel(signal.status)}</span></td>
                                        <td>{signal.signal_at ? new Date(signal.signal_at).toLocaleString() : 'Not recorded'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="empty-state">
                        <div className="empty-state-icon"><Workflow size={32} /></div>
                        <div className="empty-state-title">No lifecycle movement yet</div>
                        <p className="empty-state-text">Activity, submission, and procurement signals will appear here.</p>
                    </div>
                )}
            </section>
        </div>
    );
}
