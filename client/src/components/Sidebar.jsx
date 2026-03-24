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

/* ── Role-based nav visibility ── */
const NAV_ITEMS = [
    {
        group: 'Executive',
        items: [
            { to: '/dashboard', label: 'Executive Dashboard', icon: LayoutDashboard, roles: ['DIRECTOR'] },
            { to: '/analytics', label: 'Advanced Analytics', icon: LineChart, roles: ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ME_INTERN_ACTING_OFFICER'] },
        ],
    },
    {
        group: 'Programs',
        items: [
            { to: '/programs', label: 'Programs', icon: FolderKanban, roles: ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ADMIN_ASSISTANT', 'PSYCHOSOCIAL_SUPPORT_OFFICER', 'COMMUNITY_DEVELOPMENT_OFFICER', 'ME_INTERN_ACTING_OFFICER', 'LOGISTICS_ASSISTANT'] },
            { to: '/facilitators', label: 'Development Facilitators', icon: Users, roles: ['DIRECTOR', 'ADMIN_ASSISTANT', 'COMMUNITY_DEVELOPMENT_OFFICER', 'PSYCHOSOCIAL_SUPPORT_OFFICER'] },
            { to: '/me', label: 'Monitoring & Evaluation', icon: BarChart3, roles: ['DIRECTOR', 'ME_INTERN_ACTING_OFFICER', 'COMMUNITY_DEVELOPMENT_OFFICER', 'PSYCHOSOCIAL_SUPPORT_OFFICER', 'SOCIAL_SERVICES_INTERN', 'FINANCE_ADMIN_OFFICER'] },
            { to: '/finance', label: 'Finance & Administration', icon: DollarSign, roles: ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'LOGISTICS_ASSISTANT'] },
        ],
    },
    {
        group: 'Governance',
        items: [
            { to: '/governance', label: 'Governance & Approvals', icon: ShieldCheck, roles: ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ADMIN_ASSISTANT', 'ME_INTERN_ACTING_OFFICER'] },
            { to: '/reports', label: 'Reports', icon: FileText, roles: ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ME_INTERN_ACTING_OFFICER', 'ADMIN_ASSISTANT'] },
        ],
    },
    {
        group: 'System',
        items: [
            { to: '/settings', label: 'Settings', icon: Settings, roles: ['DIRECTOR', 'ADMIN_ASSISTANT'] },
            { to: '/users', label: 'User Management', icon: Users, roles: ['DIRECTOR'] },
        ],
    },
    {
        group: 'Workspace (Intranet)',
        items: [
            { to: '/intranet/dashboard', label: 'Announcements', icon: Radio, roles: ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ADMIN_ASSISTANT', 'LOGISTICS_ASSISTANT', 'PSYCHOSOCIAL_SUPPORT_OFFICER', 'COMMUNITY_DEVELOPMENT_OFFICER', 'ME_INTERN_ACTING_OFFICER', 'SOCIAL_SERVICES_INTERN', 'YOUTH_COMMUNICATIONS_INTERN', 'DEVELOPMENT_FACILITATOR'] },
            { to: '/intranet/directory', label: 'Staff Directory', icon: Contact, roles: ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ADMIN_ASSISTANT', 'LOGISTICS_ASSISTANT', 'PSYCHOSOCIAL_SUPPORT_OFFICER', 'COMMUNITY_DEVELOPMENT_OFFICER', 'ME_INTERN_ACTING_OFFICER', 'SOCIAL_SERVICES_INTERN', 'YOUTH_COMMUNICATIONS_INTERN', 'DEVELOPMENT_FACILITATOR'] },
            { to: '/intranet/documents', label: 'Document Library', icon: BookOpen, roles: ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ADMIN_ASSISTANT', 'LOGISTICS_ASSISTANT', 'PSYCHOSOCIAL_SUPPORT_OFFICER', 'COMMUNITY_DEVELOPMENT_OFFICER', 'ME_INTERN_ACTING_OFFICER', 'SOCIAL_SERVICES_INTERN', 'YOUTH_COMMUNICATIONS_INTERN', 'DEVELOPMENT_FACILITATOR'] },
            { to: '/intranet/calendar', label: 'Organization Calendar', icon: Calendar, roles: ['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ADMIN_ASSISTANT', 'LOGISTICS_ASSISTANT', 'PSYCHOSOCIAL_SUPPORT_OFFICER', 'COMMUNITY_DEVELOPMENT_OFFICER', 'ME_INTERN_ACTING_OFFICER', 'SOCIAL_SERVICES_INTERN', 'YOUTH_COMMUNICATIONS_INTERN', 'DEVELOPMENT_FACILITATOR'] },
        ],
    },
];

/* Facilitator portal link shown only for that role */
const FACILITATOR_NAV = [
    {
        group: 'My Work', items: [
            { to: '/my-portal', label: 'My Portal', icon: LayoutDashboard, roles: ['DEVELOPMENT_FACILITATOR', 'SOCIAL_SERVICES_INTERN', 'YOUTH_COMMUNICATIONS_INTERN'] },
        ]
    },
];

export default function Sidebar({ pendingCount }) {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const role = user?.role_code || '';
    const initial = (user?.name || 'U')[0].toUpperCase();

    // Determine which nav groups to show
    const navGroups = role === 'DEVELOPMENT_FACILITATOR' || role === 'SOCIAL_SERVICES_INTERN' || role === 'YOUTH_COMMUNICATIONS_INTERN'
        ? FACILITATOR_NAV
        : NAV_ITEMS;

    const filtered = navGroups.map(group => ({
        ...group,
        items: group.items.filter(item => item.roles.includes(role)),
    })).filter(group => group.items.length > 0);

    const doLogout = () => {
        logout();
        navigate('/login');
    };

    const roleLabel = (code) => {
        const map = {
            DIRECTOR: 'Director',
            FINANCE_ADMIN_OFFICER: 'Finance & Admin Officer',
            ADMIN_ASSISTANT: 'Admin Assistant',
            LOGISTICS_ASSISTANT: 'Logistics Assistant',
            PSYCHOSOCIAL_SUPPORT_OFFICER: 'PSS Officer',
            COMMUNITY_DEVELOPMENT_OFFICER: 'CD Officer',
            ME_INTERN_ACTING_OFFICER: 'M&E Officer',
            SOCIAL_SERVICES_INTERN: 'Social Services Intern',
            YOUTH_COMMUNICATIONS_INTERN: 'Youth & Comms Intern',
            DEVELOPMENT_FACILITATOR: 'Development Facilitator',
        };
        return map[code] || code;
    };

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
                        <div className="sidebar-user-role">{roleLabel(role)}</div>
                    </div>
                    <LogOut size={15} style={{ color: '#EF4444', flexShrink: 0, opacity: 0.7 }} />
                </div>
            </div>
        </aside>
    );
}
