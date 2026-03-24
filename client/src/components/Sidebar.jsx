import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import API_BASE from '../apiConfig';
import {
    LayoutDashboard, FolderKanban, Users, BarChart3,
    DollarSign, ShieldCheck, FileText, Settings,
    Bell, LogOut, Menu, X, ChevronRight,
    Sun, Moon, Radio, Contact, BookOpen, Calendar, LineChart
} from 'lucide-react';

/* ── Role-based nav visibility (SYSTEM ROLES) ── */
const NAV_ITEMS = [
    {
        group: 'Executive',
        items: [
            { to: '/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT'] },
            { to: '/analytics', label: 'Advanced Analytics', icon: LineChart, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'PROGRAM_STAFF'] },
        ],
    },
    {
        group: 'Programs',
        items: [
            { to: '/programs', label: 'Programs', icon: FolderKanban, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'PROGRAM_STAFF', 'OPERATIONS', 'INTERN'] },
            { to: '/facilitators', label: 'Development Facilitators', icon: Users, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'PROGRAM_STAFF'] },
            { to: '/me', label: 'Monitoring & Evaluation', icon: BarChart3, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'PROGRAM_STAFF', 'INTERN'] },
            { to: '/finance', label: 'Finance & Administration', icon: DollarSign, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'PROGRAM_STAFF', 'OPERATIONS'] },
        ],
    },
    {
        group: 'Governance',
        items: [
            { to: '/governance', label: 'Governance & Approvals', icon: ShieldCheck, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'PROGRAM_STAFF'] },
            { to: '/reports', label: 'Reports', icon: FileText, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'PROGRAM_STAFF', 'INTERN'] },
        ],
    },
    {
        group: 'System',
        items: [
            { to: '/settings', label: 'Settings', icon: Settings, systemRoles: ['SUPER_ADMIN'] },
            { to: '/users', label: 'User Management', icon: Users, systemRoles: ['SUPER_ADMIN'] },
        ],
    },
    {
        group: 'Workspace (Intranet)',
        items: [
            { to: '/intranet/dashboard', label: 'Announcements', icon: Radio, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'PROGRAM_STAFF', 'OPERATIONS', 'INTERN', 'FACILITATOR'] },
            { to: '/intranet/directory', label: 'Staff Directory', icon: Contact, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'PROGRAM_STAFF', 'OPERATIONS', 'INTERN', 'FACILITATOR'] },
            { to: '/intranet/documents', label: 'Document Library', icon: BookOpen, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'PROGRAM_STAFF', 'OPERATIONS', 'INTERN', 'FACILITATOR'] },
            { to: '/intranet/calendar', label: 'Organization Calendar', icon: Calendar, systemRoles: ['SUPER_ADMIN', 'MANAGEMENT', 'PROGRAM_STAFF', 'OPERATIONS', 'INTERN', 'FACILITATOR'] },
        ],
    },
];

/* Facilitator portal link shown only for that role */
const FACILITATOR_NAV = [
    {
        group: 'My Work', items: [
            { to: '/my-portal', label: 'My Portal', icon: LayoutDashboard, systemRoles: ['FACILITATOR', 'INTERN'] },
        ]
    },
];

export default function Sidebar({ pendingCount }) {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const systemRole = user?.system_role || 'INTERN';
    const initial = (user?.name || 'U')[0].toUpperCase();

    // Determine which nav groups to show based on system role
    const navGroups = systemRole === 'FACILITATOR' || systemRole === 'INTERN'
        ? FACILITATOR_NAV
        : NAV_ITEMS;

    const filtered = navGroups.map(group => ({
        ...group,
        items: group.items.filter(item => item.systemRoles.includes(systemRole)),
    })).filter(group => group.items.length > 0);

    const doLogout = () => {
        logout();
        navigate('/login');
    };

    const roleDisplay = user?.job_title || (systemRole === 'SUPER_ADMIN' ? 'System Admin' : systemRole);

    return (
        <aside className="erp-sidebar">
            {/* Brand */}
            <div className="sidebar-brand">
                <div className="sidebar-brand-logo">
                    <img src="/mmpz-logo.png" alt="MMPZ Logo" />
                </div>
                <div className="sidebar-brand-text">
                    <div className="sidebar-brand-title" style={{ fontFamily: 'var(--font-heading)', letterSpacing: '0.02em' }}>MMPZ ERP</div>
                    <div className="sidebar-brand-sub" style={{ fontSize: '9px', letterSpacing: '0.1em' }}>PLATFORM</div>
                </div>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {filtered.map(group => (
                    <div key={group.group}>
                        <div className="sidebar-nav-label">{group.group}</div>
                        {group.items.map(item => {
                            const Icon = item.icon;
                            const isApprovals = item.to === '/governance';
                            return (
                                <NavLink
                                    key={item.to}
                                    to={item.to}
                                    className={({ isActive }) =>
                                        `sidebar-nav-item${isActive ? ' active' : ''}`
                                    }
                                >
                                    <Icon className="sidebar-nav-icon" size={18} />
                                    <span>{item.label}</span>
                                    {isApprovals && pendingCount > 0 && (
                                        <span className="sidebar-nav-badge">{pendingCount > 99 ? '99+' : pendingCount}</span>
                                    )}
                                </NavLink>
                            );
                        })}
                    </div>
                ))}
            </nav>

            {/* Footer / User */}
            <div className="sidebar-footer" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="sidebar-actions" style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
                    <button
                        className="topbar-btn"
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                        style={{ width: '100%', borderRadius: '10px' }}
                    >
                        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                        <span style={{ marginLeft: '8px', fontSize: '11px', fontWeight: 600 }}>
                            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                        </span>
                    </button>
                </div>

                <div
                    className="sidebar-user"
                    onClick={doLogout}
                    role="button"
                    aria-label="Sign out"
                    title="Sign out"
                    style={{ cursor: 'pointer' }}
                >
                    <div className="sidebar-user-avatar">{initial}</div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user?.name}</div>
                        <div className="sidebar-user-role">{roleDisplay}</div>
                    </div>
                    <LogOut size={15} style={{ color: '#EF4444', flexShrink: 0, opacity: 0.7 }} />
                </div>
            </div>
        </aside>
    );
}
