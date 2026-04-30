import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    Activity,
    AlertCircle,
    BarChart3,
    CheckCircle2,
    FolderKanban,
    Target,
    Users,
} from 'lucide-react';
import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Pie,
    PieChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from 'recharts';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

export default function AnalyticsDashboardPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [summary, setSummary] = useState(null);
    const [performance, setPerformance] = useState([]);
    const [programs, setPrograms] = useState([]);
    const [projects, setProjects] = useState([]);
    const [indicators, setIndicators] = useState([]);
    const [governanceItems, setGovernanceItems] = useState([]);
    const [riskSummary, setRiskSummary] = useState(null);
    const [multiYear, setMultiYear] = useState([]);

    useEffect(() => {
        const loadAnalytics = async () => {
            setLoading(true);
            setError('');
            const results = await Promise.allSettled([
                axios.get(`${API_BASE}/dashboard/executive-summary`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/me/summary`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/programs`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/projects`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/indicators`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/governance/queue`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/analytics/risk-summary`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/analytics/multi-year`, { params: { userId: user.id } }),
            ]);

            const [summaryRes, perfRes, programRes, projectRes, indicatorRes, governanceRes, riskRes, multiYearRes] = results;

            if (summaryRes.status === 'fulfilled') setSummary(summaryRes.value.data);
            if (perfRes.status === 'fulfilled') setPerformance(perfRes.value.data || []);
            if (programRes.status === 'fulfilled') setPrograms(programRes.value.data || []);
            if (projectRes.status === 'fulfilled') setProjects(projectRes.value.data || []);
            if (indicatorRes.status === 'fulfilled') setIndicators(indicatorRes.value.data || []);
            if (governanceRes.status === 'fulfilled') setGovernanceItems(governanceRes.value.data || []);
            if (riskRes.status === 'fulfilled') setRiskSummary(riskRes.value.data || null);
            if (multiYearRes.status === 'fulfilled') setMultiYear(multiYearRes.value.data || []);

            const failed = results.every((result) => result.status === 'rejected');
            if (failed) {
                setError('Unable to load analytics right now.');
            }
            setLoading(false);
        };

        loadAnalytics();
    }, [user.id]);

    const programStatusData = useMemo(() => {
        const counts = programs.reduce((acc, program) => {
            const key = program.status || 'unknown';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [programs]);

    const indicatorPriorityData = useMemo(() => {
        const counts = indicators.reduce((acc, indicator) => {
            const key = indicator.priority || 'medium';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [indicators]);

    const chartPerformance = useMemo(
        () => [...performance].reverse().slice(-6),
        [performance]
    );

    const governanceBreakdown = useMemo(() => {
        const counts = governanceItems.reduce((acc, item) => {
            const key = item.entity_type || item.request_type || 'other';
            acc[key] = (acc[key] || 0) + 1;
            return acc;
        }, {});
        return Object.entries(counts).map(([name, value]) => ({ name, value }));
    }, [governanceItems]);

    if (loading) {
        return <div className="page-loading"><div className="spinner" /><p>Loading analytics...</p></div>;
    }

    if (error) {
        return <div className="panel"><div className="auth-error">{error}</div></div>;
    }

    return (
        <div className="content-stack fade-in">
            <PageHeader
                title="Advanced Analytics"
                subtitle="Operational analytics built directly into the ERP."
            />

            <div className="kpi-grid">
                <div className="kpi-card primary">
                    <div className="kpi-icon-wrap"><FolderKanban size={20} /></div>
                    <div className="kpi-label">Programs</div>
                    <div className="kpi-value">{summary?.active_programs ?? programs.filter((item) => item.status === 'active').length}</div>
                    <div className="kpi-sub">{projects.length} total projects in the system</div>
                </div>
                <div className="kpi-card success">
                    <div className="kpi-icon-wrap"><Users size={20} /></div>
                    <div className="kpi-label">Facilitators</div>
                    <div className="kpi-value">{summary?.active_facilitators ?? 0}</div>
                    <div className="kpi-sub">Active field delivery workforce</div>
                </div>
                <div className="kpi-card warning">
                    <div className="kpi-icon-wrap"><Target size={20} /></div>
                    <div className="kpi-label">Indicators</div>
                    <div className="kpi-value">{indicators.length}</div>
                    <div className="kpi-sub">{indicators.filter((item) => item.status === 'active').length} active tracking indicators</div>
                </div>
                <div className="kpi-card danger">
                    <div className="kpi-icon-wrap"><AlertCircle size={20} /></div>
                    <div className="kpi-label">High Risk</div>
                    <div className="kpi-value">{riskSummary?.high_risk_count ?? 0}</div>
                    <div className="kpi-sub">Indicators needing budget or progress attention</div>
                </div>
            </div>

            <div className="panels-row">
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Performance Trend</h2>
                            <p className="panel-subtitle">Reached values reported over the last periods.</p>
                        </div>
                    </div>
                    <div style={{ height: '300px' }}>
                        {chartPerformance.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={chartPerformance}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="reporting_period" />
                                    <YAxis />
                                    <Tooltip
                                        contentStyle={{
                                            background: 'var(--bg-surface)',
                                            border: '1px solid var(--border)',
                                            borderRadius: '10px',
                                        }}
                                    />
                                    <Bar dataKey="total_reached" fill="var(--brand-primary)" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state" style={{ height: '100%' }}>
                                <div className="empty-state-icon"><BarChart3 size={28} /></div>
                                <div className="empty-state-title">No performance data yet</div>
                                <p className="empty-state-text">This chart will populate as progress updates are submitted.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Program Status Mix</h2>
                            <p className="panel-subtitle">Current distribution of organizational programs.</p>
                        </div>
                    </div>
                    <div style={{ height: '300px' }}>
                        {programStatusData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={programStatusData} dataKey="value" nameKey="name" outerRadius={96} innerRadius={52}>
                                        {programStatusData.map((entry, index) => (
                                            <Cell
                                                key={entry.name}
                                                fill={['#2f5d50', '#be8a3d', '#8fa39a', '#c76b5c', '#6b7280'][index % 5]}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state" style={{ height: '100%' }}>
                                <div className="empty-state-icon"><FolderKanban size={28} /></div>
                                <div className="empty-state-title">No programs yet</div>
                                <p className="empty-state-text">Create your first program to unlock program-level analytics.</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="panels-row">
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Multi-Year Comparison</h2>
                            <p className="panel-subtitle">Average performance and budget use by year.</p>
                        </div>
                    </div>
                    <div style={{ height: '280px' }}>
                        {multiYear.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={multiYear}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                                    <XAxis dataKey="year" />
                                    <YAxis />
                                    <Tooltip />
                                    <Bar dataKey="avg_performance" fill="var(--brand-primary)" radius={[6, 6, 0, 0]} />
                                    <Bar dataKey="avg_budget_used" fill="var(--brand-warning)" radius={[6, 6, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state" style={{ height: '100%' }}>
                                <div className="empty-state-icon"><BarChart3 size={28} /></div>
                                <div className="empty-state-title">No multi-year data yet</div>
                                <p className="empty-state-text">Yearly comparisons appear after indicators have dated updates.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Risk Watchlist</h2>
                            <p className="panel-subtitle">Indicators with the highest combined risk score.</p>
                        </div>
                    </div>
                    {(riskSummary?.indicators || []).length > 0 ? (
                        <div className="control-stack">
                            {riskSummary.indicators.slice(0, 6).map((indicator) => (
                                <div key={indicator.id} className="control-row static">
                                    <div>
                                        <div className="control-title">{indicator.title}</div>
                                        <div className="control-copy">
                                            {indicator.project_name || 'No project'} · {indicator.progress_percentage}% progress · {indicator.budget_utilization_percent}% budget used
                                        </div>
                                    </div>
                                    <span className={`badge badge-${indicator.risk_level === 'high' ? 'danger' : indicator.risk_level === 'medium' ? 'warning' : 'success'}`}>
                                        {indicator.auto_risk_score}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: '36px 20px' }}>
                            <div className="empty-state-icon"><CheckCircle2 size={28} /></div>
                            <div className="empty-state-title">No risk data yet</div>
                            <p className="empty-state-text">Risk signals appear as indicators collect progress and budget data.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="panels-row">
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Indicator Priorities</h2>
                            <p className="panel-subtitle">Where the current tracking effort is concentrated.</p>
                        </div>
                    </div>
                    <div style={{ height: '280px' }}>
                        {indicatorPriorityData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={indicatorPriorityData} layout="vertical">
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                                    <XAxis type="number" />
                                    <YAxis type="category" dataKey="name" width={90} />
                                    <Tooltip />
                                    <Bar dataKey="value" fill="var(--brand-accent)" radius={[0, 6, 6, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="empty-state" style={{ height: '100%' }}>
                                <div className="empty-state-icon"><Target size={28} /></div>
                                <div className="empty-state-title">No indicator distribution yet</div>
                                <p className="empty-state-text">Indicator priority analytics appear once indicators are created.</p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Governance Breakdown</h2>
                            <p className="panel-subtitle">What is currently sitting in the review queue.</p>
                        </div>
                    </div>
                    {governanceBreakdown.length > 0 ? (
                        <div className="control-stack">
                            {governanceBreakdown.map((item) => (
                                <div key={item.name} className="control-row static">
                                    <div>
                                        <div className="control-title">{String(item.name).replace(/_/g, ' ')}</div>
                                        <div className="control-copy">Pending items in this category</div>
                                    </div>
                                    <span className="badge badge-warning">{item.value}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: '36px 20px' }}>
                            <div className="empty-state-icon"><CheckCircle2 size={28} /></div>
                            <div className="empty-state-title">Governance queue is clear</div>
                            <p className="empty-state-text">There are no pending governance items at the moment.</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Operational Notes</h2>
                        <p className="panel-subtitle">Quick context from the data loaded on this page.</p>
                    </div>
                </div>
                <div className="control-stack">
                    <div className="control-row static">
                        <div>
                            <div className="control-title">Budget utilization</div>
                            <div className="control-copy">Current executive summary utilization snapshot.</div>
                        </div>
                        <span className="badge badge-info">
                            {summary?.budget_utilization_percent ?? 0}%
                        </span>
                    </div>
                    <div className="control-row static">
                        <div>
                            <div className="control-title">Projects in delivery</div>
                            <div className="control-copy">Projects currently marked active across the system.</div>
                        </div>
                        <span className="badge badge-success">
                            {projects.filter((project) => project.status === 'active').length}
                        </span>
                    </div>
                    <div className="control-row static">
                        <div>
                            <div className="control-title">Tracked activity</div>
                            <div className="control-copy">This page now uses native ERP analytics only. No external iframe is required.</div>
                        </div>
                        <span className="badge badge-primary">
                            <Activity size={12} style={{ marginRight: 4 }} />
                            Native
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
