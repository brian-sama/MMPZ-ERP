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
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

const createBlankReport = () => ({
    title: '',
    content: '',
    indicator_id: '',
    male_count: 0,
    female_count: 0,
    notes: '',
    recipients: [],
    attachment: null,
});

const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

export default function MyPortalPage() {
    const { user } = useAuth();
    const [assignments, setAssignments] = useState([]);
    const [indicators, setIndicators] = useState([]);
    const [recipients, setRecipients] = useState([]);
    const [submissions, setSubmissions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedAsgn, setSelectedAsgn] = useState(null);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportType, setReportType] = useState('weekly');
    const [newReport, setNewReport] = useState(createBlankReport());
    const [submittingReport, setSubmittingReport] = useState(false);
    const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
    const [attendanceStatus, setAttendanceStatus] = useState('present');
    const [attendanceSaved, setAttendanceSaved] = useState(false);

    useEffect(() => {
        fetchPortalData();
    }, []);

    useEffect(() => {
        if (!selectedAsgn?.project_id) return;
        const matchingIndicator = indicators.find((item) => item.project_id === selectedAsgn.project_id);
        if (matchingIndicator && !newReport.indicator_id) {
            setNewReport((current) => ({ ...current, indicator_id: String(matchingIndicator.id) }));
        }
    }, [selectedAsgn?.project_id, indicators, newReport.indicator_id]);

    const projectIndicators = useMemo(() => {
        if (!selectedAsgn?.project_id) return indicators;
        const scoped = indicators.filter((item) => item.project_id === selectedAsgn.project_id);
        return scoped.length > 0 ? scoped : indicators;
    }, [indicators, selectedAsgn?.project_id]);

    const fetchPortalData = async () => {
        setLoading(true);
        try {
            const [assignmentRes, indicatorRes, userRes, submissionRes] = await Promise.all([
                axios.get(`${API_BASE}/facilitator-assignments`, {
                    params: { facilitator_id: user.id, userId: user.id },
                }),
                axios.get(`${API_BASE}/indicators`, { params: { userId: user.id } }),
                axios.get(`${API_BASE}/users`),
                axios.get(`${API_BASE}/volunteer/submissions`, { params: { userId: user.id } }),
            ]);

            setAssignments(assignmentRes.data || []);
            setIndicators(indicatorRes.data || []);
            setRecipients(
                (userRes.data || []).filter((item) => item.role_code !== 'DEVELOPMENT_FACILITATOR')
            );
            setSubmissions(submissionRes.data || []);

            if ((assignmentRes.data || []).length > 0) {
                setSelectedAsgn(assignmentRes.data[0]);
            }
        } catch (error) {
            console.error('Failed to fetch facilitator portal data', error);
        } finally {
            setLoading(false);
        }
    };

    const logAttendance = async () => {
        if (!selectedAsgn) return;
        try {
            await axios.post(`${API_BASE}/facilitator-attendance`, {
                userId: user.id,
                attendance_records: [
                    {
                        assignment_id: selectedAsgn.id,
                        date: attendanceDate,
                        status: attendanceStatus,
                        notes: 'Logged via facilitator portal',
                    },
                ],
            });
            setAttendanceSaved(true);
            setTimeout(() => setAttendanceSaved(false), 3000);
        } catch (error) {
            alert('Failed to log attendance');
        }
    };

    const openReportModal = (type) => {
        setReportType(type);
        setShowReportModal(true);
        setNewReport(createBlankReport());
    };

    const toggleRecipient = (recipientId) => {
        setNewReport((current) => ({
            ...current,
            recipients: current.recipients.includes(recipientId)
                ? current.recipients.filter((id) => id !== recipientId)
                : [...current.recipients, recipientId],
        }));
    };

    const submitReport = async (event) => {
        event.preventDefault();
        if (!selectedAsgn) return;
        if (reportType === 'weekly' && newReport.recipients.length === 0) {
            alert('Select at least one non-facilitator recipient for this report.');
            return;
        }

        setSubmittingReport(true);
        try {
            if (reportType === 'weekly') {
                const fileData = newReport.attachment ? await fileToBase64(newReport.attachment) : null;
                await axios.post(`${API_BASE}/volunteer/submit`, {
                    userId: user.id,
                    type: 'report',
                    title: newReport.title,
                    content: newReport.content,
                    description: `${newReport.title}: ${newReport.content}`.trim(),
                    fileData,
                    fileName: newReport.attachment?.name || null,
                    mimeType: newReport.attachment?.type || null,
                    assignmentId: selectedAsgn.id,
                    projectId: selectedAsgn.project_id,
                    recipients: newReport.recipients,
                });
            } else {
                await axios.post(`${API_BASE}/volunteer/activity-report`, {
                    userId: user.id,
                    indicator_id: newReport.indicator_id,
                    male_count: Number(newReport.male_count || 0),
                    female_count: Number(newReport.female_count || 0),
                    notes: newReport.notes,
                });
            }

            setShowReportModal(false);
            setNewReport(createBlankReport());
            await fetchPortalData();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to save report');
        } finally {
            setSubmittingReport(false);
        }
    };

    if (loading) {
        return (
            <div className="page-loading">
                <div className="spinner" />
            </div>
        );
    }

    return (
        <div className="fade-in">
            <PageHeader
                title="Facilitator Portal"
                subtitle="Log attendance, submit field reports, and route weekly narratives to the right staff."
            />

            <div className="panels-row facilitator-portal-layout">
                <div className="facilitator-portal-sidebar" style={{ flex: '0 0 350px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title">My Assignments</h2>
                        </div>
                        <div style={{ padding: '8px' }}>
                            {assignments.map((assignment) => (
                                <div
                                    key={assignment.id}
                                    className={`report-item ${selectedAsgn?.id === assignment.id ? 'active' : ''}`}
                                    onClick={() => setSelectedAsgn(assignment)}
                                    style={{
                                        padding: '12px',
                                        borderRadius: '8px',
                                        border:
                                            selectedAsgn?.id === assignment.id
                                                ? '1.5px solid var(--brand-primary)'
                                                : '1px solid transparent',
                                        cursor: 'pointer',
                                        marginBottom: '8px',
                                        background:
                                            selectedAsgn?.id === assignment.id
                                                ? 'var(--brand-primary-light)'
                                                : 'transparent',
                                    }}
                                >
                                    <div style={{ fontWeight: 600, fontSize: '13px' }}>
                                        {assignment.project_name}
                                    </div>
                                    <div className="form-hint">
                                        Assigned: {new Date(assignment.assigned_at).toLocaleDateString()}
                                    </div>
                                </div>
                            ))}
                            {assignments.length === 0 && (
                                <div className="empty-state" style={{ padding: '20px' }}>
                                    <div className="empty-state-icon">
                                        <Briefcase size={24} />
                                    </div>
                                    <p className="empty-state-text" style={{ fontSize: '11px' }}>
                                        No projects currently assigned to you.
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="kpi-card info">
                        <div className="kpi-icon-wrap">
                            <History size={20} />
                        </div>
                        <div className="kpi-label">Reports Submitted</div>
                        <div className="kpi-value" style={{ fontSize: '24px' }}>
                            {submissions.filter((item) => item.user_id === user.id).length}
                        </div>
                        <div className="kpi-sub">Narratives and evidence files on record</div>
                    </div>
                </div>

                <div className="facilitator-portal-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
                    <div className="panel">
                        <div className="panel-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div className="kpi-icon-wrap" style={{ width: '32px', height: '32px' }}>
                                    <CheckSquare size={16} />
                                </div>
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
                                        onChange={(event) => setAttendanceDate(event.target.value)}
                                    />
                                </div>
                                <div className="form-group" style={{ flex: 1, minWidth: '150px' }}>
                                    <label className="form-label">Attendance Status</label>
                                    <select
                                        className="form-input"
                                        value={attendanceStatus}
                                        onChange={(event) => setAttendanceStatus(event.target.value)}
                                    >
                                        <option value="present">Present (Field)</option>
                                        <option value="office">Office / Admin</option>
                                        <option value="absent">Excused Absence</option>
                                    </select>
                                </div>
                                <button
                                    className="btn btn-primary"
                                    style={{ minHeight: '42px', padding: '0 24px' }}
                                    onClick={logAttendance}
                                    disabled={!selectedAsgn}
                                >
                                    {attendanceSaved ? 'Saved' : 'Log Attendance'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title">Shortcuts & Reporting</h2>
                        </div>
                        <div
                            style={{
                                padding: '24px',
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                gap: '16px',
                            }}
                        >
                            <button className="control-row" onClick={() => openReportModal('activity')} style={{ minHeight: '110px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="kpi-icon-wrap" style={{ width: '36px', height: '36px', background: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}>
                                        <Target size={18} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '14px' }}>Log Activity Data</div>
                                        <div className="form-hint" style={{ fontSize: '11px' }}>Submit indicator counts and field notes</div>
                                    </div>
                                </div>
                            </button>

                            <button className="control-row" onClick={() => openReportModal('weekly')} style={{ minHeight: '110px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div className="kpi-icon-wrap" style={{ width: '36px', height: '36px', background: '#3b82f61a', color: '#3b82f6' }}>
                                        <Calendar size={18} />
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '14px' }}>Weekly Narrative</div>
                                        <div className="form-hint" style={{ fontSize: '11px' }}>Save a report and assign it to HQ staff</div>
                                    </div>
                                </div>
                            </button>
                        </div>
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title">Recent Submissions</h2>
                        </div>
                        {submissions.length > 0 ? (
                            <div className="control-stack">
                                {submissions.slice(0, 5).map((submission) => (
                                    <div key={submission.id} className="control-row static">
                                        <div>
                                            <div className="control-title">
                                                {submission.title || submission.file_name || 'Untitled submission'}
                                            </div>
                                            <div className="control-copy">
                                                {submission.project_name || 'General field submission'} · {new Date(submission.created_at).toLocaleString()}
                                            </div>
                                        </div>
                                        <span className="badge badge-info">{submission.type}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="empty-state" style={{ padding: '32px 20px' }}>
                                <div className="empty-state-icon">
                                    <FileText size={28} />
                                </div>
                                <div className="empty-state-title">No submissions yet</div>
                                <p className="empty-state-text">
                                    Save your first weekly narrative or activity update from the shortcuts above.
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="panel" style={{ background: 'var(--bg-app)', border: '1px solid var(--border)', padding: '20px' }}>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <AlertCircle size={20} className="text-muted" />
                            <div>
                                <div style={{ fontWeight: 600, fontSize: '13px' }}>Reporting note</div>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                    Weekly narratives can include PDF or Word evidence files and can be assigned to one or multiple non-facilitator staff members.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showReportModal && (
                <div className="modal-overlay" onClick={() => setShowReportModal(false)}>
                    <div className="modal-box lg" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">
                                {reportType === 'weekly' ? 'Submit Weekly Narrative' : 'Log Field Activity Data'}
                            </div>
                            <button className="modal-close" onClick={() => setShowReportModal(false)}>
                                ×
                            </button>
                        </div>
                        <form onSubmit={submitReport}>
                            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Active Project Context</label>
                                    <div className="form-input" style={{ background: 'var(--bg-app)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <Briefcase size={14} className="text-primary" />
                                        {selectedAsgn?.project_name || 'No project selected'}
                                    </div>
                                </div>

                                {reportType === 'weekly' ? (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Report Title</label>
                                            <input
                                                type="text"
                                                className="form-input"
                                                required
                                                placeholder="e.g. Week 4 Implementation - Harare South"
                                                value={newReport.title}
                                                onChange={(event) =>
                                                    setNewReport((current) => ({ ...current, title: event.target.value }))
                                                }
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Executive Summary / Narrative</label>
                                            <textarea
                                                className="form-input"
                                                required
                                                style={{ minHeight: '180px' }}
                                                placeholder="Describe the key activities, achievements and challenges..."
                                                value={newReport.content}
                                                onChange={(event) =>
                                                    setNewReport((current) => ({ ...current, content: event.target.value }))
                                                }
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Attach PDF or Word Report</label>
                                            <input
                                                type="file"
                                                className="form-input"
                                                accept=".pdf,.doc,.docx"
                                                onChange={(event) =>
                                                    setNewReport((current) => ({
                                                        ...current,
                                                        attachment: event.target.files?.[0] || null,
                                                    }))
                                                }
                                            />
                                            <p className="form-hint">
                                                Optional, but recommended when you have a formatted report or supporting evidence.
                                            </p>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Assign To Non-Facilitator Staff</label>
                                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px', maxHeight: '220px', overflowY: 'auto', padding: '4px' }}>
                                                {recipients.map((recipient) => (
                                                    <label key={recipient.id} className="control-row static" style={{ padding: '12px', cursor: 'pointer', background: newReport.recipients.includes(recipient.id) ? 'var(--brand-primary-light)' : 'var(--bg-app)' }}>
                                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                                                            <input
                                                                type="checkbox"
                                                                checked={newReport.recipients.includes(recipient.id)}
                                                                onChange={() => toggleRecipient(recipient.id)}
                                                                style={{ marginTop: '3px' }}
                                                            />
                                                            <div>
                                                                <div className="control-title">{recipient.name}</div>
                                                                <div className="control-copy">{recipient.job_title || recipient.role_code}</div>
                                                            </div>
                                                        </div>
                                                    </label>
                                                ))}
                                            </div>
                                            <p className="form-hint">
                                                Select one or more staff members who should receive this weekly narrative.
                                            </p>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Associated Indicator</label>
                                            <select
                                                className="form-input"
                                                required
                                                value={newReport.indicator_id}
                                                onChange={(event) =>
                                                    setNewReport((current) => ({ ...current, indicator_id: event.target.value }))
                                                }
                                            >
                                                <option value="">Select indicator...</option>
                                                {projectIndicators.map((indicator) => (
                                                    <option key={indicator.id} value={indicator.id}>
                                                        {indicator.title}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px' }}>
                                            <div className="form-group">
                                                <label className="form-label">Male Participants</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    required
                                                    min="0"
                                                    value={newReport.male_count}
                                                    onChange={(event) =>
                                                        setNewReport((current) => ({ ...current, male_count: event.target.value }))
                                                    }
                                                />
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Female Participants</label>
                                                <input
                                                    type="number"
                                                    className="form-input"
                                                    required
                                                    min="0"
                                                    value={newReport.female_count}
                                                    onChange={(event) =>
                                                        setNewReport((current) => ({ ...current, female_count: event.target.value }))
                                                    }
                                                />
                                            </div>
                                        </div>

                                        <div className="form-group">
                                            <label className="form-label">Field Notes / Evidence Summary</label>
                                            <textarea
                                                className="form-input"
                                                style={{ minHeight: '100px' }}
                                                value={newReport.notes}
                                                onChange={(event) =>
                                                    setNewReport((current) => ({ ...current, notes: event.target.value }))
                                                }
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowReportModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submittingReport || !selectedAsgn}>
                                    <Send size={16} />
                                    {submittingReport
                                        ? 'Saving...'
                                        : reportType === 'weekly'
                                            ? 'Save Report'
                                            : 'Save Activity Log'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

