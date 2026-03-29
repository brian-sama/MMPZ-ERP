import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import API_BASE from '../apiConfig';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

const getNotificationPermission = () =>
    typeof window !== 'undefined' && 'Notification' in window
        ? window.Notification.permission
        : 'unsupported';

const pushSupportedInBrowser = () =>
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window;

const urlBase64ToUint8Array = (base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const normalized = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(normalized);
    return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export function NotificationProvider({ children }) {
    const { user, token } = useAuth();
    const streamRef = useRef(null);
    const retryTimeoutRef = useRef(null);
    const serviceWorkerRegistrationRef = useRef(null);
    const pushSyncPromiseRef = useRef(null);
    const [notifications, setNotifications] = useState([]);
    const [permission, setPermission] = useState(getNotificationPermission);
    const [pushSupported, setPushSupported] = useState(pushSupportedInBrowser);
    const [pushEnabled, setPushEnabled] = useState(false);

    const fetchNotifications = async () => {
        if (!user?.id) {
            setNotifications([]);
            return;
        }
        try {
            const res = await axios.get(`${API_BASE}/notifications`);
            setNotifications(Array.isArray(res.data) ? res.data : []);
        } catch (error) {
            console.error('Failed to fetch notifications', error);
        }
    };

    const syncPushSubscription = useCallback(async () => {
        if (!user?.id || !token || !pushSupportedInBrowser() || typeof window === 'undefined') {
            setPushEnabled(false);
            return false;
        }

        if (window.Notification.permission !== 'granted') {
            setPushEnabled(false);
            return false;
        }

        if (pushSyncPromiseRef.current) {
            return pushSyncPromiseRef.current;
        }

        pushSyncPromiseRef.current = (async () => {
            try {
                const registration =
                    serviceWorkerRegistrationRef.current ||
                    (await navigator.serviceWorker.register('/push-sw.js'));
                serviceWorkerRegistrationRef.current = registration;

                const configRes = await axios.get(`${API_BASE}/push/config`, {
                    params: { userId: user.id },
                });
                const config = configRes.data || {};
                if (!config.supported || !config.publicKey) {
                    setPushEnabled(false);
                    return false;
                }

                let subscription = await registration.pushManager.getSubscription();
                if (!subscription) {
                    subscription = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: urlBase64ToUint8Array(config.publicKey),
                    });
                }

                await axios.post(`${API_BASE}/push/subscriptions`, {
                    userId: user.id,
                    subscription,
                });
                setPushEnabled(true);
                return true;
            } catch (error) {
                console.error('Failed to sync push subscription', error);
                setPushEnabled(false);
                return false;
            } finally {
                pushSyncPromiseRef.current = null;
            }
        })();

        return pushSyncPromiseRef.current;
    }, [token, user?.id]);

    useEffect(() => {
        setPermission(getNotificationPermission());
        setPushSupported(pushSupportedInBrowser());
    }, []);

    useEffect(() => {
        fetchNotifications();
    }, [user?.id]);

    useEffect(() => {
        if (!user?.id || typeof window === 'undefined' || !pushSupportedInBrowser()) {
            setPushEnabled(false);
            return undefined;
        }

        let cancelled = false;
        const handleServiceWorkerMessage = (event) => {
            if (event.data?.type === 'notification-click' && event.data?.url) {
                window.location.assign(event.data.url);
            }
        };

        navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
        navigator.serviceWorker
            .register('/push-sw.js')
            .then(async (registration) => {
                if (cancelled) return;
                serviceWorkerRegistrationRef.current = registration;
                setPushSupported(true);
                const existingSubscription = await registration.pushManager.getSubscription();
                if (!cancelled) {
                    setPushEnabled(Boolean(existingSubscription));
                }
            })
            .catch((error) => {
                console.error('Failed to register push service worker', error);
                if (!cancelled) {
                    setPushSupported(false);
                    setPushEnabled(false);
                    serviceWorkerRegistrationRef.current = null;
                }
            });

        return () => {
            cancelled = true;
            navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
        };
    }, [user?.id]);

    useEffect(() => {
        if (permission !== 'granted' || !user?.id || !token) return;
        syncPushSubscription();
    }, [permission, syncPushSubscription, token, user?.id]);

    useEffect(() => {
        if (!user?.id || !token || typeof window === 'undefined') return undefined;

        let isClosed = false;
        const streamUrl = `${window.location.origin}${API_BASE}/notifications/stream?token=${encodeURIComponent(token)}`;

        const connect = () => {
            if (isClosed) return;

            const source = new EventSource(streamUrl);
            streamRef.current = source;

            source.onmessage = (event) => {
                try {
                    const payload = JSON.parse(event.data);
                    if (payload.kind !== 'notification' || !payload.notification) return;
                    setNotifications((current) => {
                        const withoutExisting = current.filter((item) => item.id !== payload.notification.id);
                        return [payload.notification, ...withoutExisting];
                    });

                    const shouldSuppressDesktopAlert =
                        payload.notification.type === 'calendar_reminder' && pushEnabled;

                    if (
                        !shouldSuppressDesktopAlert &&
                        typeof window !== 'undefined' &&
                        'Notification' in window &&
                        window.Notification.permission === 'granted'
                    ) {
                        const desktopNotification = new window.Notification(payload.notification.title, {
                            body: payload.notification.message || 'You have a new system notification.',
                        });
                        desktopNotification.onclick = () => {
                            window.focus();
                            desktopNotification.close();
                        };
                    }
                } catch (error) {
                    console.error('Failed to process realtime notification', error);
                }
            };

            source.onerror = () => {
                source.close();
                if (streamRef.current === source) {
                    streamRef.current = null;
                }
                if (isClosed) return;
                retryTimeoutRef.current = window.setTimeout(connect, 3000);
            };
        };

        connect();

        return () => {
            isClosed = true;
            if (retryTimeoutRef.current) {
                window.clearTimeout(retryTimeoutRef.current);
                retryTimeoutRef.current = null;
            }
            streamRef.current?.close();
            streamRef.current = null;
        };
    }, [pushEnabled, token, user?.id]);

    const markRead = async (id) => {
        await axios.post(`${API_BASE}/notifications/${id}/read`);
        setNotifications((current) =>
            current.map((item) => (item.id === id ? { ...item, is_read: true } : item))
        );
    };

    const markAllRead = async () => {
        await axios.post(`${API_BASE}/notifications/mark-all-read`);
        setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
    };

    const enableDesktopNotifications = async () => {
        if (typeof window === 'undefined' || !('Notification' in window)) {
            return 'unsupported';
        }
        const result = await window.Notification.requestPermission();
        setPermission(result);
        if (result === 'granted') {
            await syncPushSubscription();
        } else {
            setPushEnabled(false);
        }
        return result;
    };

    const value = useMemo(
        () => ({
            notifications,
            unreadCount: notifications.filter((item) => !item.is_read).length,
            permission,
            pushSupported,
            pushEnabled,
            refreshNotifications: fetchNotifications,
            markRead,
            markAllRead,
            enableDesktopNotifications,
        }),
        [notifications, permission, pushEnabled, pushSupported]
    );

    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>;
}

export function useNotifications() {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotifications must be used within a NotificationProvider');
    }
    return context;
}
