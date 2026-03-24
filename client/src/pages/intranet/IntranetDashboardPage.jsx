import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../../context/AuthContext';
import API_BASE from '../../apiConfig';
import PageHeader from '../../components/PageHeader';
import { Radio, Bell, MessageSquare, CheckCircle2, Plus, Users, Globe, Trash2, Clock } from 'lucide-react';

export default function IntranetDashboardPage() {
    const { user, isFacilitator } = useAuth();
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);

    // Form State
    const [newPost, setNewPost] = useState({
        title: '',
        content: '',
        audience: ['ALL']
    });
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetchAnnouncements();
    }, []);

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/announcements`, { params: { userId: user.id } });
            setAnnouncements(res.data);
        } catch (err) {
            console.error('Failed to fetch announcements');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            await axios.post(`${API_BASE}/announcements`, { ...newPost, userId: user.id });
            setShowModal(false);
            setNewPost({ title: '', content: '', audience: ['ALL'] });
            fetchAnnouncements();
        } catch (err) {
            alert('Failed to post announcement');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Remove this announcement?')) return;
        try {
            await axios.delete(`${API_BASE}/announcements/${id}`, { params: { userId: user.id } });
            fetchAnnouncements();
        } catch (err) {
            alert('Failed to delete');
        }
    };

    const toggleAudience = (role) => {
        if (role === 'ALL') {
            setNewPost({ ...newPost, audience: ['ALL'] });
            return;
        }
        let current = newPost.audience.filter(a => a !== 'ALL');
        if (current.includes(role)) {
            current = current.filter(a => a !== role);
        } else {
            current.push(role);
        }
        if (current.length === 0) current = ['ALL'];
        setNewPost({ ...newPost, audience: current });
    };

    if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

    return (
        <div className="fade-in">
            <PageHeader
                title="Internal Announcements"
                subtitle="Organization updates, policy changes, and internal news."
                actions={!isFacilitator() && (
                    <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
                        <Plus size={16} /> Post Update
                    </button>
                )}
            />

            <div className="panels-row">
                <div style={{ flex: 2, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Radio size={16} /> Latest News
                            </h2>
                        </div>
                        
                        <div style={{ padding: '20px' }}>
                            {announcements.map(item => (
                                <div key={item.id} className="report-item" style={{ padding: '20px', marginBottom: '16px', background: 'var(--bg-app)', borderLeft: '4px solid var(--brand-primary)' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <h3 style={{ fontSize: '16px', fontWeight: 700, margin: 0 }}>{item.title}</h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                {new Date(item.created_at).toLocaleDateString()}
                                            </span>
                                            {(item.author_id === user.id || user.system_role === 'SUPER_ADMIN') && (
                                                <button className="btn btn-ghost btn-sm" onClick={() => handleDelete(item.id)} style={{ color: 'var(--brand-danger)' }}>
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                    <p style={{ fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{item.content}</p>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '12px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                                        <div style={{ fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Users size={12} /> {item.author_name}
                                        </div>
                                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', background: 'var(--border)', padding: '2px 8px', borderRadius: '10px' }}>
                                            {item.audience.includes('ALL') ? 'Public' : `Audience: ${item.audience.join(', ')}`}
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {announcements.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><MessageSquare size={32} /></div>
                                    <div className="empty-state-title">No new announcements</div>
                                    <p className="empty-state-text">Check back later for organizational updates.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Bell size={16} /> My Tasks
                            </h2>
                        </div>
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <div className="empty-state-icon"><CheckCircle2 size={32} /></div>
                            <div className="empty-state-title">All caught up</div>
                            <p className="empty-state-text">You have no pending tasks today.</p>
                        </div>
                    </div>
                    
                    <div className="kpi-card info">
                        <div className="kpi-icon-wrap"><Clock size={20} /></div>
                        <div className="kpi-label">Upcoming Events</div>
                        <div className="kpi-value">0</div>
                        <p className="form-hint">See full calendar for more details.</p>
                    </div>
                </div>
            </div>

            {/* Create Modal */}
            {showModal && (
                <div className="modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
                        <div className="modal-header">
                            <div className="modal-title">Post New Update</div>
                            <button className="modal-close" onClick={() => setShowModal(false)}>×</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Title</label>
                                    <input 
                                        type="text" className="form-input" required 
                                        placeholder="e.g. New HQ Security Protocol"
                                        value={newPost.title}
                                        onChange={e => setNewPost({...newPost, title: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Content</label>
                                    <textarea 
                                        className="form-input" required style={{ height: '150px' }}
                                        placeholder="Type your announcement here..."
                                        value={newPost.content}
                                        onChange={e => setNewPost({...newPost, content: e.target.value})}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Target Audience</label>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                                        {['ALL', 'MANAGEMENT', 'PROGRAM_STAFF', 'OPERATIONS', 'INTERN', 'FACILITATOR'].map(role => (
                                            <button
                                                key={role}
                                                type="button"
                                                className={`badge ${newPost.audience.includes(role) ? 'badge-primary' : ''}`}
                                                style={{ cursor: 'pointer', border: '1px solid var(--border)', background: newPost.audience.includes(role) ? 'var(--brand-primary)' : 'transparent' }}
                                                onClick={() => toggleAudience(role)}
                                            >
                                                {role}
                                            </button>
                                        ))}
                                    </div>
                                    <p className="form-hint">Only people in these roles will see this update.</p>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Posting...' : 'Announce'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
