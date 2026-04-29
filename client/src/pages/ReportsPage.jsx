import React, { useEffect, useState } from 'react';
import axios from 'axios';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import {
    FilePieChart, Download, FileText, Table,
    Filter, Calendar, ChevronRight, BarChartHorizontal, Upload, ClipboardList
} from 'lucide-react';

const REPORT_TEMPLATES = [
    { id: 'me_monthly', name: 'M&E Monthly Progress Report', icon: FilePieChart, desc: 'Detailed breakdown of indicator achievements vs monthly targets.' },
    { id: 'finance_utilization', name: 'Finance Utilization Report', icon: Table, desc: 'Grant burn rates and budget line availability summary.' },
    { id: 'facilitator_activity', name: 'Facilitator Field Activity', icon: FileText, desc: 'Log of all field activities and attendance for the selected period.' },
    { id: 'procurement_audit', name: 'Procurement Audit Trail', icon: BarChartHorizontal, desc: 'Full lifecycle of all purchase requests and management approvals.' }
];

const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });

export default function ReportsPage() {
    const { user } = useAuth();
    const [selectedReport, setSelectedReport] = useState(null);
    const [generating, setGenerating] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [format, setFormat] = useState('pdf');
    const [submissionType, setSubmissionType] = useState('leave_application');
    const [submissionTitle, setSubmissionTitle] = useState('');
    const [submissionDescription, setSubmissionDescription] = useState('');
    const [submissionFile, setSubmissionFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [submissions, setSubmissions] = useState([]);

    const canUploadLeaveApplication = user?.role_code !== 'DEVELOPMENT_FACILITATOR';
    const canUploadRequestForFunds = [
        'FINANCE_ADMIN_OFFICER',
        'ADMIN_ASSISTANT',
        'LOGISTICS_ASSISTANT',
        'COMMUNITY_DEVELOPMENT_OFFICER',
        'PSYCHOSOCIAL_SUPPORT_OFFICER',
        'ME_INTERN_ACTING_OFFICER',
        'SOCIAL_SERVICES_INTERN',
        'YOUTH_COMMUNICATIONS_INTERN',
    ].includes(user?.role_code);
    const availableSubmissionTypes = [
        canUploadLeaveApplication ? {
            value: 'leave_application',
            label: 'Leave Application Form',
            helper: 'Route staff leave documentation to the Director, Finance, and Logistics reviewers.',
            accept: '.pdf,.doc,.docx,.jpg,.jpeg,.png',
        } : null,
        canUploadRequestForFunds ? {
            value: 'request_for_funds_plan',
            label: 'Request for Funds Plan',
            helper: 'Upload the Excel plan for director approval before it reaches the finance team.',
            accept: '.xls,.xlsx',
        } : null,
    ].filter(Boolean);

    const handleGenerate = async () => {
        if (!selectedReport) return;
        setGenerating(true);
        const previewWindow = format === 'pdf' ? window.open('', '_blank', 'noopener,noreferrer') : null;
        try {
            const endpoint = format === 'pdf' ? '/reports/pdf' : '/reports/excel';
            const res = await axios.get(`${API_BASE}${endpoint}`, {
                params: {
                    from: dateFrom,
                    to: dateTo,
                    type: selectedReport.id,
                    userId: user.id,
                },
                responseType: 'blob',
            });

            const blob = new Blob([res.data], {
                type:
                    res.headers['content-type'] ||
                    (format === 'pdf' ? 'text/html;charset=utf-8' : 'text/csv;charset=utf-8'),
            });
            const blobUrl = window.URL.createObjectURL(blob);

            if (format === 'pdf') {
                if (previewWindow) {
                    previewWindow.location = blobUrl;
                } else {
                    window.open(blobUrl, '_blank', 'noopener,noreferrer');
                }
                setTimeout(() => window.URL.revokeObjectURL(blobUrl), 60_000);
            } else {
                const link = document.createElement('a');
                link.href = blobUrl;
                link.setAttribute('download', `report_${selectedReport.id}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(blobUrl);
            }
        } catch (err) {
            if (previewWindow) previewWindow.close();
            alert('Failed to generate report');
        } finally {
            setGenerating(false);
        }
    };

    const fetchOperationalSubmissions = async () => {
        try {
            const res = await axios.get(`${API_BASE}/volunteer/submissions`, {
                params: { userId: user.id },
            });
            setSubmissions(
                (res.data || []).filter((item) =>
                    ['leave_application', 'request_for_funds_plan'].includes(item.type)
                )
            );
        } catch (error) {
            console.error('Failed to load operational submissions', error);
        }
    };

    useEffect(() => {
        if (availableSubmissionTypes.length > 0) {
            setSubmissionType((current) =>
                availableSubmissionTypes.some((option) => option.value === current)
                    ? current
                    : availableSubmissionTypes[0].value
            );
        }
        fetchOperationalSubmissions();
    }, [user.id]);

    const handleSubmission = async (event) => {
        event.preventDefault();
        if (!submissionFile) {
            alert('Please attach the completed file first.');
            return;
        }

        setSubmitting(true);
        try {
            const fileData = await fileToBase64(submissionFile);
            await axios.post(`${API_BASE}/volunteer/submit`, {
                userId: user.id,
                type: submissionType,
                title: submissionTitle || submissionFile.name,
                description: submissionDescription,
                fileData,
                fileName: submissionFile.name,
                mimeType: submissionFile.type,
            });
            setSubmissionTitle('');
            setSubmissionDescription('');
            setSubmissionFile(null);
            setSubmissionType(availableSubmissionTypes[0]?.value || 'leave_application');
            await fetchOperationalSubmissions();
            alert(
                submissionType === 'request_for_funds_plan'
                    ? 'Request-for-funds plan sent to the Director for approval.'
                    : 'Leave application sent to the Director, Finance, and Logistics reviewers.'
            );
        } catch (err) {
            alert(err.response?.data?.error || 'Failed to submit document');
        } finally {
            setSubmitting(false);
        }
    };

    const downloadSubmission = async (submission) => {
        try {
            const res = await axios.get(`${API_BASE}/volunteer/download/${submission.id}`, {
                params: { userId: user.id },
            });
            const fileData = res.data?.file_data;
            if (!fileData) {
                alert('Attachment is no longer available.');
                return;
            }

            const link = document.createElement('a');
            link.href = fileData;
            link.download = submission.file_name || submission.title || 'submission';
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to download attachment');
        }
    };

    return (
        <div className="fade-in">
            <PageHeader
                title="System Reports"
                subtitle="Extract strategic data and operational insights for stakeholder reporting."
            />

            <div className="panels-row reports-layout">
                <div className="panel" style={{ flex: '0 0 450px' }}>
                    <div className="panel-header">
                        <h2 className="panel-title">Report Templates</h2>
                    </div>
                    <div className="report-list">
                        {REPORT_TEMPLATES.map(rep => (
                            <div
                                key={rep.id}
                                className={`report-item ${selectedReport?.id === rep.id ? 'active' : ''}`}
                                onClick={() => setSelectedReport(rep)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '16px',
                                    padding: '16px',
                                    borderBottom: '1px solid var(--border)',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <div className="kpi-icon-wrap" style={{ width: '40px', height: '40px', flexShrink: 0 }}>
                                    <rep.icon size={20} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: '14px' }}>{rep.name}</div>
                                    <div className="form-hint" style={{ fontSize: '12px' }}>{rep.desc}</div>
                                </div>
                                <ChevronRight size={18} className="text-muted" />
                            </div>
                        ))}
                    </div>
                </div>

                <div className="panel">
                    {selectedReport ? (
                        <div className="animate-slide-in reports-preview" style={{ padding: '32px' }}>
                            <div style={{ textAlign: 'center', marginBottom: '32px' }}>
                                <div className="kpi-icon-wrap" style={{ margin: '0 auto 16px', width: '64px', height: '64px', background: 'var(--brand-primary-light)', color: 'var(--brand-primary)' }}>
                                    <selectedReport.icon size={32} />
                                </div>
                                <h2 style={{ fontSize: '20px', fontWeight: 700 }}>{selectedReport.name}</h2>
                                <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '8px auto' }}>{selectedReport.desc}</p>
                            </div>

                            <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                                <div className="form-group" style={{ marginBottom: '20px' }}>
                                    <label className="form-label">Select Date Range</label>
                                    <div className="reports-date-range" style={{ display: 'flex', gap: '12px' }}>
                                        <input type="date" className="form-input" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
                                        <input type="date" className="form-input" value={dateTo} onChange={e => setDateTo(e.target.value)} />
                                    </div>
                                </div>

                                <div className="form-group" style={{ marginBottom: '20px' }}>
                                    <label className="form-label">Output Format</label>
                                    <div className="reports-format-grid" style={{ display: 'flex', gap: '12px' }}>
                                        <label style={{ flex: 1, padding: '12px', border: format === 'pdf' ? '2px solid var(--brand-primary)' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: format === 'pdf' ? 'var(--brand-primary-light)' : 'transparent' }}>
                                            <input type="radio" name="format" checked={format === 'pdf'} onChange={() => setFormat('pdf')} />
                                            <span>PDF Document</span>
                                        </label>
                                        <label style={{ flex: 1, padding: '12px', border: format === 'excel' ? '2px solid var(--brand-primary)' : '1px solid var(--border)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px', background: format === 'excel' ? 'var(--brand-primary-light)' : 'transparent' }}>
                                            <input type="radio" name="format" checked={format === 'excel'} onChange={() => setFormat('excel')} />
                                            <span>Excel Spreadsheet</span>
                                        </label>
                                    </div>
                                </div>

                                <button 
                                    className="btn btn-primary" 
                                    style={{ width: '100%', padding: '12px', height: '48px' }}
                                    onClick={handleGenerate}
                                    disabled={generating}
                                >
                                    <Download size={18} style={{ marginRight: '8px' }} /> {generating ? 'Generating...' : 'Generate & Download Report'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="empty-state" style={{ height: '100%', minHeight: '400px' }}>
                            <div className="empty-state-icon"><BarChartHorizontal size={48} /></div>
                            <div className="empty-state-title">Select a report template</div>
                            <p className="empty-state-text">Choose a template from the left to configure your export.</p>
                        </div>
                    )}
                </div>
            </div>

            {availableSubmissionTypes.length > 0 && (
                <div className="panel" style={{ marginTop: '24px' }}>
                    <div className="panel-header">
                        <h2 className="panel-title">Operational Uploads</h2>
                    </div>
                    <form onSubmit={handleSubmission} style={{ padding: '24px', display: 'grid', gap: '18px' }}>
                        <div className="form-group">
                            <label className="form-label">Submission Type</label>
                            <select
                                className="form-input"
                                value={submissionType}
                                onChange={(event) => {
                                    setSubmissionType(event.target.value);
                                    setSubmissionFile(null);
                                }}
                            >
                                {availableSubmissionTypes.map((option) => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                            <div className="form-hint">
                                {availableSubmissionTypes.find((option) => option.value === submissionType)?.helper}
                            </div>
                        </div>

                        <div className="reports-date-range" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group">
                                <label className="form-label">Title</label>
                                <input
                                    className="form-input"
                                    value={submissionTitle}
                                    onChange={(event) => setSubmissionTitle(event.target.value)}
                                    placeholder={submissionType === 'request_for_funds_plan' ? 'April request for funds plan' : 'Annual leave application'}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Attachment</label>
                                <input
                                    type="file"
                                    className="form-input"
                                    accept={availableSubmissionTypes.find((option) => option.value === submissionType)?.accept}
                                    onChange={(event) => setSubmissionFile(event.target.files?.[0] || null)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Notes</label>
                            <textarea
                                className="form-input"
                                style={{ minHeight: '110px' }}
                                value={submissionDescription}
                                onChange={(event) => setSubmissionDescription(event.target.value)}
                                placeholder="Add context for the reviewers and approvers."
                            />
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={submitting}>
                            <Upload size={16} /> {submitting ? 'Submitting...' : 'Submit for Review'}
                        </button>
                    </form>
                </div>
            )}

            <div className="panel" style={{ marginTop: '24px' }}>
                <div className="panel-header">
                    <h2 className="panel-title">Operational Inbox</h2>
                </div>
                {submissions.length === 0 ? (
                    <div className="empty-state" style={{ padding: '36px 20px' }}>
                        <div className="empty-state-icon"><ClipboardList size={28} /></div>
                        <div className="empty-state-title">No leave or funds submissions yet</div>
                        <p className="empty-state-text">Submitted operational forms will appear here for follow-up and download.</p>
                    </div>
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Type</th>
                                    <th>Title</th>
                                    <th>Submitted By</th>
                                    <th>Date</th>
                                    <th>File</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map((submission) => (
                                    <tr key={submission.id}>
                                        <td>
                                            <span className="badge badge-info">
                                                {submission.type === 'request_for_funds_plan' ? 'Request for Funds' : 'Leave Application'}
                                            </span>
                                        </td>
                                        <td>{submission.title || submission.file_name || 'Untitled submission'}</td>
                                        <td>{submission.volunteer_name || 'Staff member'}</td>
                                        <td>{new Date(submission.created_at).toLocaleDateString()}</td>
                                        <td>
                                            {submission.has_file ? (
                                                <button className="btn btn-ghost btn-sm" onClick={() => downloadSubmission(submission)}>
                                                    <Download size={14} />
                                                </button>
                                            ) : (
                                                <span className="form-hint">No file</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
