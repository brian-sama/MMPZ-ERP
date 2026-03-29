
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE from '../apiConfig';
import {
    Upload,
    FileText,
    BarChart,
    Link,
    CheckCircle,
    AlertCircle,
    Download,
    Clock,
    File
} from 'lucide-react';

const VolunteerPortal = ({ user }) => {
    const [activeTab, setActiveTab] = useState('uploads');
    const [msg, setMsg] = useState({ type: '', text: '' });

    // Data Lists
    const [submissions, setSubmissions] = useState([]);
    const [indicators, setIndicators] = useState([]);
    const [koboForms, setKoboForms] = useState([]);
    const [myKoboRequests, setMyKoboRequests] = useState([]);

    // Forms State
    const [uploadType, setUploadType] = useState('plan');
    const [file, setFile] = useState(null);
    const [description, setDescription] = useState('');
    const [isUploading, setIsUploading] = useState(false);

    // Activity Report State
    const [reportForm, setReportForm] = useState({ indicatorId: '', male: 0, female: 0, notes: '' });

    // Kobo Request State
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
                params: { role: user.role, userId: user.id }
            });
            setSubmissions(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchIndicators = async () => {
        try {
            const res = await axios.get(`${API_BASE}/indicators`, {
                params: { userId: user.id, role: user.role }
            });
            // Only active indicators
            setIndicators(res.data.filter(i => i.status === 'active'));
        } catch (err) { console.error(err); }
    };

    const fetchKoboForms = async () => {
        try {
            const res = await axios.get(`${API_BASE}/kobo/forms`, {
                params: { userId: user.id }
            });
            setKoboForms(res.data);
        } catch (err) { console.error(err); }
    };

    const fetchMyKoboRequests = async () => {
        try {
            const res = await axios.get(`${API_BASE}/volunteer/kobo-requests`, {
                params: { userId: user.id }
            });
            setMyKoboRequests(res.data);
        } catch (err) { console.error(err); }
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            if (selectedFile.size > 4 * 1024 * 1024) {
                setMsg({ type: 'error', text: 'File size must be less than 4MB' });
                setFile(null);
                return;
            }
            setFile(selectedFile);
        }
    };

    const convertToBase64 = (file) => new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });

    const handleUploadSubmit = async (e) => {
        e.preventDefault();
        if (!file) { setMsg({ type: 'error', text: 'Please select a file' }); return; }
        setIsUploading(true);
        try {
            const base64File = await convertToBase64(file);
            await axios.post(`${API_BASE}/volunteer/submit`, {
                userId: user.id,
                type: uploadType,
                fileData: base64File,
                fileName: file.name,
                mimeType: file.type,
                description: description
            });
            setMsg({ type: 'success', text: 'Upload successful!' });
            setFile(null); setDescription(''); fetchSubmissions();
        } catch (err) {
            setMsg({ type: 'error', text: 'Upload failed' });
        } finally { setIsUploading(false); }
    };

    const handleReportSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE}/volunteer/activity-report`, {
                userId: user.id, ...reportForm
            });
            setMsg({ type: 'success', text: 'Activity report submitted!' });
            setReportForm({ indicatorId: '', male: 0, female: 0, notes: '' });
        } catch (err) {
            setMsg({ type: 'error', text: 'Failed to submit report' });
        }
    };

    const handleKoboRequest = async (e) => {
        e.preventDefault();
        // Find form name
        const form = koboForms.find(f => f.uid === koboRequest.formUid);
        if (!form) return;

        try {
            await axios.post(`${API_BASE}/volunteer/kobo-request`, {
                userId: user.id,
                formUid: koboRequest.formUid,
                formName: form.name,
                indicatorId: koboRequest.indicatorId
            });
            setMsg({ type: 'success', text: 'Connection requested! Waiting for approval.' });
            setKoboRequest({ formUid: '', formName: '', indicatorId: '' });
            fetchMyKoboRequests();
        } catch (err) {
            setMsg({ type: 'error', text: 'Request failed. Maybe already exists?' });
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
        <div className="space-y-8 animate-slideIn">
            <header className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Volunteer Portal</h1>
                    <p className="text-slate-500 mt-1">Welcome back, {user.name}.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setActiveTab('uploads')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'uploads' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-slate-500 border border-slate-200'}`}
                    >
                        <div className="flex items-center gap-2"><FileText size={16} /> Documents</div>
                    </button>
                    <button
                        onClick={() => setActiveTab('reporting')}
                        className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${activeTab === 'reporting' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-white text-slate-500 border border-slate-200'}`}
                    >
                        <div className="flex items-center gap-2"><BarChart size={16} /> Activity & Kobo</div>
                    </button>
                </div>
            </header>

            {msg.text && (
                <div className={`p-4 rounded-xl flex items-center gap-3 ${msg.type === 'error' ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {msg.type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
                    <span className="font-medium">{msg.text}</span>
                </div>
            )}

            {activeTab === 'uploads' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Document Upload Form */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 h-fit">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-2xl text-blue-600"><Upload size={24} /></div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Upload Document</h3>
                                <p className="text-sm text-slate-500">Reports, Plans, etc.</p>
                            </div>
                        </div>
                        <form onSubmit={handleUploadSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Type</label>
                                <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl" value={uploadType} onChange={(e) => setUploadType(e.target.value)}>
                                    <option value="plan">Activity Plan</option>
                                    <option value="report">Activity Report</option>
                                    <option value="concept_note">Concept Note</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                                <input type="text" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl" value={description} onChange={e => setDescription(e.target.value)} />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">File</label>
                                <input type="file" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl" accept=".pdf,.doc,.docx" onChange={handleFileChange} />
                            </div>
                            <button type="submit" disabled={isUploading} className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl shadow-lg transition-all">
                                {isUploading ? 'Uploading...' : 'Submit'}
                            </button>
                        </form>
                    </div>
                    {/* List */}
                    <div className="lg:col-span-2 space-y-4">
                        <h3 className="text-xl font-bold dark:text-white">My Uploads</h3>
                        {submissions.map(sub => (
                            <div key={sub.id} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex justify-between items-center">
                                <div className="flex gap-4 items-center">
                                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><File size={20} /></div>
                                    <div>
                                        <div className="font-bold">{sub.type}</div>
                                        <div className="text-sm text-slate-500">{sub.file_name} | {new Date(sub.created_at).toLocaleDateString()}</div>
                                    </div>
                                </div>
                                <button onClick={() => handleDownload(sub.id)} className="text-slate-400 hover:text-blue-600"><Download size={20} /></button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {activeTab === 'reporting' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Activity Report Numbers */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-2xl text-emerald-600"><BarChart size={24} /></div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Activity Numbers</h3>
                                <p className="text-sm text-slate-500">Report beneficiaries by gender</p>
                            </div>
                        </div>
                        <form onSubmit={handleReportSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Project Indicator</label>
                                <select required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl" value={reportForm.indicatorId} onChange={e => setReportForm({ ...reportForm, indicatorId: e.target.value })}>
                                    <option value="">-- Select Indicator --</option>
                                    {indicators.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                                </select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Male Count</label>
                                    <input type="number" min="0" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl" value={reportForm.male} onChange={e => setReportForm({ ...reportForm, male: e.target.value })} />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-1">Female Count</label>
                                    <input type="number" min="0" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl" value={reportForm.female} onChange={e => setReportForm({ ...reportForm, female: e.target.value })} />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Notes</label>
                                <textarea className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl" rows="3" value={reportForm.notes} onChange={e => setReportForm({ ...reportForm, notes: e.target.value })}></textarea>
                            </div>
                            <button type="submit" className="w-full py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg transition-all">Submit Report</button>
                        </form>
                    </div>

                    {/* Kobo Link Request */}
                    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-2xl text-orange-600"><Link size={24} /></div>
                            <div>
                                <h3 className="text-lg font-bold text-slate-900 dark:text-white">Request Kobo Sync</h3>
                                <p className="text-sm text-slate-500">Link a Kobo Form to an Indicator</p>
                            </div>
                        </div>
                        <form onSubmit={handleKoboRequest} className="space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Kobo Form</label>
                                <select required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl" value={koboRequest.formUid} onChange={e => setKoboRequest({ ...koboRequest, formUid: e.target.value })}>
                                    <option value="">-- Select Form --</option>
                                    {koboForms.map(f => <option key={f.uid} value={f.uid}>{f.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-slate-700 mb-1">Target Indicator</label>
                                <select required className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl" value={koboRequest.indicatorId} onChange={e => setKoboRequest({ ...koboRequest, indicatorId: e.target.value })}>
                                    <option value="">-- Select Indicator --</option>
                                    {indicators.map(i => <option key={i.id} value={i.id}>{i.title}</option>)}
                                </select>
                            </div>
                            <button type="submit" className="w-full py-3 bg-orange-600 text-white font-bold rounded-xl shadow-lg transition-all">Request Connection</button>
                        </form>

                        {/* Recent Requests List */}
                        <div className="mt-8">
                            <h4 className="font-bold text-slate-900 dark:text-white mb-4 text-sm uppercase tracking-wide">My Requests</h4>
                            <div className="space-y-3">
                                {myKoboRequests.length === 0 && <p className="text-sm text-slate-400">No pending requests.</p>}
                                {myKoboRequests.map(req => (
                                    <div key={req.id} className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 text-sm">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-slate-800 dark:text-zinc-200 truncate pr-2">{req.kobo_form_name}</span>
                                            <span className={`px-2 py-0.5 rounded text-xs font-bold capitalize ${req.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                                req.status === 'rejected' ? 'bg-rose-100 text-rose-700' :
                                                    'bg-amber-100 text-amber-700'
                                                }`}>{req.status}</span>
                                        </div>
                                        <div className="text-slate-500">Linked to: {req.indicator_title}</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default VolunteerPortal;
