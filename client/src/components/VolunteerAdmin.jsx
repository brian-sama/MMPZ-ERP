import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Briefcase, Database, Download, Search, Users, X } from 'lucide-react';
import API_BASE from '../apiConfig';
import StatCard from './StatCard';

export default function VolunteerAdmin({ user }) {
    const [activeTab, setActiveTab] = useState('submissions');
    const [submissions, setSubmissions] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [showImportModal, setShowImportModal] = useState(false);
    const [importStep, setImportStep] = useState(1);
    const [linkedForms, setLinkedForms] = useState([]);
    const [selectedForm, setSelectedForm] = useState(null);
    const [formFields, setFormFields] = useState([]);
    const [mapping, setMapping] = useState({
        name: '',
        age: '',
        gender: '',
        contact: '',
        event_date: '',
        volunteer_name: '',
    });
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        fetchAll();
    }, []);

    const fetchAll = () => {
        fetchSubmissions();
        fetchParticipants();
    };

    const fetchSubmissions = async () => {
        try {
            const res = await axios.get(`${API_BASE}/volunteer/submissions`, {
                params: { role: user.role, userId: user.id },
            });
            setSubmissions(res.data || []);
        } catch (err) {
            console.error('Error fetching submissions', err);
        }
    };

    const fetchParticipants = async () => {
        try {
            const res = await axios.get(`${API_BASE}/volunteer/participants`, {
                params: { role: user.role, userId: user.id },
            });
            setParticipants(res.data || []);
        } catch (err) {
            console.error('Error fetching participants', err);
        }
    };

    const openImportModal = async () => {
        setShowImportModal(true);
        setImportStep(1);
        try {
            const res = await axios.get(`${API_BASE}/kobo/links`, {
                params: { userId: user.id },
            });
            setLinkedForms(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleFormSelect = async (event) => {
        const uid = event.target.value;
        const form = linkedForms.find((item) => item.kobo_form_uid === uid);
        setSelectedForm(form || null);

        try {
            const res = await axios.get(`${API_BASE}/kobo/fields/${uid}`, {
                params: { userId: user.id },
            });
            setFormFields(res.data || []);
            setImportStep(2);
        } catch (err) {
            alert('Could not fetch fields. Ensure the selected form has synced data.');
        }
    };

    const handleImportSubmit = async (event) => {
        event.preventDefault();
        if (!selectedForm) return;

        setImporting(true);
        try {
            const res = await axios.post(`${API_BASE}/kobo/import-participants`, {
                kobo_form_uid: selectedForm.kobo_form_uid,
                mapping,
                userId: user.id,
            });
            alert(res.data.message);
            setShowImportModal(false);
            fetchParticipants();
        } catch (err) {
            alert('Import failed');
        } finally {
            setImporting(false);
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
                alert('No file data found for this submission.');
                return;
            }

            const link = document.createElement('a');
            link.href = fileData;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (err) {
            alert('Could not download this submission.');
        }
    };

    const uniqueVolunteers = new Set([
        ...submissions.map((item) => item.volunteer_name),
        ...participants.map((item) => item.volunteer_name),
    ]).size;

    return (
        <div className="content-stack fade-in">
            <div className="toolbar-row">
                <div>
                    <h1 className="page-title">Volunteer Management</h1>
                    <p className="page-subtitle">Review submissions, maintain the participants register, and import Kobo records.</p>
                </div>
                <div className="segmented-control">
                    <button
                        className={`segmented-button ${activeTab === 'submissions' ? 'active' : ''}`}
                        onClick={() => setActiveTab('submissions')}
                    >
                        Submissions
                    </button>
                    <button
                        className={`segmented-button ${activeTab === 'participants' ? 'active' : ''}`}
                        onClick={() => setActiveTab('participants')}
                    >
                        Participants
                    </button>
                </div>
            </div>

            <div className="metric-grid">
                <StatCard
                    label="Active Volunteers"
                    value={uniqueVolunteers || 0}
                    subtext="People contributing submissions or participant data"
                    trend="stable"
                    icon={<Users size={18} />}
                    iconTone="primary"
                />
                <StatCard
                    label="Total Submissions"
                    value={submissions.length}
                    subtext="Plans, reports, and supporting uploads"
                    trend="up"
                    icon={<Briefcase size={18} />}
                    iconTone="info"
                />
                <StatCard
                    label="Participants Recorded"
                    value={participants.length}
                    subtext="Central database rows available for reporting"
                    trend="up"
                    icon={<Database size={18} />}
                    iconTone="success"
                />
            </div>

            {activeTab === 'submissions' && (
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Recent Volunteer Submissions</h2>
                            <p className="panel-subtitle">Documents submitted from the field.</p>
                        </div>
                        <div className="selection-card" style={{ padding: '0 12px', minWidth: '240px', cursor: 'default' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Search size={16} color="var(--text-muted)" />
                                <input
                                    type="text"
                                    className="form-input"
                                    style={{ border: 'none', boxShadow: 'none', background: 'transparent', paddingLeft: 0, paddingRight: 0 }}
                                    placeholder="Search by volunteer or filename"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Volunteer</th>
                                    <th>Document Type</th>
                                    <th>File Name</th>
                                    <th>Submitted On</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.length === 0 && (
                                    <tr>
                                        <td colSpan="5">
                                            <div className="empty-state" style={{ padding: '28px 16px' }}>
                                                <div className="empty-state-title">No submissions yet</div>
                                                <p className="empty-state-text">Volunteer documents will appear here once uploaded.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {submissions.map((submission) => (
                                    <tr key={submission.id}>
                                        <td>{submission.volunteer_name}</td>
                                        <td>
                                            <span className="badge badge-primary">
                                                {submission.type.replace(/_/g, ' ')}
                                            </span>
                                        </td>
                                        <td>{submission.file_name}</td>
                                        <td>{new Date(submission.created_at).toLocaleDateString()}</td>
                                        <td>
                                            {submission.has_file && (
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleDownload(submission.id)}>
                                                    <Download size={14} />
                                                    Download
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'participants' && (
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Central Participants Database</h2>
                            <p className="panel-subtitle">Imported or manually synced participant records.</p>
                        </div>
                        <div className="toolbar-row">
                            <button className="btn btn-primary btn-sm" onClick={openImportModal}>
                                <Download size={14} />
                                Import From Kobo
                            </button>
                            <div className="selection-card" style={{ padding: '0 12px', minWidth: '220px', cursor: 'default' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                    <Search size={16} color="var(--text-muted)" />
                                    <input
                                        type="text"
                                        className="form-input"
                                        style={{ border: 'none', boxShadow: 'none', background: 'transparent', paddingLeft: 0, paddingRight: 0 }}
                                        placeholder="Search participant names"
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Logged By</th>
                                    <th>Participant Name</th>
                                    <th>Age</th>
                                    <th>Gender</th>
                                    <th>Contact</th>
                                    <th>Event Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {participants.length === 0 && (
                                    <tr>
                                        <td colSpan="6">
                                            <div className="empty-state" style={{ padding: '28px 16px' }}>
                                                <div className="empty-state-title">No participants recorded</div>
                                                <p className="empty-state-text">Import a Kobo form or wait for synced records to appear here.</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                                {participants.map((participant) => (
                                    <tr key={participant.id}>
                                        <td>{participant.volunteer_name}</td>
                                        <td>{participant.name}</td>
                                        <td>{participant.age}</td>
                                        <td>
                                            <span className={`badge ${participant.gender === 'Female' ? 'badge-accent' : 'badge-info'}`}>
                                                {participant.gender}
                                            </span>
                                        </td>
                                        <td>{participant.contact}</td>
                                        <td>{new Date(participant.event_date).toLocaleDateString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showImportModal && (
                <div className="modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="modal-box lg" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">Import Participants From Kobo</div>
                                <p className="panel-subtitle">Map linked form fields into the central register.</p>
                            </div>
                            <button className="modal-close" onClick={() => setShowImportModal(false)}>
                                <X size={18} />
                            </button>
                        </div>

                        <div className="modal-body">
                            {importStep === 1 ? (
                                <div className="content-stack">
                                    <div className="form-group">
                                        <label className="form-label">Select Linked Kobo Form</label>
                                        <select className="form-select" onChange={handleFormSelect} defaultValue="">
                                            <option value="" disabled>Choose a form</option>
                                            {linkedForms.map((form) => (
                                                <option key={form.id} value={form.kobo_form_uid}>
                                                    {form.kobo_form_name} ({form.indicator_title})
                                                </option>
                                            ))}
                                        </select>
                                        <p className="form-hint">Only linked forms with available synced data appear here.</p>
                                    </div>
                                </div>
                            ) : (
                                <form onSubmit={handleImportSubmit} className="content-stack">
                                    <div className="helper-note">
                                        <Database size={18} color="var(--brand-primary)" />
                                        <div>
                                            <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Field Mapping</strong>
                                            <p>Match each Kobo question to the correct participant database column before import.</p>
                                        </div>
                                    </div>
                                    <div className="form-row">
                                        {['name', 'age', 'gender', 'contact', 'event_date', 'volunteer_name'].map((field) => (
                                            <div className="form-group" key={field}>
                                                <label className="form-label">{field.replace('_', ' ')}</label>
                                                <select
                                                    className="form-select"
                                                    value={mapping[field]}
                                                    onChange={(event) => setMapping({ ...mapping, [field]: event.target.value })}
                                                    required={field === 'name'}
                                                >
                                                    <option value="">Select Kobo field</option>
                                                    {formFields.map((item) => (
                                                        <option key={item} value={item}>{item}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="modal-footer" style={{ paddingLeft: 0, paddingRight: 0, paddingBottom: 0, borderTop: 'none' }}>
                                        <button type="button" className="btn btn-secondary" onClick={() => setShowImportModal(false)}>
                                            Cancel
                                        </button>
                                        <button type="submit" className="btn btn-primary" disabled={importing}>
                                            {importing ? 'Importing...' : 'Start Import'}
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
