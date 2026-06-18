import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppShell from './components/AppShell';
import { canAccessRole, getDefaultRouteForUser } from './accessControl';
import { getAllowedRolesForPath } from './navigationConfig';

// Pages
import LoginPage from './pages/LoginPage';
import ForcePasswordResetPage from './pages/ForcePasswordResetPage';
import ExecutiveDashboardPage from './pages/ExecutiveDashboardPage';
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage';
import ProgramLifecyclePage from './pages/ProgramLifecyclePage';
import ProgramsPage from './pages/ProgramsPage';
import FacilitatorsPage from './pages/FacilitatorsPage';
import MonitoringEvaluationPage from './pages/MonitoringEvaluationPage';
import FinanceAdminPage from './pages/FinanceAdminPage';
import BudgetTrackerPage from './pages/BudgetTrackerPage';
import GovernanceApprovalsPage from './pages/GovernanceApprovalsPage';
import GovernanceCompliancePage from './pages/GovernanceCompliancePage';
import InstitutionalCompliancePage from './pages/InstitutionalCompliancePage';
import AdminFinanceDashboardPage from './pages/AdminFinanceDashboardPage';
import OperationalLogisticsDashboardPage from './pages/OperationalLogisticsDashboardPage';
import InventoryOperationsPage from './pages/InventoryOperationsPage';
import AssetManagementPage from './pages/AssetManagementPage';
import ChallengeCourseOperationsPage from './pages/ChallengeCourseOperationsPage';
import ExecutiveWorkspacePage from './pages/ExecutiveWorkspacePage';
import ReportsPage from './pages/ReportsPage';
import SettingsPage from './pages/SettingsPage';
import UserManagementPage from './pages/UserManagementPage';
import MyPortalPage from './pages/MyPortalPage';
import StaffSubmissionsPage from './pages/StaffSubmissionsPage';
import FinanceVaultPage from './pages/FinanceVaultPage';
import FundingRequestWizardPage from './pages/FundingRequestWizardPage';

// Intranet
import IntranetDashboardPage from './pages/intranet/IntranetDashboardPage.jsx';
import StaffDirectoryPage from './pages/intranet/StaffDirectoryPage.jsx';
import DocumentLibraryPage from './pages/intranet/DocumentLibraryPage.jsx';
import CalendarPage from './pages/intranet/CalendarPage.jsx';

const ProtectedRoute = ({ children, allowedRoles }) => {
    const { user, loading } = useAuth();

    if (loading) return <div>Loading...</div>;
    if (!user) return <Navigate to="/login" replace />;
    
    // Force password reset if required
    if (user.require_password_reset && window.location.pathname !== '/force-password-reset') {
        return <Navigate to="/force-password-reset" replace />;
    }

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
            <Route path="/force-password-reset" element={<ForcePasswordResetPage />} />

            <Route element={
                <ProtectedRoute>
                    <AppShell key={sessionKey || user?.id || 'anonymous-session'} />
                </ProtectedRoute>
            }>
                <Route path="/" element={<Navigate to={getDefaultRouteForUser(user)} replace />} />
                <Route path="/dashboard" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/dashboard')}><ExecutiveDashboardPage /></ProtectedRoute>} />
                <Route path="/analytics" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/analytics')}><AnalyticsDashboardPage /></ProtectedRoute>} />
                <Route path="/lifecycle" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/lifecycle')}><ProgramLifecyclePage /></ProtectedRoute>} />
                <Route path="/programs" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/programs')}><ProgramsPage /></ProtectedRoute>} />
                <Route path="/facilitators" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/facilitators')}><FacilitatorsPage /></ProtectedRoute>} />
                <Route path="/me" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/me')}><MonitoringEvaluationPage /></ProtectedRoute>} />
                <Route path="/finance" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/finance')}><FinanceAdminPage /></ProtectedRoute>} />
                <Route path="/budget" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/budget')}><BudgetTrackerPage /></ProtectedRoute>} />
                <Route path="/governance" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance')}><GovernanceApprovalsPage /></ProtectedRoute>} />
                
                {/* Governance & Compliance Tabbed Routes */}
                <Route path="/governance/safeguarding" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance/safeguarding')}><GovernanceCompliancePage activeTab="safeguarding" /></ProtectedRoute>} />
                <Route path="/governance/volunteers" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance/volunteers')}><GovernanceCompliancePage activeTab="volunteers" /></ProtectedRoute>} />
                <Route path="/governance/donors" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance/donors')}><GovernanceCompliancePage activeTab="donors" /></ProtectedRoute>} />
                <Route path="/governance/grants" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance/grants')}><GovernanceCompliancePage activeTab="grants" /></ProtectedRoute>} />
                <Route path="/governance/supervision" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance/supervision')}><GovernanceCompliancePage activeTab="supervision" /></ProtectedRoute>} />
                <Route path="/governance/knowledge-hub" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance/knowledge-hub')}><GovernanceCompliancePage activeTab="knowledge-hub" /></ProtectedRoute>} />
                <Route path="/governance/referrals" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance/referrals')}><GovernanceCompliancePage activeTab="referrals" /></ProtectedRoute>} />
                <Route path="/governance/performance" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance/performance')}><GovernanceCompliancePage activeTab="performance" /></ProtectedRoute>} />
                <Route path="/governance/institutional" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance/institutional')}><InstitutionalCompliancePage /></ProtectedRoute>} />
                <Route path="/governance/confidential" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/governance/confidential')}><ExecutiveWorkspacePage /></ProtectedRoute>} />

                {/* Operational Accountability Routes */}
                <Route path="/operations/admin-finance" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/operations/admin-finance')}><AdminFinanceDashboardPage /></ProtectedRoute>} />
                <Route path="/operations/logistics" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/operations/logistics')}><OperationalLogisticsDashboardPage /></ProtectedRoute>} />
                <Route path="/operations/inventory" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/operations/inventory')}><InventoryOperationsPage /></ProtectedRoute>} />
                <Route path="/operations/assets" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/operations/assets')}><AssetManagementPage /></ProtectedRoute>} />
                <Route path="/operations/challenge-course" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/operations/challenge-course')}><ChallengeCourseOperationsPage /></ProtectedRoute>} />

                <Route path="/reports" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/reports')}><ReportsPage /></ProtectedRoute>} />
                <Route path="/settings" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/settings')}><SettingsPage /></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/users')}><UserManagementPage /></ProtectedRoute>} />
                <Route path="/my-portal" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/my-portal')}><MyPortalPage /></ProtectedRoute>} />
                <Route path="/submissions" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/submissions')}><StaffSubmissionsPage /></ProtectedRoute>} />
                <Route path="/finance/vault" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/finance/vault')}><FinanceVaultPage /></ProtectedRoute>} />
                <Route path="/submissions/request-funds" element={<ProtectedRoute allowedRoles={getAllowedRolesForPath('/submissions')}><FundingRequestWizardPage /></ProtectedRoute>} />

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
