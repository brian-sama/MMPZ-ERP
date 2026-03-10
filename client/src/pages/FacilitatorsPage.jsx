import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import {
    Users, Search, Plus, MapPin, Phone,
    Calendar, CheckCircle, XCircle, Info,
    UserCheck, Briefcase, ChevronRight
} from 'lucide-react';

export default function FacilitatorsPage() {
    const { user } = useAuth();
    const [facilitators, setFacilitators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFacilitator, setSelectedFacilitator] = useState(null);
    const [assignments, setAssignments] = useState([]);

    useEffect(() => {
        fetchFacilitators();
    }, []);

    const fetchFacilitators = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/facilitators`, { params: { userId: user.id } });
            setFacilitators(res.data);
        } catch (err) {
            console.error('Failed to fetch facilitators');
        } finally {
            setLoading(false);
        }
    };

    const handleSelectFacilitator = async (fac) => {
        setSelectedFacilitator(fac);
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/facilitator-assignments`, {
                params: { userId: user.id, facilitator_id: fac.user_id }
            });
            setAssignments(res.data);
        } catch (err) {
            console.error('Failed to fetch assignments');
        } finally {
            setLoading(false);
        }
    };

    const filtered = facilitators.filter(f =>
        f.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        f.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fade-in">
            <PageHeader
                title="Development Facilitators"
                subtitle="Manage field volunteer profiles, project assignments, and performance."
                actions={
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <div className="search-box">
                            <Search size={16} className="search-icon" />
                            <input
                                type="text"
                                placeholder="Search facilitators..."
                                className="form-input"
                                style={{ paddingLeft: '32px', height: '36px' }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                        <button className="btn btn-primary btn-sm">
                            <Plus size={16} /> Add Facilitator
                        </button>
                    </div>
                }
            />

            <div className="panels-row">
                {/* List Panel */}
                <div className="panel" style={{ flex: selectedFacilitator ? '0 0 450px' : '1' }}>
                    <div className="panel-header">
                        <h2 className="panel-title">Active Registry ({facilitators.length})</h2>
                    </div>
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Facilitator</th>
                                    <th>Status</th>
                                    {!selectedFacilitator && <th>Contact</th>}
                                    {!selectedFacilitator && <th>Assignments</th>}
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(fac => (
                                    <tr
                                        key={fac.user_id}
                                        className={selectedFacilitator?.user_id === fac.user_id ? 'active-row' : ''}
                                        onClick={() => handleSelectFacilitator(fac)}
                                        style={{ cursor: 'pointer' }}
                                    >
                                        <td>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <div className="sidebar-user-avatar" style={{ width: '32px', height: '32px' }}>{fac.name[0]}</div>
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{fac.name}</div>
                                                    <div className="form-hint">{fac.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${fac.status === 'active' ? 'success' : 'muted'}`}>
                                                {fac.status}
                                            </span>
                                        </td>
                                        {!selectedFacilitator && (
                                            <>
                                                <td>{fac.phone || 'No phone'}</td>
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                        <Briefcase size={14} className="text-muted" />
                                                        {fac.active_assignments} active
                                                    </div>
                                                </td>
                                            </>
                                        )}
                                        <td style={{ textAlign: 'right' }}>
                                            <ChevronRight size={18} className="text-muted" />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detail Panel */}
                {selectedFacilitator && (
                    <div className="panel animate-slide-in">
                        <div className="panel-header">
                            <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="kpi-icon-wrap" style={{ background: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}>
                                        <UserCheck size={20} />
                                    </div>
                                    <div>
                                        <h2 className="panel-title">{selectedFacilitator.name}</h2>
                                        <p className="panel-subtitle">Facilitator Profile Details</p>
                                    </div>
                                </div>
                                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedFacilitator(null)}>Close</button>
                            </div>
                        </div>

                        <div style={{ padding: '20px' }}>
                            <div className="kpi-grid" style={{ gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '24px' }}>
                                <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '8px' }}>
                                    <div className="form-hint" style={{ marginBottom: '4px' }}>Phone Number</div>
                                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Phone size={14} className="text-primary" /> {selectedFacilitator.phone || 'Not setup'}
                                    </div>
                                </div>
                                <div style={{ background: 'var(--bg-app)', padding: '12px', borderRadius: '8px' }}>
                                    <div className="form-hint" style={{ marginBottom: '4px' }}>Age & Gender</div>
                                    <div style={{ fontWeight: 600 }}>{selectedFacilitator.age_bracket || 'N/A'} • {selectedFacilitator.gender || 'N/A'}</div>
                                </div>
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <MapPin size={16} className="text-muted" /> Residential Address
                                </h3>
                                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-app)', padding: '12px', borderRadius: '8px' }}>
                                    {selectedFacilitator.address || 'No address registered for this facilitator.'}
                                </p>
                            </div>

                            <div className="divider" style={{ margin: '24px 0' }}></div>

                            <div className="panel-header" style={{ padding: '0 0 12px 0' }}>
                                <h3 className="panel-title" style={{ fontSize: '14px' }}>Assigned Projects</h3>
                                <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px', height: '28px', fontSize: '11px' }}>Assign New</button>
                            </div>

                            <div className="data-table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Project</th>
                                            <th>Assigned</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {assignments.map(asgn => (
                                            <tr key={asgn.id}>
                                                <td>{asgn.project_name}</td>
                                                <td>{new Date(asgn.assigned_at).toLocaleDateString()}</td>
                                                <td>
                                                    <span className={`badge badge-${asgn.is_active ? 'success' : 'muted'}`}>
                                                        {asgn.is_active ? 'Active' : 'Archived'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
