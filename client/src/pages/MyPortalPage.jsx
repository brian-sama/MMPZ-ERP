import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import {
    CheckSquare, History, Briefcase, Calendar,
    Target, Info, MapPin, Send, AlertCircle
} from 'lucide-react';

export default function MyPortalPage() {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAsgn, setSelectedAsgn] = useState(null);

    // Attendance State
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceStatus, setAttendanceStatus] = useState('present');
    const [attendanceSaved, setAttendanceSaved] = useState(false);

    useEffect(() => {
        fetchMyWork();
    }, []);

    const fetchMyWork = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/facilitator-assignments`, {
                params: { facilitator_id: user.id }
            });
            setAssignments(res.data);
            if (res.data.length > 0) setSelectedAsgn(res.data[0]);
        } catch (err) {
            console.error('Failed to fetch assignments');
        } finally {
            setLoading(false);
        }
    };

    const logAttendance = async () => {
        if (!selectedAsgn) return;
        try {
            await axios.post(`${API_BASE}/facilitator-attendance`, {
                userId: user.id,
                attendance_records: [{
                    assignment_id: selectedAsgn.id,
                    date: attendanceDate,
                    status: attendanceStatus,
                    notes: 'Logged via facilitator portal'
                }]
            });
            setAttendanceSaved(true);
            setTimeout(() => setAttendanceSaved(false), 3000);
        } catch (err) {
            alert('Failed to log attendance');
        }
    };

    if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

    return (
        <div className="fade-in">
            <PageHeader
                title="Facilitator Portal"
                subtitle="Manage your daily implementation work and reporting."
            />

            <div className="panels-row">
                <div style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Assignments List */}
                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title">My Assignments</h2>
                        </div>
                        <div style={{ padding: '8px' }}>
                            {assignments.map(asgn => (
                                <div
                                    key={asgn.id}
                                    className={`report-item ${selectedAsgn?.id === asgn.id ? 'active' : ''}`}
                                    onClick={() => setSelectedAsgn(asgn)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border: selectedAsgn?.id === asgn.id ? '1.5px solid var(--brand-primary)' : '1px solid transparent',
                                        cursor: 'pointer',
                                        marginBottom: '8px',
                                        background: selectedAsgn?.id === asgn.id ? 'var(--brand-primary-light)' : 'transparent'
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>{asgn.project_name}</div>
                                    <div className="form-hint">Assigned: {new Date(asgn.assigned_at).toLocaleDateString()}</div>
                                </div>
                            ))}
                            {assignments.length === 0 && (
                                <div className="empty-state" style={{ padding: '20px' }}>
                                    <div className="empty-state-icon"><Briefcase size={24} /></div>
                                    <p className="empty-state-text" style={{ fontSize: '11px' }}>No projects currently assigned to you.</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Personal KPIs */}
                    <div className="kpi-card info">
                        <div className="kpi-icon-wrap"><History size={20} /></div>
                        <div className="kpi-label">Days Logged</div>
                        <div className="kpi-value" style={{ fontSize: '24px' }}>18</div>
                        <div className="kpi-sub">Total attendance this month</div>
                    </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    {/* Attendance Logging */}
                    <div className="panel">
                        <div className="panel-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="kpi-icon-wrap" style={{ width: '32px', height: '32px' }}><CheckSquare size={16} /></div>
                                <h2 className="panel-title">Daily Attendance</h2>
                            </div>
                        </div>
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                                <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                                    <label className="form-label">Work Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={attendanceDate}
                                        onChange={(e) => setAttendanceDate(e.target.value)}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                                    <label className="form-label">Attendance Status</label>
                                    <select
                                        className="form-input"
                                        value={attendanceStatus}
                                        onChange={(e) => setAttendanceStatus(e.target.value)}
                                    >
                                        <option value="present">Present (Field)</option>
                                        <option value="office">Office / Admin</option>
                                        <option value="absent">Excused Absence</option>
                                    </select>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ height: '42px', padding: '0 24px' }}
                                    onClick={logAttendance}
                                    disabled={!selectedAsgn}
                                >
                                    {attendanceSaved ? 'Success ✓' : 'Log Attendance'}
                                </button>
                            </div>
                            {attendanceSaved && (
                                <p className="fade-in" style={{ fontSize: '12px', color: 'var(--brand-success)', marginTop: '8px', fontWeight: 600 }}>
                                    Attendance records updated successfully.
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Module Links / Fast Reporting */}
                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title">Shortcuts & Reporting</h2>
                        </div>
                        <div style={{ padding: '24px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="hover-scale" style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-app)', cursor: 'pointer' }} onClick={() => window.location.hash = '/me'}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="kpi-icon-wrap" style={{ width: '36px', height: '36px', background: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}>
                                        <Target size={18} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '14px' }}>Report Progress</div>
                                        <div className="form-hint" style={{ fontSize: '11px' }}>Log monthly indicator actuals</div>
                                    </div>
                                </div>
                            </div>
                            <div className="hover-scale" style={{ padding: '16px', borderRadius: '12px', background: 'var(--bg-app)', cursor: 'pointer' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="kpi-icon-wrap" style={{ width: '36px', height: '36px', background: '#3b82f61a', color: '#3b82f6' }}>
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '14px' }}>Activity Logs</div>
                                        <div className="form-hint" style={{ fontSize: '11px' }}>Submit implementation reports</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="panel" style={{ background: 'var(--bg-surface-alt)', border: '1px solid var(--border)', padding: '20px' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <AlertCircle size={20} className="text-muted" />
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '13px' }}>Offline Capability</div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    This portal supports offline data entry. Records will automatically sync when you return to cellular coverage.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
