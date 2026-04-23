import React from 'react';
import { ArrowUpRight, ExternalLink } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const getStreamlitUrl = () => {
    const configuredUrl = import.meta.env.VITE_STREAMLIT_URL;
    if (configuredUrl) return configuredUrl;

    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return '/streamlit/?embed=true';
    }

    return 'https://streamlit.mmpzmne.co.zw/?embed=true';
};

export default function AnalyticsDashboardPage() {
    const streamlitUrl = getStreamlitUrl();

    return (
        <div className="content-stack fade-in">
            <PageHeader
                title="Advanced Analytics"
                subtitle="Interactive reporting powered by the Streamlit analytics workspace."
                actions={(
                    <a
                        className="btn btn-secondary btn-sm"
                        href={streamlitUrl}
                        target="_blank"
                        rel="noreferrer"
                    >
                        <ExternalLink size={14} />
                        Open In New Tab
                    </a>
                )}
            />

            <div className="panel" style={{ padding: '14px', display: 'grid', gap: '12px' }}>
                <div className="helper-note">
                    <ArrowUpRight size={18} color="var(--brand-primary)" />
                    <div>
                        <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Analytics Embed</strong>
                        <p>If the embedded view is blocked by hosting or browser policy, open the analytics workspace in a new tab.</p>
                    </div>
                </div>

                <div
                    style={{
                        width: '100%',
                        minHeight: 'min(900px, calc(100vh - 230px))',
                        borderRadius: 'var(--radius-lg)',
                        overflow: 'hidden',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-surface)',
                        position: 'relative',
                    }}
                >
                    <iframe
                        src={streamlitUrl}
                        title="Streamlit Analytics"
                        style={{
                            width: '100%',
                            height: '100%',
                            border: 0,
                            position: 'absolute',
                            inset: 0,
                        }}
                        sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-downloads"
                        allowFullScreen
                    />
                </div>
            </div>
        </div>
    );
}
