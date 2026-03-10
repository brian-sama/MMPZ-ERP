import React, { useState, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import axios from 'axios';
import API_BASE from '../apiConfig';
import { useAuth } from '../context/AuthContext';
import '../erp-shell.css';

export default function AppShell() {
    const { user } = useAuth();
    const location = useLocation();
    const [pendingCount, setPendingCount] = useState(0);

    // Fetch count for sidebar badge
    useEffect(() => {
        const fetchCounts = async () => {
            if (!user?.id) return;
            try {
                const res = await axios.get(`${API_BASE}/approvals`, {
                    params: { countOnly: true, userId: user.id }
                });
                setPendingCount(res.data.total || 0);
            } catch (err) {
                console.error('Failed to fetch approval counts', err);
            }
        };
        fetchCounts();
    }, [location.pathname, user?.id]);

    const getPageTitle = () => {
        const path = location.pathname;
        if (path === '/dashboard') return 'Executive Dashboard';
        if (path === '/programs') return 'Programs Module';
        if (path === '/facilitators') return 'Development Facilitators';
        if (path === '/me') return 'Monitoring & Evaluation';
        if (path === '/finance') return 'Finance & Administration';
        if (path === '/governance') return 'Governance & Approvals';
        if (path === '/reports') return 'System Reports';
        if (path === '/settings') return 'General Settings';
        return 'MMPZ ERP';
    };

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
                <TopBar title={getPageTitle()} />
                <main className="erp-content">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
