import React from 'react';
import PageHeader from '../components/PageHeader';
import {
    Settings as SettingsIcon, Shield, Bell,
    Map, Database, Cog, Globe, Save
} from 'lucide-react';

const SETTINGS_SECTIONS = [
    { id: 'org', name: 'Organization Profile', icon: Globe, desc: 'Branding, contact info, and operational clusters.' },
    { id: 'gov', name: 'Governance Framework', icon: Shield, desc: 'Approval thresholds, workflow steps, and delegation.' },
    { id: 'notif', name: 'Notification Rules', icon: Bell, desc: 'Email alerts and system broadcast configurations.' },
    { id: 'loc', name: 'Geographical Areas', icon: Map, desc: 'Manage districts, wards, and reporting zones.' },
    { id: 'sys', name: 'System Parameters', icon: Cog, desc: 'API keys, database maintenance, and integrator hooks.' }
];

export default function SettingsPage() {
    return (
        <div className="fade-in">
            <PageHeader
                title="General Settings"
                subtitle="Configure organizational defaults and core system parameters."
                actions={<button className="btn btn-primary btn-sm"><Save size={16} /> Save Changes</button>}
            />

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {SETTINGS_SECTIONS.map(sec => (
                    <div key={sec.id} className="panel hover-scale" style={{ cursor: 'pointer', padding: '0' }}>
                        <div style={{ padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '12px' }}>
                                <div className="kpi-icon-wrap" style={{ background: 'var(--bg-app)', color: 'var(--brand-primary)' }}>
                                    <sec.icon size={22} />
                                </div>
                                <h3 style={{ fontSize: '15px', fontWeight: 700 }}>{sec.name}</h3>
                            </div>
                            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                                {sec.desc}
                            </p>
                        </div>
                        <div style={{ background: 'var(--bg-app)', padding: '12px 24px', fontSize: '12px', fontWeight: 600, color: 'var(--brand-primary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>Manage Section</span>
                            <Cog size={14} />
                        </div>
                    </div>
                ))}
            </div>

            <div className="panel" style={{ marginTop: '24px' }}>
                <div className="panel-header">
                    <h2 className="panel-title">System Status</h2>
                </div>
                <div style={{ padding: '20px' }}>
                    <div style={{ display: 'flex', gap: '32px' }}>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-success)' }}></div>
                            <div style={{ fontSize: '13px' }}>Database Connection: <strong>Secure</strong></div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-success)' }}></div>
                            <div style={{ fontSize: '13px' }}>Storage Backend: <strong>Optimized</strong></div>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--brand-warning)' }}></div>
                            <div style={{ fontSize: '13px' }}>Kobo Integration: <strong>Syncing</strong></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
