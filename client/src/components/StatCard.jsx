import React from 'react';
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react';

const TREND_STYLES = {
    up: {
        label: 'Growing',
        icon: ArrowUpRight,
        className: 'badge badge-success',
    },
    down: {
        label: 'Watch',
        icon: ArrowDownRight,
        className: 'badge badge-danger',
    },
    stable: {
        label: 'Stable',
        icon: Minus,
        className: 'badge badge-muted',
    },
};

export default function StatCard({ label, value, subtext, trend = 'stable', icon, iconTone = 'primary' }) {
    const trendConfig = TREND_STYLES[trend] || TREND_STYLES.stable;
    const TrendIcon = trendConfig.icon;

    return (
        <div className="metric-card">
            <div className="metric-top">
                <div className={`metric-icon ${iconTone}`}>
                    {icon}
                </div>
                <span className={trendConfig.className}>
                    <TrendIcon size={12} />
                    {trendConfig.label}
                </span>
            </div>
            <div className="metric-title">{label}</div>
            <div className="metric-value">{value}</div>
            <div className="metric-text">{subtext}</div>
        </div>
    );
}
