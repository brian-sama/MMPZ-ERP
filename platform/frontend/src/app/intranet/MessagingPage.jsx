import { useEffect, useMemo, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { apiClient } from "../../services/apiClient";
import { connectMessagingChannel } from "../../services/websocketService";
import { hasPermission } from "../../utils/permissions";

export const MessagingPage = () => {
  const { user } = useOutletContext();
  const [channels, setChannels] = useState([]);
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState("");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [channelForm, setChannelForm] = useState({
    name: "",
    channel_type: "DEPARTMENT",
    department: ""
  });
  const [messageForm, setMessageForm] = useState({ content: "", attachment_path: "" });

  const canManage = useMemo(() => hasPermission(user, "members.edit"), [user]);

  const loadChannels = async () => {
    const { data } = await apiClient.get("/messaging/channels/", { params: { page_size: 100 } });
    const results = data.results || [];
    setChannels(results);
    if (!selectedChannelId && results.length > 0) {
      setSelectedChannelId(String(results[0].id));
    }
  };

  const loadMessages = async (channelId) => {
    if (!channelId) {
      setMessages([]);
      return;
    }
    const { data } = await apiClient.get("/messaging/messages/", {
      params: {
        channel_id: channelId,
        unread_only: showUnreadOnly ? 1 : undefined,
        page_size: 100
      }
    });
    setMessages((data.results || []).slice().reverse());
  };

  useEffect(() => {
    loadChannels().catch(() => setStatus("Failed to load channels"));
  }, []);

  useEffect(() => {
    loadMessages(selectedChannelId).catch(() => setStatus("Failed to load messages"));
  }, [selectedChannelId, showUnreadOnly]);

  useEffect(() => {
    if (!selectedChannelId) return undefined;
    const socket = connectMessagingChannel(selectedChannelId, (payload) => {
      if (!payload) return;
      if (payload.message && Number(payload.channel_id) === Number(selectedChannelId)) {
        setMessages((prev) => [...prev, payload.message]);
      } else if (payload.content) {
        setMessages((prev) => [
          ...prev,
          {
            id: `ws-${Date.now()}`,
            content: payload.content,
            created_at: payload.created_at,
            sender: payload.sender_id || null,
            is_read: false
          }
        ]);
      }
    });
    return () => socket.close();
  }, [selectedChannelId]);

  const createChannel = async () => {
    try {
      await apiClient.post("/messaging/channels/", channelForm);
      setChannelForm({ name: "", channel_type: "DEPARTMENT", department: "" });
      setStatus("Channel created");
      await loadChannels();
    } catch {
      setStatus("Failed to create channel");
    }
  };

  const sendMessage = async () => {
    if (!selectedChannelId || !messageForm.content.trim()) {
      setStatus("Select a channel and provide message content");
      return;
    }
    try {
      await apiClient.post("/messaging/messages/", {
        channel: Number(selectedChannelId),
        content: messageForm.content,
        attachment_path: messageForm.attachment_path
      });
      setMessageForm({ content: "", attachment_path: "" });
      setStatus("Message sent");
      await loadMessages(selectedChannelId);
    } catch {
      setStatus("Failed to send message");
    }
  };

  const markRead = async (id) => {
    try {
      await apiClient.post(`/messaging/messages/${id}/mark-read/`);
      await loadMessages(selectedChannelId);
    } catch {
      setStatus("Failed to mark message as read");
    }
  };

  return (
    <section className="space-y-4">
      <header>
        <h2 className="text-2xl font-bold text-slate-900">Realtime Messaging</h2>
        <p className="text-sm text-slate-600">Direct messages, department channels, and file sharing.</p>
      </header>

      {canManage ? (
        <div className="grid gap-2 rounded-xl bg-white p-4 shadow-panel md:grid-cols-4">
          <input
            value={channelForm.name}
            onChange={(event) => setChannelForm((prev) => ({ ...prev, name: event.target.value }))}
            placeholder="Channel name"
            className="rounded border border-slate-300 px-3 py-2"
          />
          <select
            value={channelForm.channel_type}
            onChange={(event) => setChannelForm((prev) => ({ ...prev, channel_type: event.target.value }))}
            className="rounded border border-slate-300 px-3 py-2"
          >
            <option value="DEPARTMENT">Department</option>
            <option value="DIRECT">Direct</option>
          </select>
          <input
            value={channelForm.department}
            onChange={(event) => setChannelForm((prev) => ({ ...prev, department: event.target.value }))}
            placeholder="Department (optional)"
            className="rounded border border-slate-300 px-3 py-2"
          />
          <button onClick={createChannel} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
            Create Channel
          </button>
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-[280px_1fr]">
        <aside className="rounded-xl bg-white p-4 shadow-panel">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Channels</h3>
          <ul className="mt-2 space-y-1">
            {channels.map((channel) => (
              <li key={channel.id}>
                <button
                  onClick={() => setSelectedChannelId(String(channel.id))}
                  className={`w-full rounded px-2 py-2 text-left text-sm ${
                    String(channel.id) === selectedChannelId
                      ? "bg-brand-100 text-brand-900"
                      : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {channel.name}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="space-y-3 rounded-xl bg-white p-4 shadow-panel">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-slate-700">Messages</h3>
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(event) => setShowUnreadOnly(event.target.checked)}
              />
              Unread only
            </label>
          </div>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded border border-slate-200 p-3">
            {messages.length === 0 ? (
              <p className="text-sm text-slate-500">No messages in this channel.</p>
            ) : (
              messages.map((message) => (
                <article key={message.id} className="rounded bg-slate-50 p-2 text-sm text-slate-700">
                  <p>{message.content}</p>
                  <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
                    <span>{message.created_at ? new Date(message.created_at).toLocaleString() : "-"}</span>
                    {!message.is_read && Number.isInteger(message.id) ? (
                      <button onClick={() => markRead(message.id)} className="text-brand-700">
                        Mark read
                      </button>
                    ) : null}
                  </div>
                </article>
              ))
            )}
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <input
              value={messageForm.content}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, content: event.target.value }))}
              placeholder="Message"
              className="rounded border border-slate-300 px-3 py-2 md:col-span-3"
            />
            <button onClick={sendMessage} className="rounded bg-brand-700 px-3 py-2 text-sm font-semibold text-white">
              Send
            </button>
            <input
              value={messageForm.attachment_path}
              onChange={(event) => setMessageForm((prev) => ({ ...prev, attachment_path: event.target.value }))}
              placeholder="Attachment path (optional)"
              className="rounded border border-slate-300 px-3 py-2 md:col-span-4"
            />
          </div>
        </div>
      </div>
      {status ? <p className="text-sm text-slate-700">{status}</p> : null}
    </section>
  );
};
