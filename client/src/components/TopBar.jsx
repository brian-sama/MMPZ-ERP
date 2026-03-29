import React, { useEffect, useRef, useState } from 'react';
import { Bell, Menu, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { getSearchableRoutes } from '../navigationConfig';

const formatTimeAgo = (value) => {
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return '';
    const deltaMs = Date.now() - timestamp;
    const minutes = Math.max(1, Math.round(deltaMs / 60000));
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
    const days = Math.round(hours / 24);
    if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;
    return new Date(value).toLocaleDateString();
};

export default function TopBar({ title, onToggleMenu, mobileMenuOpen }) {
    const { user, logout } = useAuth();
    const {
        notifications,
        unreadCount,
        permission,
        markRead,
        markAllRead,
        enableDesktopNotifications,
    } = useNotifications();
    const navigate = useNavigate();
    const [showNotifications, setShowNotifications] = useState(false);
    const [showSearch, setShowSearch] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const searchRef = useRef(null);
    const notifRef = useRef(null);

    useEffect(() => {
        const handler = (event) => {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
            if (searchRef.current && !searchRef.current.contains(event.target)) {
                setShowSearch(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const navLinks = getSearchableRoutes(user).map((item) => ({
        label: item.label,
        path: item.to,
    }));

    const filteredLinks = searchQuery.length > 0
        ? navLinks.filter((item) => item.label.toLowerCase().includes(searchQuery.toLowerCase()))
        : [];

    const doLogout = () => {
        logout();
        navigate('/login');
    };

    const handleNotificationClick = async (notification) => {
        if (!notification.is_read) {
            try {
                await markRead(notification.id);
            } catch (error) {
                console.error('Failed to mark notification as read', error);
            }
        }

        setShowNotifications(false);
        if (!notification.action_url) return;
        if (notification.action_url.startsWith('/uploads/')) {
            window.open(notification.action_url, '_blank', 'noopener,noreferrer');
            return;
        }
        if (notification.action_url.startsWith('/')) {
            navigate(notification.action_url);
            return;
        }
        window.open(notification.action_url, '_blank', 'noopener,noreferrer');
    };

    return (
        <header className="erp-topbar">
            <div className="topbar-leading">
                <button
                    className={`topbar-btn topbar-menu-btn${mobileMenuOpen ? ' active' : ''}`}
                    title={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
                    aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    onClick={onToggleMenu}
                >
                    <Menu size={18} />
                </button>
                <div className="topbar-title">{title}</div>
            </div>

            <div className="topbar-actions">
                <div style={{ position: 'relative' }} ref={searchRef}>
                    <button
                        className="topbar-btn"
                        title="Search"
                        onClick={() => {
                            setShowSearch((current) => !current);
                            setShowNotifications(false);
                        }}
                    >
                        <Search size={17} />
                    </button>

                    {showSearch && (
                        <div className="topbar-dropdown">
                            <div className="topbar-dropdown-search">
                                <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Search pages..."
                                    value={searchQuery}
                                    onChange={(event) => setSearchQuery(event.target.value)}
                                    style={{
                                        flex: 1,
                                        background: 'none',
                                        border: 'none',
                                        outline: 'none',
                                        color: 'var(--text-primary)',
                                        fontSize: '13px',
                                        fontFamily: 'inherit',
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        onClick={() => setSearchQuery('')}
                                        style={{
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--text-muted)',
                                            padding: 0,
                                        }}
                                    >
                                        <X size={13} />
                                    </button>
                                )}
                            </div>

                            {filteredLinks.length > 0 ? (
                                <div style={{ padding: '6px' }}>
                                    {filteredLinks.map((link) => (
                                        <button
                                            key={link.path}
                                            className="topbar-dropdown-item"
                                            onClick={() => {
                                                navigate(link.path);
                                                setShowSearch(false);
                                                setSearchQuery('');
                                            }}
                                        >
                                            {link.label}
                                        </button>
                                    ))}
                                </div>
                            ) : searchQuery.length > 0 ? (
                                <div className="topbar-empty">No results found</div>
                            ) : (
                                <div style={{ padding: '12px 16px' }}>
                                    <div className="topbar-dropdown-heading">Pages</div>
                                    {navLinks.map((link) => (
                                        <button
                                            key={link.path}
                                            className="topbar-dropdown-item"
                                            onClick={() => {
                                                navigate(link.path);
                                                setShowSearch(false);
                                            }}
                                        >
                                            {link.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div style={{ position: 'relative' }} ref={notifRef}>
                    <button
                        className="topbar-btn"
                        title="Notifications"
                        onClick={() => {
                            setShowNotifications((current) => !current);
                            setShowSearch(false);
                        }}
                    >
                        <Bell size={17} />
                        {unreadCount > 0 && (
                            <span className="topbar-badge">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>

                    {showNotifications && (
                        <div className="topbar-dropdown topbar-notifications">
                            <div className="topbar-dropdown-header">
                                <span style={{ fontWeight: 700, fontSize: '14px', color: 'var(--text-primary)' }}>
                                    Notifications
                                </span>
                                <button
                                    className="topbar-inline-action"
                                    onClick={markAllRead}
                                    disabled={notifications.length === 0}
                                >
                                    Mark all read
                                </button>
                            </div>

                            {permission !== 'granted' && permission !== 'unsupported' && (
                                <div className="topbar-dropdown-banner">
                                    <div>
                                        <div style={{ fontWeight: 700, marginBottom: '4px' }}>Browser alerts are off</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            Enable browser notifications for realtime alerts and 24-hour event reminders.
                                        </div>
                                    </div>
                                    <button className="btn btn-secondary btn-sm" onClick={enableDesktopNotifications}>
                                        Enable
                                    </button>
                                </div>
                            )}

                            {notifications.length > 0 ? (
                                <div className="topbar-notification-list">
                                    {notifications.map((item) => (
                                        <button
                                            key={item.id}
                                            className={`topbar-notification-item${item.is_read ? '' : ' unread'}`}
                                            onClick={() => handleNotificationClick(item)}
                                        >
                                            <div className="topbar-notification-title">{item.title}</div>
                                            <div className="topbar-notification-message">
                                                {item.message || 'New system update.'}
                                            </div>
                                            <div className="topbar-notification-time">
                                                {formatTimeAgo(item.created_at)}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            ) : (
                                <div className="topbar-empty">No notifications yet</div>
                            )}
                        </div>
                    )}
                </div>

                <div className="topbar-divider" />

                <button
                    onClick={doLogout}
                    title="Sign out"
                    className="topbar-avatar-btn"
                >
                    {(user?.name || 'U')[0].toUpperCase()}
                </button>
            </div>
        </header>
    );
}
