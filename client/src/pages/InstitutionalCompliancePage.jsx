import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    AlertTriangle,
    CalendarClock,
    FileArchive,
    FileText,
    Landmark,
    Plus,
    RefreshCw,
    ShieldCheck,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import {
    EmptyState,
    MetricCard,
    badgeTone,
    formatDate,
    formatNumber,
    formatStatus,
    getErrorMessage,
} from './operationsUtils.jsx';

const recordTypes = [
    ['tax_clearance', 'ZIMRA Tax Clearance'],
    ['pvo_registration', 'PVO Registration'],
    ['board_resolution', 'Board Resolution'],
    ['mou', 'MoU'],
    ['policy', 'Policy'],
    ['annual_return', 'Annual Return'],
    ['audit_report', 'Audit Report'],
    ['legal_document', 'Legal Document'],
];

const initialRecord = {
    record_type: 'tax_clearance',
    title: '',
    reference_number: '',
    issuing_authority: '',
    issue_date: '',
    expiry_date: '',
    renewal_status: 'not_started',
    compliance_status: 'pending',
    owner_department: '',
    remarks: '',
};

const canManageCompliance = (user) =>
    user?.system_role === 'SUPER_ADMIN' ||
    ['DIRECTOR', 'FINANCE_OFFICER', 'ADMIN_FINANCE_ASSISTANT', 'SYSTEM_ADMIN'].includes(user?.role_code);

const daysUntil = (value) => {
    if (!value) return null;
    const parsed = new Date(value).getTime();
    if (Number.isNaN(parsed)) return null;
    return Math.ceil((parsed - Date.now()) / 86400000);
};

export default function InstitutionalCompliancePage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [data, setData] = useState({ metrics: {}, records: [], expiring: [] });
    const [modal, setModal] = useState(false);
    const [recordForm, setRecordForm] = useState(initialRecord);
    const [submitting, setSubmitting] = useState(false);

    const manager = canManageCompliance(user);

    const fetchCompliance = async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_BASE}/operations/compliance`);
            setData({
                metrics: res.data?.metrics || {},
                records: Array.isArray(res.data?.records) ? res.data.records : [],
                expiring: Array.isArray(res.data?.expiring) ? res.data.expiring : [],
            });
        } catch (err) {
            setError(getErrorMessage(err, 'Compliance records are unavailable.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchCompliance();
    }, []);

    const taxRecords = useMemo(
        () => data.records.filter((record) => record.record_type === 'tax_clearance'),
        [data.records]
    );
    const pvoRecords = useMemo(
        () => data.records.filter((record) => record.record_type === 'pvo_registration'),
        [data.records]
    );

    const submitRecord = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await axios.post(`${API_BASE}/operations/compliance-records`, recordForm);
            setRecordForm(initialRecord);
            setModal(false);
            setMessage('Compliance record created.');
            await fetchCompliance({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not create compliance record.'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="page-loading"><div className="spinner" /></div>;
    }

    return (
        <div className="fade-in governance-workspace">
            <PageHeader
                title="Institutional Compliance"
                subtitle="ZIMRA, PVO, board, policy, legal, audit, and document version controls."
                actions={
                    <div className="governance-toolbar">
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchCompliance({ silent: true })} disabled={refreshing}>
                            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                            Refresh
                        </button>
                        {manager && (
                            <button className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
                                <Plus size={14} />
                                Record
                            </button>
                        )}
                    </div>
                }
            />

            {error && <div className="page-message error">{error}</div>}
            {message && <div className="page-message success">{message}</div>}

            <section className="domain-hero">
                <div>
                    <div className="domain-kicker">Governance Evidence Registry</div>
                    <h2>Compliance documents now have status, expiry, ownership, and version history.</h2>
                    <p>
                        Tax clearance, PVO registration, policies, annual returns, audit reports, board decisions, and legal records are tracked in the same control layer.
                    </p>
                </div>
                <div className="hero-control-card">
                    <div className="hero-control-label">Expiring In 30 Days</div>
                    <div className="hero-control-value">{formatNumber(data.metrics.expiring_30_count)}</div>
                    <p>{formatNumber(data.metrics.expired_count)} expired compliance record{Number(data.metrics.expired_count || 0) === 1 ? '' : 's'} require escalation.</p>
                </div>
            </section>

            <div className="metric-grid">
                <MetricCard icon={FileArchive} label="Records" value={formatNumber(data.metrics.total_records)} note="Governance evidence items" />
                <MetricCard icon={ShieldCheck} tone="success" label="Compliant" value={formatNumber(data.metrics.compliant_count)} note="Current institutional records" />
                <MetricCard icon={CalendarClock} tone="warning" label="Expiring Soon" value={formatNumber(data.metrics.expiring_30_count)} note="Within the next 30 days" />
                <MetricCard icon={AlertTriangle} tone="warning" label="Expired" value={formatNumber(data.metrics.expired_count)} note="Needs renewal or archive decision" />
            </div>

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">ZIMRA Tax Clearance</h2>
                            <p className="panel-subtitle">Certificate numbers, expiry dates, and renewal status.</p>
                        </div>
                    </div>
                    {taxRecords.length === 0 ? (
                        <EmptyState icon={Landmark} title="No tax clearance records" />
                    ) : (
                        <div className="control-stack compact">
                            {taxRecords.map((record) => {
                                const days = daysUntil(record.expiry_date);
                                return (
                                    <div className="control-row static" key={record.id}>
                                        <div>
                                            <div className="control-title">{record.title}</div>
                                            <div className="control-copy">
                                                {record.reference_number || 'No certificate number'} / expires {formatDate(record.expiry_date)}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <span className={`badge badge-${badgeTone(record.compliance_status)}`}>{formatStatus(record.compliance_status)}</span>
                                            <div className="form-hint">{days === null ? 'No expiry' : `${days} days remaining`}</div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">PVO Documentation</h2>
                            <p className="panel-subtitle">Registration certificates, returns, board resolutions, and legal files.</p>
                        </div>
                    </div>
                    {pvoRecords.length === 0 ? (
                        <EmptyState icon={FileText} title="No PVO records" />
                    ) : (
                        <div className="control-stack compact">
                            {pvoRecords.map((record) => (
                                <div className="control-row static" key={record.id}>
                                    <div>
                                        <div className="control-title">{record.title}</div>
                                        <div className="control-copy">{record.reference_number || 'No reference'} / {record.issuing_authority || 'Authority not set'}</div>
                                    </div>
                                    <span className={`badge badge-${badgeTone(record.compliance_status)}`}>{formatStatus(record.compliance_status)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Compliance Register</h2>
                        <p className="panel-subtitle">Document versioning is captured per record.</p>
                    </div>
                </div>
                {data.records.length === 0 ? (
                    <EmptyState icon={FileArchive} title="No compliance records captured" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Record</th>
                                    <th>Type</th>
                                    <th>Status</th>
                                    <th>Renewal</th>
                                    <th>Expiry</th>
                                    <th>Versions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.records.map((record) => (
                                    <tr key={record.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{record.title}</div>
                                            <div className="form-hint">{record.reference_number || 'No reference'} / {record.owner_department || 'No owner'}</div>
                                        </td>
                                        <td>{formatStatus(record.record_type)}</td>
                                        <td><span className={`badge badge-${badgeTone(record.compliance_status)}`}>{formatStatus(record.compliance_status)}</span></td>
                                        <td>{formatStatus(record.renewal_status)}</td>
                                        <td>{formatDate(record.expiry_date)}</td>
                                        <td>{Array.isArray(record.versions) ? record.versions.length : 0}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {modal && (
                <div className="modal-overlay" onMouseDown={() => setModal(false)}>
                    <div className="modal-box lg" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Create Compliance Record</h3>
                            <button className="modal-close" onClick={() => setModal(false)}>x</button>
                        </div>
                        <form onSubmit={submitRecord}>
                            <div className="modal-body form-grid">
                                <label className="form-field">
                                    <span>Record Type</span>
                                    <select className="form-input" value={recordForm.record_type} onChange={(event) => setRecordForm({ ...recordForm, record_type: event.target.value })}>
                                        {recordTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                                    </select>
                                </label>
                                <label className="form-field">
                                    <span>Title</span>
                                    <input className="form-input" value={recordForm.title} onChange={(event) => setRecordForm({ ...recordForm, title: event.target.value })} required />
                                </label>
                                <label className="form-field">
                                    <span>Reference Number</span>
                                    <input className="form-input" value={recordForm.reference_number} onChange={(event) => setRecordForm({ ...recordForm, reference_number: event.target.value })} />
                                </label>
                                <label className="form-field">
                                    <span>Issuing Authority</span>
                                    <input className="form-input" value={recordForm.issuing_authority} onChange={(event) => setRecordForm({ ...recordForm, issuing_authority: event.target.value })} />
                                </label>
                                <label className="form-field">
                                    <span>Issue Date</span>
                                    <input className="form-input" type="date" value={recordForm.issue_date} onChange={(event) => setRecordForm({ ...recordForm, issue_date: event.target.value })} />
                                </label>
                                <label className="form-field">
                                    <span>Expiry Date</span>
                                    <input className="form-input" type="date" value={recordForm.expiry_date} onChange={(event) => setRecordForm({ ...recordForm, expiry_date: event.target.value })} />
                                </label>
                                <label className="form-field">
                                    <span>Compliance Status</span>
                                    <select className="form-input" value={recordForm.compliance_status} onChange={(event) => setRecordForm({ ...recordForm, compliance_status: event.target.value })}>
                                        <option value="pending">Pending</option>
                                        <option value="compliant">Compliant</option>
                                        <option value="at_risk">At Risk</option>
                                        <option value="expired">Expired</option>
                                    </select>
                                </label>
                                <label className="form-field">
                                    <span>Renewal Status</span>
                                    <select className="form-input" value={recordForm.renewal_status} onChange={(event) => setRecordForm({ ...recordForm, renewal_status: event.target.value })}>
                                        <option value="not_started">Not Started</option>
                                        <option value="in_progress">In Progress</option>
                                        <option value="submitted">Submitted</option>
                                        <option value="renewed">Renewed</option>
                                        <option value="not_applicable">Not Applicable</option>
                                    </select>
                                </label>
                                <label className="form-field full">
                                    <span>Owner Department</span>
                                    <input className="form-input" value={recordForm.owner_department} onChange={(event) => setRecordForm({ ...recordForm, owner_department: event.target.value })} />
                                </label>
                                <label className="form-field full">
                                    <span>Remarks</span>
                                    <textarea className="form-input" value={recordForm.remarks} onChange={(event) => setRecordForm({ ...recordForm, remarks: event.target.value })} />
                                </label>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Record'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
