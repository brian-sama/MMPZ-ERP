import { Bell, Command, Search } from "lucide-react";

export const TopNavigation = ({ onOpenCommandPalette, onLogout, user }) => {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
      <div>
        <p className="text-xs uppercase tracking-[0.16em] text-brand-700">Unified Enterprise Portal</p>
        <h1 className="text-xl font-semibold text-slate-800">Digital Organization Platform</h1>
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenCommandPalette}
          className="flex items-center gap-2 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          <Command size={16} />
          <span>Command Search</span>
          <kbd className="rounded bg-slate-200 px-2 py-0.5 text-xs">Ctrl + K</kbd>
        </button>
        <button className="rounded-full bg-brand-50 p-2 text-brand-700 hover:bg-brand-100">
          <Search size={18} />
        </button>
        <button className="rounded-full bg-brand-50 p-2 text-brand-700 hover:bg-brand-100">
          <Bell size={18} />
        </button>
        <div className="rounded-xl bg-slate-900 px-3 py-2 text-xs text-white">
          {user?.email || "guest@portal.local"}
        </div>
        <button
          onClick={onLogout}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-700 hover:bg-slate-100"
        >
          Logout
        </button>
      </div>
    </header>
  );
};
