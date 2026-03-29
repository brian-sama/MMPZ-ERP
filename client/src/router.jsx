import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import { canAccessRole, getDefaultRouteForUser } from './accessControl';
import { getAllowedRolesForPath } from './navigationConfig';

// Lazy loading placeholders for now
import LoginPage from './pages/LoginPage';
import ExecutiveDashboardPage from './pages/ExecutiveDashboardPage';
import ProgramsPage from './pages/ProgramsPage';
import FacilitatorsPage from './pages/FacilitatorsPage';
import MonitoringEvaluationPage from './pages/MonitoringEvaluationPage';
import FinanceAdminPage from './pages/FinanceAdminPage';
import GovernanceApprovalsPage from './pages/GovernanceApprovalsPage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import MyPortalPage from './pages/MyPortalPage';
import UserManagementPage from './pages/UserManagementPage';
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage';

// Intranet Placeholders
import IntranetDashboardPage from './pages/intranet/IntranetDashboardPage.jsx';
import StaffDirectoryPage from './pages/intranet/StaffDirectoryPage.jsx';
import DocumentLibraryPage from './pages/intranet/DocumentLibraryPage.jsx';
import CalendarPage from './pages/intranet/CalendarPage.jsx';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();

    if (loading) return <div>Loading...</div>;
    if (!user) return <Navigate to="/login" replace />;

    if (!canAccessRole(user, allowedRoles)) {
        return <Navigate to={getDefaultRouteForUser(user)} replace />;
    }

    return children;
}

export default function AppRouter() {
    const { user, sessionKey } = useAuth();

    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={
                <ProtectedRoute>
                    <AppShell key={sessionKey || user?.id || 'anonymous-session'} />
                </ProtectedRoute>
            }>
                <Route path="/" element={<Navigate to={getDefaultRouteForUser(user)} replace />} />
                <Route path="/dashboard" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/dashboard')}><ExecutiveDashboardPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/analytics')}><AnalyticsDashboardPage /></ProtectedRoute>} />
                <Route path="/programs" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/programs')}><ProgramsPage /></ProtectedRoute>} />
                <Route path="/facilitators" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/facilitators')}><FacilitatorsPage /></ProtectedRoute>} />
                <Route path="/me" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/me')}><MonitoringEvaluationPage /></ProtectedRoute>} />
                <Route path="/finance" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/finance')}><FinanceAdminPage /></ProtectedRoute>} />
                <Route path="/governance" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance')}><GovernanceApprovalsPage /></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/reports')}><ReportsPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/settings')}><SettingsPage /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/users')}><UserManagementPage /></ProtectedRoute>} />
                <Route path="/my-portal" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/my-portal')}><MyPortalPage /></ProtectedRoute>} />

                {/* Intranet Routes (All roles can access) */}
                <Route path="/intranet/dashboard" element={<ProtectedRoute><IntranetDashboardPage /></ProtectedRoute>} />
                <Route path="/intranet/directory" element={<ProtectedRoute><StaffDirectoryPage /></ProtectedRoute>} />
                <Route path="/intranet/documents" element={<ProtectedRoute><DocumentLibraryPage /></ProtectedRoute>} />
                <Route path="/intranet/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
    );
}
