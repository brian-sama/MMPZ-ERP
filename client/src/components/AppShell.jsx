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
                    params: { userId: user.id }
                });
                setPendingCount((res.data || []).filter((item) => item.status === 'pending').length);
            } catch (err) {
                console.error('Failed to fetch approval counts', err);
            }
        };
        fetchCounts();
    }, [location.pathname, user?.id]);

    return (
        <div className="erp-shell">
            {/* Animated Background Elements */}
            <div className="erp-bg-effects">
                <div className="glow-1"></div>
                <div className="glow-2"></div>
                <div className="glow-3"></div>
            </div>

            <Sidebar pendingCount={pendingCount} />
            <div className="erp-main">
                <TopBar title={getPageTitle(location.pathname)} />
                <main className="erp-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
