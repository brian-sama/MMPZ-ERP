import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    Activity,
    AlertCircle,
    BarChart3,
    ClipboardList,
    DollarSign,
    FolderKanban,
    Target,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

const formatCurrency = (value) =>
    `$${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const budgetTone = (row) => {
    if (!row?.allocated) return 'info';
    const remainingRatio = Number(row.remaining || 0) / Number(row.allocated || 1);
    if (remainingRatio < 0.1) return 'danger';
    if (remainingRatio < 0.25) return 'warning';
    return 'success';
};

const UtilizationBar = ({ value }) => (
    <div style={{ width: '130px' }}>
        <div style={{ height: '6px', background: 'var(--border-subtle)', borderRadius: '4px', overflow: 'hidden' }}>
            <div
                style={{
                    width: `${Math.min(Number(value || 0), 100)}%`,
                    height: '100%',
                    background: value > 85 ? 'var(--brand-danger)' : value > 65 ? 'var(--brand-warning)' : 'var(--brand-primary)',
                    borderRadius: '4px',
                }}
            />
        </div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', marginTop: '4px' }}>
            {Number(value || 0)}% used
        </div>
    </div>
);

const EmptyState = ({ icon: Icon, title, copy }) => (
    <div className="empty-state" style={{ padding: '36px 20px' }}>
        <div className="empty-state-icon"><Icon size={28} /></div>
        <div className="empty-state-title">{title}</div>
        <p className="empty-state-text">{copy}</p>
    </div>
);

export default function BudgetTrackerPage() {
    const { user } = useAuth();
    const [activeTab, setActiveTab] = useState('overview');
    const [overview, setOverview] = useState(null);
    const [programs, setPrograms] = useState([]);
    const [indicators, setIndicators] = useState([]);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const loadBudgetData = async () => {
            setLoading(true);
            setError('');
            try {
                const params = { userId: user.id };
                const [overviewRes, programRes, indicatorRes, activityRes] = await Promise.all([
                    axios.get(`${API_BASE}/budget/overview`, { params }),
                    axios.get(`${API_BASE}/budget/programs`, { params }),
                    axios.get(`${API_BASE}/budget/indicators`, { params }),
                    axios.get(`${API_BASE}/budget/activities`, { params }),
                ]);
                setOverview(overviewRes.data || null);
                setPrograms(programRes.data || []);
                setIndicators(indicatorRes.data || []);
                setActivities(activityRes.data || []);
            } catch (err) {
                setError(err.response?.data?.error || 'Unable to load budget tracker.');
            } finally {
                setLoading(false);
            }
        };

        loadBudgetData();
    }, [user.id]);

    const topPressureIndicators = useMemo(
        () => [...indicators]
            .filter((item) => Number(item.allocated || 0) > 0)
            .sort((a, b) => Number(a.remaining || 0) / Number(a.allocated || 1) - Number(b.remaining || 0) / Number(b.allocated || 1))
            .slice(0, 6),
        [indicators]
    );

    if (loading) return <div className="page-loading"><div className="spinner" /><p>Loading budget tracker...</p></div>;
    if (error) return <div className="panel"><div className="auth-error">{error}</div></div>;

    return (
        <div className="content-stack fade-in">
            <PageHeader
                title="Budget Tracker"
                subtitle="Track allocated, spent, committed, and remaining budget within your authorized scope."
            />

            <div className="kpi-grid">
                <div className="kpi-card primary">
                    <div className="kpi-icon-wrap"><DollarSign size={20} /></div>
                    <div className="kpi-label">Allocated</div>
                    <div className="kpi-value">{formatCurrency(overview?.allocated)}</div>
                    <div className="kpi-sub">Across visible indicators and programs</div>
                </div>
                <div className="kpi-card warning">
                    <div className="kpi-icon-wrap"><BarChart3 size={20} /></div>
                    <div className="kpi-label">Spent</div>
                    <div className="kpi-value">{formatCurrency(overview?.spent)}</div>
                    <div className="kpi-sub">{overview?.utilization_percent || 0}% of allocated budget used</div>
                </div>
                <div className="kpi-card info">
                    <div className="kpi-icon-wrap"><ClipboardList size={20} /></div>
                    <div className="kpi-label">Committed / Pending</div>
                    <div className="kpi-value">{formatCurrency((overview?.committed || 0) + (overview?.pending || 0))}</div>
                    <div className="kpi-sub">Approved and waiting procurement pressure</div>
                </div>
                <div className="kpi-card success">
                    <div className="kpi-icon-wrap"><Target size={20} /></div>
                    <div className="kpi-label">Remaining</div>
                    <div className="kpi-value">{formatCurrency(overview?.remaining)}</div>
                    <div className="kpi-sub">{overview?.indicator_count || 0} indicators in view</div>
                </div>
            </div>

            <div className="segmented-control">
                {[
                    ['overview', 'Overview'],
                    ['programs', 'Programs'],
                    ['indicators', 'Indicators'],
                    ['activities', 'Activities'],
                ].map(([id, label]) => (
                    <button
                        key={id}
                        className={`segmented-button ${activeTab === id ? 'active' : ''}`}
                        onClick={() => setActiveTab(id)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {activeTab === 'overview' && (
                <div className="panels-row">
                    <div className="panel">
                        <div className="panel-header">
                            <div>
                                <h2 className="panel-title">Budget Pressure</h2>
                                <p className="panel-subtitle">Indicators with the least remaining budget capacity.</p>
                            </div>
                        </div>
                        {topPressureIndicators.length > 0 ? (
                            <div className="control-stack">
                                {topPressureIndicators.map((item) => (
                                    <div key={item.id} className="control-row static">
                                        <div>
                                            <div className="control-title">{item.name}</div>
                                            <div className="control-copy">{item.project_name || 'Unassigned project'} · {item.program_name || 'No program'}</div>
                                        </div>
                                        <div className="control-trailing">
                                            <span className={`badge badge-${budgetTone(item)}`}>{formatCurrency(item.remaining)} left</span>
                                            <UtilizationBar value={item.utilization_percent} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState icon={AlertCircle} title="No budget pressure detected" copy="Visible indicators still have sufficient remaining budget." />
                        )}
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <div>
                                <h2 className="panel-title">Recent Activity Costs</h2>
                                <p className="panel-subtitle">Latest spend logged against visible activities.</p>
                            </div>
                        </div>
                        {activities.length > 0 ? (
                            <div className="control-stack">
                                {activities.slice(0, 8).map((activity) => (
                                    <div key={activity.id} className="control-row static">
                                        <div>
                                            <div className="control-title">{activity.name}</div>
                                            <div className="control-copy">{activity.indicator_name || 'No indicator'} · {activity.project_name || 'No project'}</div>
                                        </div>
                                        <span className="badge badge-warning">{formatCurrency(activity.spent)}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <EmptyState icon={Activity} title="No visible activity costs" copy="Activity spend will appear here once activities are logged." />
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'programs' && (
                <BudgetTable
                    rows={programs}
                    emptyIcon={FolderKanban}
                    emptyTitle="No visible program budgets"
                    nameHeader="Program"
                    secondary={(row) => `${row.project_count || 0} projects · ${row.status}`}
                />
            )}

            {activeTab === 'indicators' && (
                <BudgetTable
                    rows={indicators}
                    emptyIcon={Target}
                    emptyTitle="No visible indicator budgets"
                    nameHeader="Indicator"
                    secondary={(row) => `${row.project_name || 'No project'} · ${row.program_name || 'No program'}`}
                />
            )}

            {activeTab === 'activities' && (
                <div className="panel">
                    {activities.length > 0 ? (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Activity</th>
                                        <th>Indicator</th>
                                        <th>Project</th>
                                        <th>Category</th>
                                        <th>Cost</th>
                                        <th>Date</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activities.map((activity) => (
                                        <tr key={activity.id}>
                                            <td>{activity.name}</td>
                                            <td>{activity.indicator_name || 'Unassigned'}</td>
                                            <td>{activity.project_name || 'Unassigned'}</td>
                                            <td><span className="badge badge-muted">{activity.category || 'other'}</span></td>
                                            <td style={{ fontWeight: 700 }}>{formatCurrency(activity.spent)}</td>
                                            <td>{activity.activity_date ? new Date(activity.activity_date).toLocaleDateString() : 'N/A'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <EmptyState icon={Activity} title="No visible activity costs" copy="Activity costs will appear here for your assigned scope." />
                    )}
                </div>
            )}
        </div>
    );
}

function BudgetTable({ rows, emptyIcon, emptyTitle, nameHeader, secondary }) {
    if (rows.length === 0) {
        return (
            <div className="panel">
                <EmptyState icon={emptyIcon} title={emptyTitle} copy="Budget information appears here once records are linked to your scope." />
            </div>
        );
    }

    return (
        <div className="panel">
            <div className="data-table-wrap">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>{nameHeader}</th>
                            <th>Allocated</th>
                            <th>Spent</th>
                            <th>Committed</th>
                            <th>Pending</th>
                            <th>Remaining</th>
                            <th>Use</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => (
                            <tr key={row.id}>
                                <td>
                                    <div style={{ fontWeight: 700 }}>{row.name}</div>
                                    <div className="form-hint">{secondary(row)}</div>
                                </td>
                                <td>{formatCurrency(row.allocated)}</td>
                                <td>{formatCurrency(row.spent)}</td>
                                <td>{formatCurrency(row.committed)}</td>
                                <td>{formatCurrency(row.pending)}</td>
                                <td><span className={`badge badge-${budgetTone(row)}`}>{formatCurrency(row.remaining)}</span></td>
                                <td><UtilizationBar value={row.utilization_percent} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
