import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_BASE from '../../apiConfig';
import PageHeader from '../../components/PageHeader';
import { Contact, Search, MapPin, Mail, Phone, Shield } from 'lucide-react';

export default function StaffDirectoryPage() {
    const [search, setSearch] = useState('');
    const [staff, setStaff] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStaff();
    }, []);

    const fetchStaff = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${API_BASE}/users`);
            setStaff(res.data);
        } catch (err) {
            console.error('Failed to fetch staff');
        } finally {
            setLoading(false);
        }
    };

    const filteredStaff = staff.filter(s => 
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        (s.job_title || '').toLowerCase().includes(search.toLowerCase()) ||
        (s.email || '').toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="fade-in">
            <PageHeader
                title="Staff Directory"
                subtitle="Find and connect with colleagues across the organization"
            />

            <div className="panel" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-app)', padding: '10px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                    <Search size={16} style={{ color: 'var(--text-muted)' }} />
                    <input
                        type="text"
                        placeholder="Search by name, role, or department..."
                        style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', width: '100%' }}
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
            </div>

            {loading ? (
                <div className="page-loading"><div className="spinner"></div></div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                    {filteredStaff.map(s => (
                        <div key={s.id} className="panel hover-scale" style={{ padding: '20px', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                                <div style={{ 
                                    width: '48px', height: '48px', borderRadius: '50%', 
                                    background: 'var(--brand-primary-light)', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', 
                                    fontSize: '18px', fontWeight: 700, color: 'var(--brand-primary)' 
                                }}>
                                    {s.name.charAt(0)}
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        {s.name}
                                        {s.system_role === 'SUPER_ADMIN' && <Shield size={12} className="text-primary" />}
                                    </div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                        {s.job_title || s.role_code}
                                    </div>
                                </div>
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Mail size={13} /> {s.email}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Contact size={13} /> {s.system_role}
                                </div>
                                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '5px', fontSize: '10px', display: 'flex', justifyContent: 'space-between' }}>
                                    <span>Member since: {new Date(s.created_at).getFullYear()}</span>
                                    <span style={{ color: s.role_assignment_status === 'confirmed' ? 'var(--brand-success)' : 'var(--brand-warning)' }}>
                                        ● {s.role_assignment_status}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
