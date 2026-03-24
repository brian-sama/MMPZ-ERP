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
    const [activeSection, setActiveSection] = useState(null);
    const [saving, setSaving] = useState(false);

    const handleSave = () => {
        setSaving(true);
        setTimeout(() => {
            setSaving(false);
            setActiveSection(null);
            alert('Settings updated successfully!');
        }, 800);
    };

    return (
        <div className="fade-in">
            <PageHeader
                title="General Settings"
                subtitle="Configure organizational defaults and core system parameters."
                actions={<button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}><Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}</button>}
            />

            <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
                {SETTINGS_SECTIONS.map(sec => (
                    <div key={sec.id} className="panel hover-scale" style={{ cursor: 'pointer', padding: '0' }} onClick={() => setActiveSection(sec)}>
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
            </div>

            {/* Settings Detail Modal */}
            {activeSection && (
                <div className="modal-overlay" onClick={() => setActiveSection(null)}>
                    <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px' }}>
                        <div className="modal-header">
                            <div className="modal-title">{activeSection.name}</div>
                            <button className="modal-close" onClick={() => setActiveSection(null)}>×</button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <p className="form-hint">{activeSection.desc}</p>
                            
                            {activeSection.id === 'org' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Organization Name</label>
                                        <input type="text" className="form-input" defaultValue="Mzilikazi MMPZ" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Contact Email</label>
                                        <input type="email" className="form-input" defaultValue="admin@mmpzmne.co.zw" />
                                    </div>
                                </div>
                            )}

                            {activeSection.id === 'gov' && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    <div className="form-group">
                                        <label className="form-label">Procurement Approval Threshold ($)</label>
                                        <input type="number" className="form-input" defaultValue="500" />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Workflow Escalation (Days)</label>
                                        <input type="number" className="form-input" defaultValue="3" />
                                    </div>
                                </div>
                            )}

                            {['notif', 'loc', 'sys'].includes(activeSection.id) && (
                                <div style={{ textAlign: 'center', padding: '24px', background: 'var(--bg-app)', borderRadius: '8px' }}>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Advanced configuration for <strong>{activeSection.name}</strong> will be implemented in the next module release.</p>
                                </div>
                            )}
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setActiveSection(null)}>Close</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                                {saving ? 'Applying...' : 'Apply Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
