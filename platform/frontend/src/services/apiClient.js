import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000/api/v1";
const REFRESH_PATH = "/auth/refresh/";

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 12000
});

const refreshClient = axios.create({
  baseURL: API_BASE,
  timeout: 12000
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("portal_access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error?.config;
    if (error?.response?.status === 401 && original && !original._retry) {
      const refresh = localStorage.getItem("portal_refresh_token");
      if (refresh && !String(original.url || "").includes(REFRESH_PATH)) {
        original._retry = true;
        try {
          const { data } = await refreshClient.post(REFRESH_PATH, { refresh });
          localStorage.setItem("portal_access_token", data.access);
          if (data.refresh) {
            localStorage.setItem("portal_refresh_token", data.refresh);
          }
          original.headers.Authorization = `Bearer ${data.access}`;
          return apiClient(original);
        } catch {
          // fall through to logout/cleanup
        }
      }
    }

    if (error?.response?.status === 401) {
      localStorage.removeItem("portal_access_token");
      localStorage.removeItem("portal_refresh_token");
    }
    return Promise.reject(error);
  }
);
