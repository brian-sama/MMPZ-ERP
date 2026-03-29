
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE from '../apiConfig';
import StatCard from './StatCard';
import {
    Users,
    FileText,
    Download,
    Search,
    Calendar,
    Briefcase
} from 'lucide-react';

const VolunteerAdmin = ({ user }) => {
    const [activeTab, setActiveTab] = useState('submissions');
    const [submissions, setSubmissions] = useState([]);
    const [participants, setParticipants] = useState([]);

    useEffect(() => {
        if (activeTab === 'submissions') fetchSubmissions();
        if (activeTab === 'participants') fetchParticipants();
        // Fetch both initially for stats? Optimally yes, but lazy load is fine for now.
        // Let's fetch both on mount to populate stats
        fetchAll();
    }, []);

    const fetchAll = () => {
        fetchSubmissions();
        fetchParticipants();
    }

    const fetchSubmissions = async () => {
        try {
            const res = await axios.get(`${API_BASE}/volunteer/submissions`, {
                params: { role: user.role, userId: user.id }
            });
            setSubmissions(res.data);
        } catch (err) {
            console.error('Error fetching submissions', err);
        }
    };

    const fetchParticipants = async () => {
        try {
            const res = await axios.get(`${API_BASE}/volunteer/participants`, {
                params: { role: user.role, userId: user.id }
            });
            setParticipants(res.data);
        } catch (err) {
            console.error('Error fetching participants', err);
        }
    };


    // Import State
    const [showImportModal, setShowImportModal] = useState(false);
    const [importStep, setImportStep] = useState(1);
    const [linkedForms, setLinkedForms] = useState([]);
    const [selectedForm, setSelectedForm] = useState(null);
    const [formFields, setFormFields] = useState([]);
    const [mapping, setMapping] = useState({
        name: '', age: '', gender: '', contact: '', event_date: '', volunteer_name: ''
    });
    const [importing, setImporting] = useState(false);

    const openImportModal = async () => {
        setShowImportModal(true);
        setImportStep(1);
        try {
            const res = await axios.get(`${API_BASE}/kobo/links`, {
                params: { userId: user.id }
            });
            setLinkedForms(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error(err);
        }
    };

    const handleFormSelect = async (e) => {
        const uid = e.target.value;
        const form = linkedForms.find(f => f.kobo_form_uid === uid);
        setSelectedForm(form);
        // Fetch fields
        try {
            const res = await axios.get(`${API_BASE}/kobo/fields/${uid}`, {
                params: { userId: user.id }
            });
            setFormFields(res.data);
            setImportStep(2);
        } catch (err) {
            alert('Could not fetch fields (ensure form has at least one sync).');
        }
    };

    const handleImportSubmit = async (e) => {
        e.preventDefault();
        setImporting(true);
        try {
            const res = await axios.post(`${API_BASE}/kobo/import-participants`, {
                kobo_form_uid: selectedForm.kobo_form_uid,
                mapping,
                userId: user.id
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

    // Calculate unique volunteers (mock logic as API doesn't return count directly yet, but we can infer from unique names in submissions/participants)
    const uniqueVolunteers = new Set([...submissions.map(s => s.volunteer_name), ...participants.map(p => p.volunteer_name)]).size;

    return (
        <div className="space-y-8 animate-slideIn">
            <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Volunteer Management</h1>
                    <p className="text-slate-500 mt-1">Oversee volunteer activities and data collection.</p>
                </div>
                <div className="flex bg-white dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
                    <button
                        onClick={() => setActiveTab('submissions')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'submissions'
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        Submissions
                    </button>
                    <button
                        onClick={() => setActiveTab('participants')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'participants'
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                            }`}
                    >
                        Participants DB
                    </button>
                </div>
            </header>

            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatCard
                    label="Active Volunteers"
                    value={uniqueVolunteers || 0}
                    subtext="contributing data"
                    trend="stable"
                    color="bg-purple-600"
                    icon={<Users size={24} />}
                    iconColor="text-purple-600"
                />
                <StatCard
                    label="Total Submissions"
                    value={submissions.length}
                    subtext="reports & plans"
                    trend="up"
                    color="bg-blue-600"
                    icon={<FileText size={24} />}
                    iconColor="text-blue-600"
                />
                <StatCard
                    label="Beneficiaries Reached"
                    value={participants.length}
                    subtext="total recorded"
                    trend="up"
                    color="bg-emerald-600"
                    icon={<Briefcase size={24} />}
                    iconColor="text-emerald-600"
                />
            </div>

            {/* Content Area */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                {activeTab === 'submissions' && (
                    <>
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Recent Submissions</h3>
                            {/* ... Search ... */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <input type="text" placeholder="Search..." className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                        <th className="px-6 py-4">Volunteer</th>
                                        <th className="px-6 py-4">Document Type</th>
                                        <th className="px-6 py-4">File Name</th>
                                        <th className="px-6 py-4">Submitted On</th>
                                        <th className="px-6 py-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {submissions.length === 0 && (
                                        <tr><td colSpan="5" className="px-6 py-8 text-center text-slate-500">No data available.</td></tr>
                                    )}
                                    {submissions.map(sub => (
                                        <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 font-semibold text-slate-900 dark:text-white">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                                        {sub.volunteer_name.charAt(0)}
                                                    </div>
                                                    {sub.volunteer_name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="capitalize px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-100 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800">
                                                    {sub.type.replace('_', ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{sub.file_name}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar size={14} />
                                                    {new Date(sub.created_at).toLocaleDateString()}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                {sub.has_file && (
                                                    <button onClick={() => handleDownload(sub.id)} className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-semibold text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm">
                                                        <Download size={14} /> Download
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}

                {activeTab === 'participants' && (
                    <>
                        <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-slate-900 dark:text-white">Central Participants Database</h3>
                            <div className="flex gap-2">
                                <button
                                    onClick={openImportModal}
                                    className="px-3 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-sm font-bold flex items-center gap-2 hover:opacity-90 transition-opacity"
                                >
                                    <Download size={16} /> Import from Kobo
                                </button>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="text"
                                        placeholder="Search names..."
                                        className="pl-10 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                                    />
                                </div>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 dark:bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500 font-bold">
                                        <th className="px-6 py-4">Logged By</th>
                                        <th className="px-6 py-4">Participant Name</th>
                                        <th className="px-6 py-4">Age</th>
                                        <th className="px-6 py-4">Gender</th>
                                        <th className="px-6 py-4">Contact</th>
                                        <th className="px-6 py-4">Event Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                    {participants.length === 0 && (
                                        <tr><td colSpan="6" className="px-6 py-8 text-center text-slate-500">No participants recorded.</td></tr>
                                    )}
                                    {participants.map(p => (
                                        <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 text-sm font-medium text-slate-900 dark:text-white">{p.volunteer_name}</td>
                                            <td className="px-6 py-4 font-semibold text-slate-700 dark:text-slate-300">{p.name}</td>
                                            <td className="px-6 py-4">{p.age}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-lg text-xs font-bold ${p.gender === 'Female'
                                                    ? 'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                                                    : 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                                    }`}>
                                                    {p.gender}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{p.contact}</td>
                                            <td className="px-6 py-4 text-sm text-slate-500">{new Date(p.event_date).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* Import Modal */}
            {showImportModal && (
                <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl p-6 w-full max-w-lg border border-slate-200 dark:border-slate-700 animate-slideIn">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold dark:text-white">Import from Kobo</h3>
                            <button onClick={() => setShowImportModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><Search size={20} className="rotate-45" /></button>
                        </div>

                        {importStep === 1 ? (
                            <div className="space-y-4">
                                <label className="block font-semibold text-sm mb-2 dark:text-slate-300">Select Kobo Form (from Linked)</label>
                                <select onChange={handleFormSelect} className="w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                                    <option value="">-- Choose a Form --</option>
                                    {linkedForms.map(f => (
                                        <option key={f.id} value={f.kobo_form_uid}>{f.kobo_form_name} (Ind: {f.indicator_title})</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500">Only forms that have been linked and synced will appear here.</p>
                            </div>
                        ) : (
                            <form onSubmit={handleImportSubmit} className="space-y-4">
                                <p className="text-sm text-slate-500 mb-4 bg-blue-50 p-2 rounded-lg text-blue-700">
                                    Map the Kobo form questions to the database columns.
                                </p>
                                <div className="grid grid-cols-2 gap-4">
                                    {['name', 'age', 'gender', 'contact', 'event_date', 'volunteer_name'].map(field => (
                                        <div key={field}>
                                            <label className="block text-xs font-bold uppercase text-slate-500 mb-1">{field.replace('_', ' ')}</label>
                                            <select
                                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 text-sm"
                                                value={mapping[field]}
                                                onChange={e => setMapping({ ...mapping, [field]: e.target.value })}
                                                required={field === 'name'} // Name is mandatory
                                            >
                                                <option value="">-- Select Field --</option>
                                                {formFields.map(k => <option key={k} value={k}>{k}</option>)}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                                <button disabled={importing} type="submit" className="w-full py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors">
                                    {importing ? 'Importing...' : 'Start Import'}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default VolunteerAdmin;
