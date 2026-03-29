import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { LogOut, User } from 'lucide-react';
import axios from 'axios';
import API_BASE from '../apiConfig';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { formatRoleLabel } from '../accessControl';
import { getNavigationForUser, isGovernanceRoute } from '../navigationConfig';

export default function Sidebar({ pendingCount }) {
    const { user, updateUserProfile, logout } = useAuth();
    const { theme } = useTheme();
    const navigate = useNavigate();
    const [updating, setUpdating] = React.useState(false);
    
    const initial = (user?.name || 'U')[0].toUpperCase();
    const navGroups = getNavigationForUser(user);
    const roleDisplay = user?.job_title || formatRoleLabel(user?.role_code);

    const doLogout = () => {
        logout();
        navigate('/login');
    };

    const updateAvatar = async () => {
        const url = window.prompt("Enter Profile Picture URL:", user?.profile_picture_url || "");
        if (url === null) return; // Cancelled

        setUpdating(true);
        try {
            const res = await axios.patch(`${API_BASE}/me/profile`, { profile_picture_url: url });
            updateUserProfile({ profile_picture_url: url });
        } catch (err) {
            alert("Failed to update profile picture");
        } finally {
            setUpdating(false);
        }
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
                <div
                    className="sidebar-user"
                    role="button"
                    aria-label="User Profile"
                    title="Update Profile Picture"
                    onClick={updateAvatar}
                    style={{ cursor: updating ? 'wait' : 'pointer' }}
                >
                    {user?.profile_picture_url ? (
                        <div className="sidebar-avatar-container">
                            <img 
                                src={user.profile_picture_url} 
                                alt={user.name} 
                                className="sidebar-user-avatar" 
                            />
                            <div className="sidebar-avatar-overlay">Edit</div>
                        </div>
                    ) : (
                        <div className="sidebar-user-avatar">
                            {initial}
                            <div className="sidebar-avatar-overlay">Edit</div>
                        </div>
                    )}
                    <div className="sidebar-user-info">
                        <div className="sidebar-user-name">{user?.name}</div>
                        <div className="sidebar-user-role">{roleDisplay}</div>
                    </div>
                </div>
                
                <div 
                    className="sidebar-logout-wrapper"
                    onClick={doLogout}
                    role="button"
                    title="Sign out"
                >
                    <LogOut size={16} />
                    <span>Sign Out</span>
                </div>
            </div>
        </aside>
    );
}
