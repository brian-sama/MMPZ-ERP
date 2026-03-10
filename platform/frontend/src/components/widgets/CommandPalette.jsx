import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { apiClient } from "../../services/apiClient";
import { sidebarSections } from "../../utils/navigation";
import { hasPermission } from "../../utils/permissions";

export const CommandPalette = ({ user, open, onClose }) => {
  const [query, setQuery] = useState("");
  const [remote, setRemote] = useState({
    navigation: [],
    members: [],
    documents: [],
    events: [],
    knowledge: []
  });
  const navigate = useNavigate();

  const entries = useMemo(
    () =>
      sidebarSections.flatMap((section) =>
        section.items
          .filter((item) => hasPermission(user, item.requiredPermission))
          .map((item) => ({
            id: item.to,
            label: `${section.label}: ${item.label}`,
            to: item.to,
            type: "navigation"
          }))
      ),
    [user]
  );

  const filteredNavigation = entries.filter((entry) =>
    entry.label.toLowerCase().includes(query.toLowerCase())
  );
  const localNavigationTargets = new Set(filteredNavigation.map((entry) => entry.to));
  const remoteNavigation = remote.navigation.filter((entry) => !localNavigationTargets.has(entry.to));

  useEffect(() => {
    if (!open || !query.trim()) {
      setRemote({ navigation: [], members: [], documents: [], events: [], knowledge: [] });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const { data } = await apiClient.get("/search/command", { params: { q: query.trim() } });
        setRemote({
          navigation: data.navigation || [],
          members: data.members || [],
          documents: data.documents || [],
          events: data.events || [],
          knowledge: data.knowledge || []
        });
      } catch {
        setRemote({ navigation: [], members: [], documents: [], events: [], knowledge: [] });
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [open, query]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex items-start justify-center bg-slate-900/40 p-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-4 shadow-panel">
        <input
          autoFocus
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search members, documents, modules..."
          className="w-full rounded-lg border border-slate-300 px-3 py-2 outline-none ring-brand-200 focus:ring-2"
        />
        <ul className="mt-3 max-h-80 overflow-y-auto">
          {filteredNavigation.map((entry) => (
            <li key={entry.to}>
              <button
                onClick={() => {
                  navigate(entry.to);
                  onClose();
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                {entry.label}
              </button>
            </li>
          ))}
          {remoteNavigation.map((entry) => (
            <li key={`remote-nav-${entry.to}`}>
              <button
                onClick={() => {
                  navigate(entry.to);
                  onClose();
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                {entry.label}
              </button>
            </li>
          ))}
          {remote.members.map((member) => (
            <li key={`member-${member.id}`}>
              <button
                onClick={() => {
                  navigate(`/erp/members?q=${encodeURIComponent(member.member_id || member.name)}`);
                  onClose();
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                Member: {member.name} ({member.member_id})
              </button>
            </li>
          ))}
          {remote.documents.map((document) => (
            <li key={`document-${document.id}`}>
              <button
                onClick={() => {
                  navigate(`/intranet/documents?q=${encodeURIComponent(document.title)}`);
                  onClose();
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                Document: {document.title}
              </button>
            </li>
          ))}
          {remote.events.map((event) => (
            <li key={`event-${event.id}`}>
              <button
                onClick={() => {
                  navigate(`/intranet/events?q=${encodeURIComponent(event.title)}`);
                  onClose();
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                Event: {event.title}
              </button>
            </li>
          ))}
          {remote.knowledge.map((article) => (
            <li key={`kb-${article.id}`}>
              <button
                onClick={() => {
                  navigate(`/intranet/knowledge-base?q=${encodeURIComponent(article.title)}`);
                  onClose();
                }}
                className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
              >
                Knowledge: {article.title}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};
