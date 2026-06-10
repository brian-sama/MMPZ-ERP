import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
    Activity,
    Bell,
    CheckCircle2,
    Database,
    Globe,
    RefreshCw,
    Save,
    Shield,
    Truck,
    Users,
    WifiOff,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { useAuth } from '../context/AuthContext';
import API_BASE from '../apiConfig';

const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

export default function SettingsPage() {
    const { user, isSuperAdmin } = useAuth();
    const canEditControls = user?.role_code === 'DIRECTOR' || isSuperAdmin();
    const [thresholdValue, setThresholdValue] = useState('500');
    const [savedThreshold, setSavedThreshold] = useState('500');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    
    // KoBo Configuration State
    const [koboConfig, setKoboConfig] = useState({
        server_url: '',
        api_token: '',
    });
    const [koboLoading, setKoboLoading] = useState(false);
    const [koboSaving, setKoboSaving] = useState(false);
    const [koboMessage, setKoboMessage] = useState('');
    const [koboError, setKoboError] = useState('');
    const [koboStorageReady, setKoboStorageReady] = useState(true);

    // System Health state
    const [health, setHealth] = useState(null);
    const [healthLoading, setHealthLoading] = useState(true);
    const [healthError, setHealthError] = useState('');

    const fetchHealth = async () => {
        setHealthLoading(true);
        setHealthError('');
        try {
            const res = await axios.get(`${API_BASE}/admin/system-health`);
            setHealth(res.data);
        } catch (err) {
            setHealthError(err.response?.data?.error || 'Unable to fetch system health.');
        } finally {
            setHealthLoading(false);
        }
    };

    const fetchSettings = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await axios.get(`${API_BASE}/settings/finance-threshold`, {
                params: { userId: user.id },
            });
            const value = res.data?.value_text || '500';
            setThresholdValue(value);
            setSavedThreshold(value);
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to load finance settings.');
        } finally {
            setLoading(false);
        }
    };

    const fetchKoboConfig = async () => {
        setKoboLoading(true);
        setKoboError('');
        try {
            const res = await axios.get(`${API_BASE}/kobo/config`, {
                params: { userId: user.id },
            });
            setKoboStorageReady(res.data?.storage_ready !== false);
            setKoboConfig({
                server_url: res.data.server_url || 'https://kf.kobotoolbox.org',
                api_token: res.data.api_token || '',
            });
        } catch (err) {
            setKoboStorageReady(false);
            setKoboError(err.response?.data?.error || 'Failed to load KoBo configuration.');
        } finally {
            setKoboLoading(false);
        }
    };
    useEffect(() => {
        fetchSettings();
        fetchKoboConfig();
        fetchHealth();
    }, []);

    const dirty = useMemo(
        () => String(thresholdValue) !== String(savedThreshold),
        [thresholdValue, savedThreshold]
    );

    const handleSave = async () => {
        setSaving(true);
        setError('');
        setMessage('');
        try {
            const res = await axios.patch(`${API_BASE}/settings/finance-threshold`, {
                userId: user.id,
                value: thresholdValue,
            });
            setSavedThreshold(res.data.value_text);
            setThresholdValue(res.data.value_text);
            setMessage('Finance authority threshold updated.');
        } catch (err) {
            setError(err.response?.data?.error || 'Unable to update threshold.');
        } finally {
            setSaving(false);
        }
    };

    const handleSaveKobo = async (e) => {
        e.preventDefault();
        setKoboSaving(true);
        setKoboMessage('');
        setKoboError('');
        if (!koboStorageReady) {
            setKoboError('KoBo configuration storage is not available until the latest database migrations are applied.');
            setKoboSaving(false);
            return;
        }
        try {
            const res = await axios.post(`${API_BASE}/kobo/config`, {
                userId: user.id,
                ...koboConfig,
            });
            setKoboMessage(res.data.message || 'KoBo configuration saved and verified.');
            await fetchKoboConfig();
        } catch (err) {
            setKoboError(err.response?.data?.error || 'Failed to save KoBo configuration.');
        } finally {
            setKoboSaving(false);
        }
    };

    if (loading) return <div className="page-loading"><div className="spinner"></div></div>;

    return (
        <div className="fade-in finance-workspace">
            <PageHeader
                title="Operational Settings"
                subtitle="Define financial authority, administrative controls, and logistics discipline."
                actions={
                    <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={!canEditControls || !dirty || saving}>
                        <Save size={16} /> {saving ? 'Saving...' : 'Save Control Changes'}
                    </button>
                }
            />

            {(message || error) && (
                <div className={`page-message ${message ? 'success' : 'error'}`}>
                    {message || error}
                </div>
            )}

            <section className="domain-hero">
                <div>
                    <div className="domain-kicker">Operating Policy</div>
                    <h2>Settings should express authority, segregation of duties, and operational readiness, not just feature toggles.</h2>
                    <p>
                        This page is now anchored on practical controls: who can release spend,
                        when procurement needs deeper review, and what administrative safeguards remain non-negotiable.
                    </p>
                </div>
                <div className="hero-control-card">
                    <div className="hero-control-label">Current Threshold</div>
                    <div className="hero-control-value">{formatCurrency(thresholdValue)}</div>
                    <p>Requests at or above this level require Director approval and comparative review.</p>
                </div>
            </section>

            <div className="signal-strip">
                <div className="signal-card">
                    <div className="signal-icon warning"><Shield size={18} /></div>
                    <div className="signal-meta">
                        <div className="signal-label">Authority Point</div>
                        <div className="signal-value">{formatCurrency(savedThreshold)}</div>
                        <div className="signal-note">Final approval threshold for material procurement.</div>
                    </div>
                </div>
                <div className="signal-card">
                    <div className="signal-icon success"><Users size={18} /></div>
                    <div className="signal-meta">
                        <div className="signal-label">Segregation Rule</div>
                        <div className="signal-value">3 roles</div>
                        <div className="signal-note">Requester, reviewer, and approver should remain distinct actors.</div>
                    </div>
                </div>
                <div className="signal-card">
                    <div className="signal-icon accent"><Truck size={18} /></div>
                    <div className="signal-meta">
                        <div className="signal-label">Logistics Readiness</div>
                        <div className="signal-value">Pre-check</div>
                        <div className="signal-note">Approved commitments should only proceed when delivery handling is clear.</div>
                    </div>
                </div>
            </div>

            <div className="panels-row">
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Financial Authority</h2>
                            <div className="panel-subtitle">Set the value above which requisitions escalate to Director sign-off.</div>
                        </div>
                    </div>
                    <div className="form-group">
                        <label className="form-label">Major finance threshold (USD)</label>
                        <input
                            type="number"
                            min="0"
                            className="form-input"
                            value={thresholdValue}
                            disabled={!canEditControls}
                            onChange={(event) => setThresholdValue(event.target.value)}
                        />
                        <div className="form-hint">
                            Used by finance and procurement workflows to classify routine, finance-review, and Director-review requisitions.
                        </div>
                        {!canEditControls && (
                            <div className="form-hint">
                                Only the Director or System Admin can change the authority threshold.
                            </div>
                        )}
                    </div>
                    <div className="summary-card muted" style={{ marginTop: '16px' }}>
                        <div className="summary-label">Current escalation rule</div>
                        <div className="summary-copy">
                            Routine below {formatCurrency(Number(thresholdValue || 0) / 2)}, finance review from {formatCurrency(Number(thresholdValue || 0) / 2)} to {formatCurrency(thresholdValue)}, Director review at or above {formatCurrency(thresholdValue)}.
                        </div>
                    </div>
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">Administrative Controls</h2>
                            <div className="panel-subtitle">Baseline controls that should remain fixed in operations.</div>
                        </div>
                    </div>
                    <div className="control-stack">
                        <div className="control-row static">
                            <div>
                                <div className="control-title">User provisioning</div>
                                <div className="control-copy">Role assignment should be reviewed independently from account creation.</div>
                            </div>
                            <Users size={18} />
                        </div>
                        <div className="control-row static">
                            <div>
                                <div className="control-title">System notifications</div>
                                <div className="control-copy">Escalation notices should follow pending approvals and overdue requisitions.</div>
                            </div>
                            <Bell size={18} />
                        </div>
                        <div className="control-row static">
                            <div>
                                <div className="control-title">Reference data stewardship</div>
                                <div className="control-copy">Organizational and geographic master data should be curated, not edited ad hoc.</div>
                            </div>
                            <Globe size={18} />
                        </div>
                    </div>
                </div>
            </div>

            <div className="panels-row">
                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">KoBoToolbox Connection</h2>
                            <div className="panel-subtitle">Connect to the correct KoBoCollect database for field data sync.</div>
                        </div>
                    </div>
                    {koboLoading ? (
                        <div className="empty-state" style={{ height: '100px' }}><div className="spinner"></div></div>
                    ) : (
                        <form onSubmit={handleSaveKobo}>
                            {(koboMessage || koboError) && (
                                <div className={`page-message ${koboMessage ? 'success' : 'error'}`} style={{ marginBottom: '16px' }}>
                                    {koboMessage || koboError}
                                </div>
                            )}
                            <div className="form-group">
                                <label className="form-label">Server URL</label>
                                <input
                                    type="url"
                                    className="form-input"
                                    value={koboConfig.server_url}
                                    placeholder="https://kf.kobotoolbox.org"
                                    disabled={!canEditControls}
                                    onChange={(e) => setKoboConfig({ ...koboConfig, server_url: e.target.value })}
                                />
                            </div>
                            <div className="form-group" style={{ marginTop: '12px' }}>
                                <label className="form-label">API Token</label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={koboConfig.api_token}
                                    placeholder="Your secret API token"
                                    disabled={!canEditControls}
                                    onChange={(e) => setKoboConfig({ ...koboConfig, api_token: e.target.value })}
                                />
                            </div>
                            <div style={{ marginTop: '16px' }}>
                                <button
                                    type="submit"
                                    className="btn btn-primary btn-sm"
                                    disabled={!canEditControls || koboSaving || !koboConfig.server_url || !koboConfig.api_token}
                                >
                                    <Database size={14} /> {koboSaving ? 'Saving & Testing...' : 'Save & Test Connection'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <div className="panel">
                    <div className="panel-header">
                        <div>
                            <h2 className="panel-title">System Health</h2>
                            <div className="panel-subtitle">Live integration status across ERP and M&E Compass.</div>
                        </div>
                        <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={fetchHealth}
                            disabled={healthLoading}
                            title="Refresh"
                        >
                            <RefreshCw size={14} style={{ animation: healthLoading ? 'spin 1s linear infinite' : 'none' }} />
                        </button>
                    </div>
                    {healthLoading && !health ? (
                        <div className="empty-state" style={{ height: '120px' }}><div className="spinner"></div></div>
                    ) : healthError ? (
                        <div className="page-message error">{healthError}</div>
                    ) : (
                        <div className="control-stack">
                            {/* M&E Compass status */}
                            <div className="control-row static">
                                <div>
                                    <div className="control-title">M&E Compass</div>
                                    {health?.me ? (
                                        <div className="control-copy">
                                            {health.me.approvedActivities ?? 0} approved activities —{' '}
                                            {health.me.pendingSyncToErp ?? 0} pending ERP sync
                                            {health.me.lastSyncedAt
                                                ? ` · last synced ${new Date(health.me.lastSyncedAt).toLocaleDateString()}`
                                                : ''}
                                        </div>
                                    ) : (
                                        <div className="control-copy" style={{ color: 'var(--text-muted)' }}>Offline or unreachable</div>
                                    )}
                                </div>
                                {health?.me ? <CheckCircle2 size={18} style={{ color: 'var(--success)' }} /> : <WifiOff size={18} style={{ color: 'var(--text-muted)' }} />}
                            </div>
                            {/* ERP summaries received */}
                            <div className="control-row static">
                                <div>
                                    <div className="control-title">M&E Summaries in ERP</div>
                                    <div className="control-copy">
                                        {health?.erp?.totalMeSummariesStored ?? 0} activity records stored
                                        {health?.erp?.lastReceivedMeSummaryAt
                                            ? ` · last received ${new Date(health.erp.lastReceivedMeSummaryAt).toLocaleDateString()}`
                                            : ' · none received yet'}
                                    </div>
                                </div>
                                <Database size={18} />
                            </div>
                            {/* Pending sync alert */}
                            {(health?.me?.pendingSyncToErp ?? 0) > 0 && (
                                <div className="control-row static" style={{ background: 'var(--warning-bg, rgba(234,179,8,0.08))', borderRadius: '6px', padding: '8px 12px' }}>
                                    <div>
                                        <div className="control-title" style={{ color: 'var(--warning, #ca8a04)' }}>Sync Pending</div>
                                        <div className="control-copy">
                                            {health.me.pendingSyncToErp} approved {health.me.pendingSyncToErp === 1 ? 'activity' : 'activities'} waiting to sync to ERP. These will push automatically when the next activity is approved.
                                        </div>
                                    </div>
                                    <Activity size={18} style={{ color: 'var(--warning, #ca8a04)', flexShrink: 0 }} />
                                </div>
                            )}
                            <div className="control-row static" style={{ opacity: 0.6, fontSize: '11px' }}>
                                <div className="control-copy">Checked {health?.checkedAt ? new Date(health.checkedAt).toLocaleTimeString() : '—'}</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
