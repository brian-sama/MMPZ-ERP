import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    AlertCircle,
    Briefcase,
    Calendar,
    CheckSquare,
    FileText,
    History,
    Send,
    Target,
    Plus,
    Clock,
    User,
    Upload,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

export default function MyPortalPage() {
    const { user } = useAuth();
    const [activities, setActivities] = useState([]);
    const [projects, setProjects] = useState([]);
    const [indicators, setIndicators] = useState([]);
    const [reviewers, setReviewers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [portalMessage, setPortalMessage] = useState('');
    
    // Create Activity Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [createLoading, setCreateLoading] = useState(false);
    const [newActivity, setNewActivity] = useState({
        project_id: '',
        indicator_id: '',
        activity_date: new Date().toISOString().split('T')[0],
        location: '',
        description: '',
        assigned_reviewer_id: '',
        plan_file: null
    });

    // Activity Detail / Edit State
    const [selectedActivity, setSelectedActivity] = useState(null);
    const [updateLoading, setUpdateLoading] = useState(false);

    const mergePortalActivities = (erpActivities = [], compassActivities = []) => {
        const localActivityIds = new Set(erpActivities.map(activity => String(activity.id)));
        const localRows = erpActivities.map(activity => ({
            ...activity,
            isCompassSynced: false,
            source_system: activity.source_system || 'ERP My Portal',
        }));
        const compassRows = compassActivities
            .filter(activity => !activity.erp_field_activity_id || !localActivityIds.has(String(activity.erp_field_activity_id)))
            .map(activity => ({
                ...activity,
                isCompassSynced: true,
                source_system: activity.source_system || 'Compass M&E',
            }));

        return [...localRows, ...compassRows].sort((a, b) => {
            const left = new Date(a.activity_date || a.updated_at || a.created_at || 0).getTime();
            const right = new Date(b.activity_date || b.updated_at || b.created_at || 0).getTime();
            return right - left;
        });
    };

    useEffect(() => {
        if (user?.id) fetchPortalData();
    }, [user?.id]);

    const fetchPortalData = async () => {
        setLoading(true);
        try {
            const compassActivityRequest = axios
                .get(`${API_BASE}/me/compass-activities`, { params: { userId: user.id } })
                .catch(error => {
                    console.warn('Compass activity feed unavailable', error);
                    return { data: [] };
                });

            const [activityRes, projectRes, indicatorRes, userRes, compassActivityRes] = await Promise.all([
                axios.get(`${API_BASE}/activities`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/projects`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/indicators`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/users`),
                compassActivityRequest,
            ]);

            setActivities(mergePortalActivities(activityRes.data || [], compassActivityRes.data || []));
            setProjects(projectRes.data || []);
            setIndicators(indicatorRes.data || []);
            setReviewers((userRes.data || []).filter(u => 
                ['PSYCHOSOCIAL_SUPPORT_OFFICER', 'COMMUNITY_DEVELOPMENT_OFFICER', 'SOCIAL_SERVICES_INTERN', 'YOUTH_COMMUNICATIONS_INTERN', 'DIRECTOR'].includes(u.role_code)
            ));
        } catch (error) {
            console.error('Portal data fetch error', error);
            setPortalMessage('Failed to load portal data.');
        } finally {
            setLoading(false);
        }
    };

    const fileToBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleCreateActivity = async (e) => {
        e.preventDefault();
        if (!newActivity.plan_file) {
            alert('An Activity Plan document is REQUIRED to create a new field activity.');
            return;
        }

        setCreateLoading(true);
        try {
            // 1. Upload the plan first as a submission
            const fileData = await fileToBase64(newActivity.plan_file);
            const subRes = await axios.post(`${API_BASE}/submissions`, {
                submission_type: 'activity_plan',
                department_category: 'PROGRAM',
                title: `Activity Plan: ${newActivity.description.substring(0, 30)}...`,
                description: newActivity.description,
                file_path: fileData, // Simple base64 for now, backend should handle
                file_name: newActivity.plan_file.name,
                mime_type: newActivity.plan_file.type,
            });

            const planSubmissionId = subRes.data.id;

            // 2. Create the activity
            await axios.post(`${API_BASE}/activities`, {
                ...newActivity,
                plan_submission_id: planSubmissionId
            });

            setShowCreateModal(false);
            setNewActivity({
                project_id: '',
                indicator_id: '',
                activity_date: new Date().toISOString().split('T')[0],
                location: '',
                description: '',
                assigned_reviewer_id: '',
                plan_file: null
            });
            await fetchPortalData();
        } catch (error) {
            alert('Failed to create activity: ' + (error.response?.data?.error || error.message));
        } finally {
            setCreateLoading(false);
        }
    };

    const handleSubmitForReview = async (activityId) => {
        if (!confirm('Are you sure you want to submit this activity for review? This will finalize the record for M&E verification.')) return;
        
        try {
            await axios.post(`${API_BASE}/activities/${activityId}/submit`);
            await fetchPortalData();
            alert('Activity submitted successfully.');
        } catch (error) {
            alert('Submission failed.');
        }
    };

    const pendingVerificationCount = useMemo(
        () => activities.filter(a => !a.isCompassSynced && a.status === 'submitted').length,
        [activities]
    );

    if (loading) return <div className="page-loading"><div className="spinner" /></div>;

    return (
        <div className="fade-in">
            <PageHeader
                title="Facilitator Workspace"
                subtitle="Manage your field activities, track participant data, and submit reports for verification."
                actions={
                    <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
                        <Plus size={18} />
                        New Field Activity
                    </button>
                }
            />

            <div className="panels-row">
                <div style={{ flex: 1 }}>
                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title">Active Field Work</h2>
                        </div>
                        {portalMessage && (
                            <div className="alert alert-warning" style={{ marginBottom: '16px' }}>
                                {portalMessage}
                            </div>
                        )}
                        <div className="control-stack">
                            {activities.map(activity => (
                                <div key={activity.id} className="control-row static" style={{ padding: '20px' }}>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                                            <span className={`badge badge-${activity.status === 'draft' ? 'secondary' : 'info'}`}>
                                                {String(activity.status || 'submitted').toUpperCase()}
                                            </span>
                                            <span className={`badge ${activity.isCompassSynced ? 'badge-success' : 'badge-secondary'}`}>
                                                {activity.isCompassSynced ? 'COMPASS SYNCED' : 'ERP PORTAL'}
                                            </span>
                                            <span className="text-muted" style={{ fontSize: '12px' }}>
                                                <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                                {activity.activity_date ? new Date(activity.activity_date).toLocaleDateString() : 'No date'}
                                            </span>
                                        </div>
                                        <div style={{ fontWeight: 700, fontSize: '15px', color: 'var(--text-main)' }}>
                                            {activity.description || 'No description provided'}
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            {activity.project_name || 'Unlinked project'} - {activity.location || 'No location'}
                                        </div>
                                        <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                                            <div className="form-hint" style={{ fontSize: '11px' }}>
                                                <User size={10} style={{ marginRight: '4px' }} />
                                                {activity.isCompassSynced ? 'Source: Compass / mobile sync' : `Reviewer: ${activity.reviewer_name || 'Unassigned'}`}
                                            </div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        {!activity.isCompassSynced && activity.status === 'draft' && (
                                            <button 
                                                className="btn btn-outline btn-sm"
                                                onClick={() => handleSubmitForReview(activity.id)}
                                            >
                                                Submit Review
                                            </button>
                                        )}
                                        <button className="btn btn-secondary btn-sm" disabled={activity.isCompassSynced}>
                                            {activity.isCompassSynced ? 'In Compass' : 'Details'}
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {activities.length === 0 && (
                                <div className="empty-state" style={{ padding: '60px 20px' }}>
                                    <div className="empty-state-icon"><Target size={40} /></div>
                                    <div className="empty-state-title">No Field Activities</div>
                                    <p className="empty-state-text">Start by creating a new field activity and uploading your activity plan.</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="kpi-card primary">
                        <div className="kpi-icon-wrap"><CheckSquare size={20} /></div>
                        <div className="kpi-label">Pending Verification</div>
                        <div className="kpi-value">{pendingVerificationCount}</div>
                        <div className="kpi-sub">Waiting for Officer/Intern review</div>
                    </div>
                    
                    <div className="panel" style={{ padding: '20px' }}>
                        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '12px' }}>Workflow Reminder</h3>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Every field activity requires an <strong>Activity Plan</strong> before it can be created. 
                            Once field work is complete, update the activity with participant numbers and evidence to submit for verification.
                        </p>
                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5, marginTop: '12px' }}>
                            Activities captured in the mobile app flow into Compass first. Approved Compass activity summaries appear here, and ERP portal activities are pushed back to Compass for M&E review.
                        </p>
                    </div>
                </div>
            </div>

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <div className="modal-box lg" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">New Field Activity</div>
                            <button className="modal-close" onClick={() => setShowCreateModal(false)}>x</button>
                        </div>
                        <form onSubmit={handleCreateActivity}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Project</label>
                                        <select 
                                            className="form-input" 
                                            required 
                                            value={newActivity.project_id}
                                            onChange={e => setNewActivity({...newActivity, project_id: e.target.value})}
                                        >
                                            <option value="">Select Project...</option>
                                            {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Indicator</label>
                                        <select 
                                            className="form-input" 
                                            required 
                                            value={newActivity.indicator_id}
                                            onChange={e => setNewActivity({...newActivity, indicator_id: e.target.value})}
                                        >
                                            <option value="">Select Indicator...</option>
                                            {indicators.filter(i => i.project_id === newActivity.project_id || !newActivity.project_id).map(i => (
                                                <option key={i.id} value={i.id}>{i.title}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Date</label>
                                        <input 
                                            type="date" 
                                            className="form-input" 
                                            required 
                                            value={newActivity.activity_date}
                                            onChange={e => setNewActivity({...newActivity, activity_date: e.target.value})}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Location</label>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            placeholder="e.g. Ward 15 Hall" 
                                            value={newActivity.location}
                                            onChange={e => setNewActivity({...newActivity, location: e.target.value})}
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Brief Description</label>
                                    <textarea 
                                        className="form-input" 
                                        style={{ minHeight: '80px' }}
                                        placeholder="Summarize the planned field work..."
                                        value={newActivity.description}
                                        onChange={e => setNewActivity({...newActivity, description: e.target.value})}
                                    />
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Select Supervisor/Reviewer</label>
                                    <select 
                                        className="form-input" 
                                        required 
                                        value={newActivity.assigned_reviewer_id}
                                        onChange={e => setNewActivity({...newActivity, assigned_reviewer_id: e.target.value})}
                                    >
                                        <option value="">Select Officer or Intern...</option>
                                        {reviewers.map(r => <option key={r.id} value={r.id}>{r.name} ({r.role_code})</option>)}
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">Activity Plan (PDF/DOCX) <span style={{ color: 'var(--brand-danger)' }}>*Required</span></label>
                                    <div className="file-upload-box" style={{ border: '2px dashed var(--border)', padding: '30px', textAlign: 'center', borderRadius: '12px' }}>
                                        <input 
                                            type="file" 
                                            id="plan-upload"
                                            className="hidden"
                                            onChange={e => setNewActivity({...newActivity, plan_file: e.target.files?.[0]})}
                                            accept=".pdf,.doc,.docx"
                                        />
                                        <label htmlFor="plan-upload" style={{ cursor: 'pointer' }}>
                                            <Upload size={32} className="text-muted" style={{ marginBottom: '12px' }} />
                                            <div style={{ fontWeight: 600 }}>{newActivity.plan_file ? newActivity.plan_file.name : 'Click to upload Activity Plan'}</div>
                                            <div className="form-hint">Only PDF and Word documents are accepted</div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={createLoading}>
                                    {createLoading ? 'Creating...' : 'Create Activity'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
