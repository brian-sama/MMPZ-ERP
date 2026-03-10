import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import {
    DollarSign, Landmark, Receipt, FileText,
    Plus, ArrowUpRight, Wallet, History,
    BarChart4, PieChart, ShoppingBag, ShieldCheck
} from 'lucide-react';

export default function FinanceAdminPage() {
    const { user } = useAuth();
    const [tab, setTab] = useState('overview'); // 'overview', 'grants', 'procurement'
    const [metrics, setMetrics] = useState(null);
    const [grants, setGrants] = useState([]);
    const [procurement, setProcurement] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchFinanceData();
    }, []);

    const fetchFinanceData = async () => {
        setLoading(true);
        try {
            const summaryRes = await axios.get(`${API_BASE}/finance/summary`, { params: { userId: user.id } });
            setMetrics(summaryRes.data.metrics);

            const grantsRes = await axios.get(`${API_BASE}/finance/grants`, { params: { userId: user.id } });
            setGrants(grantsRes.data);

            const procRes = await axios.get(`${API_BASE}/procurement`, { params: { userId: user.id } });
            setProcurement(procRes.data);
        } catch (err) {
            console.error('Failed to fetch finance data');
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

    return (
        <div className="fade-in">
            <PageHeader
                title="Finance & Administration"
                subtitle="Manage organizational wealth, donor grants, and procurement workflows."
                actions={
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn btn-secondary btn-sm"><History size={16} /> Audit Logs</button>
                        <button className="btn btn-primary btn-sm"><Plus size={16} /> New Requisition</button>
                    </div>
                }
            />

            {/* Finance Tabs */}
            <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border)', marginBottom: '24px' }}>
                {['overview', 'grants', 'procurement'].map(t => (
                    <button
                        key={t}
                        onClick={() => setTab(t)}
                        style={{
                            padding: '12px 4px',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: tab === t ? 'var(--brand-primary)' : 'var(--text-muted)',
                            borderBottom: tab === t ? '2px solid var(--brand-primary)' : '2px solid transparent',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            textTransform: 'capitalize'
                        }}
                    >
                        {t}
                    </button>
                ))}
            </div>

            {tab === 'overview' && (
                <>
                    <div className="kpi-grid">
                        <div className="kpi-card primary">
                            <div className="kpi-icon-wrap"><Landmark size={22} /></div>
                            <div className="kpi-label">Grant Commitments</div>
                            <div className="kpi-value">${metrics.commitment_total.toLocaleString()}</div>
                            <div className="kpi-sub">Across {metrics.total_grants} active grants</div>
                        </div>
                        <div className="kpi-card info">
                            <div className="kpi-icon-wrap"><Wallet size={22} /></div>
                            <div className="kpi-label">Allocated Budget</div>
                            <div className="kpi-value">${metrics.allocated_total.toLocaleString()}</div>
                            <div className="kpi-sub">Allocated to project lines</div>
                        </div>
                        <div className="kpi-card success">
                            <div className="kpi-icon-wrap"><PieChart size={22} /></div>
                            <div className="kpi-label">Actual Expenditure</div>
                            <div className="kpi-value">${metrics.spent_total.toLocaleString()}</div>
                            <div className="kpi-sub">{Math.round((metrics.spent_total / metrics.allocated_total) * 100) || 0}% utilization</div>
                        </div>
                        <div className="kpi-card warning">
                            <div className="kpi-icon-wrap"><ShoppingBag size={22} /></div>
                            <div className="kpi-label">Open Requisitions</div>
                            <div className="kpi-value">{procurement.filter(p => p.status === 'pending_approval').length}</div>
                            <div className="kpi-sub">Awaiting management action</div>
                        </div>
                    </div>

                    <div className="panels-row">
                        <div className="panel">
                            <div className="panel-header">
                                <h2 className="panel-title">Recent Grant Inflow</h2>
                            </div>
                            <div className="data-table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Donor</th>
                                            <th>Grant Name</th>
                                            <th>Amount</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {grants.slice(0, 5).map(g => (
                                            <tr key={g.id}>
                                                <td style={{ fontWeight: 600 }}>{g.donor_name}</td>
                                                <td>{g.name}</td>
                                                <td style={{ fontWeight: 700 }}>${parseFloat(g.total_amount).toLocaleString()}</td>
                                                <td><span className="badge badge-success">Active</span></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="panel">
                            <div className="panel-header">
                                <h2 className="panel-title">Expenditure Analysis</h2>
                            </div>
                            <div className="empty-state">
                                <div className="empty-state-icon"><BarChart4 size={32} /></div>
                                <div className="empty-state-title">Analytics syncing...</div>
                                <p className="empty-state-text">Budget line burn rates will be available once more data is logged.</p>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {tab === 'grants' && (
                <div className="panel">
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Donor</th>
                                    <th>Grant Name / Code</th>
                                    <th>Grant Value</th>
                                    <th>Allocated to Projects</th>
                                    <th>Reporting Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {grants.map(g => (
                                    <tr key={g.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{g.donor_name}</div>
                                            <div className="form-hint">{g.code}</div>
                                        </td>
                                        <td>{g.name}</td>
                                        <td style={{ fontWeight: 700 }}>${parseFloat(g.total_amount).toLocaleString()}</td>
                                        <td>
                                            <div style={{ fontSize: '13px' }}>${parseFloat(g.total_budgeted).toLocaleString()}</div>
                                            <div className="progress-bar-wrap" style={{ width: '100px', height: '4px', marginTop: '4px' }}>
                                                <div className="progress-bar-fill" style={{ width: `${(g.total_budgeted / g.total_amount) * 100}%` }}></div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className="badge badge-info">On Track</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {tab === 'procurement' && (
                <div className="panel">
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Request ID / Title</th>
                                    <th>Project</th>
                                    <th>Requester</th>
                                    <th>Est. Value</th>
                                    <th>Status</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {procurement.map(p => (
                                    <tr key={p.id}>
                                        <td>
                                            <div style={{ fontWeight: 600 }}>{p.title}</div>
                                            <div className="form-hint">PR-{p.id.slice(0, 8).toUpperCase()}</div>
                                        </td>
                                        <td>{p.project_name || 'N/A'}</td>
                                        <td>{p.requester_name}</td>
                                        <td style={{ fontWeight: 700 }}>${parseFloat(p.total_estimated_cost).toLocaleString()}</td>
                                        <td>
                                            <span className={`badge badge-${p.status === 'approved' ? 'success' : p.status === 'pending_approval' ? 'warning' : 'muted'}`}>
                                                {p.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'right' }}>
                                            <button className="btn btn-secondary btn-sm">View Items</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {procurement.length === 0 && (
                            <div className="empty-state">
                                <div className="empty-state-icon"><ShoppingBag size={32} /></div>
                                <div className="empty-state-title">No requests found</div>
                                <p className="empty-state-text">Submit your first procurement requisition to begin.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
