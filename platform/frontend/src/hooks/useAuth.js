import { useEffect, useMemo, useState } from "react";

import { getSession, login as loginService, logout as logoutService } from "../services/authService";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const access = localStorage.getItem("portal_access_token");
    if (!access) {
      setLoading(false);
      return;
    }

    // Show cached user immediately so the portal loads without a spinner
    const cached = localStorage.getItem("portal_user");
    if (cached) {
      try {
        setUser(JSON.parse(cached));
      } catch {
        localStorage.removeItem("portal_user");
      }
    }
    setLoading(false);

    // Verify session in the background and refresh cached profile
    getSession()
      .then((session) => {
        const freshUser = session.user || null;
        setUser(freshUser);
        if (freshUser) localStorage.setItem("portal_user", JSON.stringify(freshUser));
      })
      .catch(() => {
        // Token expired or invalid — clear everything and force re-login
        localStorage.removeItem("portal_access_token");
        localStorage.removeItem("portal_refresh_token");
        localStorage.removeItem("portal_user");
        setUser(null);
      });
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        // login response now includes user — no second getSession() needed
        const data = await loginService(email, password);
        setUser(data.user || null);
      },
      logout: async () => {
        await logoutService();
        setUser(null);
      }
    }),
    [user, loading]
  );

  return value;
};
