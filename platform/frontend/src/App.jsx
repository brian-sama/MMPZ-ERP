import { Navigate, Outlet, Route, Routes } from "react-router-dom";

import { LoginPage } from "./app/auth/LoginPage";
import { DashboardPage } from "./app/dashboard/DashboardPage";
import { AssetsPage } from "./app/erp/AssetsPage";
import { FinancePage } from "./app/erp/FinancePage";
import { InventoryPage } from "./app/erp/InventoryPage";
import { MembersPage } from "./app/erp/MembersPage";
import { ReportsPage } from "./app/erp/ReportsPage";
import { AnnouncementsPage } from "./app/intranet/AnnouncementsPage";
import { DirectoryPage } from "./app/intranet/DirectoryPage";
import { DocumentsPage } from "./app/intranet/DocumentsPage";
import { EventsPage } from "./app/intranet/EventsPage";
import { KnowledgeBasePage } from "./app/intranet/KnowledgeBasePage";
import { MessagingPage } from "./app/intranet/MessagingPage";
import { RolesPage } from "./app/administration/RolesPage";
import { SettingsPage } from "./app/administration/SettingsPage";
import { UsersPage } from "./app/administration/UsersPage";
import { PortalLayout } from "./components/layout/PortalLayout";
import { useAuth } from "./hooks/useAuth";
import { useCommandPalette } from "./hooks/useCommandPalette";
import { hasPermission } from "./utils/permissions";

const RequireAuth = ({ user }) => {
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
};

const RequirePermission = ({ user, permission }) => {
  if (!hasPermission(user, permission)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <Outlet />;
};

function App() {
  const { user, loading, login, logout } = useAuth();
  const { open, setOpen } = useCommandPalette();

  if (loading) {
    return <div className="grid min-h-screen place-items-center text-slate-700">Loading portal...</div>;
  }

  return (
    <Routes>
      <Route path="/login" element={<LoginPage user={user} onLogin={login} />} />
      <Route element={<RequireAuth user={user} />}>
        <Route
          element={
            <PortalLayout
              user={user}
              onLogout={logout}
              commandPaletteOpen={open}
              setCommandPaletteOpen={setOpen}
            />
          }
        >
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          <Route element={<RequirePermission user={user} permission="members.view" />}>
            <Route path="/erp/members" element={<MembersPage />} />
            <Route path="/erp/reports" element={<ReportsPage />} />
            <Route path="/intranet/announcements" element={<AnnouncementsPage />} />
            <Route path="/intranet/messaging" element={<MessagingPage />} />
            <Route path="/intranet/events" element={<EventsPage />} />
            <Route path="/intranet/directory" element={<DirectoryPage />} />
            <Route path="/intranet/knowledge-base" element={<KnowledgeBasePage />} />
          </Route>

          <Route element={<RequirePermission user={user} permission="finance.approve" />}>
            <Route path="/erp/finance" element={<FinancePage />} />
          </Route>

          <Route element={<RequirePermission user={user} permission="inventory.manage" />}>
            <Route path="/erp/assets" element={<AssetsPage />} />
            <Route path="/erp/inventory" element={<InventoryPage />} />
          </Route>

          <Route element={<RequirePermission user={user} permission="documents.upload" />}>
            <Route path="/intranet/documents" element={<DocumentsPage />} />
          </Route>

          <Route element={<RequirePermission user={user} permission="members.edit" />}>
            <Route path="/admin/users" element={<UsersPage />} />
            <Route path="/admin/roles" element={<RolesPage />} />
            <Route path="/admin/settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
