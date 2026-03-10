import React, { useState } from 'react';
import PageHeader from '../../components/PageHeader';
import { Contact, Search, MapPin, Mail, Phone } from 'lucide-react';

export default function StaffDirectoryPage() {
    const [search, setSearch] = useState('');

    const staffDummy = [
        { id: 1, name: 'Tinashe Moyo', role: 'Director', dept: 'Executive', location: 'Harare HQ' },
        { id: 2, name: 'Chipo Ndlovu', role: 'Finance Officer', dept: 'Finance & Admin', location: 'Bulawayo' },
        { id: 3, name: 'Brian Sam', role: 'IT Administrator', dept: 'System', location: 'Harare HQ' },
    ];

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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '20px' }}>
                {staffDummy.map(staff => (
                    <div key={staff.id} className="panel" style={{ padding: '20px', cursor: 'pointer', transition: 'transform 0.2s', ':hover': { transform: 'translateY(-2px)' } }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 600, color: 'var(--text-primary)' }}>
                                {staff.name.charAt(0)}
                            </div>
                            <div>
                                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' }}>{staff.name}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{staff.role}</div>
                            </div>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><Contact size={12} /> {staff.dept}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><MapPin size={12} /> {staff.location}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
