import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import axios from 'axios';
import API_BASE from '../apiConfig';
import { useAuth } from '../context/AuthContext';
import { canAccessRole } from '../accessControl';
import { getAllowedRolesForPath, getPageTitle } from '../navigationConfig';
import '../erp-shell.css';

export default function AppShell() {
    const { user } = useAuth();
    const location = useLocation();
    const [pendingCount, setPendingCount] = useState(0);
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Fetch count for sidebar badge
    useEffect(() => {
        const fetchCounts = async () => {
            if (!user?.id) return;
            if (!canAccessRole(user, getAllowedRolesForPath('/governance'))) {
                setPendingCount(0);
                return;
            }
            try {
                const res = await axios.get(`${API_BASE}/governance/queue`, {
                    params: { userId: user.id, countOnly: true }
                });
                setPendingCount(Number(res.data?.total || 0));
            } catch (err) {
                console.error('Failed to fetch governance queue count', err);
            }
        };
        fetchCounts();
    }, [location.pathname, user?.id]);

    useEffect(() => {
        setSidebarOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!sidebarOpen) return undefined;

        const previousOverflow = document.body.style.overflow;
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                setSidebarOpen(false);
            }
        };

        document.body.style.overflow = 'hidden';
        document.addEventListener('keydown', handleKeyDown);

        return () => {
            document.body.style.overflow = previousOverflow;
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [sidebarOpen]);

    return (
        <div className={`erp-shell${sidebarOpen ? ' sidebar-open' : ''}`}>
            {/* Animated Background Elements */}
            <div className="erp-bg-effects">
                <div className="glow-1"></div>
                <div className="glow-2"></div>
                <div className="glow-3"></div>
            </div>

            <button
                className={`erp-sidebar-scrim${sidebarOpen ? ' visible' : ''}`}
                onClick={() => setSidebarOpen(false)}
                aria-label="Close navigation menu"
            />
            <Sidebar
                pendingCount={pendingCount}
                mobileOpen={sidebarOpen}
                onNavigate={() => setSidebarOpen(false)}
            />
            <div className="erp-main">
                <TopBar
                    title={getPageTitle(location.pathname)}
                    onToggleMenu={() => setSidebarOpen((current) => !current)}
                    mobileMenuOpen={sidebarOpen}
                />
                <main className="erp-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
