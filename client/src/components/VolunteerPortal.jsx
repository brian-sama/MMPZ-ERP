import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    AlertCircle,
    BarChart,
    CheckCircle,
    Download,
    File,
    FileText,
    Link as LinkIcon,
    Upload,
} from 'lucide-react';
import API_BASE from '../apiConfig';

export default function VolunteerPortal({ user }) {
    const [activeTab, setActiveTab] = useState('uploads');
    const [msg, setMsg] = useState({ type: '', text: '' });
    const [submissions, setSubmissions] = useState([]);
    const [indicators, setIndicators] = useState([]);
    const [koboForms, setKoboForms] = useState([]);
    const [myKoboRequests, setMyKoboRequests] = useState([]);
    const [uploadType, setUploadType] = useState('plan');
    const [file, setFile] = useState(null);
    const [description, setDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const [reportForm, setReportForm] = useState({ indicatorId: '', male: 0, female: 0, notes: '' });
    const [koboRequest, setKoboRequest] = useState({ formUid: '', formName: '', indicatorId: '' });

    useEffect(() => {
        fetchSubmissions();
        fetchIndicators();
        fetchKoboForms();
        fetchMyKoboRequests();
    }, [user.id]);

    const fetchSubmissions = async () => {
        try {
            const res = await axios.get(`${API_BASE}/volunteer/submissions`, {
                params: { role: user.role, userId: user.id },
            });
            setSubmissions(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchIndicators = async () => {
        try {
            const res = await axios.get(`${API_BASE}/indicators`, {
                params: { userId: user.id, role: user.role },
            });
            setIndicators((res.data || []).filter((item) => item.status === 'active'));
        } catch (err) {
            console.error(err);
        }
    };

    const fetchKoboForms = async () => {
        try {
            const res = await axios.get(`${API_BASE}/kobo/forms`, {
                params: { userId: user.id },
            });
            setKoboForms(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const fetchMyKoboRequests = async () => {
        try {
            const res = await axios.get(`${API_BASE}/volunteer/kobo-requests`, {
                params: { userId: user.id },
            });
            setMyKoboRequests(res.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleFileChange = (event) => {
        const selectedFile = event.target.files?.[0];
        if (selectedFile) {
            if (selectedFile.size > 4 * 1024 * 1024) {
                setMsg({ type: 'error', text: 'File size must be less than 4MB.' });
                setFile(null);
                return;
            }
            setFile(selectedFile);
        }
    };

    const convertToBase64 = (value) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(value);
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => reject(error);
    });

    const handleUploadSubmit = async (event) => {
        event.preventDefault();
        if (!file) {
            setMsg({ type: 'error', text: 'Select a document before submitting.' });
            return;
        }

        setIsUploading(true);
        try {
            const base64File = await convertToBase64(file);
            await axios.post(`${API_BASE}/volunteer/submit`, {
                userId: user.id,
                type: uploadType,
                fileData: base64File,
                fileName: file.name,
                mimeType: file.type,
                description,
            });
            setMsg({ type: 'success', text: 'Document uploaded successfully.' });
            setFile(null);
            setDescription('');
            fetchSubmissions();
        } catch (err) {
            setMsg({ type: 'error', text: 'Upload failed. Please try again.' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleReportSubmit = async (event) => {
        event.preventDefault();
        try {
            await axios.post(`${API_BASE}/volunteer/activity-report`, {
                userId: user.id,
                ...reportForm,
            });
            setMsg({ type: 'success', text: 'Activity report submitted.' });
            setReportForm({ indicatorId: '', male: 0, female: 0, notes: '' });
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to submit activity report.' });
        }
    };

    const handleKoboRequest = async (event) => {
        event.preventDefault();
        const form = koboForms.find((item) => item.uid === koboRequest.formUid);
        if (!form) return;

        try {
            await axios.post(`${API_BASE}/volunteer/kobo-request`, {
                userId: user.id,
                formUid: koboRequest.formUid,
                formName: form.name,
                indicatorId: koboRequest.indicatorId,
            });
            setMsg({ type: 'success', text: 'Kobo connection request sent for review.' });
            setKoboRequest({ formUid: '', formName: '', indicatorId: '' });
            fetchMyKoboRequests();
        } catch (err) {
            setMsg({ type: 'error', text: 'Request failed. It may already exist.' });
        }
    };

    const handleDownload = async (submissionId) => {
        try {
            const res = await axios.get(`${API_BASE}/volunteer/download/${submissionId}`, {
                params: { userId: user.id },
            });
            const fileData = res.data?.file_data;
            const fileName = res.data?.file_name || `submission-${submissionId}`;
            if (!fileData) {
                setMsg({ type: 'error', text: 'No file data found for this submission.' });
                return;
            }

            const link = document.createElement('a');
            link.href = fileData;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            setMsg({ type: 'error', text: 'Could not download this submission.' });
        }
    };

    return (
        <div className="content-stack fade-in">
            <div className="toolbar-row">
                <div>
                    <h1 className="page-title">Volunteer Portal</h1>
                    <p className="page-subtitle">Submit field documents, report activity data, and request Kobo links.</p>
                </div>
                <div className="segmented-control">
                    <button
                        className={`segmented-button ${activeTab === 'uploads' ? 'active' : ''}`}
                        onClick={() => setActiveTab('uploads')}
                    >
                        Documents
                    </button>
                    <button
                        className={`segmented-button ${activeTab === 'reporting' ? 'active' : ''}`}
                        onClick={() => setActiveTab('reporting')}
                    >
                        Activity & Kobo
                    </button>
                </div>
            </div>

            {msg.text && (
                <div className={`page-alert ${msg.type === 'error' ? 'error' : 'success'}`}>
                    {msg.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
                    <p>{msg.text}</p>
                </div>
            )}

            {activeTab === 'uploads' && (
                <div className="panels-row">
                    <div className="panel">
                        <div className="panel-header">
                            <div>
                                <h2 className="panel-title">Upload Document</h2>
                                <p className="panel-subtitle">Share plans, reports, and other supporting files.</p>
                            </div>
                            <div className="metric-icon primary">
                                <Upload size={18} />
                            </div>
                        </div>

                        <form onSubmit={handleUploadSubmit} className="content-stack">
                            <div className="form-group">
                                <label className="form-label">Document Type</label>
                                <select className="form-select" value={uploadType} onChange={(event) => setUploadType(event.target.value)}>
                                    <option value="plan">Activity Plan</option>
                                    <option value="report">Activity Report</option>
                                    <option value="concept_note">Concept Note</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Description</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={description}
                                    onChange={(event) => setDescription(event.target.value)}
                                    placeholder="Add context for reviewers or admin staff"
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">File</label>
                                <input
                                    type="file"
                                    className="form-input"
                                    accept=".pdf,.doc,.docx"
                                    onChange={handleFileChange}
                                />
                                <p className="form-hint">Accepted formats: PDF, DOC, DOCX. Maximum size: 4MB.</p>
                            </div>
                            <button type="submit" disabled={isUploading} className="btn btn-primary">
                                {isUploading ? 'Uploading...' : 'Submit Document'}
                            </button>
                        </form>
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <div>
                                <h2 className="panel-title">My Uploads</h2>
                                <p className="panel-subtitle">Recent files you have already submitted.</p>
                            </div>
                            <div className="metric-icon info">
                                <FileText size={18} />
                            </div>
                        </div>

                        {submissions.length === 0 ? (
                            <div className="empty-state" style={{ padding: '28px 16px' }}>
                                <div className="empty-state-title">No uploads yet</div>
                                <p className="empty-state-text">Submitted files will appear here with their upload date.</p>
                            </div>
                        ) : (
                            <div className="stack-list">
                                {submissions.map((submission) => (
                                    <div key={submission.id} className="status-card">
                                        <div className="status-card-header">
                                            <div>
                                                <div className="status-card-title">{submission.type.replace(/_/g, ' ')}</div>
                                                <div className="status-card-copy">
                                                    {submission.file_name} · {new Date(submission.created_at).toLocaleDateString()}
                                                </div>
                                            </div>
                                            <span className="badge badge-primary">
                                                <File size={12} />
                                                Filed
                                            </span>
                                        </div>
                                        <div className="status-card-actions">
                                            <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(submission.id)}>
                                                <Download size={14} />
                                                Download
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'reporting' && (
                <div className="panels-row">
                    <div className="panel">
                        <div className="panel-header">
                            <div>
                                <h2 className="panel-title">Activity Numbers</h2>
                                <p className="panel-subtitle">Report beneficiary totals against an approved indicator.</p>
                            </div>
                            <div className="metric-icon success">
                                <BarChart size={18} />
                            </div>
                        </div>

                        <form onSubmit={handleReportSubmit} className="content-stack">
                            <div className="form-group">
                                <label className="form-label">Project Indicator</label>
                                <select
                                    required
                                    className="form-select"
                                    value={reportForm.indicatorId}
                                    onChange={(event) => setReportForm({ ...reportForm, indicatorId: event.target.value })}
                                >
                                    <option value="">Select indicator</option>
                                    {indicators.map((indicator) => (
                                        <option key={indicator.id} value={indicator.id}>
                                            {indicator.title}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-row">
                                <div className="form-group">
                                    <label className="form-label">Male Count</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="form-input"
                                        value={reportForm.male}
                                        onChange={(event) => setReportForm({ ...reportForm, male: event.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Female Count</label>
                                    <input
                                        type="number"
                                        min="0"
                                        className="form-input"
                                        value={reportForm.female}
                                        onChange={(event) => setReportForm({ ...reportForm, female: event.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Notes</label>
                                <textarea
                                    className="form-textarea"
                                    rows="4"
                                    value={reportForm.notes}
                                    onChange={(event) => setReportForm({ ...reportForm, notes: event.target.value })}
                                />
                            </div>
                            <button type="submit" className="btn btn-primary">Submit Activity Report</button>
                        </form>
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <div>
                                <h2 className="panel-title">Request Kobo Sync</h2>
                                <p className="panel-subtitle">Ask for a Kobo form to be linked to an indicator.</p>
                            </div>
                            <div className="metric-icon warning">
                                <LinkIcon size={18} />
                            </div>
                        </div>

                        <form onSubmit={handleKoboRequest} className="content-stack">
                            <div className="form-group">
                                <label className="form-label">Kobo Form</label>
                                <select
                                    required
                                    className="form-select"
                                    value={koboRequest.formUid}
                                    onChange={(event) => setKoboRequest({ ...koboRequest, formUid: event.target.value })}
                                >
                                    <option value="">Select form</option>
                                    {koboForms.map((form) => (
                                        <option key={form.uid} value={form.uid}>{form.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Target Indicator</label>
                                <select
                                    required
                                    className="form-select"
                                    value={koboRequest.indicatorId}
                                    onChange={(event) => setKoboRequest({ ...koboRequest, indicatorId: event.target.value })}
                                >
                                    <option value="">Select indicator</option>
                                    {indicators.map((indicator) => (
                                        <option key={indicator.id} value={indicator.id}>{indicator.title}</option>
                                    ))}
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary">Request Connection</button>
                        </form>

                        <div className="divider" />

                        <div className="content-stack">
                            <div>
                                <h3 className="panel-title">My Requests</h3>
                                <p className="panel-subtitle">Track the status of submitted Kobo link requests.</p>
                            </div>
                            {myKoboRequests.length === 0 ? (
                                <p className="form-hint">No requests submitted yet.</p>
                            ) : (
                                <div className="stack-list">
                                    {myKoboRequests.map((request) => (
                                        <div key={request.id} className="status-card">
                                            <div className="status-card-header">
                                                <div>
                                                    <div className="status-card-title">{request.kobo_form_name}</div>
                                                    <div className="status-card-copy">Linked to: {request.indicator_title}</div>
                                                </div>
                                                <span className={`badge ${
                                                    request.status === 'approved'
                                                        ? 'badge-success'
                                                        : request.status === 'rejected'
                                                            ? 'badge-danger'
                                                            : 'badge-warning'
                                                }`}>
                                                    {request.status}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
