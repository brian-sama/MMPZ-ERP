import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useNavigate } from 'react-router-dom';
import {
    Users, FolderKanban, TrendingUp,
    AlertCircle, CheckCircle2, Layers, Clock, ArrowUpRight,
    FileText, DollarSign, Activity
} from 'lucide-react';

export default function ExecutiveDashboardPage() {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const res = await axios.get(`${API_BASE}/dashboard/executive-summary`, {
                    params: { userId: user.id }
                });
                setData(res.data);
            } catch (err) {
                setError('Failed to load dashboard data');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchDashboard();
    }, [user.id]);

    if (loading) return <div className="page-loading"><div className="spinner"></div><p>Loading...</p></div>;
    if (error) return <div className="panel"><div className="auth-error">{error}</div></div>;

    const activityFeed = [
        { icon: FolderKanban, color: '#7B2CBF', text: 'Program "Community Digital Literacy" was created', time: '2 hours ago' },
        { icon: CheckCircle2, color: '#2BB673', text: 'Expense request #1042 was approved', time: '4 hours ago' },
        { icon: Users, color: '#2BB673', text: 'T. Moyo was assigned to Harare District', time: '6 hours ago' },
        { icon: FileText, color: '#9CA3AF', text: 'Quarterly report submitted', time: 'Yesterday' },
        { icon: AlertCircle, color: '#F59E0B', text: 'Office supplies procurement is pending approval', time: 'Yesterday' },
    ];

    return (
        <div className="fade-in">
            <PageHeader
                title="Executive Dashboard"
                subtitle="Overview of programs, finances, and approvals."
            />

            {/* Quick Actions */}
            <div style={{
                display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '24px',
                alignItems: 'center',
                padding: '14px 20px',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
            }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', marginRight: '8px' }}>
                    Actions
                </span>
                {[
                    { label: 'Create Program', path: '/programs' },
                    { label: 'Add Staff Member', path: '/facilitators' },
                    { label: 'Approve Expense', path: '/governance' },
                    { label: 'Generate Report', path: '/reports' },
                ].map(({ label, path }) => (
                    <button
                        key={label}
                        className="btn btn-secondary btn-sm"
                        onClick={() => navigate(path)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {/* KPI Row */}
            <div className="kpi-grid">
                {/* Active Programs — purple */}
                <div className="kpi-card primary" style={{ animationDelay: '0.05s' }}>
                    <div className="kpi-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div className="kpi-icon-wrap" style={{ background: 'rgba(123,44,191,0.15)', color: '#7B2CBF' }}>
                            <Layers size={20} />
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', background: 'rgba(43,182,115,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                            +12%
                        </div>
                    </div>
                    <div className="kpi-value">{data.active_programs}</div>
                    <div className="kpi-label">Active Programs</div>
                    <div className="kpi-sub">{data.active_projects} project{data.active_projects !== 1 ? 's' : ''} running</div>
                    <div style={{ height: '3px', background: 'var(--border-subtle)', borderRadius: '2px', marginTop: '12px' }}>
                        <div style={{ width: '70%', height: '100%', background: 'linear-gradient(90deg, #7B2CBF, #a855f7)', borderRadius: '2px' }}></div>
                    </div>
                </div>

                {/* Development Facilitators — green */}
                <div className="kpi-card success" style={{ animationDelay: '0.1s' }}>
                    <div className="kpi-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div className="kpi-icon-wrap" style={{ background: 'rgba(43,182,115,0.15)', color: '#2BB673' }}>
                            <Users size={20} />
                        </div>
                    </div>
                    <div className="kpi-value">{data.active_facilitators}</div>
                    <div className="kpi-label">Development Facilitators</div>
                    <div className="kpi-sub">Active in the field</div>
                    <div style={{ height: '3px', background: 'var(--border-subtle)', borderRadius: '2px', marginTop: '12px' }}>
                        <div style={{ width: '85%', height: '100%', background: 'linear-gradient(90deg, #2BB673, #34d399)', borderRadius: '2px' }}></div>
                    </div>
                </div>

                {/* Budget — amber */}
                <div className="kpi-card warning" style={{ animationDelay: '0.15s' }}>
                    <div className="kpi-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div className="kpi-icon-wrap" style={{ background: 'rgba(245,158,11,0.15)', color: '#F59E0B' }}>
                            <TrendingUp size={20} />
                        </div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--success)', background: 'rgba(43,182,115,0.1)', padding: '2px 8px', borderRadius: '12px' }}>
                            +4%
                        </div>
                    </div>
                    <div className="kpi-value">{data.budget_utilization_percent}%</div>
                    <div className="kpi-label">Budget Used</div>
                    <div className="kpi-sub">${data.budget_remaining.toLocaleString()} remaining</div>
                    <div style={{ height: '3px', background: 'var(--border-subtle)', borderRadius: '2px', marginTop: '12px' }}>
                        <div style={{ width: `${data.budget_utilization_percent}%`, height: '100%', background: 'linear-gradient(90deg, #F59E0B, #fbbf24)', borderRadius: '2px' }}></div>
                    </div>
                </div>

                {/* Pending Approvals — red */}
                <div className="kpi-card danger" style={{ animationDelay: '0.2s' }}>
                    <div className="kpi-top" style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '14px' }}>
                        <div className="kpi-icon-wrap" style={{ background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>
                            <AlertCircle size={20} />
                        </div>
                    </div>
                    <div className="kpi-value">{data.pending_approvals}</div>
                    <div className="kpi-label">Pending Approvals</div>
                    <div className="kpi-sub">Needs your review</div>
                    <div style={{ height: '3px', background: 'var(--border-subtle)', borderRadius: '2px', marginTop: '12px' }}>
                        <div style={{ width: '40%', height: '100%', background: 'linear-gradient(90deg, #EF4444, #f87171)', borderRadius: '2px' }}></div>
                    </div>
                </div>
            </div>

            <div className="panels-row">
                {/* Approvals Preview */}
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Pending Approvals</h2>
                            <p className="panel-subtitle">Items waiting for your decision</p>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => navigate('/governance')}>
                            View All <ArrowUpRight size={14} />
                        </button>
                    </div>

                    {data.pending_approvals_list?.length > 0 ? (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Type</th>
                                        <th>Submitted by</th>
                                        <th>Date</th>
                                        <th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.pending_approvals_list.map(item => (
                                        <tr key={item.id}>
                                            <td><span className="badge badge-info">{item.request_type.replace('_', ' ')}</span></td>
                                            <td>{item.requester_name}</td>
                                            <td>{new Date(item.created_at).toLocaleDateString()}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className="btn btn-primary btn-sm"
                                                    onClick={() => navigate(`/governance?approvalId=${item.id}`)}
                                                >
                                                    Review
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon"><CheckCircle2 size={32} /></div>
                            <div className="empty-state-title">Nothing pending</div>
                            <p className="empty-state-text">No items are waiting for your approval.</p>
                        </div>
                    )}
                </div>

                {/* M&E Snapshot */}
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Impact Indicators</h2>
                            <p className="panel-subtitle">Progress on key targets</p>
                        </div>
                    </div>

                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Indicator</th>
                                    <th>Progress</th>
                                    <th>Priority</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.key_indicators?.map((ind, idx) => (
                                    <tr key={idx}>
                                        <td style={{ maxWidth: '200px' }}>
                                            <div style={{ fontWeight: 700, fontSize: '13px', color: 'var(--text-primary)', fontFamily: 'var(--font-heading)' }}>{ind.title}</div>
                                            <div className="form-hint" style={{ fontSize: '11px' }}>{ind.current_value} of {ind.target_value}</div>
                                        </td>
                                        <td>
                                            <div style={{ width: '120px' }}>
                                                <div style={{ height: '5px', background: 'var(--border-subtle)', borderRadius: '3px', marginBottom: '4px', overflow: 'hidden' }}>
                                                    <div style={{
                                                        width: `${ind.progress_percentage}%`,
                                                        height: '100%',
                                                        background: ind.progress_percentage > 75 ? '#2BB673' : ind.progress_percentage > 40 ? '#F59E0B' : '#EF4444',
                                                        borderRadius: '3px',
                                                    }}></div>
                                                </div>
                                                <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>{ind.progress_percentage}%</div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${ind.priority === 'critical' ? 'danger' : ind.priority === 'high' ? 'warning' : 'primary'}`} style={{ borderRadius: '6px', fontSize: '9px' }}>
                                                {ind.priority}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Activity Feed */}
            <div className="panel" style={{ marginTop: '20px' }}>
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <Activity size={16} style={{ color: '#7B2CBF' }} /> Recent Activity
                        </h2>
                        <p className="panel-subtitle">Latest actions across the system</p>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {activityFeed.map((evt, i) => {
                        const Icon = evt.icon;
                        return (
                            <div key={i} style={{
                                display: 'flex', alignItems: 'center', gap: '14px',
                                padding: '12px 0',
                                borderBottom: i < activityFeed.length - 1 ? '1px solid var(--border)' : 'none',
                            }}>
                                <div style={{
                                    width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                                    background: `${evt.color}18`,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                    <Icon size={16} style={{ color: evt.color }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{evt.text}</div>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{evt.time}</div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={{ textAlign: 'center', marginTop: '24px', fontSize: '11px', color: 'var(--text-muted)' }}>
                <Clock size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Last updated: {new Date(data.updated_at).toLocaleString()}
            </div>
        </div>
    );
}
