import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import {
    AlertTriangle,
    BarChart3,
    BookOpen,
    Calendar,
    CheckSquare,
    ChevronRight,
    ClipboardCheck,
    Clock,
    Database,
    FileSpreadsheet,
    FileText,
    Link as LinkIcon,
    RefreshCw,
    Search,
    ShieldCheck,
    Users,
    WalletCards,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

const MODULES = [
    { id: 'safeguarding', label: 'Safeguarding', path: '/governance/safeguarding', icon: ShieldCheck },
    { id: 'volunteers', label: 'Volunteer Management', path: '/governance/volunteers', icon: Users },
    { id: 'donors', label: 'Donor Compliance', path: '/governance/donors', icon: FileText },
    { id: 'grants', label: 'Grant Management', path: '/governance/grants', icon: WalletCards },
    { id: 'supervision', label: 'Supervision Logs', path: '/governance/supervision', icon: CheckSquare },
    { id: 'knowledge-hub', label: 'Knowledge Hub', path: '/governance/knowledge-hub', icon: BookOpen },
    { id: 'referrals', label: 'Referral Governance', path: '/governance/referrals', icon: LinkIcon },
    { id: 'performance', label: 'Staff Performance', path: '/governance/performance', icon: BarChart3 },
];

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

const formatStatus = (value) => String(value || 'pending').replace(/_/g, ' ');

const asPercent = (value) => `${Math.round(Number(value || 0))}%`;

const daysUntil = (dateValue) => {
    if (!dateValue) return null;
    const end = new Date(dateValue).getTime();
    if (Number.isNaN(end)) return null;
    return Math.ceil((end - Date.now()) / (1000 * 60 * 60 * 24));
};

const matchesSearch = (term, values) => {
    if (!term) return true;
    const normalized = term.toLowerCase();
    return values.some((value) => String(value || '').toLowerCase().includes(normalized));
};

function MetricCard({ icon: Icon, tone = 'primary', label, value, note }) {
    return (
        <div className="metric-card">
            <div className="metric-top">
                <div>
                    <div className="metric-title">{label}</div>
                    <div className="metric-value">{value}</div>
                </div>
                <div className={`metric-icon ${tone}`}>
                    <Icon size={18} />
                </div>
            </div>
            {note && <div className="metric-text">{note}</div>}
        </div>
    );
}

function EmptyModuleState({ icon: Icon = Database, title, text }) {
    return (
        <div className="empty-state">
            <div className="empty-state-icon">
                <Icon size={26} />
            </div>
            <div className="empty-state-title">{title}</div>
            {text && <p className="empty-state-text">{text}</p>}
        </div>
    );
}

export default function GovernanceCompliancePage({ activeTab = 'safeguarding' }) {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [queue, setQueue] = useState([]);
    const [financeSummary, setFinanceSummary] = useState(null);
    const [grants, setGrants] = useState([]);
    const [facilitators, setFacilitators] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [riskSummary, setRiskSummary] = useState(null);
    const [projects, setProjects] = useState([]);
    const [submissions, setSubmissions] = useState([]);

    const activeModule = MODULES.find((module) => module.id === activeTab) || MODULES[0];
    const ActiveIcon = activeModule.icon;

    const fetchWorkspace = async ({ silent = false } = {}) => {
        if (!user?.id) return;
        if (silent) {
            setRefreshing(true);
        } else {
            setLoading(true);
        }
        setError('');

        const params = { userId: user.id };
        const sources = {
            queue: axios.get(`${API_BASE}/governance/queue`, { params }),
            financeSummary: axios.get(`${API_BASE}/finance/summary`, { params }),
            grants: axios.get(`${API_BASE}/finance/grants`, { params }),
            facilitators: axios.get(`${API_BASE}/facilitators`, { params }),
            documents: axios.get(`${API_BASE}/documents`, { params }),
            riskSummary: axios.get(`${API_BASE}/analytics/risk-summary`, { params }),
            projects: axios.get(`${API_BASE}/projects`, { params }),
            submissions: axios.get(`${API_BASE}/submissions`, {
                params: { ...params, view: 'admin', limit: 30 },
            }),
        };

        const results = await Promise.allSettled(
            Object.entries(sources).map(([key, request]) => request.then((res) => [key, res.data]))
        );

        let fulfilled = 0;
        for (const result of results) {
            if (result.status !== 'fulfilled') continue;
            fulfilled += 1;
            const [key, data] = result.value;
            if (key === 'queue') setQueue(Array.isArray(data) ? data : []);
            if (key === 'financeSummary') setFinanceSummary(data || null);
            if (key === 'grants') setGrants(Array.isArray(data) ? data : []);
            if (key === 'facilitators') setFacilitators(Array.isArray(data) ? data : []);
            if (key === 'documents') setDocuments(Array.isArray(data?.items) ? data.items : []);
            if (key === 'riskSummary') setRiskSummary(data || null);
            if (key === 'projects') setProjects(Array.isArray(data) ? data : []);
            if (key === 'submissions') setSubmissions(Array.isArray(data) ? data : []);
        }

        if (fulfilled === 0) {
            setError('Governance workspace data is currently unavailable.');
        }
        setLoading(false);
        setRefreshing(false);
    };

    useEffect(() => {
        fetchWorkspace();
    }, [user?.id]);

    const pendingQueue = useMemo(
        () => queue.filter((item) => ['pending', 'submitted', 'verified'].includes(String(item.status || 'pending'))),
        [queue]
    );

    const riskIndicators = riskSummary?.indicators || [];
    const highRiskIndicators = riskIndicators.filter((item) => item.risk_level === 'high');
    const endingGrants = grants.filter((grant) => {
        const days = daysUntil(grant.end_date);
        return days !== null && days >= 0 && days <= 60;
    });
    const activeFacilitators = facilitators.filter((facilitator) => facilitator.status === 'active');
    const recentDocuments = [...documents].sort(
        (a, b) => new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
    );
    const searchableRiskIndicators = riskIndicators.filter((item) =>
        matchesSearch(searchTerm, [item.title, item.project_name, item.program_name, item.risk_level])
    );
    const searchableQueue = pendingQueue.filter((item) =>
        matchesSearch(searchTerm, [item.display_type, item.entity_type, item.requester_name, item.requester_role])
    );
    const searchableGrants = grants.filter((grant) =>
        matchesSearch(searchTerm, [grant.name, grant.code, grant.donor_name, grant.status])
    );
    const searchableFacilitators = facilitators.filter((facilitator) =>
        matchesSearch(searchTerm, [facilitator.name, facilitator.email, facilitator.status, facilitator.phone])
    );
    const searchableDocuments = recentDocuments.filter((document) =>
        matchesSearch(searchTerm, [document.title, document.file_name, document.category, document.uploaded_by_name])
    );
    const searchableSubmissions = submissions.filter((submission) =>
        matchesSearch(searchTerm, [
            submission.title,
            submission.submission_title,
            submission.submitter_name,
            submission.status,
            submission.submission_type,
        ])
    );

    const financeMetrics = financeSummary?.metrics || {};
    const averagePerformance =
        riskIndicators.length > 0
            ? Math.round(
                  riskIndicators.reduce((sum, item) => sum + Number(item.progress_percentage || 0), 0) /
                      riskIndicators.length
              )
            : 0;

    const recentDocumentCount = recentDocuments.filter((document) => {
        const updatedAt = new Date(document.updated_at || document.created_at || 0).getTime();
        return updatedAt > Date.now() - 30 * 24 * 60 * 60 * 1000;
    }).length;

    const renderSafeguarding = () => (
        <>
            <div className="metric-grid">
                <MetricCard
                    icon={AlertTriangle}
                    tone="warning"
                    label="High Risk Indicators"
                    value={highRiskIndicators.length}
                    note="M&E records flagged for immediate control attention"
                />
                <MetricCard
                    icon={ClipboardCheck}
                    tone="primary"
                    label="Open Approvals"
                    value={pendingQueue.length}
                    note="Items currently waiting in the governance queue"
                />
                <MetricCard
                    icon={Clock}
                    tone="info"
                    label="Older Than 30 Days"
                    value={riskIndicators.filter((item) => Number(item.days_since_update || 0) > 30).length}
                    note="Controls with stale supporting evidence"
                />
            </div>

            <div className="panels-row">
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Escalation Watchlist</h2>
                            <p className="panel-subtitle">Risk records drawn from the M&E engine.</p>
                        </div>
                    </div>
                    {searchableRiskIndicators.length === 0 ? (
                        <EmptyModuleState icon={ShieldCheck} title="No safeguarding risk records" />
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Indicator</th>
                                        <th>Project</th>
                                        <th>Risk</th>
                                        <th>Progress</th>
                                        <th>Last Update</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {searchableRiskIndicators.slice(0, 8).map((item) => (
                                        <tr key={item.id}>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{item.title}</div>
                                                <div className="form-hint">{item.program_name || 'Program not set'}</div>
                                            </td>
                                            <td>{item.project_name || 'Unassigned'}</td>
                                            <td>
                                                <span className={`badge badge-${item.risk_level === 'high' ? 'danger' : item.risk_level === 'medium' ? 'warning' : 'success'}`}>
                                                    {item.risk_level || 'low'}
                                                </span>
                                            </td>
                                            <td>{asPercent(item.progress_percentage)}</td>
                                            <td>{Number(item.days_since_update || 0)} days ago</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Approval Escalations</h2>
                            <p className="panel-subtitle">The same queue used by Finance and Director approvals.</p>
                        </div>
                        <button className="btn btn-secondary btn-sm" onClick={() => navigate('/governance')}>
                            Open Queue <ChevronRight size={14} />
                        </button>
                    </div>
                    {searchableQueue.length === 0 ? (
                        <EmptyModuleState icon={ClipboardCheck} title="Governance queue is clear" />
                    ) : (
                        <div className="control-stack compact">
                            {searchableQueue.slice(0, 6).map((item) => (
                                <button
                                    key={item.id}
                                    className="control-row"
                                    onClick={() => navigate(`/governance?approvalId=${item.id}`)}
                                >
                                    <div>
                                        <div className="control-title">{item.display_type || formatStatus(item.entity_type)}</div>
                                        <div className="control-copy">
                                            {item.requester_name || 'Unknown requester'} · {formatDate(item.created_at)}
                                        </div>
                                    </div>
                                    <span className="badge badge-warning">{formatStatus(item.status)}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </>
    );

    const renderVolunteers = () => (
        <>
            <div className="metric-grid">
                <MetricCard icon={Users} label="Registered Facilitators" value={facilitators.length} note="Field profiles from the Facilitators module" />
                <MetricCard icon={ClipboardCheck} tone="success" label="Active Facilitators" value={activeFacilitators.length} note="Profiles currently marked active" />
                <MetricCard
                    icon={CheckSquare}
                    tone="info"
                    label="Active Assignments"
                    value={facilitators.reduce((sum, item) => sum + Number(item.active_assignments || 0), 0)}
                    note="Project assignment controls"
                />
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Facilitator Governance Registry</h2>
                        <p className="panel-subtitle">Pulled directly from field staff profiles and project assignments.</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/facilitators')}>
                        Manage <ChevronRight size={14} />
                    </button>
                </div>
                {searchableFacilitators.length === 0 ? (
                    <EmptyModuleState icon={Users} title="No facilitator records found" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Facilitator</th>
                                    <th>Status</th>
                                    <th>Contact</th>
                                    <th>Assignments</th>
                                    <th>Joined</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchableFacilitators.slice(0, 12).map((facilitator) => (
                                    <tr key={facilitator.user_id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{facilitator.name}</div>
                                            <div className="form-hint">{facilitator.email}</div>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${facilitator.status === 'active' ? 'success' : 'muted'}`}>
                                                {facilitator.status || 'active'}
                                            </span>
                                        </td>
                                        <td>{facilitator.phone || 'No phone'}</td>
                                        <td>{Number(facilitator.active_assignments || 0)} active</td>
                                        <td>{formatDate(facilitator.joined_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );

    const renderDonors = () => (
        <>
            <div className="metric-grid">
                <MetricCard icon={FileText} label="Donors" value={financeMetrics.total_donors || 0} note="From finance master data" />
                <MetricCard icon={WalletCards} tone="success" label="Active Grants" value={financeMetrics.total_grants || grants.length} note={formatCurrency(financeMetrics.commitment_total)} />
                <MetricCard icon={Calendar} tone="warning" label="Closing In 60 Days" value={endingGrants.length} note="Grant end dates needing reporting focus" />
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Donor Commitments & Reporting Windows</h2>
                        <p className="panel-subtitle">Grant dates and utilization come from Finance, not a duplicate compliance list.</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/finance')}>
                        Finance <ChevronRight size={14} />
                    </button>
                </div>
                {searchableGrants.length === 0 ? (
                    <EmptyModuleState icon={FileText} title="No donor grant records found" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Donor / Grant</th>
                                    <th>Commitment</th>
                                    <th>Used</th>
                                    <th>End Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchableGrants.slice(0, 10).map((grant) => {
                                    const used = Number(grant.total_used || 0);
                                    const amount = Number(grant.total_amount || 0);
                                    const percent = amount > 0 ? (used / amount) * 100 : 0;
                                    return (
                                        <tr key={grant.id}>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{grant.name}</div>
                                                <div className="form-hint">{grant.donor_name} · {grant.code || 'No code'}</div>
                                            </td>
                                            <td>{formatCurrency(amount)}</td>
                                            <td>
                                                <div className="progress-bar-wrap" style={{ marginBottom: '5px' }}>
                                                    <div className="progress-bar-fill" style={{ width: `${Math.min(percent, 100)}%`, background: 'var(--brand-primary)' }} />
                                                </div>
                                                <span>{formatCurrency(used)} · {asPercent(percent)}</span>
                                            </td>
                                            <td>{formatDate(grant.end_date)}</td>
                                            <td>
                                                <span className={`badge badge-${daysUntil(grant.end_date) !== null && daysUntil(grant.end_date) <= 60 ? 'warning' : 'success'}`}>
                                                    {daysUntil(grant.end_date) !== null && daysUntil(grant.end_date) <= 60 ? 'reporting window' : 'active'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );

    const renderGrants = () => (
        <>
            <div className="metric-grid">
                <MetricCard icon={WalletCards} label="Grant Pool" value={formatCurrency(financeMetrics.commitment_total)} note={`${financeMetrics.total_grants || grants.length} grant records`} />
                <MetricCard icon={FileSpreadsheet} tone="info" label="Allocated" value={formatCurrency(financeMetrics.allocated_total)} note="Budget lines under grant controls" />
                <MetricCard icon={ClipboardCheck} tone="warning" label="Pending Commitments" value={formatCurrency(financeMetrics.pending_procurement_total)} note="Awaiting approval before spend" />
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Grant Allocation Discipline</h2>
                        <p className="panel-subtitle">Budget and procurement commitments share the same Finance data source.</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/budget')}>
                        Budget <ChevronRight size={14} />
                    </button>
                </div>
                {searchableGrants.length === 0 ? (
                    <EmptyModuleState icon={WalletCards} title="No grant budget records found" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Grant</th>
                                    <th>Budgeted</th>
                                    <th>Allocated</th>
                                    <th>Spent</th>
                                    <th>Balance</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchableGrants.slice(0, 10).map((grant) => {
                                    const amount = Number(grant.total_amount || 0);
                                    const used = Number(grant.total_used || 0);
                                    const balance = amount - used;
                                    return (
                                        <tr key={grant.id}>
                                            <td>
                                                <div style={{ fontWeight: 700 }}>{grant.name}</div>
                                                <div className="form-hint">{grant.donor_name || 'No donor'} · {grant.code || 'No code'}</div>
                                            </td>
                                            <td>{formatCurrency(grant.total_budgeted || 0)}</td>
                                            <td>{formatCurrency(grant.total_allocated || 0)}</td>
                                            <td>{formatCurrency(used)}</td>
                                            <td>
                                                <span className={`badge badge-${balance < 0 ? 'danger' : 'success'}`}>
                                                    {formatCurrency(balance)}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );

    const renderSupervision = () => (
        <>
            <div className="metric-grid">
                <MetricCard icon={CheckSquare} label="Review Queue" value={searchableSubmissions.length} note="Unified staff submissions in review" />
                <MetricCard icon={AlertTriangle} tone="warning" label="Risk Follow Ups" value={highRiskIndicators.length} note="M&E records requiring supervision" />
                <MetricCard icon={ClipboardCheck} tone="success" label="Approved Items" value={submissions.filter((item) => item.status === 'approved').length} note="Closed staff submission controls" />
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Supervision & QA Worklist</h2>
                        <p className="panel-subtitle">Staff submissions, approvals, and M&E risk signals in one review surface.</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/submissions')}>
                        Submissions <ChevronRight size={14} />
                    </button>
                </div>
                {searchableSubmissions.length === 0 ? (
                    <EmptyModuleState icon={CheckSquare} title="No supervision submissions found" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Submission</th>
                                    <th>Submitter</th>
                                    <th>Status</th>
                                    <th>Handler</th>
                                    <th>Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchableSubmissions.slice(0, 10).map((submission) => (
                                    <tr key={submission.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{submission.title || submission.submission_title || 'Untitled submission'}</div>
                                            <div className="form-hint">{formatStatus(submission.submission_type)}</div>
                                        </td>
                                        <td>{submission.submitter_name || 'Unknown'}</td>
                                        <td>
                                            <span className={`badge badge-${submission.status === 'approved' ? 'success' : submission.status === 'rejected' ? 'danger' : 'warning'}`}>
                                                {formatStatus(submission.status)}
                                            </span>
                                        </td>
                                        <td>{formatStatus(submission.current_handler_role)}</td>
                                        <td>{formatDate(submission.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );

    const renderKnowledgeHub = () => (
        <>
            <div className="metric-grid">
                <MetricCard icon={BookOpen} label="Documents" value={documents.length} note="Shared policy and resource library" />
                <MetricCard icon={FileText} tone="info" label="Categories" value={new Set(documents.map((document) => document.category)).size} note="Library classification controls" />
                <MetricCard icon={Clock} tone="success" label="Recent Uploads" value={recentDocumentCount} note="Updated in the last 30 days" />
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Approved Knowledge Assets</h2>
                        <p className="panel-subtitle">Documents come from the ERP intranet library.</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/intranet/documents')}>
                        Library <ChevronRight size={14} />
                    </button>
                </div>
                {searchableDocuments.length === 0 ? (
                    <EmptyModuleState icon={BookOpen} title="No knowledge hub documents found" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Document</th>
                                    <th>Category</th>
                                    <th>Owner</th>
                                    <th>Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchableDocuments.slice(0, 12).map((document) => (
                                    <tr key={document.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{document.title}</div>
                                            <div className="form-hint">{document.file_name || 'No file name'}</div>
                                        </td>
                                        <td><span className="badge badge-info">{document.category || 'General'}</span></td>
                                        <td>{document.uploaded_by_name || 'System'}</td>
                                        <td>{formatDate(document.updated_at || document.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );

    const renderReferrals = () => (
        <>
            <div className="metric-grid">
                <MetricCard icon={LinkIcon} label="Active Projects" value={projects.length} note="Program linkage boundary" />
                <MetricCard icon={AlertTriangle} tone="warning" label="Referral Watchlist" value={highRiskIndicators.length} note="Client-service linkage signals from M&E risk" />
                <MetricCard icon={Users} tone="info" label="Field Facilitators" value={activeFacilitators.length} note="People available for follow-up assignments" />
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Referral Governance Watchlist</h2>
                        <p className="panel-subtitle">Project ownership, field coverage, and M&E risk records are reviewed together.</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/me')}>
                        M&E <ChevronRight size={14} />
                    </button>
                </div>
                {searchableRiskIndicators.length === 0 ? (
                    <EmptyModuleState icon={LinkIcon} title="No referral watchlist items found" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Indicator</th>
                                    <th>Program / Project</th>
                                    <th>Risk</th>
                                    <th>Evidence Age</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchableRiskIndicators.slice(0, 10).map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{item.title}</div>
                                            <div className="form-hint">Target progress {asPercent(item.progress_percentage)}</div>
                                        </td>
                                        <td>
                                            <div>{item.project_name || 'Unassigned project'}</div>
                                            <div className="form-hint">{item.program_name || 'Program not set'}</div>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${item.risk_level === 'high' ? 'danger' : item.risk_level === 'medium' ? 'warning' : 'success'}`}>
                                                {item.risk_level || 'low'}
                                            </span>
                                        </td>
                                        <td>{Number(item.days_since_update || 0)} days</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );

    const renderPerformance = () => (
        <>
            <div className="metric-grid">
                <MetricCard icon={BarChart3} label="Average Performance" value={asPercent(averagePerformance)} note={`${riskIndicators.length} indicators in view`} />
                <MetricCard icon={AlertTriangle} tone="warning" label="High Risk" value={riskSummary?.high_risk_count || 0} note="Risk engine score above threshold" />
                <MetricCard icon={ClipboardCheck} tone="success" label="Low Risk" value={riskSummary?.low_risk_count || 0} note="Controls tracking normally" />
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Performance Governance Matrix</h2>
                        <p className="panel-subtitle">KPI performance and risk are shared with the Analytics workspace.</p>
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => navigate('/analytics')}>
                        Analytics <ChevronRight size={14} />
                    </button>
                </div>
                {searchableRiskIndicators.length === 0 ? (
                    <EmptyModuleState icon={BarChart3} title="No performance records found" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Indicator</th>
                                    <th>Progress</th>
                                    <th>Budget Used</th>
                                    <th>Velocity</th>
                                    <th>Risk</th>
                                </tr>
                            </thead>
                            <tbody>
                                {searchableRiskIndicators.slice(0, 12).map((item) => (
                                    <tr key={item.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{item.title}</div>
                                            <div className="form-hint">{item.project_name || item.program_name || 'No project'}</div>
                                        </td>
                                        <td>{asPercent(item.progress_percentage)}</td>
                                        <td>{asPercent(item.budget_utilization_percent)}</td>
                                        <td>{Number(item.velocity || 0).toFixed(2)}</td>
                                        <td>
                                            <span className={`badge badge-${item.risk_level === 'high' ? 'danger' : item.risk_level === 'medium' ? 'warning' : 'success'}`}>
                                                {item.risk_level || 'low'}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );

    const renderModule = () => {
        if (activeTab === 'volunteers') return renderVolunteers();
        if (activeTab === 'donors') return renderDonors();
        if (activeTab === 'grants') return renderGrants();
        if (activeTab === 'supervision') return renderSupervision();
        if (activeTab === 'knowledge-hub') return renderKnowledgeHub();
        if (activeTab === 'referrals') return renderReferrals();
        if (activeTab === 'performance') return renderPerformance();
        return renderSafeguarding();
    };

    if (loading) {
        return <div className="page-loading"><div className="spinner" /></div>;
    }

    return (
        <div className="fade-in governance-workspace">
            <PageHeader
                title="Governance & Compliance"
                subtitle="Shared control view across approvals, finance, field delivery, documents, and M&E evidence."
                actions={
                    <div className="governance-toolbar">
                        <div className="search-box">
                            <Search size={14} className="search-icon" />
                            <input
                                className="form-input"
                                style={{ height: '36px', paddingLeft: '32px' }}
                                placeholder="Search controls..."
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                            />
                        </div>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => fetchWorkspace({ silent: true })}
                            disabled={refreshing}
                        >
                            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                            {refreshing ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                }
            />

            {error && <div className="page-message error">{error}</div>}

            <section className="domain-hero">
                <div>
                    <div className="domain-kicker">ERP Control Layer</div>
                    <h2>Governance now sits on top of the same records the teams already use every day.</h2>
                    <p>
                        The compliance modules read approvals, grants, facilitators, shared documents, submissions, projects,
                        and analytics from the core ERP instead of maintaining a separate demo workspace.
                    </p>
                </div>
                <div className="hero-control-card">
                    <div className="hero-control-label">Active Module</div>
                    <div className="hero-control-value" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <ActiveIcon size={28} />
                        {activeModule.label}
                    </div>
                    <p>{pendingQueue.length} governance item{pendingQueue.length === 1 ? '' : 's'} waiting across the shared approval queue.</p>
                </div>
            </section>

            <div className="signal-strip">
                <div className="signal-card">
                    <div className="signal-icon primary"><ShieldCheck size={18} /></div>
                    <div className="signal-meta">
                        <div className="signal-label">Approval Queue</div>
                        <div className="signal-value">{pendingQueue.length}</div>
                        <div className="signal-note">Pending governance actions</div>
                    </div>
                </div>
                <div className="signal-card">
                    <div className="signal-icon success"><WalletCards size={18} /></div>
                    <div className="signal-meta">
                        <div className="signal-label">Commitments</div>
                        <div className="signal-value">{formatCurrency(financeMetrics.commitment_total)}</div>
                        <div className="signal-note">{financeMetrics.total_grants || grants.length} active grants</div>
                    </div>
                </div>
                <div className="signal-card">
                    <div className="signal-icon warning"><AlertTriangle size={18} /></div>
                    <div className="signal-meta">
                        <div className="signal-label">High Risk</div>
                        <div className="signal-value">{highRiskIndicators.length}</div>
                        <div className="signal-note">M&E risk engine records</div>
                    </div>
                </div>
                <div className="signal-card">
                    <div className="signal-icon accent"><Users size={18} /></div>
                    <div className="signal-meta">
                        <div className="signal-label">Field Coverage</div>
                        <div className="signal-value">{activeFacilitators.length}</div>
                        <div className="signal-note">Active facilitator profiles</div>
                    </div>
                </div>
            </div>

            <div className="governance-module-grid" style={{ gridTemplateColumns: '1fr' }}>
                <section className="content-stack" style={{ minWidth: 0 }}>
                    {renderModule()}
                </section>
            </div>
        </div>
    );
}
