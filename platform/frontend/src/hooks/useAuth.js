import { useEffect, useMemo, useState } from "react";

import { getSession, login as loginService, logout as logoutService } from "../services/authService";

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const access = localStorage.getItem("portal_access_token");
    if (!access) {
      setUser(null);
      setLoading(false);
      return;
    }
    getSession()
      .then((session) => setUser(session.user || null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        await loginService(email, password);
        const session = await getSession();
        setUser(session.user || null);
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
