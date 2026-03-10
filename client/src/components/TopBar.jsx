import React, { useState, useRef, useEffect } from 'react';
import { Bell, Search, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function TopBar({ title }) {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef(null);
    const notifRef = useRef(null);

    // Close dropdowns on outside click
    useEffect(() => {
        const handler = (e) => {
            if (notifRef.current && !notifRef.current.contains(e.target)) {
                setShowNotifications(false);
            }
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowSearch(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const doLogout = () => {
        logout();
        navigate('/login');
    };

    const navLinks = [
        { label: 'Executive Dashboard', path: '/dashboard' },
        { label: 'Programs', path: '/programs' },
        { label: 'Development Facilitators', path: '/facilitators' },
        { label: 'Monitoring & Evaluation', path: '/me' },
        { label: 'Finance & Administration', path: '/finance' },
        { label: 'Governance & Approvals', path: '/governance' },
        { label: 'Reports', path: '/reports' },
        { label: 'Settings', path: '/settings' },
        { label: 'User Management', path: '/users' },
    ];

    const filteredLinks = searchQuery.length > 0
        ? navLinks.filter(l => l.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : [];

    const sampleNotifications = [
        { text: 'New expense request submitted', time: '5 min ago', unread: true },
        { text: 'Program report is ready to review', time: '1 hour ago', unread: true },
        { text: 'T. Moyo completed field assignment', time: '3 hours ago', unread: false },
    ];

    return (
        <header className="erp-topbar">
            <div className="topbar-title">{title}</div>

            <div className="topbar-actions">
                {/* Search */}
                <div style={{ position: 'relative' }} ref={searchRef}>
                    <button
                        className="topbar-btn"
                        title="Search"
                        onClick={() => { setShowSearch(s => !s); setShowNotifications(false); }}
                    >
                        <Search size={17} />
                    </button>

                    {showSearch && (
                        <div style={{
                            position: 'absolute', top: '44px', right: 0,
                            width: '300px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--card-shadow)',
                            zIndex: 200,
                            overflow: 'hidden',
                        }}>
                            <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search pages..."
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    style={{
                                        flex: 1, background: 'none', border: 'none', outline: 'none',
                                        color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit',
                                    }}
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 0 }}>
                                        <X size={13} />
                                    </button>
                                )}
                            </div>
                            {filteredLinks.length > 0 ? (
                                <div style={{ padding: '6px' }}>
                                    {filteredLinks.map(link => (
                                        <button
                                            key={link.path}
                                            onClick={() => { navigate(link.path); setShowSearch(false); setSearchQuery(''); }}
                                            style={{
                                                width: '100%', textAlign: 'left', padding: '9px 12px',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: 'var(--text-primary)', fontSize: '13px',
                                                borderRadius: 'var(--radius-md)', fontFamily: 'inherit',
                                                display: 'flex', alignItems: 'center', gap: '8px',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                        >
                                            {link.label}
                                        </button>
                                    ))}
                                </div>
                            ) : searchQuery.length > 0 ? (
                                <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>No results found</div>
                            ) : (
                                <div style={{ padding: '12px 16px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Pages</div>
                                    {navLinks.map(link => (
                                        <button
                                            key={link.path}
                                            onClick={() => { navigate(link.path); setShowSearch(false); }}
                                            style={{
                                                width: '100%', textAlign: 'left', padding: '8px 10px',
                                                background: 'none', border: 'none', cursor: 'pointer',
                                                color: 'var(--text-secondary)', fontSize: '13px',
                                                borderRadius: 'var(--radius-md)', fontFamily: 'inherit',
                                            }}
                                            onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                                            onMouseLeave={e => e.currentTarget.style.background = 'none'}
                                        >
                                            {link.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Notifications */}
                <div style={{ position: 'relative' }} ref={notifRef}>
                    <button
                        className="topbar-btn"
                        title="Notifications"
                        onClick={() => { setShowNotifications(s => !s); setShowSearch(false); }}
                    >
                        <Bell size={17} />
                        <span className="topbar-badge">3</span>
                    </button>

                    {showNotifications && (
                        <div style={{
                            position: 'absolute', top: '44px', right: 0,
                            width: '300px',
                            background: 'var(--bg-surface)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-lg)',
                            boxShadow: 'var(--card-shadow)',
                            zIndex: 200,
                            overflow: 'hidden',
                        }}>
                            <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>Notifications</span>
                                <span style={{ fontSize: '11px', color: '#7B2CBF', fontWeight: 600, cursor: 'pointer' }}>Mark all read</span>
                            </div>
                            {sampleNotifications.map((n, i) => (
                                <div key={i} style={{
                                    padding: '12px 16px',
                                    borderBottom: i < sampleNotifications.length - 1 ? '1px solid var(--border)' : 'none',
                                    background: n.unread ? 'rgba(123,44,191,0.05)' : 'transparent',
                                    display: 'flex', gap: '10px', alignItems: 'flex-start',
                                }}>
                                    {n.unread && (
                                        <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#7B2CBF', marginTop: '5px', flexShrink: 0 }} />
                                    )}
                                    <div style={{ flex: 1, paddingLeft: n.unread ? 0 : '17px' }}>
                                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: n.unread ? 600 : 400 }}>{n.text}</div>
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>{n.time}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />

                {/* User avatar + logout */}
                <button
                    onClick={doLogout}
                    title="Sign out"
                    style={{
                        width: '32px', height: '32px', borderRadius: '50%',
                        background: 'linear-gradient(135deg, #7B2CBF, #5A189A)',
                        border: 'none', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '12px', fontWeight: 700, color: 'white',
                        fontFamily: 'inherit', flexShrink: 0,
                        transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '0.8'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '1'}
                >
                    {(user?.name || 'U')[0].toUpperCase()}
                </button>
            </div>
        </header>
    );
}
