import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    AlertCircle,
    Calendar,
    ChevronRight,
    ClipboardList,
    FolderKanban,
    Layers,
    Plus,
    Target,
    UserRound,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';

const PROGRAM_STATUS_OPTIONS = ['active', 'paused', 'completed', 'archived'];
const PROJECT_STATUS_OPTIONS = ['planning', 'active', 'paused', 'completed', 'archived'];
const ACTIVITY_CATEGORY_OPTIONS = ['other', 'training', 'meeting', 'field_visit'];

const createBlankForm = (type, userId) => ({
    name: '',
    description: '',
    status: type === 'project' ? 'planning' : 'active',
    donor: '',
    start_date: '',
    end_date: '',
    owner_user_id: String(userId || ''),
    indicator_id: '',
    category: 'other',
    cost: '',
    assigned_user_id: '',
    evidence_url: '',
    activity_output: '',
});

export default function ProgramsPage() {
    const { user, hasRole } = useAuth();
    const [view, setView] = useState('programs');
    const [programs, setPrograms] = useState([]);
    const [projects, setProjects] = useState([]);
    const [activities, setActivities] = useState([]);
    const [users, setUsers] = useState([]);
    const [indicators, setIndicators] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedProgram, setSelectedProgram] = useState(null);
    const [selectedProject, setSelectedProject] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [formType, setFormType] = useState('program');
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState('');
    const [formData, setFormData] = useState(createBlankForm('program', user?.id));
    const currentEntityType = view === 'activities' ? 'activity' : view.slice(0, -1);

    const canCreate = hasRole('DIRECTOR', 'ADMIN_ASSISTANT', 'COMMUNITY_DEVELOPMENT_OFFICER');

    const fetchPrograms = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/programs`, { params: { userId: user.id } });
            setPrograms(res.data || []);
        } catch (error) {
            console.error('Failed to fetch programs', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchSupportData = async () => {
        try {
            const [userRes, indicatorRes] = await Promise.all([
                axios.get(`${API_BASE}/users`),
                axios.get(`${API_BASE}/indicators`, { params: { userId: user.id } }),
            ]);
            setUsers(userRes.data || []);
            setIndicators(indicatorRes.data || []);
        } catch (error) {
            console.error('Failed to fetch program support data', error);
        }
    };

    useEffect(() => {
        fetchPrograms();
        fetchSupportData();
    }, []);

    const handleProgramClick = async (program) => {
        setSelectedProgram(program);
        setSelectedProject(null);
        setView('projects');
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/projects`, { params: { userId: user.id } });
            setProjects((res.data || []).filter((project) => project.program_id === program.id));
        } catch (error) {
            console.error('Failed to fetch projects', error);
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
            setActivities((res.data || []).filter((activity) => activity.project_id === project.id));
        } catch (error) {
            console.error('Failed to fetch activities', error);
        } finally {
            setLoading(false);
        }
    };

    const resetView = () => {
        setView('programs');
        setSelectedProgram(null);
        setSelectedProject(null);
        fetchPrograms();
    };

    const resetToProjects = () => {
        setView('projects');
        setSelectedProject(null);
        if (selectedProgram) {
            handleProgramClick(selectedProgram);
        }
    };

    const openCreateForm = (type) => {
        if (type === 'project' && !selectedProgram) {
            alert('Open a program first so the new project can be created under it.');
            return;
        }
        if (type === 'activity' && !selectedProject) {
            alert('Open a project first so the activity can be linked correctly.');
            return;
        }

        setFormType(type);
        setFormError('');
        setFormData(createBlankForm(type, user.id));
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setFormError('');
        setFormData(createBlankForm(formType, user.id));
    };

    const projectIndicators = useMemo(
        () => indicators.filter((indicator) => indicator.project_id === selectedProject?.id),
        [indicators, selectedProject?.id]
    );

    const refreshCurrentView = async () => {
        if (view === 'programs') {
            await fetchPrograms();
            return;
        }
        if (view === 'projects' && selectedProgram) {
            await handleProgramClick(selectedProgram);
            return;
        }
        if (view === 'activities' && selectedProject) {
            await handleProjectClick(selectedProject);
        }
    };

    const validateForm = () => {
        if ((formType === 'program' || formType === 'project') && !formData.name.trim()) {
            return 'Name is required.';
        }

        if (formType === 'project') {
            if (!selectedProgram?.id) return 'Select a program before creating a project.';
            if (
                formData.start_date &&
                formData.end_date &&
                new Date(formData.end_date).getTime() < new Date(formData.start_date).getTime()
            ) {
                return 'End date cannot be earlier than the start date.';
            }
        }

        if (formType === 'activity') {
            if (!selectedProject?.id) return 'Select a project before logging an activity.';
            if (!formData.description.trim()) return 'Activity description is required.';
            if (!formData.indicator_id) return 'Select an indicator for this activity.';
            const numericCost = Number(formData.cost || 0);
            if (Number.isNaN(numericCost) || numericCost < 0) {
                return 'Cost must be zero or a positive number.';
            }
        }

        return '';
    };

    const submitForm = async (event) => {
        event.preventDefault();
        const validationError = validateForm();
        if (validationError) {
            setFormError(validationError);
            return;
        }

        setFormError('');
        setSubmitting(true);
        try {
            if (formType === 'program') {
                await axios.post(`${API_BASE}/programs`, {
                    userId: user.id,
                    name: formData.name,
                    description: formData.description,
                    status: formData.status,
                });
            }

            if (formType === 'project') {
                await axios.post(`${API_BASE}/projects`, {
                    userId: user.id,
                    program_id: selectedProgram?.id,
                    name: formData.name,
                    description: formData.description,
                    donor: formData.donor,
                    start_date: formData.start_date || null,
                    end_date: formData.end_date || null,
                    status: formData.status,
                    owner_user_id: formData.owner_user_id || user.id,
                });
            }

            if (formType === 'activity') {
                await axios.post(`${API_BASE}/activities`, {
                    userId: user.id,
                    project_id: selectedProject?.id,
                    indicator_id: formData.indicator_id,
                    description: formData.description,
                    category: formData.category,
                    cost: Number(formData.cost || 0),
                    assigned_user_id: formData.assigned_user_id || null,
                    evidence_url: formData.evidence_url || null,
                    activity_output: formData.activity_output || null,
                });
            }

            closeForm();
            await refreshCurrentView();
        } catch (error) {
            setFormError(error.response?.data?.error || `Failed to create ${formType}`);
        } finally {
            setSubmitting(false);
        }
    };

    const formHeading = {
        program: 'Create Program',
        project: 'Create Project',
        activity: 'Log Activity',
    }[formType];

    const formSummary = {
        program: 'Register a new strategic program area for the organization.',
        project: 'Add a project under the currently selected program.',
        activity: 'Capture an implementation activity under the currently selected project.',
    }[formType];

    const breadcrumbs = (
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
                    view === 'programs'
                        ? 'Organizational strategic clusters.'
                        : view === 'projects'
                            ? `Strategic initiatives under ${selectedProgram?.name}.`
                            : `Field activities for ${selectedProject?.name}.`
                }
                actions={
                    canCreate ? (
                        <button className="btn btn-primary" onClick={() => openCreateForm(currentEntityType)}>
                            <Plus size={16} /> New {currentEntityType.charAt(0).toUpperCase() + currentEntityType.slice(1)}
                        </button>
                    ) : null
                }
            />

            {breadcrumbs}

            {loading ? (
                <div className="page-loading"><div className="spinner"></div></div>
            ) : (
                <>
                    {view === 'programs' && (
                        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))' }}>
                            {programs.map((program) => (
                                <div key={program.id} className="kpi-card info" onClick={() => handleProgramClick(program)} style={{ cursor: 'pointer' }}>
                                    <div className="kpi-icon-wrap"><Layers size={22} /></div>
                                    <div className="kpi-label">{program.status}</div>
                                    <div className="kpi-value" style={{ fontSize: '20px', marginTop: '4px' }}>{program.name}</div>
                                    <p className="kpi-sub">{program.description || 'No description provided.'}</p>
                                </div>
                            ))}
                            {programs.length === 0 && (
                                <div className="panel" style={{ gridColumn: '1 / -1' }}>
                                    <div className="empty-state">
                                        <div className="empty-state-icon"><FolderKanban size={32} /></div>
                                        <div className="empty-state-title">No programs found</div>
                                        <p className="empty-state-text">Start by creating your first organizational program.</p>
                                        {canCreate && (
                                            <button className="btn btn-primary" onClick={() => openCreateForm('program')}>
                                                <Plus size={16} /> Create Program
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {view === 'projects' && (
                        projects.length > 0 ? (
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
                                        {projects.map((project) => (
                                            <tr key={project.id}>
                                                <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{project.name}</td>
                                                <td><span className="badge badge-primary">{project.donor || 'Core Fund'}</span></td>
                                                <td><span className={`badge badge-${project.status === 'active' ? 'success' : 'warning'}`}>{project.status}</span></td>
                                                <td>
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                                        <Calendar size={12} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                                                        {project.start_date ? new Date(project.start_date).toLocaleDateString() : 'N/A'} - {project.end_date ? new Date(project.end_date).toLocaleDateString() : 'N/A'}
                                                    </div>
                                                </td>
                                                <td>{project.owner_name || 'Unassigned'}</td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => handleProjectClick(project)}>View Activities</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="panel">
                                <div className="empty-state">
                                    <div className="empty-state-icon"><ClipboardList size={32} /></div>
                                    <div className="empty-state-title">No projects in this program</div>
                                    <p className="empty-state-text">Create the first project under {selectedProgram?.name} to begin tracking work.</p>
                                    {canCreate && (
                                        <button className="btn btn-primary" onClick={() => openCreateForm('project')}>
                                            <Plus size={16} /> Create Project
                                        </button>
                                    )}
                                </div>
                            </div>
                        )
                    )}

                    {view === 'activities' && (
                        <div className="panel">
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
                                        {activities.map((activity) => (
                                            <tr key={activity.id}>
                                                <td style={{ fontWeight: 500 }}>{activity.description}</td>
                                                <td><span className="badge badge-muted">{activity.category}</span></td>
                                                <td>
                                                    {activity.evidence_url ? (
                                                        <a href={activity.evidence_url} target="_blank" rel="noreferrer" className="badge badge-info">View Attachment</a>
                                                    ) : (
                                                        <span className="badge badge-muted">No Evidence</span>
                                                    )}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>${parseFloat(activity.cost || 0).toLocaleString()}</td>
                                                <td>{new Date(activity.activity_date).toLocaleDateString()}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                                {activities.length === 0 && (
                                    <div className="empty-state">
                                        <div className="empty-state-icon"><Target size={32} /></div>
                                        <div className="empty-state-title">No field activities logged</div>
                                        <p className="empty-state-text">Log implementation activities for this project.</p>
                                        {canCreate && (
                                            <button className="btn btn-primary" onClick={() => openCreateForm('activity')}>
                                                <Plus size={16} /> Log Activity
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </>
            )}

            {showForm && (
                <div className="modal-overlay" onClick={closeForm}>
                    <div className="modal-box" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <div>
                                <div className="modal-title">{formHeading}</div>
                                <div className="form-hint" style={{ marginTop: '4px' }}>{formSummary}</div>
                            </div>
                            <button className="modal-close" onClick={closeForm}>&times;</button>
                        </div>
                        <form onSubmit={submitForm}>
                            <div className="modal-body" style={{ display: 'grid', gap: '16px' }}>
                                {formType === 'project' && selectedProgram && (
                                    <div className="surface-muted">
                                        <div className="control-title">Program Context</div>
                                        <div className="control-copy">{selectedProgram.name}</div>
                                    </div>
                                )}

                                {formType === 'activity' && (
                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {selectedProject && (
                                            <div className="surface-muted">
                                                <div className="control-title">Project Context</div>
                                                <div className="control-copy">{selectedProject.name}</div>
                                            </div>
                                        )}
                                        {selectedProgram && (
                                            <div className="surface-muted">
                                                <div className="control-title">Program</div>
                                                <div className="control-copy">{selectedProgram.name}</div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {formError && (
                                    <div className="surface-muted" style={{ borderColor: 'rgba(180, 35, 24, 0.28)', background: 'rgba(180, 35, 24, 0.08)' }}>
                                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', color: 'var(--brand-danger)' }}>
                                            <AlertCircle size={16} style={{ marginTop: '2px', flexShrink: 0 }} />
                                            <div>
                                                <div className="control-title" style={{ color: 'var(--brand-danger)' }}>Cannot save yet</div>
                                                <div className="control-copy" style={{ color: 'var(--brand-danger)' }}>{formError}</div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {(formType === 'program' || formType === 'project') && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">{formType === 'program' ? 'Program Name' : 'Project Name'}</label>
                                            <input
                                                className="form-input"
                                                value={formData.name}
                                                placeholder={formType === 'program' ? 'e.g. Youth Resilience and Rights' : 'e.g. Harare South Community Outreach'}
                                                onChange={(event) => setFormData({ ...formData, name: event.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Description</label>
                                            <textarea
                                                className="form-input"
                                                style={{ minHeight: '120px' }}
                                                value={formData.description}
                                                placeholder={formType === 'program' ? 'Summarize the strategic purpose and outcomes for this program.' : 'Describe the scope, goals, and delivery model for this project.'}
                                                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Status</label>
                                            <select
                                                className="form-input"
                                                value={formData.status}
                                                onChange={(event) => setFormData({ ...formData, status: event.target.value })}
                                            >
                                                {(formType === 'program' ? PROGRAM_STATUS_OPTIONS : PROJECT_STATUS_OPTIONS).map((status) => (
                                                    <option key={status} value={status}>
                                                        {status.replace(/_/g, ' ')}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        {formType === 'project' && (
                                            <>
                                                <div className="form-group">
                                                    <label className="form-label">Donor</label>
                                                    <input
                                                        className="form-input"
                                                        value={formData.donor}
                                                        placeholder="e.g. UNICEF, UN Women, Core Fund"
                                                        onChange={(event) => setFormData({ ...formData, donor: event.target.value })}
                                                    />
                                                </div>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                                                    <div className="form-group">
                                                        <label className="form-label">Start Date</label>
                                                        <input type="date" className="form-input" value={formData.start_date} onChange={(event) => setFormData({ ...formData, start_date: event.target.value })} />
                                                    </div>
                                                    <div className="form-group">
                                                        <label className="form-label">End Date</label>
                                                        <input type="date" className="form-input" value={formData.end_date} onChange={(event) => setFormData({ ...formData, end_date: event.target.value })} />
                                                    </div>
                                                </div>
                                                <div className="form-group">
                                                    <label className="form-label">Project Owner</label>
                                                    <select className="form-input" value={formData.owner_user_id} onChange={(event) => setFormData({ ...formData, owner_user_id: event.target.value })}>
                                                        {users.map((person) => (
                                                            <option key={person.id} value={person.id}>{person.name}</option>
                                                        ))}
                                                    </select>
                                                    <p className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                                                        <UserRound size={12} /> This person becomes the operational owner of the project.
                                                    </p>
                                                </div>
                                            </>
                                        )}
                                    </>
                                )}

                                {formType === 'activity' && (
                                    <>
                                        <div className="form-group">
                                            <label className="form-label">Activity Description</label>
                                            <textarea
                                                className="form-input"
                                                style={{ minHeight: '120px' }}
                                                value={formData.description}
                                                placeholder="Describe the field implementation activity that took place."
                                                onChange={(event) => setFormData({ ...formData, description: event.target.value })}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Indicator</label>
                                            <select
                                                className="form-input"
                                                value={formData.indicator_id}
                                                onChange={(event) => setFormData({ ...formData, indicator_id: event.target.value })}
                                                required
                                            >
                                                <option value="">Select indicator</option>
                                                {projectIndicators.map((indicator) => (
                                                    <option key={indicator.id} value={indicator.id}>{indicator.title}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '16px' }}>
                                            <div className="form-group">
                                                <label className="form-label">Category</label>
                                                <select className="form-input" value={formData.category} onChange={(event) => setFormData({ ...formData, category: event.target.value })}>
                                                    {ACTIVITY_CATEGORY_OPTIONS.map((category) => (
                                                        <option key={category} value={category}>
                                                            {category.replace(/_/g, ' ')}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div className="form-group">
                                                <label className="form-label">Cost</label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="form-input"
                                                    value={formData.cost}
                                                    onChange={(event) => setFormData({ ...formData, cost: event.target.value })}
                                                />
                                            </div>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Assigned User</label>
                                            <select className="form-input" value={formData.assigned_user_id} onChange={(event) => setFormData({ ...formData, assigned_user_id: event.target.value })}>
                                                <option value="">Unassigned</option>
                                                {users.map((person) => (
                                                    <option key={person.id} value={person.id}>{person.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Expected Output</label>
                                            <textarea
                                                className="form-input"
                                                style={{ minHeight: '90px' }}
                                                value={formData.activity_output}
                                                placeholder="Capture the expected or delivered output from this activity."
                                                onChange={(event) => setFormData({ ...formData, activity_output: event.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="form-label">Evidence URL</label>
                                            <input
                                                className="form-input"
                                                value={formData.evidence_url}
                                                placeholder="https://..."
                                                onChange={(event) => setFormData({ ...formData, evidence_url: event.target.value })}
                                            />
                                            <p className="form-hint" style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px' }}>
                                                <Calendar size={12} /> Link supporting evidence, meeting notes, or media if available.
                                            </p>
                                        </div>
                                    </>
                                )}
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeForm}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Saving...' : formType === 'activity' ? 'Save Activity' : 'Save'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
