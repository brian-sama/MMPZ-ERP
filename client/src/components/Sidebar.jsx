import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, Moon, Sun } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatRoleLabel } from '../accessControl';
import { getNavigationForUser, isGovernanceRoute } from '../navigationConfig';

export default function Sidebar({ pendingCount }) {
    const { user, logout } = useAuth();
    const { theme, toggleTheme } = useTheme();
    const navigate = useNavigate();
    const initial = (user?.name || 'U')[0].toUpperCase();
    const navGroups = getNavigationForUser(user);
    const roleDisplay = user?.job_title || formatRoleLabel(user?.role_code);

    const doLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <aside className="erp-sidebar">
            <div className="sidebar-brand">
                <div className="sidebar-brand-logo">
                    <img src="/mmpz-logo.png" alt="MMPZ Logo" />
                </div>
                <div className="sidebar-brand-text">
                    <div className="sidebar-brand-title">MMPZ ERP</div>
                    <div className="sidebar-brand-sub">Operations Platform</div>
                </div>
            </div>

            <nav className="sidebar-nav">
                {navGroups.map((group) => (
                    <div key={group.group}>
                        <div className="sidebar-nav-label">{group.group}</div>
                        {group.items.map((item) => {
                            const Icon = item.icon;
                            const isApprovals = isGovernanceRoute(item.to);
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
                                        <span className="sidebar-nav-badge">
                                            {pendingCount > 99 ? '99+' : pendingCount}
                                        </span>
                                    )}
                                </NavLink>
                            );
                        })}
                    </div>
                ))}
            </nav>

            <div className="sidebar-footer">
                <div className="sidebar-actions">
                    <button
                        className="topbar-btn sidebar-theme-toggle"
                        onClick={toggleTheme}
                        title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
                    >
                        {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
                        <span>{theme === 'dark' ? 'Light Mode' : 'Low-Light Mode'}</span>
                    </button>
                </div>

                <div
                    className="sidebar-user"
                    onClick={doLogout}
                    role="button"
                    aria-label="Sign out"
                    title="Sign out"
                >
                    <div className="sidebar-user-avatar">{initial}</div>
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user?.name}</div>
                        <div className="sidebar-user-role">{roleDisplay}</div>
                    </div>
                    <LogOut size={15} className="sidebar-user-logout" />
                </div>
            </div>
        </aside>
    );
}
