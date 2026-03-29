import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Calendar as CalendarIcon, Clock3, MapPin, Plus, Trash2 } from 'lucide-react';
import API_BASE from '../../apiConfig';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';

const emptyEventForm = {
    title: '',
    description: '',
    event_type: 'internal_meeting',
    start_at: '',
    end_at: '',
    location: '',
};

const formatEventDate = (value) =>
    new Date(value).toLocaleString([], {
        dateStyle: 'medium',
        timeStyle: 'short',
    });

export default function CalendarPage() {
    const { user } = useAuth();
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [form, setForm] = useState(emptyEventForm);
    const [submitting, setSubmitting] = useState(false);
    const canManageEvents = user?.role_code !== 'DEVELOPMENT_FACILITATOR';

    const fetchEvents = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/calendar`, {
                params: { userId: user.id, limit: 100 },
            });
            setEvents(res.data || []);
        } catch (error) {
            console.error('Failed to fetch events', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const upcomingEvents = useMemo(
        () => events.filter((item) => new Date(item.start_at).getTime() >= Date.now()),
        [events]
    );

    const laterEvents = useMemo(
        () => events.filter((item) => new Date(item.start_at).getTime() < Date.now()),
        [events]
    );

    const openModal = (eventItem = null) => {
        setEditingEvent(eventItem);
        setForm(
            eventItem
                ? {
                      title: eventItem.title || '',
                      description: eventItem.description || '',
                      event_type: eventItem.event_type || 'internal_meeting',
                      start_at: eventItem.start_at ? eventItem.start_at.slice(0, 16) : '',
                      end_at: eventItem.end_at ? eventItem.end_at.slice(0, 16) : '',
                      location: eventItem.location || '',
                  }
                : emptyEventForm
        );
        setShowModal(true);
    };

    const closeModal = () => {
        setEditingEvent(null);
        setForm(emptyEventForm);
        setShowModal(false);
    };

    const saveEvent = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        try {
            const payload = {
                userId: user.id,
                ...form,
                start_at: form.start_at,
                end_at: form.end_at || null,
            };
            if (editingEvent) {
                await axios.put(`${API_BASE}/calendar/${editingEvent.id}`, payload);
            } else {
                await axios.post(`${API_BASE}/calendar`, payload);
            }
            closeModal();
            await fetchEvents();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to save event');
        } finally {
            setSubmitting(false);
        }
    };

    const deleteEvent = async (eventId) => {
        if (!window.confirm('Delete this event?')) return;
        try {
            await axios.delete(`${API_BASE}/calendar/${eventId}`, {
                data: { userId: user.id },
            });
            await fetchEvents();
        } catch (error) {
            alert(error.response?.data?.error || 'Failed to delete event');
        }
    };

    return (
        <div className="fade-in">
            <PageHeader
                title="Organization Calendar"
                subtitle="Upcoming training, holidays, planning sessions, and deployment schedules."
                actions={
                    canManageEvents ? (
                        <button className="btn btn-primary btn-sm" onClick={() => openModal()}>
                            <Plus size={16} /> Add Event
                        </button>
                    ) : null
                }
            />

            {loading ? (
                <div className="page-loading">
                    <div className="spinner" />
                </div>
            ) : (
                <div className="panels-row">
                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title">Upcoming Events</h2>
                        </div>

                        {upcomingEvents.length === 0 ? (
                            <div className="empty-state" style={{ padding: '60px 20px' }}>
                                <div className="empty-state-icon">
                                    <CalendarIcon size={32} />
                                </div>
                                <div className="empty-state-title">No upcoming events</div>
                                <p className="empty-state-text">
                                    The calendar is currently clear for the next 30 days.
                                </p>
                            </div>
                        ) : (
                            <div className="control-stack">
                                {upcomingEvents.map((eventItem) => (
                                    <div key={eventItem.id} className="control-row static" style={{ alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <div className="control-title">{eventItem.title}</div>
                                            <div className="control-copy">{eventItem.description || 'No additional description provided.'}</div>
                                            <div
                                                style={{
                                                    display: 'flex',
                                                    flexWrap: 'wrap',
                                                    gap: '12px',
                                                    marginTop: '10px',
                                                    fontSize: '12px',
                                                    color: 'var(--text-muted)',
                                                }}
                                            >
                                                <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                                    <Clock3 size={14} /> {formatEventDate(eventItem.start_at)}
                                                </span>
                                                {eventItem.location && (
                                                    <span style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                                                        <MapPin size={14} /> {eventItem.location}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        <div className="control-trailing">
                                            <span className="badge badge-info">{eventItem.event_type.replace(/_/g, ' ')}</span>
                                            {canManageEvents && (
                                                <div style={{ display: 'flex', gap: '8px' }}>
                                                    <button className="btn btn-secondary btn-sm" onClick={() => openModal(eventItem)}>
                                                        Edit
                                                    </button>
                                                    <button className="btn btn-ghost btn-sm" onClick={() => deleteEvent(eventItem.id)}>
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="panel">
                        <div className="panel-header">
                            <h2 className="panel-title">Calendar Snapshot</h2>
                        </div>
                        <div className="kpi-grid" style={{ marginBottom: 0 }}>
                            <div className="kpi-card info">
                                <div className="kpi-icon-wrap">
                                    <CalendarIcon size={20} />
                                </div>
                                <div className="kpi-label">Upcoming</div>
                                <div className="kpi-value">{upcomingEvents.length}</div>
                                <div className="kpi-sub">Events still ahead on the schedule</div>
                            </div>
                            <div className="kpi-card accent">
                                <div className="kpi-icon-wrap">
                                    <Clock3 size={20} />
                                </div>
                                <div className="kpi-label">Scheduled Total</div>
                                <div className="kpi-value">{events.length}</div>
                                <div className="kpi-sub">Visible across the current calendar feed</div>
                            </div>
                        </div>

                        {laterEvents.length > 0 && (
                            <div style={{ marginTop: '20px' }}>
                                <h3 style={{ fontSize: '14px', fontWeight: 700, marginBottom: '10px' }}>Already Started / Earlier Entries</h3>
                                <div className="control-stack compact">
                                    {laterEvents.slice(0, 4).map((eventItem) => (
                                        <div key={eventItem.id} className="control-row static">
                                            <div>
                                                <div className="control-title">{eventItem.title}</div>
                                                <div className="control-copy">{formatEventDate(eventItem.start_at)}</div>
                                            </div>
                                            <span className="badge badge-muted">{eventItem.event_type.replace(/_/g, ' ')}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {showModal && (
                <div className="modal-overlay" onClick={closeModal}>
                    <div className="modal-box" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">
                                {editingEvent ? 'Update Calendar Event' : 'Create Calendar Event'}
                            </div>
                            <button className="modal-close" onClick={closeModal}>
                                ×
                            </button>
                        </div>
                        <form onSubmit={saveEvent}>
                            <div className="modal-body" style={{ display: 'grid', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">Title</label>
                                    <input
                                        className="form-input"
                                        value={form.title}
                                        onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                                        required
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Description</label>
                                    <textarea
                                        className="form-input"
                                        style={{ minHeight: '120px' }}
                                        value={form.description}
                                        onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                                    />
                                </div>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                        gap: '16px',
                                    }}
                                >
                                    <div className="form-group">
                                        <label className="form-label">Event Type</label>
                                        <select
                                            className="form-input"
                                            value={form.event_type}
                                            onChange={(event) => setForm((current) => ({ ...current, event_type: event.target.value }))}
                                        >
                                            <option value="internal_meeting">Internal meeting</option>
                                            <option value="training">Training</option>
                                            <option value="field_visit">Field visit</option>
                                            <option value="holiday">Holiday</option>
                                            <option value="deadline">Deadline</option>
                                        </select>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Location</label>
                                        <input
                                            className="form-input"
                                            value={form.location}
                                            onChange={(event) => setForm((current) => ({ ...current, location: event.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div
                                    style={{
                                        display: 'grid',
                                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                                        gap: '16px',
                                    }}
                                >
                                    <div className="form-group">
                                        <label className="form-label">Start</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            value={form.start_at}
                                            onChange={(event) => setForm((current) => ({ ...current, start_at: event.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">End</label>
                                        <input
                                            type="datetime-local"
                                            className="form-input"
                                            value={form.end_at}
                                            onChange={(event) => setForm((current) => ({ ...current, end_at: event.target.value }))}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={closeModal}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={submitting}>
                                    {submitting ? 'Saving...' : 'Save Event'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
