import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import {
    Users, UserPlus, Shield, Mail, Key,
    Search, Edit2, Trash2, CheckCircle,
    XCircle, Filter, ChevronRight
} from 'lucide-react';

export default function UserManagementPage() {
    const { user: currentUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);

    // Form State
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role_code: 'FINANCE_ADMIN_OFFICER',
        phone: '',
        require_password_reset: true
    });

    const roles = [
        { code: 'SYSTEM_ADMIN', label: 'System Admin' },
        { code: 'DIRECTOR', label: 'Director' },
        { code: 'FINANCE_ADMIN_OFFICER', label: 'Finance & Admin Officer' },
        { code: 'ADMIN_ASSISTANT', label: 'Admin Assistant' },
        { code: 'LOGISTICS_ASSISTANT', label: 'Logistics Assistant' },
        { code: 'PSYCHOSOCIAL_SUPPORT_OFFICER', label: 'PSS Officer' },
        { code: 'COMMUNITY_DEVELOPMENT_OFFICER', label: 'CD Officer' },
        { code: 'ME_INTERN_ACTING_OFFICER', label: 'M&E Officer' },
        { code: 'SOCIAL_SERVICES_INTERN', label: 'Social Services Intern' },
        { code: 'YOUTH_COMMUNICATIONS_INTERN', label: 'Youth & Comms Intern' },
        { code: 'DEVELOPMENT_FACILITATOR', label: 'Development Facilitator' }
    ];

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/users`, { params: { userId: currentUser.id } });
            setUsers(res.data);
        } catch (err) {
            console.error('Failed to fetch users');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                await axios.put(`${API_BASE}/users/${editingUser.id}`, { ...formData, userId: currentUser.id });
            } else {
                await axios.post(`${API_BASE}/users`, { ...formData, userId: currentUser.id });
            }
            setShowForm(false);
            setEditingUser(null);
            setFormData({ name: '', email: '', password: '', role_code: 'FINANCE_ADMIN_OFFICER', phone: '', require_password_reset: true });
            fetchUsers();
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to save user');
        }
    };

    const handleEdit = (user) => {
        setEditingUser(user);
        setFormData({
            name: user.name,
            email: user.email,
            password: '', // Don't show password
            role_code: user.role_code,
            phone: user.phone || '',
            require_password_reset: user.require_password_reset
        });
        setShowForm(true);
    };

    const handleDelete = async (userId) => {
        if (!window.confirm('Are you sure you want to delete this user?')) return;
        try {
            await axios.delete(`${API_BASE}/users/${userId}`, { params: { userId: currentUser.id } });
            fetchUsers();
        } catch (err) {
            alert('Failed to delete user');
        }
    };

    const filtered = users.filter(u =>
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.role_code.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fade-in">
            <PageHeader
                title="User Management"
                subtitle="Manage system access, roles, and security profiles."
                actions={
                    <button className="btn btn-primary btn-sm" onClick={() => { setEditingUser(null); setShowForm(true); }}>
                        <UserPlus size={16} /> Create User
                    </button>
                }
            />

            <div className="panel">
                <div className="panel-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <h2 className="panel-title">System Users ({users.length})</h2>
                    <div className="search-box">
                        <Search size={16} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Search by name, email or role..."
                            className="form-input"
                            style={{ paddingLeft: '32px', height: '36px' }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="data-table-wrap">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>User Identity</th>
                                <th>Role / Phone</th>
                                <th>Auth Status</th>
                                <th>Last Login</th>
                                <th style={{ textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filtered.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div className="sidebar-user-avatar" style={{ width: '32px', height: '32px' }}>{u.name[0]}</div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '13px' }}>{u.name}</div>
                                                <div className="form-hint">{u.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <Shield size={14} className="text-muted" />
                                                <span className="badge badge-primary" style={{ textTransform: 'capitalize' }}>
                                                    {u.role_code.replace(/_/g, ' ').toLowerCase()}
                                                </span>
                                            </div>
                                            <div className="form-hint" style={{ fontSize: '11px' }}>{u.phone || 'No phone'}</div>
                                        </div>
                                    </td>
                                    <td>
                                        <span className={`badge badge-${u.role_assignment_status === 'confirmed' ? 'success' : 'warning'}`}>
                                            {u.role_assignment_status === 'confirmed' ? 'Verified' : 'Pending Approval'}
                                        </span>
                                    </td>
                                    <td>
                                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                            {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                                        </div>
                                    </td>
                                    <td style={{ textAlign: 'right' }}>
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                                            <button className="btn btn-ghost btn-sm" onClick={() => handleEdit(u)}><Edit2 size={14} /></button>
                                            {u.id !== currentUser.id && (
                                                <button className="btn btn-ghost btn-sm text-danger" onClick={() => handleDelete(u.id)}><Trash2 size={14} /></button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {loading && (
                        <div style={{ padding: '40px', textAlign: 'center' }}>
                            <div className="spinner" style={{ margin: '0 auto' }}></div>
                        </div>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div className="empty-state">
                            <div className="empty-state-icon"><Users size={32} /></div>
                            <p className="empty-state-text">No users found matching your search.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* User Form Modal */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <div className="modal-title">{editingUser ? 'Edit User' : 'Create New User'}</div>
                            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Full Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        required
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email Address</label>
                                    <input
                                        type="email"
                                        className="form-input"
                                        required
                                        value={formData.email}
                                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">{editingUser ? 'Update Password (leave blank to keep)' : 'Initial Password'}</label>
                                    <input
                                        type="password"
                                        className="form-input"
                                        required={!editingUser}
                                        value={formData.password}
                                        onChange={e => setFormData({ ...formData, password: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">System Role</label>
                                    <select
                                        className="form-input"
                                        value={formData.role_code}
                                        onChange={e => setFormData({ ...formData, role_code: e.target.value })}
                                    >
                                        {roles.map(r => (
                                            <option key={r.code} value={r.code}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Phone Number</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder="+263..."
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                    />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <input
                                        type="checkbox"
                                        id="require_reset"
                                        checked={formData.require_password_reset}
                                        onChange={e => setFormData({ ...formData, require_password_reset: e.target.checked })}
                                    />
                                    <label htmlFor="require_reset" style={{ fontSize: '13px', cursor: 'pointer' }}>Require password reset on next login</label>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary">{editingUser ? 'Save Changes' : 'Create User'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
