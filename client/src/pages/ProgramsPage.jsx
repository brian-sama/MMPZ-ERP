import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import {
    FolderKanban, Plus, Layers, ChevronRight,
    Search, Filter, MoreVertical, Layout, Target,
    Calendar, User as UserIcon, Tag
} from 'lucide-react';

export default function ProgramsPage() {
    const { user, hasRole } = useAuth();
    const [view, setView] = useState('programs'); // 'programs', 'projects', 'activities'
    const [programs, setPrograms] = useState([]);
    const [projects, setProjects] = useState([]);
    const [activities, setActivities] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);

    // Forms
    const [showForm, setShowForm] = useState(false);
    const [formType, setFormType] = useState('program');

    useEffect(() => {
        fetchPrograms();
    }, []);

    const fetchPrograms = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/programs`, { params: { userId: user.id } });
            setPrograms(res.data);
        } catch (err) {
            console.error('Failed to fetch programs');
        } finally {
            setLoading(false);
        }
    };

    const handleProgramClick = async (program) => {
        setSelectedProgram(program);
        setView('projects');
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/projects`, { params: { userId: user.id } });
            // Filter for this program on client for now or update API to accept program_id
            setProjects(res.data.filter(p => p.program_id === program.id));
        } catch (err) {
            console.error('Failed to fetch projects');
        } finally {
            setLoading(false);
        }
    };

    const handleProjectClick = async (project) => {
        setSelectedProject(project);
        setView('activities');
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/activities`, { params: { userId: user.id } });
            setActivities(res.data.filter(a => a.project_id === project.id));
        } catch (err) {
            console.error('Failed to fetch activities');
        } finally {
            setLoading(false);
        }
    };

    const resetView = () => {
        setView('programs');
        setSelectedProgram(null);
        setSelectedProject(null);
    };

    const resetToProjects = () => {
        setView('projects');
        setSelectedProject(null);
    };

    const Breadcrumbs = () => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>
            <span style={{ cursor: 'pointer' }} onClick={resetView}>All Programs</span>
            {selectedProgram && (
                <>
                    <ChevronRight size={14} />
                    <span style={{ cursor: 'pointer' }} onClick={resetToProjects}>{selectedProgram.name}</span>
                </>
            )}
            {selectedProject && (
                <>
                    <ChevronRight size={14} />
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selectedProject.name}</span>
                </>
            )}
        </div>
    );

    return (
        <div className="fade-in">
            <PageHeader
                title={view === 'programs' ? 'Programs' : view === 'projects' ? 'Projects' : 'Activities'}
                subtitle={
                    view === 'programs' ? 'Organizational strategic clusters.' :
                        view === 'projects' ? `Strategic initiatives under ${selectedProgram?.name}.` :
                            `Field activities for ${selectedProject?.name}.`
                }
                actions={
                    hasRole('DIRECTOR', 'ADMIN_ASSISTANT', 'COMMUNITY_DEVELOPMENT_OFFICER') && (
                        <button className="btn btn-primary" onClick={() => { setShowForm(true); setFormType(view.slice(0, -1)); }}>
                            <Plus size={16} /> New {view.slice(0, -1).charAt(0).toUpperCase() + view.slice(0, -1).slice(1)}
                        </button>
                    )
                }
            />

            <Breadcrumbs />

            {loading ? (
                <div className="page-loading"><div className="spinner"></div></div>
            ) : (
                <>
                    {view === 'programs' && (
                        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                            {programs.map(prog => (
                                <div key={prog.id} className="kpi-card info" onClick={() => handleProgramClick(prog)} style={{ cursor: 'pointer' }}>
                                    <div className="kpi-icon-wrap"><Layers size={22} /></div>
                                    <div className="kpi-label">{prog.status}</div>
                                    <div className="kpi-value" style={{ fontSize: '18px', marginTop: '4px' }}>{prog.name}</div>
                                    <p className="kpi-sub" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                        {prog.description || 'No description provided.'}
                                    </p>
                                </div>
                            ))}
                            {programs.length === 0 && (
                                <div className="panel" style={{ gridColumn: '1 / -1' }}>
                                    <div className="empty-state">
                                        <div className="empty-state-icon"><FolderKanban size={32} /></div>
                                        <div className="empty-state-title">No programs found</div>
                                        <p className="empty-state-text">Start by creating your first organizational program.</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'projects' && (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Project Name</th>
                                        <th>Donor</th>
                                        <th>Status</th>
                                        <th>Timeline</th>
                                        <th>Owner</th>
                                        <th style={{ textAlign: 'right' }}>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {projects.map(proj => (
                                        <tr key={proj.id}>
                                            <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{proj.name}</td>
                                            <td><span className="badge badge-primary">{proj.donor || 'Core Fund'}</span></td>
                                            <td><span className={`badge badge-${proj.status === 'active' ? 'success' : 'warning'}`}>{proj.status}</span></td>
                                            <td>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                    <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                                    {proj.start_date ? new Date(proj.start_date).toLocaleDateString() : 'N/A'} - {proj.end_date ? new Date(proj.end_date).toLocaleDateString() : 'N/A'}
                                                </div>
                                            </td>
                                            <td>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <div className="sidebar-user-avatar" style={{ width: '24px', height: '24px', fontSize: '10px' }}>{(proj.owner_name || 'U')[0]}</div>
                                                    <span style={{ fontSize: '13px' }}>{proj.owner_name || 'Admin'}</span>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button className="btn btn-secondary btn-sm" onClick={() => handleProjectClick(proj)}>View Activities</button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            {projects.length === 0 && (
                                <div className="empty-state">
                                    <div className="empty-state-icon"><Layout size={32} /></div>
                                    <div className="empty-state-title">No projects in this program</div>
                                    <p className="empty-state-text">Strategic initiatives can be added to this cluster.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'activities' && (
                        <div className="panels-row">
                            <div className="panel" style={{ gridColumn: '1 / -1' }}>
                                <div className="data-table-wrap">
                                    <table className="data-table">
                                        <thead>
                                            <tr>
                                                <th>Activity Description</th>
                                                <th>Category</th>
                                                <th>Evidence</th>
                                                <th>Cost</th>
                                                <th>Date</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {activities.map(act => (
                                                <tr key={act.id}>
                                                    <td style={{ fontWeight: 500 }}>{act.description}</td>
                                                    <td><span className="badge badge-muted">{act.category}</span></td>
                                                    <td>
                                                        {act.evidence_url ? (
                                                            <a href={act.evidence_url} target="_blank" rel="noreferrer" className="badge badge-info">View Attachment</a>
                                                        ) : (
                                                            <span className="badge badge-muted">No Evidence</span>
                                                        )}
                                                    </td>
                                                    <td style={{ fontWeight: 600 }}>${parseFloat(act.cost).toLocaleString()}</td>
                                                    <td>{new Date(act.activity_date).toLocaleDateString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {activities.length === 0 && (
                                        <div className="empty-state">
                                            <div className="empty-state-icon"><Target size={32} /></div>
                                            <div className="empty-state-title">No field activities logged</div>
                                            <p className="empty-state-text">Log implementation activities for this project.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Form Modal Placeholder */}
            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">New {formType}</div>
                            <button className="modal-close" onClick={() => setShowForm(false)}>×</button>
                        </div>
                        <div className="modal-body">
                            <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                                Form implementation for {formType} creation... Use the Legacy Forms if urgent or wait for the next iteration.
                            </p>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={() => setShowForm(false)}>Submit</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
