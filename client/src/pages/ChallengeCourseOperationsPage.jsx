import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
    Activity,
    AlertTriangle,
    ClipboardCheck,
    HeartPulse,
    Plus,
    RefreshCw,
    ShieldCheck,
    Target,
    Users,
} from 'lucide-react';
import API_BASE from '../apiConfig';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import {
    EmptyState,
    MetricCard,
    badgeTone,
    formatDate,
    formatNumber,
    formatStatus,
    getErrorMessage,
} from './operationsUtils.jsx';

const initialSession = {
    title: '',
    session_date: '',
    location: '',
    participant_group: '',
    participant_count: '',
    risk_assessment_status: 'pending',
    waiver_status: 'pending',
    status: 'planned',
};

const initialIncident = {
    session_id: '',
    severity: 'low',
    participant_name: '',
    description: '',
    action_taken: '',
};

const canManageChallenge = (user) =>
    user?.system_role === 'SUPER_ADMIN' ||
    ['DIRECTOR', 'PROGRAMS_ME_OFFICER', 'SYSTEM_ADMIN'].includes(user?.role_code);

export default function ChallengeCourseOperationsPage() {
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [data, setData] = useState({
        metrics: {},
        sessions: [],
        activities: [],
        equipment: [],
        incidents: [],
        outcomes: [],
    });
    const [modal, setModal] = useState('');
    const [sessionForm, setSessionForm] = useState(initialSession);
    const [incidentForm, setIncidentForm] = useState(initialIncident);
    const [submitting, setSubmitting] = useState(false);

    const manager = canManageChallenge(user);

    const fetchChallenge = async ({ silent = false } = {}) => {
        if (silent) setRefreshing(true);
        else setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_BASE}/operations/challenge-course`);
            setData({
                metrics: res.data?.metrics || {},
                sessions: Array.isArray(res.data?.sessions) ? res.data.sessions : [],
                activities: Array.isArray(res.data?.activities) ? res.data.activities : [],
                equipment: Array.isArray(res.data?.equipment) ? res.data.equipment : [],
                incidents: Array.isArray(res.data?.incidents) ? res.data.incidents : [],
                outcomes: Array.isArray(res.data?.outcomes) ? res.data.outcomes : [],
            });
        } catch (err) {
            setError(getErrorMessage(err, 'Challenge Course operations are unavailable.'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchChallenge();
    }, []);

    const submitSession = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await axios.post(`${API_BASE}/operations/challenge-course-sessions`, sessionForm);
            setSessionForm(initialSession);
            setModal('');
            setMessage('Challenge Course session created.');
            await fetchChallenge({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not create session.'));
        } finally {
            setSubmitting(false);
        }
    };

    const submitIncident = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setError('');
        try {
            await axios.post(`${API_BASE}/operations/challenge-course-incidents`, incidentForm);
            setIncidentForm(initialIncident);
            setModal('');
            setMessage('Safety incident recorded.');
            await fetchChallenge({ silent: true });
        } catch (err) {
            setError(getErrorMessage(err, 'Could not record incident.'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return <div className="page-loading"><div className="spinner" /></div>;
    }

    return (
        <div className="fade-in governance-workspace">
            <PageHeader
                title="Challenge Course Operations"
                subtitle="Sessions, facilitators, activities, equipment, safety, incidents, debriefs, and outcomes."
                actions={
                    <div className="governance-toolbar">
                        <button className="btn btn-secondary btn-sm" onClick={() => fetchChallenge({ silent: true })} disabled={refreshing}>
                            <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
                            Refresh
                        </button>
                        {manager && (
                            <>
                                <button className="btn btn-secondary btn-sm" onClick={() => setModal('incident')}>
                                    <AlertTriangle size={14} />
                                    Incident
                                </button>
                                <button className="btn btn-primary btn-sm" onClick={() => setModal('session')}>
                                    <Plus size={14} />
                                    Session
                                </button>
                            </>
                        )}
                    </div>
                }
            />

            {error && <div className="page-message error">{error}</div>}
            {message && <div className="page-message success">{message}</div>}

            <section className="domain-hero">
                <div>
                    <div className="domain-kicker">Core Methodology Operations</div>
                    <h2>Challenge Course is now a governed operational ecosystem.</h2>
                    <p>
                        Sessions connect facilitators, participant groups, equipment readiness, safety controls, incident tracking, debriefs, and outcome scores.
                    </p>
                </div>
                <div className="hero-control-card">
                    <div className="hero-control-label">Pending Safety</div>
                    <div className="hero-control-value">{formatNumber(data.metrics.pending_safety_count)}</div>
                    <p>{formatNumber(data.metrics.serious_incident_count)} serious incident record{Number(data.metrics.serious_incident_count || 0) === 1 ? '' : 's'} in the safety log.</p>
                </div>
            </section>

            <div className="metric-grid">
                <MetricCard icon={Activity} label="Sessions" value={formatNumber(data.metrics.total_sessions)} note="Planned and completed sessions" />
                <MetricCard icon={ClipboardCheck} tone="success" label="Upcoming" value={formatNumber(data.metrics.upcoming_sessions)} note="Planned or approved sessions" />
                <MetricCard icon={ShieldCheck} tone="warning" label="Safety Pending" value={formatNumber(data.metrics.pending_safety_count)} note="Risk assessment not approved" />
                <MetricCard icon={HeartPulse} tone="info" label="Equipment Attention" value={formatNumber(data.metrics.equipment_attention_count)} note="Unavailable course equipment" />
            </div>

            <section className="panel">
                <div className="panel-header">
                    <div>
                        <h2 className="panel-title">Session Plan</h2>
                        <p className="panel-subtitle">Each session carries date, location, participant group, safety, waiver, and status controls.</p>
                    </div>
                </div>
                {data.sessions.length === 0 ? (
                    <EmptyState icon={Activity} title="No Challenge Course sessions" />
                ) : (
                    <div className="data-table-wrap">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Session</th>
                                    <th>Date</th>
                                    <th>Participants</th>
                                    <th>Safety</th>
                                    <th>Waivers</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.sessions.map((session) => (
                                    <tr key={session.id}>
                                        <td>
                                            <div style={{ fontWeight: 700 }}>{session.title}</div>
                                            <div className="form-hint">{session.session_code} / {session.location || 'No location'}</div>
                                        </td>
                                        <td>{formatDate(session.session_date)}</td>
                                        <td>
                                            <div>{session.participant_group || 'Not set'}</div>
                                            <div className="form-hint">{formatNumber(session.participant_count)} participants</div>
                                        </td>
                                        <td><span className={`badge badge-${badgeTone(session.risk_assessment_status)}`}>{formatStatus(session.risk_assessment_status)}</span></td>
                                        <td><span className={`badge badge-${badgeTone(session.waiver_status)}`}>{formatStatus(session.waiver_status)}</span></td>
                                        <td><span className={`badge badge-${badgeTone(session.status)}`}>{formatStatus(session.status)}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Activity Library</h2>
                            <p className="panel-subtitle">Activity objectives, equipment, safety guides, and debrief prompts.</p>
                        </div>
                    </div>
                    {data.activities.length === 0 ? (
                        <EmptyState icon={Target} title="No activity library records" />
                    ) : (
                        <div className="control-stack compact">
                            {data.activities.slice(0, 8).map((activity) => (
                                <div className="control-row static" key={activity.id}>
                                    <div>
                                        <div className="control-title">{activity.name}</div>
                                        <div className="control-copy">{activity.objective || 'Objective not set'}</div>
                                    </div>
                                    <span className="badge badge-info">{Array.isArray(activity.equipment_required) ? activity.equipment_required.length : 0} equipment</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Safety & Incidents</h2>
                            <p className="panel-subtitle">Incidents link back to sessions and responsible reporting users.</p>
                        </div>
                    </div>
                    {data.incidents.length === 0 ? (
                        <EmptyState icon={ShieldCheck} title="No incidents recorded" />
                    ) : (
                        <div className="control-stack compact">
                            {data.incidents.slice(0, 8).map((incident) => (
                                <div className="control-row static" key={incident.id}>
                                    <div>
                                        <div className="control-title">{incident.session_title || 'Unlinked session'}</div>
                                        <div className="control-copy">{incident.description}</div>
                                    </div>
                                    <span className={`badge badge-${badgeTone(incident.severity)}`}>{formatStatus(incident.severity)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </section>
            </div>

            <div className="panels-row">
                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Equipment Readiness</h2>
                            <p className="panel-subtitle">Course equipment can link to assets or stock items.</p>
                        </div>
                    </div>
                    {data.equipment.length === 0 ? (
                        <EmptyState icon={ClipboardCheck} title="No course equipment records" />
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Equipment</th>
                                        <th>Status</th>
                                        <th>Condition</th>
                                        <th>Available Stock</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.equipment.map((item) => (
                                        <tr key={item.id}>
                                            <td>{item.name}</td>
                                            <td><span className={`badge badge-${badgeTone(item.status)}`}>{formatStatus(item.status)}</span></td>
                                            <td>{formatStatus(item.condition_status)}</td>
                                            <td>{item.available_quantity === null || item.available_quantity === undefined ? 'Not linked' : `${formatNumber(item.available_quantity)} ${item.inventory_unit || ''}`}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>

                <section className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Outcome Tracking</h2>
                            <p className="panel-subtitle">Confidence, teamwork, leadership, and emotional growth scores.</p>
                        </div>
                    </div>
                    {data.outcomes.length === 0 ? (
                        <EmptyState icon={Users} title="No outcome records" />
                    ) : (
                        <div className="data-table-wrap">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Session</th>
                                        <th>Participants</th>
                                        <th>Confidence</th>
                                        <th>Teamwork</th>
                                        <th>Leadership</th>
                                        <th>Growth</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.outcomes.map((outcome) => (
                                        <tr key={outcome.id}>
                                            <td>{outcome.session_title}</td>
                                            <td>{formatNumber(outcome.participant_count)}</td>
                                            <td>{formatNumber(outcome.confidence_score, { maximumFractionDigits: 1 })}</td>
                                            <td>{formatNumber(outcome.teamwork_score, { maximumFractionDigits: 1 })}</td>
                                            <td>{formatNumber(outcome.leadership_score, { maximumFractionDigits: 1 })}</td>
                                            <td>{formatNumber(outcome.emotional_growth_score, { maximumFractionDigits: 1 })}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            </div>

            {modal && (
                <div className="modal-overlay" onMouseDown={() => setModal('')}>
                    <div className="modal-box lg" onMouseDown={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">{modal === 'session' ? 'Plan Session' : 'Record Incident'}</h3>
                            <button className="modal-close" onClick={() => setModal('')}>x</button>
                        </div>
                        {modal === 'session' && (
                            <form onSubmit={submitSession}>
                                <div className="modal-body form-grid">
                                    <label className="form-field full">
                                        <span>Session Title</span>
                                        <input className="form-input" value={sessionForm.title} onChange={(event) => setSessionForm({ ...sessionForm, title: event.target.value })} required />
                                    </label>
                                    <label className="form-field">
                                        <span>Date</span>
                                        <input className="form-input" type="date" value={sessionForm.session_date} onChange={(event) => setSessionForm({ ...sessionForm, session_date: event.target.value })} required />
                                    </label>
                                    <label className="form-field">
                                        <span>Location</span>
                                        <input className="form-input" value={sessionForm.location} onChange={(event) => setSessionForm({ ...sessionForm, location: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Participant Group</span>
                                        <input className="form-input" value={sessionForm.participant_group} onChange={(event) => setSessionForm({ ...sessionForm, participant_group: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Participant Count</span>
                                        <input className="form-input" type="number" min="0" value={sessionForm.participant_count} onChange={(event) => setSessionForm({ ...sessionForm, participant_count: event.target.value })} />
                                    </label>
                                    <label className="form-field">
                                        <span>Risk Assessment</span>
                                        <select className="form-input" value={sessionForm.risk_assessment_status} onChange={(event) => setSessionForm({ ...sessionForm, risk_assessment_status: event.target.value })}>
                                            <option value="pending">Pending</option>
                                            <option value="completed">Completed</option>
                                            <option value="approved">Approved</option>
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Waiver Status</span>
                                        <select className="form-input" value={sessionForm.waiver_status} onChange={(event) => setSessionForm({ ...sessionForm, waiver_status: event.target.value })}>
                                            <option value="pending">Pending</option>
                                            <option value="partial">Partial</option>
                                            <option value="complete">Complete</option>
                                            <option value="not_required">Not Required</option>
                                        </select>
                                    </label>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setModal('')}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Session'}</button>
                                </div>
                            </form>
                        )}
                        {modal === 'incident' && (
                            <form onSubmit={submitIncident}>
                                <div className="modal-body form-grid">
                                    <label className="form-field">
                                        <span>Session</span>
                                        <select className="form-input" value={incidentForm.session_id} onChange={(event) => setIncidentForm({ ...incidentForm, session_id: event.target.value })}>
                                            <option value="">Unlinked</option>
                                            {data.sessions.map((session) => <option key={session.id} value={session.id}>{session.title}</option>)}
                                        </select>
                                    </label>
                                    <label className="form-field">
                                        <span>Severity</span>
                                        <select className="form-input" value={incidentForm.severity} onChange={(event) => setIncidentForm({ ...incidentForm, severity: event.target.value })}>
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                            <option value="critical">Critical</option>
                                        </select>
                                    </label>
                                    <label className="form-field full">
                                        <span>Participant Name</span>
                                        <input className="form-input" value={incidentForm.participant_name} onChange={(event) => setIncidentForm({ ...incidentForm, participant_name: event.target.value })} />
                                    </label>
                                    <label className="form-field full">
                                        <span>Description</span>
                                        <textarea className="form-input" value={incidentForm.description} onChange={(event) => setIncidentForm({ ...incidentForm, description: event.target.value })} required />
                                    </label>
                                    <label className="form-field full">
                                        <span>Action Taken</span>
                                        <textarea className="form-input" value={incidentForm.action_taken} onChange={(event) => setIncidentForm({ ...incidentForm, action_taken: event.target.value })} />
                                    </label>
                                </div>
                                <div className="modal-footer">
                                    <button type="button" className="btn btn-secondary" onClick={() => setModal('')}>Cancel</button>
                                    <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Saving...' : 'Save Incident'}</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
