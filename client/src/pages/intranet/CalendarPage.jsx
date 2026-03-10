import React from 'react';
import PageHeader from '../../components/PageHeader';
import { Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';

export default function CalendarPage() {
    return (
        <div className="fade-in">
            <PageHeader
                title="Organization Calendar"
                subtitle="Upcoming training, holidays, and deployment schedules"
                actions={<button className="btn btn-primary btn-sm">Add Event</button>}
            />

            <div className="panel">
                <div className="empty-state" style={{ padding: '60px 20px' }}>
                    <div className="empty-state-icon"><CalendarIcon size={32} /></div>
                    <div className="empty-state-title">No upcoming events</div>
                    <p className="empty-state-text">The calendar is currently clear for the next 30 days.</p>
                </div>

                {/* Example of what it looks like when events exist */}
                <div style={{ marginTop: '40px', paddingTop: '20px', borderTop: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Later This Year</h3>
                    <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '10px' }}>
                        {[
                            { date: 'APR 18', title: 'Independence Day', type: 'Holiday' },
                            { date: 'MAY 01', title: 'Workers Day', type: 'Holiday' },
                            { date: 'JUN 15', title: 'Q2 Staff Review', type: 'Internal Meeting' },
                        ].map((evt, i) => (
                            <div key={i} style={{ minWidth: '200px', background: 'var(--bg-app)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                                <div style={{ fontSize: '11px', fontWeight: 700, color: '#7B2CBF', letterSpacing: '0.05em', marginBottom: '8px' }}>{evt.date}</div>
                                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>{evt.title}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{evt.type}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
