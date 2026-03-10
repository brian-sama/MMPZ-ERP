import { apiClient } from "./apiClient";

export const login = async (email, password) => {
  const { data } = await apiClient.post("/auth/login/", { email, password });
  localStorage.setItem("portal_access_token", data.access);
  localStorage.setItem("portal_refresh_token", data.refresh);
  return data;
};

export const logout = async () => {
  const refresh = localStorage.getItem("portal_refresh_token");
  try {
    if (refresh) await apiClient.post("/auth/logout/", { refresh });
  } finally {
    localStorage.removeItem("portal_access_token");
    localStorage.removeItem("portal_refresh_token");
  }
};

export const getSession = async () => {
  const { data } = await apiClient.get("/auth/session/");
  return data;
};
