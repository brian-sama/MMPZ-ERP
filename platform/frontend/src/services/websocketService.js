const WS_BASE = import.meta.env.VITE_WS_BASE || "ws://localhost:8000";

const withToken = (path) => {
  const token = localStorage.getItem("portal_access_token");
  if (!token) return `${WS_BASE}${path}`;
  const separator = path.includes("?") ? "&" : "?";
  return `${WS_BASE}${path}${separator}token=${encodeURIComponent(token)}`;
};

export const connectNotifications = (onMessage) => {
  const socket = new WebSocket(withToken("/ws/notifications/"));
  socket.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      onMessage({ raw: event.data });
    }
  };
  return socket;
};

export const connectMessagingChannel = (roomId, onMessage) => {
  const socket = new WebSocket(withToken(`/ws/messaging/${roomId}/`));
  socket.onmessage = (event) => {
    try {
      onMessage(JSON.parse(event.data));
    } catch {
      onMessage({ raw: event.data });
    }
  };
  return socket;
};
