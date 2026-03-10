import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import API_BASE from '../apiConfig';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('mmpz_user')) || null; }
    catch { return null; }
  });
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState('');

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
      const userData = res.data;
      setUser(userData);
      sessionStorage.setItem('mmpz_user', JSON.stringify(userData));
      return userData;
    } catch (err) {
      const msg = err.response?.data?.message || 'Invalid credentials. Please try again.';
      setAuthError(msg);
      throw new Error(msg);
    } finally {
      setLoading(false);
    }
  };

  const logout = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem('mmpz_user');
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
    const updated = { ...user, require_password_reset: false };
    setUser(updated);
    sessionStorage.setItem('mmpz_user', JSON.stringify(updated));
    return res.data;
  };

  const hasRole = (...roleCodes) => roleCodes.includes(user?.role_code);
  const isDirector = () => user?.role_code === 'DIRECTOR';
  const isFinance = () => user?.role_code === 'FINANCE_ADMIN_OFFICER';
  const isFacilitator = () => user?.role_code === 'DEVELOPMENT_FACILITATOR';

  return (
    <AuthContext.Provider value={{ user, loading, authError, login, logout, resetPassword, hasRole, isDirector, isFinance, isFacilitator }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
