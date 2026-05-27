export const formatNumber = (value, options = {}) =>
    new Intl.NumberFormat('en-US', {
        maximumFractionDigits: options.maximumFractionDigits ?? 0,
        minimumFractionDigits: options.minimumFractionDigits ?? 0,
    }).format(Number(value || 0));

export const formatCurrency = (value) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(Number(value || 0));

export const formatDate = (value) =>
    value
        ? new Date(value).toLocaleDateString(undefined, {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
          })
        : 'Not set';

export const formatStatus = (value) =>
    String(value || 'pending')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const badgeTone = (value) => {
    const status = String(value || '').toLowerCase();
    if (['compliant', 'approved', 'issued', 'available', 'complete', 'completed', 'current', 'good'].includes(status)) {
        return 'success';
    }
    if (['expired', 'rejected', 'lost', 'damaged', 'critical', 'poor'].includes(status)) {
        return 'danger';
    }
    if (['pending', 'submitted', 'reviewed', 'checked_out', 'in_progress', 'partial', 'medium'].includes(status)) {
        return 'warning';
    }
    if (['strictly_confidential', 'board_only', 'restricted'].includes(status)) {
        return 'primary';
    }
    return 'muted';
};

export function MetricCard({ icon: Icon, tone = 'primary', label, value, note }) {
    return (
        <div className="metric-card">
            <div className="metric-top">
                <div>
                    <div className="metric-title">{label}</div>
                    <div className="metric-value">{value}</div>
                </div>
                <div className={`metric-icon ${tone}`}>
                    <Icon size={18} />
                </div>
            </div>
            {note && <div className="metric-text">{note}</div>}
        </div>
    );
}

export function EmptyState({ icon: Icon, title, text }) {
    return (
        <div className="empty-state">
            {Icon && (
                <div className="empty-state-icon">
                    <Icon size={26} />
                </div>
            )}
            <div className="empty-state-title">{title}</div>
            {text && <p className="empty-state-text">{text}</p>}
        </div>
    );
}

export const getErrorMessage = (error, fallback) =>
    error?.response?.data?.error || error?.message || fallback;
