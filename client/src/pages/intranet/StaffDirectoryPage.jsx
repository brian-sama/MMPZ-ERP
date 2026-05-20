import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Edit2, ImagePlus, Mail, Phone, Save, Search, Shield, Users, X } from 'lucide-react';
import API_BASE from '../../apiConfig';
import PageHeader from '../../components/PageHeader';
import { useAuth } from '../../context/AuthContext';

const cardStyles = {
    display: 'grid',
    gap: '14px',
    overflow: 'hidden',
    padding: 0,
};

export default function StaffDirectoryPage() {
    const { user } = useAuth();
    const [search, setSearch] = useState('');
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedStaff, setSelectedStaff] = useState(null);
    const [editMode, setEditMode] = useState(false);
    const [saving, setSaving] = useState(false);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);
    const [modalError, setModalError] = useState('');
    const [form, setForm] = useState({
        name: '',
        job_title: '',
        short_bio: '',
        phone: '',
        email: '',
    });
    const canManageDirectoryProfiles = user?.system_role === 'SUPER_ADMIN';

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

    useEffect(() => {
        if (!selectedStaff) {
            setEditMode(false);
            setModalError('');
            return;
        }

        setForm({
            name: selectedStaff.name || '',
            job_title: selectedStaff.job_title || '',
            short_bio: selectedStaff.short_bio || '',
            phone: selectedStaff.phone || '',
            email: selectedStaff.email || '',
        });
        setModalError('');
        setEditMode(false);
    }, [selectedStaff]);

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

    const updateLocalStaff = (updatedPerson) => {
        setStaff((current) =>
            current.map((person) => (person.id === updatedPerson.id ? { ...person, ...updatedPerson } : person))
        );
        setSelectedStaff((current) =>
            current && current.id === updatedPerson.id ? { ...current, ...updatedPerson } : current
        );
    };

    const handleSaveProfile = async () => {
        if (!selectedStaff) return;
        setSaving(true);
        setModalError('');
        try {
            const payload = {
                userId: user.id,
                name: form.name.trim(),
                email: form.email.trim(),
                role_code: selectedStaff.role_code,
                phone: form.phone.trim(),
                job_title: form.job_title.trim(),
                short_bio: form.short_bio.trim(),
                require_password_reset: selectedStaff.require_password_reset ?? false,
            };

            const res = await axios.put(`${API_BASE}/users/${selectedStaff.id}`, payload);
            const updatedUser = res.data?.user || {
                ...selectedStaff,
                ...payload,
            };
            updateLocalStaff(updatedUser);
            setEditMode(false);
        } catch (error) {
            setModalError(error.response?.data?.error || 'Failed to save profile changes.');
        } finally {
            setSaving(false);
        }
    };

    const handleAvatarUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file || !selectedStaff) return;

        setUploadingAvatar(true);
        setModalError('');
        try {
            const formData = new FormData();
            formData.append('avatar', file);
            formData.append('targetUserId', String(selectedStaff.id));

            const res = await axios.post(`${API_BASE}/upload-avatar`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            updateLocalStaff({
                ...selectedStaff,
                profile_picture_url: res.data?.url,
            });
        } catch (error) {
            setModalError(error.response?.data?.error || 'Failed to upload profile picture.');
        } finally {
            setUploadingAvatar(false);
            event.target.value = '';
        }
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
                                    {person.identity?.displayTitle || person.job_title || person.role_code}
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                    {person.identity?.department || person.department || 'MMPZ'}
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
                                    <span className="badge badge-info">System access: {person.system_role}</span>
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
                                            <span className="badge badge-info">System access: {selectedStaff.system_role}</span>
                                            {selectedStaff.system_role === 'SUPER_ADMIN' && (
                                                <span className="badge badge-primary">
                                                    <Shield size={12} style={{ marginRight: '4px' }} /> Super Admin
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {modalError && (
                                        <div className="auth-error" style={{ margin: 0 }}>
                                            {modalError}
                                        </div>
                                    )}

                                    <div className="surface-muted">
                                        <div className="control-title">
                                            {editMode ? (
                                                <input
                                                    className="form-input"
                                                    value={form.job_title}
                                                    onChange={(event) => setForm((current) => ({ ...current, job_title: event.target.value }))}
                                                />
                                            ) : (
                                                selectedStaff.identity?.displayTitle || selectedStaff.job_title || selectedStaff.role_code
                                            )}
                                        </div>
                                        <div className="control-copy">
                                            {selectedStaff.identity?.department || selectedStaff.department || 'MMPZ'} - Member since {new Date(selectedStaff.created_at).getFullYear()}
                                        </div>
                                    </div>

                                    <div className="surface-muted">
                                        <div className="control-title">Short Bio</div>
                                        <div className="control-copy">
                                            {editMode ? (
                                                <textarea
                                                    className="form-textarea"
                                                    value={form.short_bio}
                                                    onChange={(event) => setForm((current) => ({ ...current, short_bio: event.target.value }))}
                                                    placeholder="Add a public-facing staff bio"
                                                />
                                            ) : (
                                                selectedStaff.short_bio || 'This staff member has not added a public bio yet.'
                                            )}
                                        </div>
                                    </div>

                                    <div className="surface-muted">
                                        <div className="control-title">Contact</div>
                                        <div className="control-copy" style={{ display: 'grid', gap: '6px', marginTop: '8px' }}>
                                            {editMode ? (
                                                <>
                                                    <label className="form-label">Full name</label>
                                                    <input
                                                        className="form-input"
                                                        value={form.name}
                                                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                                                    />
                                                    <label className="form-label">Email</label>
                                                    <input
                                                        type="email"
                                                        className="form-input"
                                                        value={form.email}
                                                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                                                    />
                                                    <label className="form-label">Phone</label>
                                                    <input
                                                        className="form-input"
                                                        value={form.phone}
                                                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                                                        placeholder="+263..."
                                                    />
                                                </>
                                            ) : (
                                                <>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                        <Mail size={14} /> {selectedStaff.email}
                                                    </span>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                        <Phone size={14} /> {selectedStaff.phone || 'No phone listed'}
                                                    </span>
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                        <Users size={14} /> Assignment status: {selectedStaff.role_assignment_status}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div className="modal-footer">
                            {canManageDirectoryProfiles && (
                                <>
                                    {editMode ? (
                                        <>
                                            <label className="btn btn-secondary" style={{ marginRight: 'auto', cursor: uploadingAvatar ? 'wait' : 'pointer' }}>
                                                <ImagePlus size={14} /> {uploadingAvatar ? 'Uploading...' : 'Upload Picture'}
                                                <input
                                                    type="file"
                                                    accept="image/png,image/jpeg,image/webp"
                                                    style={{ display: 'none' }}
                                                    onChange={handleAvatarUpload}
                                                    disabled={uploadingAvatar}
                                                />
                                            </label>
                                            <button className="btn btn-ghost" onClick={() => setEditMode(false)} disabled={saving}>
                                                <X size={14} /> Cancel Edit
                                            </button>
                                            <button className="btn btn-primary" onClick={handleSaveProfile} disabled={saving}>
                                                <Save size={14} /> {saving ? 'Saving...' : 'Save Profile'}
                                            </button>
                                        </>
                                    ) : (
                                        <button className="btn btn-primary" onClick={() => setEditMode(true)}>
                                            <Edit2 size={14} /> Edit Profile
                                        </button>
                                    )}
                                </>
                            )}
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
