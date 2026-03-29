import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API_BASE from '../apiConfig';
import { normalizeUserProfile } from '../accessControl';

const AuthContext = createContext(null);
const USER_STORAGE_KEY = 'mmpz_user';
const TOKEN_STORAGE_KEY = 'mmpz_auth_token';
const SESSION_KEY_STORAGE_KEY = 'mmpz_session_key';

const loadStoredUser = () => {
  try {
    return normalizeUserProfile(JSON.parse(sessionStorage.getItem(USER_STORAGE_KEY)) || null);
  } catch {
    return null;
  }
};

const loadStoredToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const loadStoredSessionKey = () => {
  try {
    return sessionStorage.getItem(SESSION_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
};

const createSessionKey = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}`;
};

const clearStoredSession = () => {
  sessionStorage.removeItem(USER_STORAGE_KEY);
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  sessionStorage.removeItem(SESSION_KEY_STORAGE_KEY);
};

const applyAuthToken = (token) => {
  if (token) {
    axios.defaults.headers.common.Authorization = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common.Authorization;
  }
};

applyAuthToken(loadStoredToken());

export function AuthProvider({ children }) {
  const [user, setUser] = useState(loadStoredUser);
  const [token, setToken] = useState(loadStoredToken);
  const [sessionKey, setSessionKey] = useState(loadStoredSessionKey);
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    applyAuthToken(token);
  }, [token]);

  // Session inactivity timeout (30 min)
  useEffect(() => {
    if (!user) return;
    const LIMIT = 30 * 60 * 1000;
    let timer;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(logout, LIMIT);
    };
    const events = ['mousedown', 'keypress', 'scroll', 'touchstart'];
    events.forEach(e => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [user]);

  const login = async (email, password) => {
    setLoading(true);
    setAuthError('');
    try {
      const res = await axios.post(`${API_BASE}/login`, { email, password });
      const authToken = res.data?.token || '';
      const userData = normalizeUserProfile(res.data?.user || res.data);
      if (!authToken || !userData) {
        throw new Error('Invalid login response');
      }
      const nextSessionKey = createSessionKey();
      clearStoredSession();
      applyAuthToken(authToken);
      setToken(authToken);
      setSessionKey(nextSessionKey);
      setUser(userData);
      sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(userData));
      sessionStorage.setItem(TOKEN_STORAGE_KEY, authToken);
      sessionStorage.setItem(SESSION_KEY_STORAGE_KEY, nextSessionKey);
      return userData;
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid credentials. Please try again.';
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    clearStoredSession();
    localStorage.removeItem('mmpz_theme');
    
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
        const cookie = cookies[i];
        const eqPos = cookie.indexOf("=");
        const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie;
        document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
    }

    applyAuthToken('');
    setToken('');
    setSessionKey('');
    setUser(null);
    window.location.href = '/login';
  }, []);

  const resetPassword = async (newPassword) => {
    const res = await axios.put(`${API_BASE}/users/${user.id}`, {
      name: user.name,
      email: user.email,
      role: user.role_code,
      password: newPassword,
      require_password_reset: false,
      userId: user.id,
      adminId: user.id,
    });
    const updated = normalizeUserProfile({ ...user, require_password_reset: false });
    setUser(updated);
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
    return res.data;
  };

  const updateUserProfile = (updates) => {
    const updated = normalizeUserProfile({ ...user, ...updates });
    setUser(updated);
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(updated));
  };

  const hasRole = (...roleCodes) => roleCodes.includes(user?.role_code);
  const isDirector = () => user?.role_code === 'DIRECTOR';
  
  // System Role Helpers
  const isSuperAdmin = () => user?.system_role === 'SUPER_ADMIN';
  const isManagement = () => user?.system_role === 'MANAGEMENT' || user?.system_role === 'SUPER_ADMIN';
  const isProgramStaff = () => user?.system_role === 'PROGRAM_STAFF';
  const isOperations = () => user?.system_role === 'OPERATIONS';
  const isIntern = () => user?.system_role === 'INTERN';
  const isFacilitator = () => user?.system_role === 'FACILITATOR';

  return (
    <AuthContext.Provider value={{ 
        user, token, sessionKey, loading, authError, login, logout, resetPassword, updateUserProfile,
        hasRole, isDirector, isSuperAdmin, isManagement, isProgramStaff, isOperations, isIntern, isFacilitator 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
