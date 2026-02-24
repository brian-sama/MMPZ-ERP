import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { OfflineStorage } from './offlineStorage';
import API_BASE from './apiConfig';
import VolunteerPortal from './components/VolunteerPortal';
import VolunteerAdmin from './components/VolunteerAdmin';


import Approvals from './components/Approvals';
import Pagination from './components/Pagination';
import usePagination from './hooks/usePagination';

const PRIORITY_COLORS = {
  critical: '#EF4444',
  high: '#F59E0B',
  medium: '#8B5CF6',
  low: '#6B7280'
};

const App = () => {
  // Use sessionStorage instead of localStorage for auto-logout on browser close
  const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('mmpz_user')) || null);
  const [indicators, setIndicators] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTab, setActiveTab] = useState('indicators');
  const [showUserForm, setShowUserForm] = useState(false);
  const [showIndicatorForm, setShowIndicatorForm] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState(null);
  const [progressHistory, setProgressHistory] = useState([]);
  const [showProgressForm, setShowProgressForm] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  // KoboToolbox Integration State
  const [koboConfig, setKoboConfig] = useState({ server_url: 'https://kf.kobotoolbox.org', api_token: '', is_connected: false });
  const [koboForms, setKoboForms] = useState([]);
  const [koboLinks, setKoboLinks] = useState([]);
  const [syncingForm, setSyncingForm] = useState(null);
  // Activities State
  const [activities, setActivities] = useState([]);
  const [showActivityForm, setShowActivityForm] = useState(false);
  // Dark Mode State
  const [darkMode, setDarkMode] = useState(localStorage.getItem('mmpz_darkMode') === 'true');
  const [editingIndicator, setEditingIndicator] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  // Offline Mode State
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncQueue, setSyncQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  // Progress History Display State
  const [showProgressDetails, setShowProgressDetails] = useState(false);
  // Activity Log Display State
  const [showActivityDetails, setShowActivityDetails] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Pagination Hooks
  const { currentData: paginatedIndicators, currentPage: indicatorPage, totalPages: indicatorTotalPages, goToPage: setIndicatorPage } = usePagination(indicators, 9);
  const { currentData: paginatedUsers, currentPage: userPage, totalPages: userTotalPages, goToPage: setUserPage } = usePagination(users, 10);
  const { currentData: paginatedActivities, currentPage: activityPage, totalPages: activityTotalPages, goToPage: setActivityPage } = usePagination(activities, 10);
  const [showManagementMenu, setShowManagementMenu] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Apply dark mode to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    localStorage.setItem('mmpz_darkMode', darkMode);
  }, [darkMode]);

  useEffect(() => {
    if (user) {
      fetchIndicators();
      fetchNotifications();
      fetchKoboConfig(); // All users can view Kobo status
      if (user.role === 'admin') {
        fetchUsers();
      }
      if (['admin', 'director', 'officer', 'intern'].includes(user.role)) fetchPendingApprovals();
      if (user.role === 'volunteer') setActiveTab('volunteer-portal');
    }
  }, [user]);

  // Offline/Online Detection
  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      console.log('🟢 Back online - syncing...');
      await syncOfflineData();
    };

    const handleOffline = () => {
      setIsOnline(false);
      console.log('🔴 Offline mode activated');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Load sync queue on mount
    loadSyncQueue();

    // Load cached data if offline
    if (!navigator.onLine && user) {
      loadCachedData();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [user]);

  // Session Timeout (5 minutes of inactivity)
  useEffect(() => {
    if (!user) return;

    let timeout;
    const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes in milliseconds

    const resetTimer = () => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => {
        console.log('🕒 Session timed out due to inactivity');
        handleLogout();
      }, INACTIVITY_LIMIT);
    };

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => window.addEventListener(event, resetTimer));

    resetTimer(); // Initialize timer

    return () => {
      if (timeout) clearTimeout(timeout);
      events.forEach(event => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  // Load cached data when offline
  const loadCachedData = async () => {
    const cachedIndicators = await OfflineStorage.getIndicators();
    if (cachedIndicators) {
      setIndicators(cachedIndicators);
      console.log('✅ Loaded indicators from cache');
    }

    const cachedActivities = await OfflineStorage.getActivities();
    if (cachedActivities) {
      setActivities(cachedActivities);
      console.log('✅ Loaded activities from cache');
    }
  };

  // Load sync queue
  const loadSyncQueue = async () => {
    const queue = await OfflineStorage.getSyncQueue();
    setSyncQueue(queue.filter(item => item.status === 'pending'));
  };

  // Sync offline data when back online
  const syncOfflineData = async () => {
    if (isSyncing) return;

    setIsSyncing(true);
    const queue = await OfflineStorage.getSyncQueue();
    const pendingItems = queue.filter(item => item.status === 'pending');

    if (pendingItems.length === 0) {
      setIsSyncing(false);
      return;
    }

    console.log(`🔄 Syncing ${pendingItems.length} items...`);

    for (const item of pendingItems) {
      try {
        if (item.action === 'add_update') {
          await axios.post(`${API_BASE}/progress-updates`, item.data);
        } else if (item.action === 'add_activity') {
          await axios.post(`${API_BASE}/activities`, item.data);
        } else if (item.action === 'delete_activity') {
          await axios.delete(`${API_BASE}/activities/${item.data.activityId}`);
        }

        await OfflineStorage.markSynced(item.id);
        console.log(`✅ Synced: ${item.action}`);
      } catch (err) {
        console.error(`❌ Sync failed for ${item.action}:`, err);
        await OfflineStorage.markFailed(item.id, err);
      }
    }

    // Clear synced items
    await OfflineStorage.clearSyncedItems();
    await loadSyncQueue();
    setIsSyncing(false);

    // Refresh data from server
    if (user) {
      await fetchIndicators();
      await fetchActivities();
    }

    console.log('✅ Sync complete!');
  };

  const fetchIndicators = async () => {
    try {
      const res = await axios.get(`${API_BASE}/indicators`, {
        params: { userId: user.id, role: user.role }
      });
      // Ensure data is an array
      setIndicators(Array.isArray(res.data) ? res.data : []);
      // Cache indicators for offline use
      if (Array.isArray(res.data)) {
        await OfflineStorage.saveIndicators(res.data);
      }
    } catch (err) {
      console.error('Error fetching indicators', err);
      setIndicators([]); // Set to empty array on error
      // If offline, try to load from cache
      if (!navigator.onLine) {
        const cached = await OfflineStorage.getIndicators();
        if (cached && Array.isArray(cached)) {
          setIndicators(cached);
          console.log('Loaded indicators from cache');
        }
      }
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/users`, { params: { role: user.role } });
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching users', err);
      setUsers([]); // Set to empty array on error
    }
  };

  const fetchProgressHistory = async (indicatorId) => {
    try {
      const res = await axios.get(`${API_BASE}/indicators/${indicatorId}/progress`);
      setProgressHistory(res.data);
    } catch (err) {
      console.error('Error fetching progress history', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await axios.get(`${API_BASE}/notifications`, { params: { userId: user.id } });
      setNotifications(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching notifications', err);
      setNotifications([]); // Set to empty array on error
    }
  };

  const fetchPendingApprovals = async () => {
    try {
      const res = await axios.get(`${API_BASE}/approvals`, { params: { role: user.role } });
      // Flatten or handle new structure if needed, for badge count
      if (res.data.progress && res.data.kobo) {
        setPendingApprovals([...res.data.progress, ...res.data.kobo]);
      } else {
        setPendingApprovals(Array.isArray(res.data) ? res.data : []);
      }
    } catch (err) {
      console.error('Error fetching pending approvals', err);
      setPendingApprovals([]); // Set to empty array on error
    }
  };

  const handleSearch = async () => {
    try {
      const res = await axios.get(`${API_BASE}/indicators`, {
        params: { userId: user.id, role: user.role, search: searchQuery, status: filterStatus, priority: filterPriority }
      });
      setIndicators(res.data);
    } catch (err) {
      console.error('Error searching indicators', err);
    }
  };

  // KoboToolbox Functions
  const fetchKoboConfig = async () => {
    try {
      const res = await axios.get(`${API_BASE}/kobo/config`);
      setKoboConfig(res.data);
      if (res.data.is_connected) {
        fetchKoboForms();
        fetchKoboLinks();
      }
    } catch (err) {
      console.error('Error fetching Kobo config', err);
    }
  };

  const fetchKoboForms = async () => {
    try {
      const res = await axios.get(`${API_BASE}/kobo/forms`);
      setKoboForms(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching Kobo forms', err);
      setKoboForms([]);
    }
  };

  const fetchKoboLinks = async () => {
    try {
      const res = await axios.get(`${API_BASE}/kobo/links`);
      setKoboLinks(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching Kobo links', err);
      setKoboLinks([]);
    }
  };

  const handleKoboConnect = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    try {
      const res = await axios.post(`${API_BASE}/kobo/config`, {
        server_url: formData.get('server_url'),
        api_token: formData.get('api_token')
      });
      if (res.data.success) {
        alert(`Connected successfully! Found ${res.data.forms_count} forms.`);
        fetchKoboConfig();
      }
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to connect');
    }
  };

  const handleKoboDisconnect = async () => {
    if (!window.confirm('Disconnect from KoboToolbox?')) return;
    try {
      await axios.post(`${API_BASE}/kobo/disconnect`);
      setKoboConfig({ ...koboConfig, is_connected: false, api_token: '' });
      setKoboForms([]);
      alert('Disconnected from KoboToolbox');
    } catch (err) {
      alert('Failed to disconnect');
    }
  };

  const handleLinkForm = async (form, indicatorId) => {
    try {
      await axios.post(`${API_BASE}/kobo/link`, {
        kobo_form_uid: form.uid,
        kobo_form_name: form.name,
        indicator_id: indicatorId
      });
      alert('Form linked successfully!');
      fetchKoboLinks();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to link form');
    }
  };

  const handleUnlinkForm = async (linkId) => {
    if (!window.confirm('Remove this form link?')) return;
    try {
      await axios.delete(`${API_BASE}/kobo/link/${linkId}`);
      fetchKoboLinks();
    } catch (err) {
      alert('Failed to unlink');
    }
  };

  const handleSyncForm = async (linkId) => {
    setSyncingForm(linkId);
    try {
      const res = await axios.post(`${API_BASE}/kobo/sync/${linkId}`);
      alert(`Synced ${res.data.new_submissions} new submissions!`);
      fetchKoboLinks();
      fetchIndicators();
    } catch (err) {
      alert(err.response?.data?.error || 'Sync failed');
    } finally {
      setSyncingForm(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingForm('all');
    try {
      const res = await axios.post(`${API_BASE}/kobo/sync-all`);
      alert(res.data.message);
      fetchKoboLinks();
      fetchIndicators();
    } catch (err) {
      alert('Sync failed');
    } finally {
      setSyncingForm(null);
    }
  };

  // Activities Functions
  const fetchActivities = async (indicatorId = null) => {
    try {
      const url = indicatorId
        ? `${API_BASE}/indicators/${indicatorId}/activities`
        : `${API_BASE}/activities`;
      const res = await axios.get(url);
      setActivities(res.data);
      // Cache activities for offline use
      await OfflineStorage.saveActivities(res.data);
    } catch (err) {
      console.error('Error fetching activities', err);
      // If offline, try to load from cache
      if (!navigator.onLine) {
        const cached = await OfflineStorage.getActivities();
        if (cached) {
          setActivities(cached);
          console.log('Loaded activities from cache');
        }
      }
    }
  };

  const handleAddActivity = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    const activityData = {
      indicator_id: formData.get('indicator_id'),
      description: formData.get('description'),
      category: formData.get('category'),
      cost: formData.get('cost'),
      userId: user.id
    };

    if (!isOnline) {
      // Queue for later sync
      await OfflineStorage.addToSyncQueue({
        type: 'add_activity',
        data: activityData
      });

      // Update local state optimistically
      const newActivity = {
        ...activityData,
        id: Date.now(),
        activity_date: new Date().toISOString(),
        indicator_title: indicators.find(i => i.id == activityData.indicator_id)?.title
      };
      setActivities([newActivity, ...activities]);
      await OfflineStorage.saveActivities([newActivity, ...activities]);
      await loadSyncQueue();

      alert('⚠️ Offline: Activity queued for sync');
      setShowActivityForm(false);
      return;
    }

    try {
      const res = await axios.post(`${API_BASE}/activities`, activityData);

      // Show budget warning if present
      if (res.data.budgetWarning) {
        alert(`${res.data.message}\n\n⚠️ ${res.data.budgetWarning}`);
      } else {
        alert(res.data.message);
      }

      setShowActivityForm(false);
      fetchActivities();
      fetchIndicators(); // Refresh budget balances
      fetchNotifications(); // Refresh to show budget warning notification
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to create activity');
    }
  };

  // Mark Indicator as Complete (Quick Action)
  const handleMarkComplete = async (indicatorId) => {
    if (!window.confirm('Mark this indicator as completed?')) return;
    try {
      await axios.patch(`${API_BASE}/indicators/${indicatorId}/complete`, {
        userId: user.id,
        role: user.role
      });
      alert('Indicator marked as completed');
      fetchIndicators();
      if (selectedIndicator?.id === indicatorId) {
        setSelectedIndicator({ ...selectedIndicator, status: 'completed' });
      }
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to mark as complete');
    }
  };

  const handleDeleteActivity = async (activityId) => {
    if (!window.confirm('Delete this activity? Budget will be restored.')) return;

    if (!isOnline) {
      // Queue for later sync
      await OfflineStorage.addToSyncQueue({
        type: 'delete_activity',
        data: { activityId }
      });

      // Update local state optimistically
      const updatedActivities = activities.filter(a => a.id !== activityId);
      setActivities(updatedActivities);
      await OfflineStorage.saveActivities(updatedActivities);
      await loadSyncQueue();

      alert('⚠️ Offline: Deletion queued for sync');
      return;
    }

    try {
      await axios.delete(`${API_BASE}/activities/${activityId}`);
      fetchActivities();
      fetchIndicators();
      alert('Activity deleted, budget restored');
    } catch (err) {
      alert('Failed to delete activity');
    }
  };

  // PDF/Excel Download Functions
  const downloadPDF = () => {
    const url = `${API_BASE}/reports/pdf?role=${user.role}&userId=${user.id}`;
    window.open(url, '_blank');
  };

  const downloadExcel = () => {
    const url = `${API_BASE}/reports/excel?role=${user.role}&userId=${user.id}`;
    window.open(url, '_blank');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    const email = e.target.email.value;
    const password = e.target.password.value;
    try {
      const res = await axios.post(`${API_BASE}/login`, { email, password });
      setUser(res.data);
      if (res.data.require_password_reset) {
        setShowPasswordReset(true);
      }
      // Use sessionStorage for auto-logout on browser close
      sessionStorage.setItem('mmpz_user', JSON.stringify(res.data));
    } catch (err) {
      alert('Invalid credentials');
    }
  };

  const handlePasswordReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    try {
      await axios.put(`${API_BASE}/users/${user.id}`, {
        name: user.name,
        email: user.email,
        role: user.role,
        password: newPassword,
        require_password_reset: false
      });
      alert('Password updated successfully! You can now access the system.');
      setShowPasswordReset(false);
      // Update local user state
      const updatedUser = { ...user, require_password_reset: false };
      setUser(updatedUser);
      sessionStorage.setItem('mmpz_user', JSON.stringify(updatedUser));
    } catch (err) {
      alert('Failed to reset password');
    }
  };

  const handleLogout = () => {
    setUser(null);
    sessionStorage.removeItem('mmpz_user');
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    const payload = {
      ...data,
      require_password_reset: formData.get('require_password_reset') === 'on',
      adminRole: user.role
    };
    try {
      await axios.post(`${API_BASE}/users`, payload);
      alert('User created successfully');
      setShowUserForm(false);
      fetchUsers();
    } catch (err) {
      alert('Failed to create user');
    }
  };

  const handleAddIndicator = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    try {
      await axios.post(`${API_BASE}/indicators`, {
        title: data.title,
        target: data.target,
        total_budget: data.budget,
        userId: user.id,
        priority: data.priority
      });
      alert('Indicator created');
      setShowIndicatorForm(false);
      fetchIndicators();
    } catch (err) {
      alert('Failed to create indicator');
    }
  };

  // Edit Indicator
  const handleEditIndicator = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    try {
      await axios.put(`${API_BASE}/indicators/${editingIndicator.id}`, {
        title: data.title,
        target_value: parseInt(data.target_value),
        total_budget: parseFloat(data.total_budget),
        priority: data.priority,
        status: data.status,
        userId: user.id,
        role: user.role
      });
      alert('Indicator updated successfully');
      setShowEditForm(false);
      setEditingIndicator(null);
      fetchIndicators();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update indicator');
    }
  };

  // Delete Indicator
  const handleDeleteIndicator = async (indicatorId) => {
    if (!window.confirm('Are you sure you want to delete this indicator? This will also delete all related activities and progress updates.')) return;
    try {
      await axios.delete(`${API_BASE}/indicators/${indicatorId}`, {
        data: { userId: user.id, role: user.role }
      });
      alert('Indicator deleted successfully');
      if (selectedIndicator?.id === indicatorId) {
        setSelectedIndicator(null);
        setActiveTab('indicators');
      }
      fetchIndicators();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to delete indicator');
    }
  };

  const handleUpdateProgress = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);
    const val = parseInt(data.newValue);
    if (isNaN(val) || val < 0) {
      alert('Please enter a valid positive number for progress update');
      return;
    }
    try {
      await axios.post(`${API_BASE}/indicators/${selectedIndicator.id}/progress`, {
        userId: user.id,
        newValue: val,
        notes: data.notes
      });
      alert('Progress updated successfully');
      setShowProgressForm(false);
      fetchIndicators();
      fetchProgressHistory(selectedIndicator.id);
    } catch (err) {
      alert('Failed to update progress');
    }
  };

  const handleApproval = async (updateId, action) => {
    try {
      await axios.patch(`${API_BASE}/progress/${updateId}/approve`, {
        userId: user.id,
        userRole: user.role,
        action: action
      });
      alert(`Progress update ${action}`);
      fetchPendingApprovals();
      fetchNotifications();
    } catch (err) {
      alert('Failed to process approval');
    }
  };

  const handleMarkNotificationRead = async (notifId) => {
    try {
      await axios.patch(`${API_BASE}/notifications/${notifId}/read`);
      fetchNotifications();
    } catch (err) {
      console.error('Error marking notification read', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await axios.patch(`${API_BASE}/notifications/read-all`, { userId: user.id });
      fetchNotifications();
    } catch (err) {
      console.error('Error marking all notifications read', err);
    }
  };

  const handleExport = async (format) => {
    try {
      const res = await axios.get(`${API_BASE}/export/indicators`, {
        params: { role: user.role, userId: user.id }
      });

      if (format === 'csv') {
        const headers = ['Title', 'Target', 'Current', 'Progress %', 'Budget', 'Balance', 'Priority', 'Status'];
        const csvContent = [
          headers.join(','),
          ...res.data.map(i => [
            `"${i.title}"`, i.target_value, i.current_value, i.progress_percentage,
            i.total_budget, i.current_budget_balance, i.priority, i.status
          ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mmpz_indicators_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
      } else {
        const jsonContent = JSON.stringify(res.data, null, 2);
        const blob = new Blob([jsonContent], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `mmpz_indicators_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
      }

      alert(`Data exported as ${format.toUpperCase()}`);
    } catch (err) {
      alert('Failed to export data');
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await axios.patch(`${API_BASE}/users/${userId}/role`, { adminRole: user.role, role: newRole });
      fetchUsers();
    } catch (err) {
      alert('Failed to update role');
    }
  };

  const handleUpdateUser = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = Object.fromEntries(formData);

    try {
      await axios.put(`${API_BASE}/users/${editingUser.id}`, {
        ...data,
        require_password_reset: formData.get('require_password_reset') === 'on',
        adminRole: user.role // For authorization check if needed
      });
      alert('User updated successfully');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to delete this user?')) return;
    try {
      await axios.delete(`${API_BASE}/users/${userId}`, {
        data: { adminRole: user.role, adminId: user.id }
      });
      alert('User deleted');
      fetchUsers();
    } catch (err) {
      alert('Failed to delete user');
    }
  };

  const openIndicatorDetail = (indicator) => {
    setSelectedIndicator(indicator);
    fetchProgressHistory(indicator.id);
    setActiveTab('detail');
  };

  const getProgressBarColor = (percentage) => {
    if (percentage >= 75) return '#22C55E';
    if (percentage >= 50) return '#F59E0B';
    return '#EF4444';
  };

  const unreadCount = notifications.filter(n => !n.is_read).length;

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <img src="/logo.jpg" alt="MMPZ Logo" className="logo-img" style={{ width: '120px', height: '120px', marginBottom: '1.5rem', border: 'none' }} />
          <h1 style={{ color: 'var(--primary)', fontSize: '2.5rem', margin: '0' }}>MMPZ</h1>
          <p style={{ color: 'var(--muted)', marginBottom: '2rem', fontWeight: 500 }}>Million Memory Project Zimbabwe</p>
          <form onSubmit={handleLogin}>
            <div style={{ textAlign: 'left', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Email Address</div>
            <input name="email" type="email" placeholder="admin@mmpz.org" className="input" required />
            <div style={{ textAlign: 'left', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Password</div>
            <input name="password" type="password" placeholder="••••••••" className="input" required />
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Sign In</button>
          </form>
        </div>
      </div>
    );
  }

  if (showPasswordReset) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h1 style={{ color: 'var(--primary)', fontSize: '2rem', marginBottom: '1rem' }}>Set New Password</h1>
          <p style={{ color: 'var(--muted)', marginBottom: '2rem' }}>Administrator has requested that you change your password.</p>
          <form onSubmit={handlePasswordReset}>
            <div style={{ textAlign: 'left', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>New Password</div>
            <input
              type="password"
              placeholder="••••••••"
              className="input"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
            />
            <div style={{ textAlign: 'left', marginBottom: '0.5rem', fontSize: '0.875rem', fontWeight: 600 }}>Confirm New Password</div>
            <input
              type="password"
              placeholder="••••••••"
              className="input"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '1rem' }}>Reset Password & Login</button>
            <button type="button" onClick={handleLogout} className="btn" style={{ width: '100%', marginTop: '0.5rem', background: 'transparent', color: 'var(--muted)' }}>Cancel</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <nav className="sidebar">
        <div className="logo-container">
          <img src="/logo.jpg" alt="Logo" className="logo-img" style={{ border: '2px solid var(--secondary)', width: '40px', height: '40px' }} />
          <span className="logo-text">MMPZ</span>
        </div>

        {/* Navigation Items */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}>
          <div className={`nav-item ${activeTab === 'indicators' || activeTab === 'detail' ? 'active' : ''}`} onClick={() => { setActiveTab('indicators'); setSelectedIndicator(null); setShowIndicatorForm(false); setShowManagementMenu(false); }}>
            Indicators
          </div>

          {['admin', 'director', 'officer', 'intern'].includes(user.role) && (
            <div className={`nav-item ${activeTab === 'approvals' ? 'active' : ''}`} onClick={() => { setActiveTab('approvals'); setShowManagementMenu(false); }}>
              Approvals
              {pendingApprovals.length > 0 && (
                <span style={{ background: '#EF4444', color: 'white', borderRadius: '50%', padding: '2px 8px', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                  {pendingApprovals.length}
                </span>
              )}
            </div>
          )}

          {(user.role === 'volunteer' || user.role === 'admin') && (
            <div className={`nav-item ${activeTab === 'volunteer-portal' ? 'active' : ''}`} onClick={() => { setActiveTab('volunteer-portal'); setShowManagementMenu(false); }}>
              My Portal
            </div>
          )}

          {['admin', 'director', 'officer', 'intern'].includes(user.role) && (
            <div className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => { setActiveTab('reports'); setShowManagementMenu(false); }}>
              Reports
            </div>
          )}

          {['admin', 'director', 'officer', 'intern'].includes(user.role) && (
            <div className={`nav-item ${activeTab === 'activities' ? 'active' : ''}`} onClick={() => { setActiveTab('activities'); setShowManagementMenu(false); }}>
              Activities
            </div>
          )}

          {['admin', 'director', 'officer', 'intern'].includes(user.role) && (
            <div className="dropdown">
              <div
                className={`nav-item ${(activeTab === 'kobo' || activeTab === 'volunteers-admin' || activeTab === 'users') ? 'active' : ''}`}
                onClick={() => { setShowManagementMenu(!showManagementMenu); setShowUserMenu(false); setShowNotifications(false); }}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                Management
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: showManagementMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </div>

              {showManagementMenu && (
                <div className="dropdown-menu" style={{ left: 0, right: 'auto' }}>
                  <button
                    className={`dropdown-item ${activeTab === 'volunteers-admin' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('volunteers-admin'); setShowManagementMenu(false); }}
                  >
                    Volunteers
                  </button>
                  <button
                    className={`dropdown-item ${activeTab === 'kobo' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('kobo'); setShowManagementMenu(false); }}
                  >
                    KoboToolbox
                  </button>
                  {user.role === 'admin' && (
                    <button
                      className={`dropdown-item ${activeTab === 'users' ? 'active' : ''}`}
                      onClick={() => { setActiveTab('users'); setShowManagementMenu(false); }}
                    >
                      System Admin
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* User Info and Actions - Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', position: 'relative' }}>
          <button
            onClick={() => { setShowNotifications(!showNotifications); setShowUserMenu(false); setShowManagementMenu(false); }}
            className="btn"
            style={{
              background: 'rgba(255,255,255,0.9)',
              borderRadius: '50%',
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              position: 'relative',
              padding: 0,
              border: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)'
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1E293B" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
            </svg>
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute', top: '-4px', right: '-4px',
                background: '#EF4444', color: 'white', borderRadius: '50%',
                width: '18px', height: '18px', fontSize: '0.65rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid white'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          <div className="dropdown">
            <div
              onClick={() => { setShowUserMenu(!showUserMenu); setShowNotifications(false); setShowManagementMenu(false); }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.4rem 0.75rem',
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 'var(--radius)',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                border: '1px solid var(--border)'
              }}
            >
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text)' }}>{user.name}</div>
                <div style={{ fontSize: '0.65rem', color: 'var(--muted)', fontWeight: 600 }}>{user.role?.toUpperCase() || 'USER'}</div>
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" style={{ transform: showUserMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--muted)' }}>
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          {showUserMenu && (
            <div className="dropdown-menu">
              <div style={{ padding: '0.5rem 1rem', fontSize: '0.7rem', color: 'var(--muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.05em' }}>Settings</div>
              <button
                className="dropdown-item"
                onClick={() => { setDarkMode(!darkMode); setShowUserMenu(false); }}
              >
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: darkMode ? '#F1F5F9' : '#1E293B' }}></div>
                Switch to {darkMode ? 'Light' : 'Dark'} Mode
              </button>
            </div>
          )}
        </div>

        <button
          onClick={handleLogout}
          className="btn"
          style={{
            background: 'rgba(254, 226, 226, 0.9)',
            color: '#EF4444',
            padding: '0.4rem 1rem',
            fontWeight: 700,
            fontSize: '0.8rem',
            border: '1px solid #FECACA',
            boxShadow: '0 2px 8px rgba(239, 68, 68, 0.1)'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '0.25rem' }}>
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          Logout
        </button>

        {showNotifications && (
          <div className="dropdown-menu" style={{ width: '350px', maxHeight: '400px', overflow: 'auto' }}>
            <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ color: 'var(--text)' }}>Notifications</strong>
              <button onClick={handleMarkAllRead} style={{ fontSize: '0.75rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                Mark all read
              </button>
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--muted)', fontSize: '0.875rem' }}>No notifications</div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleMarkNotificationRead(n.id)}
                  style={{
                    padding: '1rem', borderBottom: '1px solid var(--border)', cursor: 'pointer',
                    background: n.is_read ? 'transparent' : 'rgba(107, 33, 168, 0.05)'
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text)' }}>{n.title}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.25rem', lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.5rem', fontWeight: 500 }}>
                    {new Date(n.created_at).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </nav>

      <main className="main-content">
        {/* Offline/Online Status Banner */}
        {(!isOnline || syncQueue.length > 0) && (
          <div style={{
            position: 'fixed',
            top: '70px',
            left: 0,
            right: 0,
            background: isOnline ? '#F59E0B' : '#EF4444',
            color: 'white',
            padding: '0.5rem 2rem',
            textAlign: 'center',
            fontSize: '0.875rem',
            fontWeight: 600,
            zIndex: 999,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem'
          }}>
            {!isOnline && (
              <span>Offline Mode - Changes will sync automatically when connected</span>
            )}
            {isOnline && syncQueue.length > 0 && (
              <>
                <span>
                  {isSyncing ? 'Syncing...' : `${syncQueue.length} item${syncQueue.length > 1 ? 's' : ''} pending sync`}
                </span>
                {!isSyncing && (
                  <button
                    onClick={syncOfflineData}
                    style={{
                      background: 'white',
                      color: '#6B21A8',
                      border: 'none',
                      padding: '0.25rem 0.75rem',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      fontSize: '0.875rem'
                    }}
                  >
                    Sync Now
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {/* Actions already in top navbar - this section no longer needed */}

        {/* INDICATORS LIST VIEW */}
        {activeTab === 'indicators' && (
          <>
            <header className="header-actions">
              <h1 className="dashboard-title">Program Indicators</h1>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {(user.role === 'admin' || user.role === 'officer' || user.role === 'intern') && (
                  <button className="btn btn-secondary" onClick={() => setShowIndicatorForm(!showIndicatorForm)}>
                    {showIndicatorForm ? 'Cancel' : '+ New Indicator'}
                  </button>
                )}
              </div>
            </header>

            {/* Search & Filter */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr auto', gap: '1rem', alignItems: 'end' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Search</label>
                  <input
                    type="text"
                    placeholder="Search indicators..."
                    className="input"
                    style={{ marginBottom: 0 }}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Status</label>
                  <select className="input" style={{ marginBottom: 0 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                    <option value="">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="flagged">Flagged</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Priority</label>
                  <select className="input" style={{ marginBottom: 0 }} value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}>
                    <option value="">All Priorities</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </div>
                <button className="btn btn-primary" onClick={handleSearch}>🔍 Filter</button>
              </div>
            </div>

            {showIndicatorForm && (
              <div className="card" style={{ maxWidth: '600px' }}>
                <h3>Configure New Indicator</h3>
                <form onSubmit={handleAddIndicator}>
                  <input name="title" placeholder="Indicator Title" className="input" required />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <input name="target" type="number" placeholder="Target Value" className="input" required />
                    <input name="budget" type="number" placeholder="Budget (USD)" className="input" required />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Priority Level</label>
                    <select name="priority" className="input" style={{ marginBottom: 0 }} defaultValue="medium">
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <button type="submit" className="btn btn-secondary">Create Indicator</button>
                </form>
              </div>
            )}

            <div className="stats-grid">
              <div className="stat-card">
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Total Indicators</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{indicators.length}</div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: 'var(--secondary)' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Active Projects</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{indicators.filter(i => i.status === 'active').length}</div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#22C55E' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Avg. Progress</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>
                  {indicators.length > 0 ? Math.round(indicators.reduce((acc, i) => acc + (i.progress_percentage || 0), 0) / indicators.length) : 0}%
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: '1.5rem' }}>
              {paginatedIndicators.map(ind => (
                <div key={ind.id} className="card" style={{ cursor: 'pointer' }} onClick={() => openIndicatorDetail(ind)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: '1.1rem' }}>{ind.title}</h3>
                      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                        <span className={`badge ${ind.status === 'active' ? 'badge-green' : 'badge-purple'}`}>{ind.status?.toUpperCase()}</span>
                        <span className="badge" style={{ background: PRIORITY_COLORS[ind.priority] + '20', color: PRIORITY_COLORS[ind.priority] }}>
                          {ind.priority?.toUpperCase()}
                        </span>
                        {/* Budget Warning Badge */}
                        {((ind.current_budget_balance / ind.total_budget) * 100) < 20 && (
                          <span className="badge badge-warning" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                            Low Budget
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ marginBottom: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                      <span style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>Progress</span>
                      <span style={{ fontWeight: 600 }}>{ind.progress_percentage || 0}%</span>
                    </div>
                    <div style={{ background: '#E5E7EB', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                      <div style={{
                        width: `${ind.progress_percentage || 0}%`,
                        height: '100%',
                        background: getProgressBarColor(ind.progress_percentage || 0),
                        borderRadius: '9999px',
                        transition: 'width 0.3s ease'
                      }} />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem', fontSize: '0.75rem', color: 'var(--muted)' }}>
                      <span>{ind.current_value || 0} / {ind.target_value}</span>
                      <span>Budget: ${ind.current_budget_balance} / ${ind.total_budget}</span>
                    </div>
                  </div>

                  {(user.role === 'admin' || user.role === 'director') && ind.owner_name && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--muted)', borderTop: '1px solid #E5E7EB', paddingTop: '0.75rem' }}>
                      Managed by: <strong>{ind.owner_name}</strong>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                    <button className="btn btn-secondary" style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem' }} onClick={(e) => { e.stopPropagation(); openIndicatorDetail(ind); }}>
                      View Details
                    </button>
                    {(user.role === 'officer' || user.role === 'intern' || user.role === 'admin') && (
                      <button className="btn btn-primary" style={{ flex: 1, fontSize: '0.875rem', padding: '0.5rem' }} onClick={(e) => { e.stopPropagation(); setSelectedIndicator(ind); setShowProgressForm(true); setActiveTab('detail'); fetchProgressHistory(ind.id); }}>
                        + Add Progress
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {indicators.length === 0 && (
                <div className="card" style={{ textAlign: 'center', padding: '3rem', gridColumn: '1 / -1' }}>
                  <h3>No Indicators Found</h3>
                  <p style={{ color: 'var(--muted)' }}>Use "+ New Indicator" to create your first indicator.</p>
                </div>
              )}
            </div>

            <Pagination
              currentPage={indicatorPage}
              totalPages={indicatorTotalPages}
              onPageChange={setIndicatorPage}
            />
          </>
        )}

        {/* INDICATOR DETAIL VIEW */}
        {activeTab === 'detail' && selectedIndicator && (
          <>
            <header className="header-actions">
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <button className="btn btn-secondary" onClick={() => { setActiveTab('indicators'); setSelectedIndicator(null); setShowEditForm(false); }}>
                  Back
                </button>
                <h1 className="dashboard-title" style={{ margin: 0 }}>{selectedIndicator.title}</h1>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                {/* Edit button - visible to owner, admin, director */}
                {(selectedIndicator.created_by_user_id === user.id || user.role === 'admin' || user.role === 'director') && (
                  <button
                    className="btn"
                    style={{ background: '#E0E7FF', color: '#4F46E5' }}
                    onClick={() => { setEditingIndicator(selectedIndicator); setShowEditForm(!showEditForm); setShowProgressForm(false); }}
                  >
                    {showEditForm ? 'Cancel Edit' : 'Edit'}
                  </button>
                )}
                {/* Delete button - visible to owner and admin only */}
                {(selectedIndicator.created_by_user_id === user.id || user.role === 'admin') && (
                  <button
                    className="btn"
                    style={{ background: '#FEE2E2', color: '#EF4444' }}
                    onClick={() => handleDeleteIndicator(selectedIndicator.id)}
                  >
                    Delete
                  </button>
                )}
                {/* Mark Complete button - visible to owner, admin, director if not already completed */}
                {selectedIndicator.status !== 'completed' && (selectedIndicator.created_by_user_id === user.id || user.role === 'admin' || user.role === 'director') && (
                  <button
                    className="btn"
                    style={{ background: '#DCFCE7', color: '#166534' }}
                    onClick={() => handleMarkComplete(selectedIndicator.id)}
                  >
                    Mark Complete
                  </button>
                )}
                {/* Progress button */}
                {(user.role === 'officer' || user.role === 'intern' || user.role === 'admin') && (
                  <button className="btn btn-primary" onClick={() => { setShowProgressForm(!showProgressForm); setShowEditForm(false); }}>
                    {showProgressForm ? 'Cancel' : '+ Add Progress'}
                  </button>
                )}
              </div>
            </header>

            {/* Edit Indicator Form */}
            {showEditForm && editingIndicator && (
              <div className="card" style={{ maxWidth: '600px', marginBottom: '1.5rem' }}>
                <h3>Edit Indicator</h3>
                <form onSubmit={handleEditIndicator}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Title</label>
                    <input name="title" className="input" style={{ marginBottom: 0 }} required defaultValue={editingIndicator.title} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Target Value</label>
                      <input name="target_value" type="number" className="input" style={{ marginBottom: 0 }} required defaultValue={editingIndicator.target_value} />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Total Budget ($)</label>
                      <input name="total_budget" type="number" step="0.01" className="input" style={{ marginBottom: 0 }} required defaultValue={editingIndicator.total_budget} />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Priority</label>
                      <select name="priority" className="input" style={{ marginBottom: 0 }} defaultValue={editingIndicator.priority}>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Status</label>
                      <select name="status" className="input" style={{ marginBottom: 0 }} defaultValue={editingIndicator.status}>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="flagged">Flagged</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary">Save Changes</button>
                </form>
              </div>
            )}

            {showProgressForm && (
              <div className="card" style={{ maxWidth: '500px', marginBottom: '1.5rem' }}>
                <h3>Record Progress Update</h3>
                <form onSubmit={handleUpdateProgress}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>New Progress Value</label>
                    <input name="newValue" type="number" placeholder="Enter current progress value" className="input" required defaultValue={selectedIndicator.current_value || 0} />
                    <small style={{ color: 'var(--muted)' }}>Current: {selectedIndicator.current_value || 0} / Target: {selectedIndicator.target_value}</small>
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Notes (Optional)</label>
                    <textarea name="notes" placeholder="Add notes about this progress update..." className="input" rows="3" style={{ resize: 'vertical' }} />
                  </div>
                  <button type="submit" className="btn btn-primary">Save Progress</button>
                </form>
              </div>
            )}

            <div className="stats-grid">
              <div className="stat-card">
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Target</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{selectedIndicator.target_value}</div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#22C55E' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Current Progress</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{selectedIndicator.current_value || 0}</div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#F59E0B' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Completion</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{selectedIndicator.progress_percentage || 0}%</div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: PRIORITY_COLORS[selectedIndicator.priority] }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Priority</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: PRIORITY_COLORS[selectedIndicator.priority] }}>{selectedIndicator.priority?.toUpperCase()}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="card">
                <h3>Indicator Details</h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #E5E7EB' }}>
                    <span style={{ color: 'var(--muted)' }}>Status</span>
                    <span className={`badge ${selectedIndicator.status === 'active' ? 'badge-green' : 'badge-purple'}`}>{selectedIndicator.status?.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #E5E7EB' }}>
                    <span style={{ color: 'var(--muted)' }}>Priority</span>
                    <span className="badge" style={{ background: PRIORITY_COLORS[selectedIndicator.priority] + '20', color: PRIORITY_COLORS[selectedIndicator.priority] }}>{selectedIndicator.priority?.toUpperCase()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid #E5E7EB' }}>
                    <span style={{ color: 'var(--muted)' }}>Total Budget</span>
                    <span style={{ fontWeight: 600 }}>${selectedIndicator.total_budget}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 0' }}>
                    <span style={{ color: 'var(--muted)' }}>Budget Remaining</span>
                    <span style={{ fontWeight: 600, color: '#22C55E' }}>${selectedIndicator.current_budget_balance}</span>
                  </div>
                </div>
              </div>

              <div className="card">
                <h3>Progress Over Time</h3>
                {progressHistory.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={progressHistory.slice().reverse().map(p => ({
                      date: new Date(p.update_date).toLocaleDateString(),
                      value: p.new_value,
                      percentage: Math.round((p.new_value / selectedIndicator.target_value) * 100)
                    }))}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="percentage" stroke="#8B5CF6" strokeWidth={2} dot={{ fill: '#8B5CF6' }} name="Progress %" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
                    No progress data yet
                  </div>
                )}
              </div>
            </div>

            <div className="card" style={{ marginTop: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Progress History</h3>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span className="badge badge-purple">{progressHistory.length} entries</span>
                  {progressHistory.length > 0 && (
                    <button
                      className="btn btn-secondary"
                      style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
                      onClick={() => setShowProgressDetails(!showProgressDetails)}
                    >
                      {showProgressDetails ? 'Hide Details' : 'Show Details'}
                    </button>
                  )}
                </div>
              </div>

              {progressHistory.length > 0 ? (
                <>
                  {/* Summary View */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: showProgressDetails ? '1.5rem' : '0' }}>
                    <div style={{ padding: '1rem', background: '#F3F4F6', borderRadius: 'var(--radius)', borderLeft: '3px solid #8B5CF6' }}>
                      <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Total Updates</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{progressHistory.length}</div>
                    </div>
                    <div style={{ padding: '1rem', background: '#F3F4F6', borderRadius: 'var(--radius)', borderLeft: '3px solid #22C55E' }}>
                      <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Latest Value</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{progressHistory[0]?.new_value || 0}</div>
                    </div>
                    <div style={{ padding: '1rem', background: '#F3F4F6', borderRadius: 'var(--radius)', borderLeft: '3px solid #F59E0B' }}>
                      <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Last Updated</div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, marginTop: '0.5rem' }}>
                        {new Date(progressHistory[0]?.update_date).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ padding: '1rem', background: '#F3F4F6', borderRadius: 'var(--radius)', borderLeft: '3px solid #EF4444' }}>
                      <div style={{ color: 'var(--muted)', fontSize: '0.75rem', marginBottom: '0.25rem' }}>Total Change</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>
                        +{progressHistory.length > 0 ? (progressHistory[0]?.new_value - (progressHistory[progressHistory.length - 1]?.previous_value || 0)) : 0}
                      </div>
                    </div>
                  </div>

                  {/* Detailed Table (conditional) */}
                  {showProgressDetails && (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Value Change</th>
                          <th>Notes</th>
                          <th>Status</th>
                          <th>Updated By</th>
                        </tr>
                      </thead>
                      <tbody>
                        {progressHistory.map(entry => (
                          <tr key={entry.id}>
                            <td>{new Date(entry.update_date).toLocaleString()}</td>
                            <td>
                              <span className="badge badge-green">
                                {entry.previous_value} → {entry.new_value} (+{entry.new_value - entry.previous_value})
                              </span>
                            </td>
                            <td>{entry.notes || '-'}</td>
                            <td>
                              <span className={`badge ${entry.approval_status === 'approved' ? 'badge-green' : entry.approval_status === 'rejected' ? 'badge-error' : 'badge-warning'}`}>
                                {entry.approval_status?.toUpperCase()}
                              </span>
                            </td>
                            <td>{entry.updated_by_name}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                  No progress entries yet. Click "+ Add Progress" to record your first update.
                </div>
              )}
            </div>
          </>
        )}

        {/* APPROVALS VIEW */}
        {activeTab === 'approvals' && (
          <>
            <header className="header-actions">
              <h1 className="dashboard-title">Pending Approvals</h1>
            </header>

            <div className="card" style={{ padding: 0 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Indicator</th>
                    <th>Value Change</th>
                    <th>Notes</th>
                    <th>Submitted By</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.map(approval => (
                    <tr key={approval.id}>
                      <td style={{ fontWeight: 500 }}>{approval.indicator_title}</td>
                      <td>
                        <span className="badge badge-purple">
                          {approval.previous_value} → {approval.new_value}
                        </span>
                      </td>
                      <td>{approval.notes || '-'}</td>
                      <td>{approval.updated_by_name}</td>
                      <td>{new Date(approval.update_date).toLocaleString()}</td>
                      <td style={{ display: 'flex', gap: '0.5rem', whiteSpace: 'nowrap' }}>
                        <button
                          className="btn"
                          style={{ background: '#DCFCE7', color: '#166534', padding: '0.25rem 0.75rem', fontSize: '0.875rem', flexShrink: 0 }}
                          onClick={() => handleApproval(approval.id, 'approved')}
                        >
                          Approve
                        </button>
                        <button
                          className="btn"
                          style={{ background: '#FEE2E2', color: '#EF4444', padding: '0.25rem 0.75rem', fontSize: '0.875rem', flexShrink: 0 }}
                          onClick={() => handleApproval(approval.id, 'rejected')}
                        >
                          Reject
                        </button>
                      </td>
                    </tr>
                  ))}
                  {pendingApprovals.length === 0 && (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                        No pending approvals
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* REPORTS VIEW */}
        {activeTab === 'reports' && (
          <>
            <header className="header-actions" style={{ flexWrap: 'wrap', gap: '1rem' }}>
              <h1 className="dashboard-title">Consolidated Reports</h1>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" onClick={downloadPDF}>
                  Download PDF
                </button>
                <button className="btn" style={{ background: '#22C55E', color: 'white' }} onClick={downloadExcel}>
                  Download Excel
                </button>
              </div>
            </header>

            <div className="stats-grid">
              <div className="stat-card">
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Total Indicators</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{indicators.length}</div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#22C55E' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>On Track ({'>'}=75%)</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{indicators.filter(i => (i.progress_percentage || 0) >= 75).length}</div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#F59E0B' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Needs Attention (25-75%)</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{indicators.filter(i => (i.progress_percentage || 0) >= 25 && (i.progress_percentage || 0) < 75).length}</div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#EF4444' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>At Risk (&lt;25%)</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{indicators.filter(i => (i.progress_percentage || 0) < 25).length}</div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
              <div className="card">
                <h3>Progress by Indicator</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={indicators.map(i => ({ name: i.title.substring(0, 20), progress: i.progress_percentage || 0 }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="progress" fill="#8B5CF6" name="Progress %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="card">
                <h3>Priority Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Critical', value: indicators.filter(i => i.priority === 'critical').length, color: PRIORITY_COLORS.critical },
                        { name: 'High', value: indicators.filter(i => i.priority === 'high').length, color: PRIORITY_COLORS.high },
                        { name: 'Medium', value: indicators.filter(i => i.priority === 'medium').length, color: PRIORITY_COLORS.medium },
                        { name: 'Low', value: indicators.filter(i => i.priority === 'low').length, color: PRIORITY_COLORS.low }
                      ]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, value }) => value > 0 ? `${name}: ${value}` : ''}
                    >
                      {[PRIORITY_COLORS.critical, PRIORITY_COLORS.high, PRIORITY_COLORS.medium, PRIORITY_COLORS.low].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card" style={{ marginTop: '1.5rem' }}>
              <h3>Indicators Comparison</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Indicator</th>
                    <th>Target</th>
                    <th>Current</th>
                    <th>Progress</th>
                    <th>Priority</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {indicators.sort((a, b) => (a.progress_percentage || 0) - (b.progress_percentage || 0)).map(ind => (
                    <tr key={ind.id}>
                      <td style={{ fontWeight: 500 }}>{ind.title}</td>
                      <td>{ind.target_value}</td>
                      <td>{ind.current_value || 0}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{ width: '100px', background: '#E5E7EB', borderRadius: '9999px', height: '8px', overflow: 'hidden' }}>
                            <div style={{
                              width: `${ind.progress_percentage || 0}%`,
                              height: '100%',
                              background: getProgressBarColor(ind.progress_percentage || 0),
                              borderRadius: '9999px'
                            }} />
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 500 }}>{ind.progress_percentage || 0}%</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: PRIORITY_COLORS[ind.priority] + '20', color: PRIORITY_COLORS[ind.priority] }}>
                          {ind.priority?.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${ind.status === 'active' ? 'badge-green' : 'badge-purple'}`}>{ind.status?.toUpperCase()}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}


        {/* APPROVALS VIEW */}
        {activeTab === 'approvals' && (['admin', 'director', 'officer', 'intern'].includes(user.role)) && (
          <div className="card">
            <Approvals user={user} />
          </div>
        )}

        {/* USERS VIEW */}
        {activeTab === 'users' && user.role === 'admin' && (
          <>
            <header className="header-actions" style={{ flexWrap: 'wrap', gap: '1rem' }}>
              <h1 className="dashboard-title">System Administration</h1>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowUserForm(!showUserForm);
                  setEditingUser(null);
                }}
              >
                {showUserForm ? 'Cancel' : '+ Add User'}
              </button>
            </header>

            {showUserForm && (
              <div className="card" style={{ maxWidth: '600px', marginBottom: '1.5rem' }}>
                <h3>Create New System User</h3>
                <form onSubmit={handleAddUser}>
                  <input name="name" placeholder="Full Name" className="input" required />
                  <input name="email" type="email" placeholder="Email Address" className="input" required />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <select name="role" className="input" required>
                      <option value="volunteer">Volunteer</option>
                      <option value="officer">Officer</option>
                      <option value="director">Director</option>
                      <option value="admin">Admin</option>
                      <option value="intern">Intern</option>
                    </select>
                    <input name="password" type="password" placeholder="Initial Password" className="input" required />
                  </div>
                  <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" name="require_password_reset" id="require_password_reset" style={{ width: 'auto' }} />
                    <label htmlFor="require_password_reset" style={{ fontWeight: 600, fontSize: '0.875rem' }}>Force password change on first login</label>
                  </div>
                  <button type="submit" className="btn btn-primary">Save User</button>
                </form>
              </div>
            )}

            {editingUser && (
              <div className="card" style={{ maxWidth: '600px', marginBottom: '1.5rem', borderLeft: '4px solid #F59E0B' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0 }}>Edit User: {editingUser.name}</h3>
                  <button className="btn btn-secondary" onClick={() => setEditingUser(null)}>Cancel</button>
                </div>
                <form onSubmit={handleUpdateUser}>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Full Name</label>
                    <input name="name" defaultValue={editingUser.name} className="input" style={{ marginBottom: 0 }} required />
                  </div>
                  <div style={{ marginBottom: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Email Address</label>
                    <input name="email" type="email" defaultValue={editingUser.email} className="input" style={{ marginBottom: 0 }} required />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Role</label>
                      <select name="role" defaultValue={editingUser.role} className="input" style={{ marginBottom: 0 }} required>
                        <option value="officer">Officer</option>
                        <option value="intern">Intern</option>
                        <option value="director">Director</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>New Password (Optional)</label>
                      <input name="password" type="password" placeholder="Leave blank to keep current" className="input" style={{ marginBottom: 0 }} />
                    </div>
                  </div>
                  <div style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <input type="checkbox" name="require_password_reset" id="edit_require_password_reset" defaultChecked={editingUser.require_password_reset} style={{ width: 'auto' }} />
                    <label htmlFor="edit_require_password_reset" style={{ fontWeight: 600, fontSize: '0.875rem' }}>Force password change on next login</label>
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Update User</button>
                </form>
              </div>
            )}

            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: '600px' }}>
                <thead>
                  <tr>
                    <th>User Name</th>
                    <th>Email Address</th>
                    <th>System Role</th>
                    <th>Last Login</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedUsers.map(u => (
                    <tr key={u.id}>
                      <td style={{ fontWeight: 500 }}>{u.name}</td>
                      <td>{u.email}</td>
                      <td><span className="badge badge-purple">{u.role?.toUpperCase() || 'USER'}</span></td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                        {u.last_login ? new Date(u.last_login).toLocaleString() : 'Never'}
                      </td>
                      <td style={{ display: 'flex', gap: '8px', alignItems: 'center', whiteSpace: 'nowrap' }}>
                        <button
                          onClick={() => {
                            setEditingUser(u);
                            setShowUserForm(false);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                          }}
                          className="btn"
                          style={{ background: '#DBEAFE', color: '#1E40AF', padding: '4px 12px', fontSize: '0.8rem', flexShrink: 0 }}
                        >
                          Edit
                        </button>
                        {u.id !== user.id && (
                          <button
                            onClick={() => handleDeleteUser(u.id)}
                            className="btn"
                            style={{ background: '#FEE2E2', color: '#EF4444', padding: '4px 12px', fontSize: '0.8rem', flexShrink: 0 }}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination currentPage={userPage} totalPages={userTotalPages} onPageChange={setUserPage} />
            </div>
          </>
        )}

        {/* KOBOTOOLBOX INTEGRATION VIEW */}
        {activeTab === 'kobo' && (
          <>
            <header className="header-actions">
              <h1 className="dashboard-title">KoboToolbox Integration</h1>
              {koboConfig.is_connected && user.role === 'admin' && (
                <button className="btn" style={{ background: '#DCFCE7', color: '#166534' }} onClick={handleSyncAll} disabled={syncingForm === 'all'}>
                  {syncingForm === 'all' ? 'Syncing...' : 'Sync All Forms'}
                </button>
              )}
            </header>

            {/* Read-only notice for non-admins */}
            {user.role !== 'admin' && (
              <div style={{
                background: '#FEF3C7',
                border: '1px solid #F59E0B',
                borderRadius: 'var(--radius)',
                padding: '1rem',
                marginBottom: '1.5rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem'
              }}>
                <div>
                  <strong style={{ color: '#92400E' }}>View Only Mode</strong>
                  <p style={{ margin: 0, color: '#A16207', fontSize: '0.875rem' }}>
                    You can view KoboCollect status and sync history. Only administrators can make changes.
                  </p>
                </div>
              </div>
            )}

            {/* Connection Status Card */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Connection Status</h3>
                <span className={`badge ${koboConfig.is_connected ? 'badge-green' : 'badge-error'}`}>
                  {koboConfig.is_connected ? 'Connected' : 'Not Connected'}
                </span>
              </div>

              {!koboConfig.is_connected ? (
                user.role === 'admin' ? (
                  <form onSubmit={handleKoboConnect}>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Server URL</label>
                      <select name="server_url" className="input" style={{ marginBottom: 0 }} defaultValue={koboConfig.server_url}>
                        <option value="https://kf.kobotoolbox.org">kf.kobotoolbox.org (Free)</option>
                        <option value="https://kobo.humanitarianresponse.info">kobo.humanitarianresponse.info (OCHA)</option>
                      </select>
                    </div>
                    <div style={{ marginBottom: '1rem' }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>API Token</label>
                      <input
                        name="api_token"
                        type="password"
                        placeholder="Enter your KoboToolbox API token"
                        className="input"
                        style={{ marginBottom: 0 }}
                        required
                      />
                      <small style={{ color: 'var(--muted)', display: 'block', marginTop: '0.5rem' }}>
                        Find your token at: KoboToolbox → Settings → Security → API Key
                      </small>
                    </div>
                    <button type="submit" className="btn btn-primary">Connect to KoboToolbox</button>
                  </form>
                ) : (
                  <div style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)' }}>
                    KoboToolbox is not connected. Contact an administrator to set up the connection.
                  </div>
                )
              ) : (
                <div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: user.role === 'admin' ? '1rem' : 0 }}>
                    <div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Server</div>
                      <div style={{ fontWeight: 500 }}>{koboConfig.server_url}</div>
                    </div>
                    <div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Last Sync</div>
                      <div style={{ fontWeight: 500 }}>{koboConfig.last_sync ? new Date(koboConfig.last_sync).toLocaleString() : 'Never'}</div>
                    </div>
                  </div>
                  {user.role === 'admin' && (
                    <button className="btn" style={{ background: '#FEE2E2', color: '#EF4444' }} onClick={handleKoboDisconnect}>
                      Disconnect
                    </button>
                  )}
                </div>
              )}
            </div>

            {koboConfig.is_connected && (
              <>
                {/* Linked Forms */}
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0 }}>Linked Forms</h3>
                    <span className="badge badge-purple">{koboLinks.length} linked</span>
                  </div>

                  {koboLinks.length > 0 ? (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Form Name</th>
                          <th>Linked Indicator</th>
                          <th>Submissions</th>
                          {user.role === 'admin' && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {koboLinks.map(link => (
                          <tr key={link.id}>
                            <td style={{ fontWeight: 500 }}>{link.kobo_form_name}</td>
                            <td>
                              <span className="badge badge-purple">{link.indicator_title}</span>
                            </td>
                            <td>{link.submissions_count}</td>
                            {user.role === 'admin' && (
                              <td style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                  className="btn"
                                  style={{ background: '#DCFCE7', color: '#166534', padding: '4px 12px', fontSize: '0.875rem' }}
                                  onClick={() => handleSyncForm(link.id)}
                                  disabled={syncingForm === link.id}
                                >
                                  {syncingForm === link.id ? 'Syncing...' : 'Sync'}
                                </button>
                                <button
                                  className="btn"
                                  style={{ background: '#FEE2E2', color: '#EF4444', padding: '4px 12px', fontSize: '0.875rem' }}
                                  onClick={() => handleUnlinkForm(link.id)}
                                >
                                  Unlink
                                </button>
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                      No forms linked yet.{user.role === 'admin' && ' Link a form from the list below.'}
                    </div>
                  )}
                </div>

                {/* Available Forms - Admin Only */}
                {user.role === 'admin' && (
                  <div className="card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                      <h3 style={{ margin: 0 }}>Available KoboToolbox Forms</h3>
                      <button className="btn btn-secondary" onClick={fetchKoboForms} style={{ padding: '0.5rem 1rem' }}>
                        Refresh
                      </button>
                    </div>

                    {koboForms.length > 0 ? (
                      <div style={{ display: 'grid', gap: '1rem' }}>
                        {koboForms.map(form => {
                          const isLinked = koboLinks.some(l => l.kobo_form_uid === form.uid);
                          return (
                            <div key={form.uid} style={{
                              padding: '1rem',
                              background: '#F9FAFB',
                              borderRadius: 'var(--radius)',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center'
                            }}>
                              <div>
                                <div style={{ fontWeight: 600 }}>{form.name}</div>
                                <div style={{ fontSize: '0.875rem', color: 'var(--muted)' }}>
                                  {form.submissions_count} submissions - {form.deployment_status === 'deployed' ? 'Deployed' : 'Draft'}
                                </div>
                              </div>
                              {isLinked ? (
                                <span className="badge badge-green">Linked</span>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <select
                                    id={`indicator-${form.uid}`}
                                    className="input"
                                    style={{ marginBottom: 0, width: 'auto', minWidth: '200px' }}
                                  >
                                    <option value="">Select Indicator</option>
                                    {indicators.map(ind => (
                                      <option key={ind.id} value={ind.id}>{ind.title}</option>
                                    ))}
                                  </select>
                                  <button
                                    className="btn btn-primary"
                                    style={{ padding: '0.5rem 1rem' }}
                                    onClick={() => {
                                      const indicatorId = document.getElementById(`indicator-${form.uid}`).value;
                                      if (!indicatorId) {
                                        alert('Please select an indicator');
                                        return;
                                      }
                                      handleLinkForm(form, indicatorId);
                                    }}
                                  >
                                    Link
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                        No forms found. Make sure you have deployed forms in KoboToolbox.
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ACTIVITIES VIEW */}
        {activeTab === 'activities' && (
          <>
            <header className="header-actions">
              <h1 className="dashboard-title">Activities & Budget</h1>
              {(user.role === 'admin' || user.role === 'officer' || user.role === 'intern') && (
                <button className="btn btn-primary" onClick={() => setShowActivityForm(!showActivityForm)}>
                  {showActivityForm ? 'Close Form' : '+ Add Activity'}
                </button>
              )}
            </header>

            {/* Add Activity Form */}
            {showActivityForm && (user.role === 'admin' || user.role === 'officer' || user.role === 'intern') && (
              <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ marginBottom: '1rem' }}>Add New Activity</h3>
                <form onSubmit={handleAddActivity}>
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Select Indicator</label>
                      <select name="indicator_id" className="input" style={{ marginBottom: 0 }} required>
                        <option value="">Choose an indicator...</option>
                        {indicators.map(ind => (
                          <option key={ind.id} value={ind.id}>
                            {ind.title} (Budget: ${ind.current_budget_balance})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Cost ($)</label>
                      <input name="cost" type="number" step="0.01" min="0" placeholder="0.00" className="input" style={{ marginBottom: 0 }} required />
                    </div>
                  </div>
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Category</label>
                    <select name="category" className="input" style={{ marginBottom: 0 }} required>
                      <option value="personnel">Personnel</option>
                      <option value="materials">Materials</option>
                      <option value="travel">Travel</option>
                      <option value="training">Training</option>
                      <option value="equipment">Equipment</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div style={{ marginTop: '1rem' }}>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>Activity Description</label>
                    <textarea name="description" placeholder="Describe the activity..." className="input" rows={3} style={{ marginBottom: 0 }} required />
                  </div>
                  <button type="submit" className="btn btn-primary" style={{ marginTop: '1rem' }}>Save Activity</button>
                </form>
              </div>
            )}

            {/* Budget Summary Cards */}
            <div className="stats-grid" style={{ marginBottom: '1.5rem' }}>
              <div className="stat-card">
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Total Budget</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#6B21A8' }}>
                  ${indicators.reduce((acc, i) => acc + parseFloat(i.total_budget || 0), 0).toFixed(2)}
                </div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#22C55E' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Available Balance</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#22C55E' }}>
                  ${indicators.reduce((acc, i) => acc + parseFloat(i.current_budget_balance || 0), 0).toFixed(2)}
                </div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#F59E0B' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Spent</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#F59E0B' }}>
                  ${(indicators.reduce((acc, i) => acc + parseFloat(i.total_budget || 0), 0) - indicators.reduce((acc, i) => acc + parseFloat(i.current_budget_balance || 0), 0)).toFixed(2)}
                </div>
              </div>
              <div className="stat-card" style={{ borderLeftColor: '#8B5CF6' }}>
                <div style={{ color: 'var(--muted)', fontSize: '0.875rem' }}>Total Activities</div>
                <div style={{ fontSize: '1.75rem', fontWeight: 700 }}>{activities.length}</div>
              </div>
            </div>

            {/* Activities Table */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ margin: 0 }}>Activity Log</h3>
                {activities.length > 0 && (
                  <button
                    className="btn btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.875rem' }}
                    onClick={() => setShowActivityDetails(!showActivityDetails)}
                  >
                    {showActivityDetails ? 'Hide Details' : 'Show Details'}
                  </button>
                )}
              </div>

              {activities.length > 0 ? (
                <>
                  {showActivityDetails ? (
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Indicator</th>
                          <th>Description</th>
                          <th>Cost</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedActivities.map(activity => (
                          <tr key={activity.id}>
                            <td>{new Date(activity.activity_date).toLocaleDateString()}</td>
                            <td>
                              <span className="badge badge-purple">{activity.indicator_title}</span>
                            </td>
                            <td>{activity.description}</td>
                            <td style={{ fontWeight: 600, color: '#EF4444' }}>${parseFloat(activity.cost).toFixed(2)}</td>
                            <td>
                              {(user.role === 'admin' || user.role === 'director') && (
                                <button
                                  className="btn"
                                  style={{ background: '#FEE2E2', color: '#EF4444', padding: '4px 12px', fontSize: '0.875rem' }}
                                  onClick={() => handleDeleteActivity(activity.id)}
                                >
                                  Delete
                                </button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)', background: '#F9FAFB', borderRadius: 'var(--radius)' }}>
                      <p style={{ marginBottom: '0.5rem' }}>{activities.length} activities recorded.</p>
                      <p style={{ fontSize: '0.875rem', margin: 0 }}>Click "Show Details" to view the full log.</p>
                    </div>
                  )}
                  <Pagination currentPage={activityPage} totalPages={activityTotalPages} onPageChange={setActivityPage} />
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                  <p>No activities recorded yet.</p>
                  <p style={{ fontSize: '0.875rem' }}>Click "Add Activity" to record budget expenditures.</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* VOLUNTEER ZONES */}
        {activeTab === 'volunteer-portal' && <VolunteerPortal user={user} />}
        {activeTab === 'volunteers-admin' && <VolunteerAdmin user={user} />}
      </main>



    </div >
  );
};

export default App;
