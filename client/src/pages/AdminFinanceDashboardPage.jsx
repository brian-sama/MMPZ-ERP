import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    CalendarClock,
    ClipboardList,
    FileArchive,
    FileCheck2,
    FileWarning,
    Landmark,
    RefreshCw,
    ShieldCheck,
    Users,
    WalletCards,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import {
    EmptyState,
    MetricCard,
    badgeTone,
    formatCurrency,
    formatDate,
    formatNumber,
    formatStatus,
    getErrorMessage,
} from './operationsUtils.jsx';

const asList = (value) => (Array.isArray(value) ? value : []);

function AccessProfilePanel({ profile }) {
    if (!profile) return null;

    const functionalAccess = asList(profile.functional_access);
    const restrictions = asList(profile.restrictions);
    const operationalScope = profile.operational_scope || {};
    const approvalScope = profile.approval_scope || {};

    return (
        <section className="panel">
            <div className="panel-header">
                <div>
                    <h2 className="panel-title">Structured Access Profile</h2>
                    <p className="panel-subtitle">Administrative operations, finance documentation, and governance support boundaries.</p>
                </div>
                <span className={`badge badge-${badgeTone(profile.sensitivity_clearance)}`}>
                    {formatStatus(profile.sensitivity_clearance)}
                </span>
            </div>
            <div className="access-profile-grid">
                <div className="surface-muted">
                    <h3>Organizational</h3>
                    <p>{profile.organizational_unit || 'Not assigned'}</p>
                </div>
                <div className="surface-muted">
                    <h3>Functional</h3>
                    <p>{functionalAccess.slice(0, 8).map(formatStatus).join(', ') || 'Not assigned'}</p>
                </div>
                <div className="surface-muted">
                    <h3>Sensitivity</h3>
                    <p>{formatStatus(profile.sensitivity_clearance || 'internal')}</p>
                </div>
                <div className="surface-muted">
                    <h3>Operational</h3>
                    <p>
                        Districts: {formatStatus(operationalScope.districts || 'organization_admin')}<br />
                        Activities: {formatStatus(operationalScope.activities || 'documentation_related')}
                    </p>
                </div>
                <div className="surface-muted">
                    <h3>Approval</h3>
                    <p>
                        RFF preparation: {approvalScope.request_for_funds_preparation ? 'Allowed' : 'No'}<br />
                        Delivery verification: {approvalScope.delivery_verification ? 'Allowed' : 'No'}<br />
                        Asset custody: {approvalScope.asset_checkouts ? 'Allowed' : 'No'}
                    </p>
                </div>
            </div>
            {restrictions.length > 0 && (
                <div className="access-restriction-strip">
                    {restrictions.slice(0, 7).map((restriction) => (
                        <span className="badge badge-muted" key={restriction}>{formatStatus(restriction)}</span>
                    ))}
                </div>
            )}
        </section>
    );
}

export default function AdminFinanceDashboardPage() {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [data, setData] = useState({
        metrics: {},
        pending_approvals: [],
        pending_finance_documents: [],
        upcoming_board_meetings: [],
        compliance_expiry_alerts: [],
        pending_liquidations: [],
        uploaded_quotations: [],
        meeting_records: [],
        access_profile: null,
    });

    const fetchDashboard = async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_BASE}/operations/admin-finance-dashboard`);
            setData({
                metrics: res.data?.metrics || {},
                pending_approvals: Array.isArray(res.data?.pending_approvals) ? res.data.pending_approvals : [],
                pending_finance_documents: Array.isArray(res.data?.pending_finance_documents) ? res.data.pending_finance_documents : [],
                upcoming_board_meetings: Array.isArray(res.data?.upcoming_board_meetings) ? res.data.upcoming_board_meetings : [],
                compliance_expiry_alerts: Array.isArray(res.data?.compliance_expiry_alerts) ? res.data.compliance_expiry_alerts : [],
                pending_liquidations: Array.isArray(res.data?.pending_liquidations) ? res.data.pending_liquidations : [],
                uploaded_quotations: Array.isArray(res.data?.uploaded_quotations) ? res.data.uploaded_quotations : [],
                meeting_records: Array.isArray(res.data?.meeting_records) ? res.data.meeting_records : [],
                access_profile: res.data?.access_profile || null,
            });
        } catch (err) {
            setError(getErrorMessage(err, 'Admin & finance dashboard is unavailable.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    if (loading) {
        return <div className="page-loading"><div className="spinner" /></div>;
    }

    return (
        <div className="fade-in governance-workspace">
            <PageHeader
                title="Admin & Finance Dashboard"
                subtitle="Administrative records, governance support, finance documentation, compliance follow-ups, and liquidation paperwork."
                actions={
                    <button className="btn btn-secondary btn-sm" onClick={() => fetchDashboard({ silent: true })} disabled={refreshing}>
                        <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                        Refresh
                    </button>
                }
            />

            {error && <div className="page-message error">{error}</div>}

            <section className="domain-hero">
                <div>
                    <div className="domain-kicker">Administrative Operations</div>
                    <h2>Documentation, compliance, meetings, and financial records now sit in their own workspace.</h2>
                    <p>
                        This dashboard keeps paper, governance support, staff administration, requests for funds, quotations, and liquidation records separate from warehouse, stock, asset, and delivery custody work.
                    </p>
                </div>
                <div className="hero-control-card">
                    <div className="hero-control-label">Access Boundary</div>
                    <div className="hero-control-value" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <ShieldCheck size={28} />
                        Confidential Admin
                    </div>
                    <p>No warehouse control, asset custody, sensitive investigations, counselling notes, or viral load records are included here.</p>
                </div>
            </section>

            <div className="metric-grid">
                <MetricCard icon={ClipboardList} label="Pending Approvals" value={formatNumber(data.metrics.pending_approval_count)} note="Awaiting routing or action" />
                <MetricCard icon={FileWarning} tone="warning" label="Finance Documents" value={formatNumber(Number(data.metrics.missing_quotation_count || 0) + Number(data.metrics.missing_receipt_count || 0))} note="Missing quotations, receipts, invoices, or vouchers" />
                <MetricCard icon={CalendarClock} tone="info" label="Board Meetings" value={formatNumber(data.metrics.upcoming_board_meeting_count)} note="Upcoming governance events" />
                <MetricCard icon={Landmark} tone="warning" label="Compliance Alerts" value={formatNumber(data.metrics.compliance_expiry_count)} note="Expiring or at-risk records" />
                <MetricCard icon={WalletCards} tone="primary" label="Liquidations" value={formatNumber(data.metrics.pending_liquidation_count)} note="Receipt follow-up required" />
            </div>

            <AccessProfilePanel profile={data.access_profile} />

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Pending Approvals</h2>
                            <p className="panel-subtitle">Requests that need routing, follow-up, or administrative closure.</p>
                        </div>
                    </div>
                    {data.pending_approvals.length === 0 ? (
                        <EmptyState icon={ClipboardList} title="No pending approvals" />
                    ) : (
                        <div className="control-stack compact">
                            {data.pending_approvals.map((approval) => (
                                <div className="control-row static" key={approval.id}>
                                    <div>
                                        <div className="control-title">{formatStatus(approval.entity_type)}</div>
                                        <div className="control-copy">{approval.requester_name || 'Unknown requester'} / Step {approval.current_step || 1}</div>
                                    </div>
                                    <span className={`badge badge-${badgeTone(approval.status)}`}>{formatStatus(approval.status)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Pending Finance Documents</h2>
                            <p className="panel-subtitle">Procurement and payment records missing evidence.</p>
                        </div>
                    </div>
                    {data.pending_finance_documents.length === 0 ? (
                        <EmptyState icon={FileCheck2} title="No finance document gaps" />
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Request</th>
                                        <th>Status</th>
                                        <th>Value</th>
                                        <th>Quotes</th>
                                        <th>Receipts</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.pending_finance_documents.map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{item.title}</div>
                                                <div className="form-hint">{item.requester_name || 'Unknown requester'}</div>
                                            </td>
                                            <td><span className={`badge badge-${badgeTone(item.status)}`}>{formatStatus(item.status)}</span></td>
                                            <td>{formatCurrency(item.total_estimated_cost)}</td>
                                            <td>{formatNumber(item.quotation_count)}</td>
                                            <td>{formatNumber(item.receipt_count)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Upcoming Board Meetings</h2>
                            <p className="panel-subtitle">Governance calendar items requiring records or packs.</p>
                        </div>
                    </div>
                    {data.upcoming_board_meetings.length === 0 ? (
                        <EmptyState icon={CalendarClock} title="No upcoming board meetings" />
                    ) : (
                        <div className="control-stack compact">
                            {data.upcoming_board_meetings.map((event) => (
                                <div className="control-row static" key={event.id}>
                                    <div>
                                        <div className="control-title">{event.title}</div>
                                        <div className="control-copy">{formatDate(event.start_at)} / {event.location || 'Location not set'}</div>
                                    </div>
                                    <span className="badge badge-muted">{formatStatus(event.event_type)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Compliance Expiry Alerts</h2>
                            <p className="panel-subtitle">PVO, tax, policy, audit, and legal records needing renewal attention.</p>
                        </div>
                    </div>
                    {data.compliance_expiry_alerts.length === 0 ? (
                        <EmptyState icon={Landmark} title="No compliance expiry alerts" />
                    ) : (
                        <div className="control-stack compact">
                            {data.compliance_expiry_alerts.map((record) => (
                                <div className="control-row static" key={record.id}>
                                    <div>
                                        <div className="control-title">{record.title}</div>
                                        <div className="control-copy">{formatStatus(record.record_type)} / Expires {formatDate(record.expiry_date)}</div>
                                    </div>
                                    <span className={`badge badge-${badgeTone(record.compliance_status)}`}>{formatStatus(record.compliance_status)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Pending Liquidation Documents</h2>
                            <p className="panel-subtitle">Approved or active requests that still need receipt closure.</p>
                        </div>
                    </div>
                    {data.pending_liquidations.length === 0 ? (
                        <EmptyState icon={WalletCards} title="No liquidation follow-ups" />
                    ) : (
                        <div className="control-stack compact">
                            {data.pending_liquidations.map((item) => (
                                <div className="control-row static" key={item.id}>
                                    <div>
                                        <div className="control-title">{item.activity_name}</div>
                                        <div className="control-copy">{item.submitter_name || 'Unknown submitter'} / {formatCurrency(item.total_requested_amount)}</div>
                                    </div>
                                    <span className={`badge badge-${badgeTone(item.liquidation_status)}`}>{formatStatus(item.liquidation_status)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Uploaded Quotations</h2>
                            <p className="panel-subtitle">Recent procurement records with comparison evidence attached.</p>
                        </div>
                    </div>
                    {data.uploaded_quotations.length === 0 ? (
                        <EmptyState icon={FileArchive} title="No uploaded quotations yet" />
                    ) : (
                        <div className="control-stack compact">
                            {data.uploaded_quotations.map((item) => (
                                <div className="control-row static" key={item.id}>
                                    <div>
                                        <div className="control-title">{item.title}</div>
                                        <div className="control-copy">{item.requester_name || 'Unknown requester'} / {formatDate(item.created_at)}</div>
                                    </div>
                                    <span className="badge badge-success">{formatNumber(item.quotation_count)} quotes</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Meeting & Staff Records</h2>
                        <p className="panel-subtitle">Recent administrative documents, meeting minutes, policies, contracts, and staff records.</p>
                    </div>
                </div>
                {data.meeting_records.length === 0 ? (
                    <EmptyState icon={Users} title="No administrative records uploaded yet" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>Category</th>
                                    <th>Uploaded</th>
                                    <th>File</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.meeting_records.map((document) => (
                                    <tr key={document.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{document.title}</div>
                                            <div className="form-hint">{document.description || 'No description'}</div>
                                        </td>
                                        <td>{document.category}</td>
                                        <td>{formatDate(document.created_at)}</td>
                                        <td>{document.file_name}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </div>
    );
}
