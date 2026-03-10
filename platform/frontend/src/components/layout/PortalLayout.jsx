import { Outlet } from "react-router-dom";

import { TopNavigation } from "./TopNavigation";
import { SidebarNavigation } from "./SidebarNavigation";
import { ActivityFeed } from "../widgets/ActivityFeed";
import { CommandPalette } from "../widgets/CommandPalette";
import { FloatingActions } from "../widgets/FloatingActions";
import { SmartNotifications } from "../widgets/SmartNotifications";

export const PortalLayout = ({ user, onLogout, commandPaletteOpen, setCommandPaletteOpen }) => {
  return (
    <div className="min-h-screen bg-gradient-to-b from-brand-50 via-slate-50 to-white">
      <TopNavigation
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onLogout={onLogout}
        user={user}
      />
      <div className="grid grid-cols-[280px_1fr]">
        <SidebarNavigation user={user} />
        <main className="relative space-y-6 p-6">
          <SmartNotifications />
          <Outlet context={{ user }} />
          <ActivityFeed />
        </main>
      </div>
      <FloatingActions user={user} />
      <CommandPalette user={user} open={commandPaletteOpen} onClose={() => setCommandPaletteOpen(false)} />
    </div>
  );
};
