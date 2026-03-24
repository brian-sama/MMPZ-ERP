import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';

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

    if (allowedRoles && !allowedRoles.includes(user.role_code)) {
        return <Navigate to="/" replace />;
    }

    return children;
}

export default function AppRouter() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={
                <ProtectedRoute>
                    <AppShell />
                </ProtectedRoute>
            }>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<ExecutiveDashboardPage />} />
                <Route path="/analytics" element={<ProtectedRoute allowedRoles={['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ME_INTERN_ACTING_OFFICER']}><AnalyticsDashboardPage /></ProtectedRoute>} />
                <Route path="/programs" element={<ProgramsPage />} />
                <Route path="/facilitators" element={<FacilitatorsPage />} />
                <Route path="/me" element={<MonitoringEvaluationPage />} />
                <Route path="/finance" element={<FinanceAdminPage />} />
                <Route path="/governance" element={<GovernanceApprovalsPage />} />
                <Route path="/reports" element={<ProtectedRoute allowedRoles={['DIRECTOR', 'FINANCE_ADMIN_OFFICER', 'ME_INTERN_ACTING_OFFICER', 'ADMIN_ASSISTANT']}><ReportsPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute allowedRoles={['DIRECTOR', 'ADMIN_ASSISTANT']}><SettingsPage /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute allowedRoles={['DIRECTOR']}><UserManagementPage /></ProtectedRoute>} />
                <Route path="/my-portal" element={<ProtectedRoute allowedRoles={['DEVELOPMENT_FACILITATOR', 'SOCIAL_SERVICES_INTERN', 'YOUTH_COMMUNICATIONS_INTERN']}><MyPortalPage /></ProtectedRoute>} />

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
