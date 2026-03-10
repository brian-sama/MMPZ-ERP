import React from 'react';
import PageHeader from '../../components/PageHeader';
import { Radio, Bell, MessageSquare, CheckCircle2 } from 'lucide-react';

export default function IntranetDashboardPage() {
    return (
        <div className="fade-in">
            <PageHeader
                title="Announcements"
                subtitle="Organization updates and internal news"
            />

            <div className="panels-row">
                <div className="panel" style={{ flex: 2 }}>
                    <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Radio size={16} /> Latest News
                    </h2>
                    <div className="empty-state">
                        <div className="empty-state-icon"><MessageSquare size={32} /></div>
                        <div className="empty-state-title">No new announcements</div>
                        <p className="empty-state-text">Check back later for organizational updates.</p>
                    </div>
                </div>

                <div className="panel" style={{ flex: 1 }}>
                    <h2 className="panel-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Bell size={16} /> My Tasks
                    </h2>
                    <div className="empty-state">
                        <div className="empty-state-icon"><CheckCircle2 size={32} /></div>
                        <div className="empty-state-title">All caught up</div>
                        <p className="empty-state-text">You have no pending tasks today.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
