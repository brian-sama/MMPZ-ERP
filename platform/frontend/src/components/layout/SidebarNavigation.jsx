import { NavLink } from "react-router-dom";

import { sidebarSections } from "../../utils/navigation";
import { hasPermission } from "../../utils/permissions";

export const SidebarNavigation = ({ user }) => {
  const visibleSections = sidebarSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => hasPermission(user, item.requiredPermission))
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="h-[calc(100vh-73px)] overflow-y-auto border-r border-slate-200 bg-slate-950 px-4 py-6 text-slate-300">
      {visibleSections.map((section) => (
        <div key={section.label} className="mb-8">
          <p className="mb-3 px-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
            {section.label}
          </p>
          <div className="space-y-1">
            {section.items.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                      isActive ? "bg-brand-700 text-white" : "hover:bg-slate-800 hover:text-white"
                    }`
                  }
                >
                  <Icon size={16} />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </aside>
  );
};
