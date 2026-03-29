import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Mail, Search, Shield, Users } from 'lucide-react';
import API_BASE from '../../apiConfig';
import PageHeader from '../../components/PageHeader';

const cardStyles = {
    display: 'grid',
    gap: '14px',
    overflow: 'hidden',
    padding: 0,
};

export default function StaffDirectoryPage() {
    const [search, setSearch] = useState('');
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStaff, setSelectedStaff] = useState(null);

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/users`);
            setStaff(res.data || []);
        } catch (error) {
            console.error('Failed to fetch staff', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStaff();
    }, []);

    const filteredStaff = useMemo(
        () =>
            staff.filter((item) =>
                [item.name, item.job_title, item.email, item.short_bio, item.role_code]
                    .filter(Boolean)
                    .some((value) => value.toLowerCase().includes(search.toLowerCase()))
            ),
        [search, staff]
    );

    const renderAvatar = (person, size = 140) => {
        if (person.profile_picture_url) {
            return (
                <img
                    src={person.profile_picture_url}
                    alt={person.name}
                    style={{
                        width: '100%',
                        height: size,
                        objectFit: 'cover',
                        display: 'block',
                    }}
                />
            );
        }

        return (
            <div
                style={{
                    width: '100%',
                    height: size,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background:
                        'radial-gradient(circle at 20% 20%, rgba(47,93,80,0.24), rgba(143,99,48,0.18))',
                    color: 'var(--brand-primary)',
                    fontFamily: 'var(--font-heading)',
                    fontSize: size > 160 ? '46px' : '34px',
                    fontWeight: 700,
                }}
            >
                {person.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
        );
    };

    return (
        <div className="fade-in">
            <PageHeader
                title="Staff Directory"
                subtitle="Find colleagues by role, department, and profile details."
            />

            <div className="panel" style={{ marginBottom: '20px' }}>
                <div
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'var(--bg-app)',
                        padding: '10px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border)',
                    }}
                >
                    <Search size={16} style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search by name, role, department, or bio..."
                        style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            color: 'var(--text-primary)',
                            width: '100%',
                        }}
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="page-loading">
                    <div className="spinner" />
                </div>
            ) : (
                <div
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                        gap: '20px',
                    }}
                >
                    {filteredStaff.map((person) => (
                        <div
                            key={person.id}
                            className="panel hover-scale"
                            style={cardStyles}
                            onClick={() => setSelectedStaff(person)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ' ') {
                                    event.preventDefault();
                                    setSelectedStaff(person);
                                }
                            }}
                        >
                            <div>{renderAvatar(person, 220)}</div>
                            <div style={{ padding: '0 20px 20px' }}>
                                <div
                                    style={{
                                        fontFamily: 'var(--font-heading)',
                                        fontSize: '28px',
                                        lineHeight: 1.1,
                                        marginBottom: '6px',
                                        color: 'var(--brand-secondary)',
                                    }}
                                >
                                    {person.name}
                                </div>
                                <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-secondary)' }}>
                                    {person.job_title || person.role_code}
                                </div>
                                <p style={{ marginTop: '12px', color: 'var(--text-secondary)', minHeight: '66px' }}>
                                    {person.short_bio || 'Profile bio not added yet. Tap to view contact details and role context.'}
                                </p>
                                <div
                                    style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginTop: '16px',
                                        gap: '10px',
                                    }}
                                >
                                    <span className="badge badge-info">{person.system_role}</span>
                                    <span
                                        style={{
                                            fontSize: '11px',
                                            color:
                                                person.role_assignment_status === 'confirmed'
                                                    ? 'var(--brand-success)'
                                                    : 'var(--brand-warning)',
                                        }}
                                    >
                                        {person.role_assignment_status}
                                    </span>
                                </div>
                                <button className="btn btn-primary btn-sm" style={{ marginTop: '18px', width: '100%' }}>
                                    Read More
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {selectedStaff && (
                <div className="modal-overlay" onClick={() => setSelectedStaff(null)}>
                    <div className="modal-box lg" onClick={(event) => event.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-title">Staff Profile</div>
                            <button className="modal-close" onClick={() => setSelectedStaff(null)}>
                                ×
                            </button>
                        </div>
                        <div className="modal-body">
                            <div
                                style={{
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                                    gap: '24px',
                                }}
                            >
                                <div
                                    style={{
                                        borderRadius: 'var(--radius-lg)',
                                        overflow: 'hidden',
                                        border: '1px solid var(--border)',
                                        background: 'var(--bg-app)',
                                    }}
                                >
                                    {renderAvatar(selectedStaff, 320)}
                                </div>
                                <div style={{ display: 'grid', gap: '14px', alignContent: 'start' }}>
                                    <div>
                                        <div
                                            style={{
                                                fontFamily: 'var(--font-heading)',
                                                fontSize: '34px',
                                                lineHeight: 1.05,
                                                marginBottom: '8px',
                                            }}
                                        >
                                            {selectedStaff.name}
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                            <span className="badge badge-info">{selectedStaff.system_role}</span>
                                            {selectedStaff.system_role === 'SUPER_ADMIN' && (
                                                <span className="badge badge-primary">
                                                    <Shield size={12} style={{ marginRight: '4px' }} /> Super Admin
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="surface-muted">
                                        <div className="control-title">{selectedStaff.job_title || selectedStaff.role_code}</div>
                                        <div className="control-copy">
                                            Member since {new Date(selectedStaff.created_at).getFullYear()}
                                        </div>
                                    </div>

                                    <div className="surface-muted">
                                        <div className="control-title">Short Bio</div>
                                        <div className="control-copy">
                                            {selectedStaff.short_bio || 'This staff member has not added a public bio yet.'}
                                        </div>
                                    </div>

                                    <div className="surface-muted">
                                        <div className="control-title">Contact</div>
                                        <div className="control-copy" style={{ display: 'grid', gap: '6px', marginTop: '8px' }}>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                <Mail size={14} /> {selectedStaff.email}
                                            </span>
                                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                <Users size={14} /> Assignment status: {selectedStaff.role_assignment_status}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            <button className="btn btn-secondary" onClick={() => setSelectedStaff(null)}>
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
