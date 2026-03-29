import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import {
    Users, Search, Plus, MapPin, Phone,
    Calendar, CheckCircle, XCircle, Info,
    UserCheck, Briefcase, ChevronRight, MessageSquare
} from 'lucide-react';

export default function FacilitatorsPage() {
    const { user } = useAuth();
    const [facilitators, setFacilitators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedFacilitator, setSelectedFacilitator] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [attendance, setAttendance] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [projects, setProjects] = useState([]);
    const [addType, setAddType] = useState('existing'); // 'existing' or 'new'
    const [saving, setSaving] = useState(false);

    // Form states
    const [newFacilitator, setNewFacilitator] = useState({
        user_id: '',
        name: '', // For new user
        email: '', // For new user
        password: '', // For new user
        gender: '',
        age_bracket: '',
        phone: '',
        address: '',
        joined_at: new Date().toISOString().split('T')[0]
    });
    const [newAssignment, setNewAssignment] = useState({
        project_id: ''
    });

    useEffect(() => {
        fetchFacilitators();
    }, []);

    const fetchFacilitators = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/facilitators`, { params: { userId: user.id } });
            setFacilitators(res.data);
            
            // Also fetch users and projects for modals
            const usersRes = await axios.get(`${API_BASE}/users`, { params: { userId: user.id } });
            setAllUsers(usersRes.data.filter(u => u.system_role === 'FACILITATOR'));
            
            const projRes = await axios.get(`${API_BASE}/projects`, { params: { userId: user.id } });
            setProjects(projRes.data);
        } catch (err) {
            console.error('Failed to fetch facilitators metadata', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectFacilitator = async (fac) => {
        setSelectedFacilitator(fac);
        setLoading(true);
        try {
            const [asgnRes, attRes] = await Promise.all([
                axios.get(`${API_BASE}/facilitator-assignments`, {
                    params: { userId: user.id, facilitator_id: fac.user_id }
                }),
                axios.get(`${API_BASE}/facilitator-attendance`, {
                    params: { userId: user.id, facilitator_id: fac.user_id }
                })
            ]);
            setAssignments(asgnRes.data);
            setAttendance(attRes.data);
        } catch (err) {
            console.error('Failed to fetch details');
        } finally {
            setLoading(false);
        }
    };

    const handleAddFacilitator = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            let finalUserId = newFacilitator.user_id;

            // Step 1: Create user if "new"
            if (addType === 'new') {
                const userRes = await axios.post(`${API_BASE}/users`, {
                    name: newFacilitator.name,
                    email: newFacilitator.email,
                    password: newFacilitator.password,
                    role_code: 'DEVELOPMENT_FACILITATOR',
                    system_role: 'FACILITATOR',
                    job_title: 'Development Facilitator',
                    userId: user.id
                });
                finalUserId = userRes.data.user.id;
            }

            if (!finalUserId) throw new Error('User ID missing');

            // Step 2: Create facilitator profile
            await axios.post(`${API_BASE}/facilitators`, { 
                ...newFacilitator, 
                user_id: finalUserId,
                userId: user.id 
            });

            setShowAddModal(false);
            setNewFacilitator({ 
                user_id: '', name: '', email: '', password: '', 
                gender: '', age_bracket: '', phone: '', address: '',
                joined_at: new Date().toISOString().split('T')[0]
            });
            fetchFacilitators();
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to add facilitator profile');
        } finally {
            setSaving(false);
        }
    };

    const handleAssignProject = async (e) => {
        e.preventDefault();
        setSaving(true);
        try {
            await axios.post(`${API_BASE}/facilitator-assignments`, {
                facilitator_user_id: selectedFacilitator.user_id,
                project_id: newAssignment.project_id,
                userId: user.id
            });
            setShowAssignModal(false);
            handleSelectFacilitator(selectedFacilitator);
        } catch (err) {
            alert('Failed to assign project');
        } finally {
            setSaving(false);
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
                        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
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
                                <div style={{ background: 'var(--brand-success-light)', padding: '12px', borderRadius: '8px', color: 'var(--brand-success)' }}>
                                    <div className="form-hint" style={{ color: 'var(--brand-success)', opacity: 0.8, marginBottom: '4px' }}>Sessions Logged</div>
                                    <div style={{ fontWeight: 700, fontSize: '18px' }}>{attendance.length}</div>
                                </div>
                                <div style={{ background: 'var(--brand-primary-light)', padding: '12px', borderRadius: '8px', color: 'var(--brand-primary)' }}>
                                    <div className="form-hint" style={{ color: 'var(--brand-primary)', opacity: 0.8, marginBottom: '4px' }}>Active Projects</div>
                                    <div style={{ fontWeight: 700, fontSize: '18px' }}>{assignments.filter(a => a.is_active).length}</div>
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

                            <div style={{ marginBottom: '24px' }}>
                                <button 
                                    className="btn btn-secondary" 
                                    style={{ width: '100%', background: '#25D366', color: 'white', border: 'none' }}
                                    onClick={() => window.open(`https://wa.me/${selectedFacilitator.phone?.replace(/\+/g, '')}`, '_blank')}
                                    disabled={!selectedFacilitator.phone}
                                >
                                    <MessageSquare size={18} style={{ marginRight: '8px' }} /> Message via WhatsApp
                                </button>
                            </div>

                            <div className="divider" style={{ margin: '24px 0' }}></div>

                            <div className="panel-header" style={{ padding: '0 0 12px 0' }}>
                                <h3 className="panel-title" style={{ fontSize: '14px' }}>Assigned Projects</h3>
                                <button className="btn btn-primary btn-sm" style={{ padding: '4px 8px', height: '28px', fontSize: '11px' }} onClick={() => setShowAssignModal(true)}>Assign New</button>
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

                            <div className="divider" style={{ margin: '24px 0' }}></div>

                            <div className="panel-header" style={{ padding: '0 0 12px 0' }}>
                                <h3 className="panel-title" style={{ fontSize: '14px' }}>Attendance History</h3>
                            </div>
                            <div className="data-table-wrap">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Project</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {attendance.map(att => (
                                            <tr key={att.id}>
                                                <td>{new Date(att.date).toLocaleDateString()}</td>
                                                <td>{att.project_name}</td>
                                                <td>
                                                    <span className={`badge badge-${att.status === 'present' ? 'success' : 'danger'}`}>
                                                        {att.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {attendance.length === 0 && (
                                            <tr>
                                                <td colSpan="3" style={{ textAlign: 'center', padding: '20px', color: 'var(--text-muted)' }}>No attendance logs found</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* Add Facilitator Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <div className="modal-title">Register Facilitator Profile</div>
                            <button className="modal-close" onClick={() => setShowAddModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleAddFacilitator}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', background: 'var(--bg-app)', padding: '4px', borderRadius: '10px' }}>
                                    <button 
                                        type="button"
                                        className={`btn ${addType === 'existing' ? 'btn-primary' : 'btn-ghost'}`}
                                        style={{ flex: 1, height: '32px', fontSize: '12px' }}
                                        onClick={() => setAddType('existing')}
                                    >Link Existing User</button>
                                    <button 
                                        type="button"
                                        className={`btn ${addType === 'new' ? 'btn-primary' : 'btn-ghost'}`}
                                        style={{ flex: 1, height: '32px', fontSize: '12px' }}
                                        onClick={() => setAddType('new')}
                                    >Create New User</button>
                                </div>

                                {addType === 'existing' ? (
                                    <div className="form-group animate-slide-in">
                                        <label className="form-label">Select User Account</label>
                                        <select 
                                            className="form-input" 
                                            required 
                                            value={newFacilitator.user_id}
                                            onChange={e => setNewFacilitator({ ...newFacilitator, user_id: e.target.value })}
                                        >
                                            <option value="">Select a user...</option>
                                            {allUsers.map(u => (
                                                <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                                            ))}
                                        </select>
                                        <p className="form-hint">Only users with 'Development Facilitator' role are shown.</p>
                                    </div>
                                ) : (
                                    <div className="animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div className="form-group">
                                            <label className="form-label">Full Name</label>
                                            <input 
                                                type="text" className="form-input" required
                                                value={newFacilitator.name}
                                                onChange={e => setNewFacilitator({ ...newFacilitator, name: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Email Address</label>
                                            <input 
                                                type="email" className="form-input" required
                                                value={newFacilitator.email}
                                                onChange={e => setNewFacilitator({ ...newFacilitator, email: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Initial Password</label>
                                            <input 
                                                type="password" className="form-input" required
                                                value={newFacilitator.password}
                                                onChange={e => setNewFacilitator({ ...newFacilitator, password: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                )}

                                <div className="divider"></div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Gender</label>
                                        <select 
                                            className="form-input"
                                            value={newFacilitator.gender}
                                            onChange={e => setNewFacilitator({ ...newFacilitator, gender: e.target.value })}
                                        >
                                            <option value="">Select...</option>
                                            <option value="Male">Male</option>
                                            <option value="Female">Female</option>
                                            <option value="Other">Other</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Age Bracket</label>
                                        <select 
                                            className="form-input"
                                            value={newFacilitator.age_bracket}
                                            onChange={e => setNewFacilitator({ ...newFacilitator, age_bracket: e.target.value })}
                                        >
                                            <option value="">Select...</option>
                                            <option value="18-24">18-24</option>
                                            <option value="25-34">25-34</option>
                                            <option value="35-44">35-44</option>
                                            <option value="45+">45+</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone Number</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="+263..." 
                                        value={newFacilitator.phone}
                                        onChange={e => setNewFacilitator({ ...newFacilitator, phone: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Residential Address</label>
                                    <textarea 
                                        className="form-input" 
                                        style={{ height: '60px' }}
                                        value={newFacilitator.address}
                                        onChange={e => setNewFacilitator({ ...newFacilitator, address: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Processing...' : (addType === 'new' ? 'Register & Link' : 'Create Profile')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Assign Project Modal */}
            {showAssignModal && (
                <div className="modal-overlay" onClick={() => setShowAssignModal(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '450px' }}>
                        <div className="modal-header">
                            <div className="modal-title">Assign to Project</div>
                            <button className="modal-close" onClick={() => setShowAssignModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleAssignProject}>
                            <div className="modal-body">
                                <div className="form-group">
                                    <label className="form-label">Select Project</label>
                                    <select 
                                        className="form-input" 
                                        required
                                        value={newAssignment.project_id}
                                        onChange={e => setNewAssignment({ ...newAssignment, project_id: e.target.value })}
                                    >
                                        <option value="">Select project...</option>
                                        {projects.map(p => (
                                            <option key={p.id} value={p.id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div style={{ marginTop: '16px', padding: '12px', background: 'var(--bg-app)', borderRadius: '8px', fontSize: '13px' }}>
                                    Assigning <strong>{selectedFacilitator.name}</strong> to this project will allow them to submit field reports and track activities.
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAssignModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Assign Project' : 'Assign Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
