import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useSearchParams } from 'react-router-dom';
import {
    ArrowUpRight,
    ClipboardList,
    Clock3,
    DollarSign,
    FileText,
    Landmark,
    PieChart,
    Plus,
    RefreshCw,
    Scale,
    ShieldCheck,
    ShoppingBag,
    Trash2,
    Wallet,
    X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';

const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

const formatDate = (value) =>
    value
        ? new Date(value).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
          })
        : 'Not set';

const buildPolicyProfile = (amount, thresholdValue) => {
    const total = Number(amount || 0);
    const threshold = Number(thresholdValue || 500);

    if (total >= threshold) {
        return {
            label: 'Director Review',
            tone: 'danger',
            note: `Three quotes and Director sign-off required above ${formatCurrency(threshold)}.`,
        };
    }
    if (total >= threshold / 2) {
        return {
            label: 'Finance Review',
            tone: 'warning',
            note: 'Comparative review expected before release to purchasing.',
        };
    }
    return {
        label: 'Routine Review',
        tone: 'success',
        note: 'Standard operating requisition with complete supporting lines.',
    };
};

const createBlankItem = () => ({
    description: '',
    quantity: 1,
    unit: 'item',
    estimated_unit_cost: 0,
});

export default function FinanceAdminPage() {
    const { user } = useAuth();
    const [searchParams, setSearchParams] = useSearchParams();
    const canCreateRequisition = [
        'DIRECTOR',
        'COMMUNITY_DEVELOPMENT_OFFICER',
        'PSYCHOSOCIAL_SUPPORT_OFFICER',
    ].includes(user?.role_code);
    const [tab, setTab] = useState('overview');
    const [summary, setSummary] = useState(null);
    const [grants, setGrants] = useState([]);
    const [procurement, setProcurement] = useState([]);
    const [budgetLines, setBudgetLines] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState(null);
    const [showRequisitionModal, setShowRequisitionModal] = useState(false);
    const [selectedProcurement, setSelectedProcurement] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [form, setForm] = useState({
        title: '',
        justification: '',
        budget_line_id: '',
        items: [createBlankItem()],
    });

    const thresholdValue = Number(summary?.controls?.major_finance_threshold_usd || 500);

    const fetchFinanceData = async ({ silent = false } = {}) => {
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError('');
        try {
            const params = { userId: user.id };
            const [summaryRes, grantsRes, procurementRes, budgetLineRes] = await Promise.all([
                axios.get(`${API_BASE}/finance/summary`, { params }),
                axios.get(`${API_BASE}/finance/grants`, { params }),
                axios.get(`${API_BASE}/procurement`, { params }),
                axios.get(`${API_BASE}/finance/budget-lines`, { params }),
            ]);

            setSummary(summaryRes.data);
            setGrants(grantsRes.data);
            setProcurement(procurementRes.data);
            setBudgetLines(budgetLineRes.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to load finance controls.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchFinanceData();
    }, []);

    useEffect(() => {
        const procurementId = searchParams.get('procurement');
        if (procurementId) {
            openProcurementDetail(procurementId);
        }
    }, [searchParams]);

    const formTotal = useMemo(
        () =>
            form.items.reduce((sum, item) => {
                const quantity = Number(item.quantity || 0);
                const unitCost = Number(item.estimated_unit_cost || 0);
                return sum + quantity * unitCost;
            }, 0),
        [form.items]
    );

    const selectedBudgetLine = useMemo(
        () => budgetLines.find((line) => line.id === form.budget_line_id) || null,
        [budgetLines, form.budget_line_id]
    );

    const draftPolicy = useMemo(
        () => buildPolicyProfile(formTotal, thresholdValue),
        [formTotal, thresholdValue]
    );

    const openRequests = procurement.filter((item) =>
        ['pending_approval', 'approved', 'ordered'].includes(item.status)
    );

    const resetForm = () => {
        setForm({
            title: '',
            justification: '',
            budget_line_id: '',
            items: [createBlankItem()],
        });
    };

    const updateItem = (index, field, value) => {
        setForm((current) => ({
            ...current,
            items: current.items.map((item, itemIndex) =>
                itemIndex === index ? { ...item, [field]: value } : item
            ),
        }));
    };

    const addItemRow = () => {
        setForm((current) => ({ ...current, items: [...current.items, createBlankItem()] }));
    };

    const removeItemRow = (index) => {
        setForm((current) => ({
            ...current,
            items:
                current.items.length === 1
                    ? current.items
                    : current.items.filter((_, itemIndex) => itemIndex !== index),
        }));
    };

    const openProcurementDetail = async (id) => {
        try {
            const res = await axios.get(`${API_BASE}/procurement/${id}`, {
                params: { userId: user.id },
            });
            setSelectedProcurement(res.data);
            setSearchParams((current) => {
                const next = new URLSearchParams(current);
                next.set('procurement', id);
                return next;
            });
        } catch (err) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'Unable to load requisition details.',
            });
        }
    };

    const submitRequisition = async () => {
        setSubmitting(true);
        setMessage(null);
        try {
            const payload = {
                userId: user.id,
                title: form.title,
                justification: form.justification,
                budget_line_id: form.budget_line_id || null,
                project_id: selectedBudgetLine?.project_id || null,
                items: form.items.map((item) => ({
                    description: item.description,
                    quantity: Number(item.quantity || 0),
                    unit: item.unit,
                    estimated_unit_cost: Number(item.estimated_unit_cost || 0),
                })),
            };

            const res = await axios.post(`${API_BASE}/procurement`, payload);
            setShowRequisitionModal(false);
            setMessage({
                type: 'success',
                text: `${res.data.message}. Control band: ${draftPolicy.label}.`,
            });
            resetForm();
            await fetchFinanceData({ silent: true });
        } catch (err) {
            setMessage({
                type: 'error',
                text: err.response?.data?.error || 'Unable to submit requisition.',
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

    const metrics = summary?.metrics || {};

    return (
        <div className="fade-in finance-workspace">
            <PageHeader
                title="Finance, Administration & Logistics"
                subtitle="Track commitments, protect budget lines, and route procurement through documented controls."
                actions={
                    <div className="page-actions">
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => fetchFinanceData({ silent: true })}
                            disabled={refreshing}
                        >
                            <RefreshCw size={16} /> {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                        {canCreateRequisition && (
                            <button className="btn btn-primary btn-sm" onClick={() => setShowRequisitionModal(true)}>
                                <Plus size={16} /> New Requisition
                            </button>
                        )}
                    </div>
                }
            />

            {(message || error) && (
                <div className={`page-message ${message?.type || 'error'}`}>
                    {message?.text || error}
                </div>
            )}

            <section className="domain-hero">
                <div>
                    <div className="domain-kicker">Stewardship Lens</div>
                    <h2>Spend only against funded lines, separate request from approval, and treat approvals as commitments before cash leaves the bank.</h2>
                    <p>
                        This workspace reflects three operating principles: budget discipline,
                        maker-checker segregation, and logistics readiness before approval.
                    </p>
                </div>
                <div className="hero-control-card">
                    <div className="hero-control-label">Director Threshold</div>
                    <div className="hero-control-value">{formatCurrency(thresholdValue)}</div>
                    <p>{summary?.controls?.quote_rule}</p>
                </div>
            </section>

            <div className="signal-strip">
                <div className="signal-card">
                    <div className="signal-icon primary"><Landmark size={18} /></div>
                    <div className="signal-meta">
                        <div className="signal-label">Donor Commitments</div>
                        <div className="signal-value">{formatCurrency(metrics.commitment_total)}</div>
                        <div className="signal-note">{metrics.total_grants || 0} active grants across {metrics.total_donors || 0} donors</div>
                    </div>
                </div>
                <div className="signal-card">
                    <div className="signal-icon success"><Wallet size={18} /></div>
                    <div className="signal-meta">
                        <div className="signal-label">Available After Commitments</div>
                        <div className="signal-value">{formatCurrency(metrics.available_balance_total)}</div>
                        <div className="signal-note">Allocated less actual spend and approved commitments</div>
                    </div>
                </div>
                <div className="signal-card">
                    <div className="signal-icon warning"><ShoppingBag size={18} /></div>
                    <div className="signal-meta">
                        <div className="signal-label">Pipeline Requests</div>
                        <div className="signal-value">{formatCurrency(metrics.pending_procurement_total)}</div>
                        <div className="signal-note">{metrics.open_requisitions_count || 0} active requisitions awaiting release or fulfilment</div>
                    </div>
                </div>
                <div className="signal-card">
                    <div className="signal-icon accent"><Clock3 size={18} /></div>
                    <div className="signal-meta">
                        <div className="signal-label">Aging Queue</div>
                        <div className="signal-value">{metrics.overdue_requisitions_count || 0}</div>
                        <div className="signal-note">Requests open for more than seven days</div>
                    </div>
                </div>
            </div>

            <div className="tab-strip">
                {[
                    ['overview', 'Overview'],
                    ['procurement', 'Procurement Desk'],
                    ['controls', 'Control Matrix'],
                ].map(([value, label]) => (
                    <button
                        key={value}
                        className={`tab-chip${tab === value ? ' active' : ''}`}
                        onClick={() => setTab(value)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <>
                    <div className="kpi-grid">
                        <div className="kpi-card primary">
                            <div className="kpi-icon-wrap"><PieChart size={22} /></div>
                            <div className="kpi-label">Budget Allocated</div>
                            <div className="kpi-value">{formatCurrency(metrics.allocated_total)}</div>
                            <div className="kpi-sub">Control total posted to budget lines</div>
                        </div>
                        <div className="kpi-card success">
                            <div className="kpi-icon-wrap"><DollarSign size={22} /></div>
                            <div className="kpi-label">Actual Expenditure</div>
                            <div className="kpi-value">{formatCurrency(metrics.spent_total)}</div>
                            <div className="kpi-sub">{Math.round((metrics.utilization_rate || 0) * 100)}% of allocated lines consumed</div>
                        </div>
                        <div className="kpi-card warning">
                            <div className="kpi-icon-wrap"><ClipboardList size={22} /></div>
                            <div className="kpi-label">Committed Procurement</div>
                            <div className="kpi-value">{formatCurrency(metrics.committed_procurement_total)}</div>
                            <div className="kpi-sub">Approved orders not yet recognized as expense</div>
                        </div>
                        <div className="kpi-card accent">
                            <div className="kpi-icon-wrap"><ShieldCheck size={22} /></div>
                            <div className="kpi-label">Control Threshold</div>
                            <div className="kpi-value">{formatCurrency(thresholdValue)}</div>
                            <div className="kpi-sub">Materiality point for Director release</div>
                        </div>
                    </div>

                    <div className="panels-row">
                        <div className="panel">
                            <div className="panel-header">
                                <div>
                                    <h2 className="panel-title">Grant Discipline</h2>
                                    <div className="panel-subtitle">Track committed funds against allocations and utilization.</div>
                                </div>
                            </div>
                            <div className="data-table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Donor / Grant</th>
                                            <th>Committed</th>
                                            <th>Allocated</th>
                                            <th>Spent</th>
                                            <th>Balance</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grants.map((grant) => {
                                            const balance = Number(grant.total_amount || 0) - Number(grant.total_used || 0);
                                            return (
                                                <tr key={grant.id}>
                                                    <td>
                                                        <div style={{ fontWeight: 700 }}>{grant.name}</div>
                                                        <div className="form-hint">{grant.donor_name} · {grant.code || 'No code'}</div>
                                                    </td>
                                                    <td>{formatCurrency(grant.total_amount)}</td>
                                                    <td>{formatCurrency(grant.total_allocated || grant.total_budgeted)}</td>
                                                    <td>{formatCurrency(grant.total_used)}</td>
                                                    <td>{formatCurrency(balance)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="panel">
                            <div className="panel-header">
                                <div>
                                    <h2 className="panel-title">Recent Procurement Activity</h2>
                                    <div className="panel-subtitle">Requests are assessed as commitments before cash payment.</div>
                                </div>
                            </div>
                            <div className="control-stack">
                                {(summary?.recent_procurement || []).map((item) => (
                                    <button
                                        key={item.id}
                                        className="control-row"
                                        onClick={() => openProcurementDetail(item.id)}
                                    >
                                        <div>
                                            <div className="control-title">{item.title}</div>
                                            <div className="control-copy">
                                                {item.requester_name} · {item.project_name || 'Unassigned project'} · {formatDate(item.created_at)}
                                            </div>
                                        </div>
                                        <div className="control-trailing">
                                            <span className={`badge badge-${item.approval_band === 'director_review' ? 'danger' : item.approval_band === 'finance_review' ? 'warning' : 'success'}`}>
                                                {item.approval_band.replace('_', ' ')}
                                            </span>
                                            <strong>{formatCurrency(item.total_estimated_cost)}</strong>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {tab === 'procurement' && (
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Procurement Desk</h2>
                            <div className="panel-subtitle">Every requisition should name its budget line, justification, and supporting itemization.</div>
                        </div>
                    </div>

                    <div className="finance-split">
                        <div className="surface-muted">
                            <div className="domain-kicker">Workflow Standard</div>
                            <h3>Request, review, approve, commit, then fulfill.</h3>
                            <p>
                                The requester initiates need. Finance checks budget coverage and documentation.
                                Governance approves. Logistics only proceeds on approved commitments.
                            </p>
                        </div>
                        <div className="surface-muted">
                            <div className="domain-kicker">Current Queue</div>
                            <h3>{openRequests.length} active procurement cases</h3>
                            <p>{summary?.controls?.maker_checker_rule}</p>
                        </div>
                    </div>

                    <div className="data-table-wrap" style={{ marginTop: '20px' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Requisition</th>
                                    <th>Budget Line</th>
                                    <th>Requester</th>
                                    <th>Value</th>
                                    <th>Status</th>
                                    <th>Control Band</th>
                                    <th style={{ textAlign: 'right' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {procurement.map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{item.title}</div>
                                            <div className="form-hint">{item.project_name || 'No project'} · {item.item_count || 0} lines</div>
                                        </td>
                                        <td>
                                            <div>{item.budget_line_code || 'Uncoded'}</div>
                                            <div className="form-hint">{item.budget_line_name || 'Budget line not assigned'}</div>
                                        </td>
                                        <td>{item.requester_name}</td>
                                        <td>{formatCurrency(item.total_estimated_cost)}</td>
                                        <td><span className={`badge badge-${item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'}`}>{item.status.replace('_', ' ')}</span></td>
                                        <td><span className={`badge badge-${item.approval_band === 'director_review' ? 'danger' : item.approval_band === 'finance_review' ? 'warning' : 'success'}`}>{item.approval_band.replace('_', ' ')}</span></td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn-secondary btn-sm" onClick={() => openProcurementDetail(item.id)}>
                                                <ArrowUpRight size={14} /> Inspect
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {procurement.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon"><ShoppingBag size={32} /></div>
                                <div className="empty-state-title">No requisitions yet</div>
                                <p className="empty-state-text">Open the requisition desk to submit the first budget-backed request.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {tab === 'controls' && (
                <div className="panels-row">
                    <div className="panel">
                        <div className="panel-header">
                            <div>
                                <h2 className="panel-title">Control Matrix</h2>
                                <div className="panel-subtitle">Accounting, administrative, and logistics expectations.</div>
                            </div>
                        </div>
                        <div className="control-stack">
                            <div className="control-row static">
                                <div>
                                    <div className="control-title">Budget Ownership</div>
                                    <div className="control-copy">Every requisition should point to a funded budget line before approval.</div>
                                </div>
                                <Scale size={18} />
                            </div>
                            <div className="control-row static">
                                <div>
                                    <div className="control-title">Maker-Checker Rule</div>
                                    <div className="control-copy">{summary?.controls?.maker_checker_rule}</div>
                                </div>
                                <ShieldCheck size={18} />
                            </div>
                            <div className="control-row static">
                                <div>
                                    <div className="control-title">Comparative Procurement</div>
                                    <div className="control-copy">{summary?.controls?.quote_rule}</div>
                                </div>
                                <FileText size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <div>
                                <h2 className="panel-title">Budget Lines Ready for Commitment</h2>
                                <div className="panel-subtitle">Use lines with positive available balance after pending and approved commitments.</div>
                            </div>
                        </div>
                        <div className="control-stack compact">
                            {budgetLines.slice(0, 8).map((line) => (
                                <div key={line.id} className="control-row static">
                                    <div>
                                        <div className="control-title">{line.code || 'No code'} · {line.description}</div>
                                        <div className="control-copy">{line.project_name || 'Shared budget'} · {line.grant_name || 'No grant linked'}</div>
                                    </div>
                                    <div className="control-trailing">
                                        <strong>{formatCurrency(line.available_to_commit)}</strong>
                                        <span className={`badge badge-${Number(line.available_to_commit) > 0 ? 'success' : 'danger'}`}>
                                            {Number(line.available_to_commit) > 0 ? 'available' : 'fully committed'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {showRequisitionModal && (
                <div className="modal-overlay" onClick={() => setShowRequisitionModal(false)}>
                    <div className="modal-box xl requisition-modal" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">New Procurement Requisition</div>
                            <button className="modal-close" onClick={() => setShowRequisitionModal(false)}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <div className="requisition-layout">
                                <div>
                                    <div className="form-group">
                                        <label className="form-label">Request Title</label>
                                        <input
                                            className="form-input"
                                            value={form.title}
                                            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                                            placeholder="Example: Community outreach transport and stationery"
                                        />
                                    </div>

                                    <div className="form-row">
                                        <div className="form-group">
                                            <label className="form-label">Budget Line</label>
                                            <select
                                                className="form-select"
                                                value={form.budget_line_id}
                                                onChange={(event) => setForm((current) => ({ ...current, budget_line_id: event.target.value }))}
                                            >
                                                <option value="">Select funded budget line</option>
                                                {budgetLines.map((line) => (
                                                    <option key={line.id} value={line.id}>
                                                        {line.code || 'No code'} · {line.description}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Linked Project</label>
                                            <input
                                                className="form-input"
                                                value={selectedBudgetLine?.project_name || 'Derived from budget line'}
                                                readOnly
                                            />
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Justification</label>
                                        <textarea
                                            className="form-textarea"
                                            value={form.justification}
                                            onChange={(event) => setForm((current) => ({ ...current, justification: event.target.value }))}
                                            placeholder="Explain operational need, timing, and why the spend is necessary."
                                        />
                                    </div>

                                    <div className="line-items-header">
                                        <div>
                                            <h3>Line Items</h3>
                                            <p>Break the requisition into reviewable purchasing lines.</p>
                                        </div>
                                        <button className="btn btn-secondary btn-sm" onClick={addItemRow}>
                                            <Plus size={14} /> Add line
                                        </button>
                                    </div>

                                    <div className="line-item-list">
                                        {form.items.map((item, index) => (
                                            <div key={index} className="line-item-card">
                                                <div className="requisition-line-grid">
                                                    <div className="form-group span-2">
                                                        <label className="form-label">Description</label>
                                                        <input
                                                            className="form-input"
                                                            value={item.description}
                                                            onChange={(event) => updateItem(index, 'description', event.target.value)}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">Qty</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="form-input"
                                                            value={item.quantity}
                                                            onChange={(event) => updateItem(index, 'quantity', event.target.value)}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">Unit</label>
                                                        <input
                                                            className="form-input"
                                                            value={item.unit}
                                                            onChange={(event) => updateItem(index, 'unit', event.target.value)}
                                                        />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">Unit Cost</label>
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            className="form-input"
                                                            value={item.estimated_unit_cost}
                                                            onChange={(event) => updateItem(index, 'estimated_unit_cost', event.target.value)}
                                                        />
                                                    </div>
                                                </div>
                                                <div className="line-item-footer">
                                                    <span>Line total: {formatCurrency(Number(item.quantity || 0) * Number(item.estimated_unit_cost || 0))}</span>
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        onClick={() => removeItemRow(index)}
                                                        disabled={form.items.length === 1}
                                                    >
                                                        <Trash2 size={14} /> Remove
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <aside className="requisition-sidebar">
                                    <div className="summary-card">
                                        <div className="summary-label">Draft Total</div>
                                        <div className="summary-value">{formatCurrency(formTotal)}</div>
                                        <p>{draftPolicy.note}</p>
                                    </div>
                                    <div className="summary-card muted">
                                        <div className="summary-label">Approval Band</div>
                                        <span className={`badge badge-${draftPolicy.tone}`}>{draftPolicy.label}</span>
                                    </div>
                                    <div className="summary-card muted">
                                        <div className="summary-label">Budget Capacity</div>
                                        <div className="summary-copy">
                                            {selectedBudgetLine
                                                ? `${formatCurrency(selectedBudgetLine.available_to_commit)} available to commit on the selected line.`
                                                : 'Select a budget line to check remaining commitment capacity.'}
                                        </div>
                                    </div>
                                </aside>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => { setShowRequisitionModal(false); resetForm(); }}>
                                <X size={14} /> Cancel
                            </button>
                            <button className="btn btn-primary" onClick={submitRequisition} disabled={submitting}>
                                {submitting ? 'Submitting...' : 'Submit for Approval'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {selectedProcurement && (
                <div className="modal-overlay" onClick={() => setSelectedProcurement(null)}>
                    <div className="modal-box xl" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">{selectedProcurement.title}</div>
                            <button
                                className="modal-close"
                                onClick={() => {
                                    setSelectedProcurement(null);
                                    setSearchParams((current) => {
                                        const next = new URLSearchParams(current);
                                        next.delete('procurement');
                                        return next;
                                    });
                                }}
                            >
                                &times;
                            </button>
                        </div>
                        <div className="modal-body">
                            <div className="detail-grid">
                                <div className="summary-card">
                                    <div className="summary-label">Status</div>
                                    <span className={`badge badge-${selectedProcurement.status === 'approved' ? 'success' : selectedProcurement.status === 'rejected' ? 'danger' : 'warning'}`}>
                                        {selectedProcurement.status.replace('_', ' ')}
                                    </span>
                                </div>
                                <div className="summary-card">
                                    <div className="summary-label">Estimated Value</div>
                                    <div className="summary-value">{formatCurrency(selectedProcurement.total_estimated_cost)}</div>
                                </div>
                                <div className="summary-card">
                                    <div className="summary-label">Approval Band</div>
                                    <div className="summary-copy">{selectedProcurement.policy?.label || selectedProcurement.policy?.approval_band?.replace('_', ' ')}</div>
                                </div>
                            </div>

                            <div className="surface-muted" style={{ marginTop: '18px' }}>
                                <div className="domain-kicker">Operational Context</div>
                                <h3>{selectedProcurement.project_name || 'Unassigned project'}</h3>
                                <p>{selectedProcurement.justification}</p>
                                <p>
                                    Budget line: <strong>{selectedProcurement.budget_line_code || 'Uncoded'}</strong>
                                    {selectedProcurement.budget_line_name ? ` · ${selectedProcurement.budget_line_name}` : ''}
                                </p>
                            </div>

                            <div className="data-table-wrap" style={{ marginTop: '18px' }}>
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Description</th>
                                            <th>Quantity</th>
                                            <th>Unit</th>
                                            <th>Unit Cost</th>
                                            <th>Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedProcurement.items || []).map((item) => (
                                            <tr key={item.id}>
                                                <td>{item.description}</td>
                                                <td>{Number(item.quantity || 0)}</td>
                                                <td>{item.unit}</td>
                                                <td>{formatCurrency(item.estimated_unit_cost)}</td>
                                                <td>{formatCurrency(Number(item.quantity || 0) * Number(item.estimated_unit_cost || 0))}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={() => {
                                    setSelectedProcurement(null);
                                    setSearchParams((current) => {
                                        const next = new URLSearchParams(current);
                                        next.delete('procurement');
                                        return next;
                                    });
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
