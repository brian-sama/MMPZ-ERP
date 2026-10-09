import { useEffect, useRef } from 'react';

const CHANNEL_NAME = 'mmpz_realtime_sync';
let channel = null;

try {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        channel = new BroadcastChannel(CHANNEL_NAME);
    }
} catch {
    channel = null;
}

/**
 * Publish a sync event to all local browser tabs and components.
 * @param {string} entity - e.g. 'projects', 'budget_lines', 'finance', 'indicators', 'activities'
 * @param {any} [detail] - optional payload
 */
export function publishSyncEvent(entity = '*', detail = null) {
    if (typeof window === 'undefined') return;

    const payload = {
        type: 'MMPZ_SYNC',
        entity,
        detail,
        timestamp: Date.now(),
    };

    // 1. Dispatch custom event for current window
    try {
        window.dispatchEvent(new CustomEvent('mmpz:sync', { detail: payload }));
    } catch {
        // Safe fallback
    }

    // 2. Broadcast across browser tabs
    try {
        if (channel) {
            channel.postMessage(payload);
        } else if ('localStorage' in window) {
            window.localStorage.setItem('mmpz_tab_sync', JSON.stringify(payload));
        }
    } catch {
        // Safe fallback
    }
}

/**
 * React hook to listen for real-time synchronization events, cross-tab mutations,
 * and window focus / tab activation.
 *
 * @param {string[]|string} entities - entities to listen for (e.g. ['projects'], or '*')
 * @param {Function} callback - function to invoke when matching event or window focus occurs
 * @param {Object} [options]
 * @param {boolean} [options.refreshOnFocus=true] - whether to refresh silently when switching tabs
 * @param {number} [options.minFocusIntervalMs=3000] - minimum time between focus refetches
 */
export function useRealtimeSync(entities = '*', callback, options = {}) {
    const { refreshOnFocus = true, minFocusIntervalMs = 3000 } = options;
    const lastTriggerRef = useRef(Date.now());
    const callbackRef = useRef(callback);
    callbackRef.current = callback;

    const watchedEntities = Array.isArray(entities) ? entities : [entities];

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const shouldHandle = (targetEntity) => {
            if (!targetEntity || targetEntity === '*') return true;
            return watchedEntities.includes('*') || watchedEntities.includes(targetEntity);
        };

        const handleSync = (payload) => {
            if (!payload) return;
            if (shouldHandle(payload.entity)) {
                lastTriggerRef.current = Date.now();
                callbackRef.current?.({ source: 'sync', entity: payload.entity, detail: payload.detail });
            }
        };

        // Window custom event listener
        const onCustomEvent = (event) => {
            handleSync(event.detail);
        };
        window.addEventListener('mmpz:sync', onCustomEvent);

        // BroadcastChannel listener
        const onBroadcastMessage = (event) => {
            if (event.data?.type === 'MMPZ_SYNC') {
                handleSync(event.data);
            }
        };
        if (channel) {
            channel.addEventListener('message', onBroadcastMessage);
        }

        // Window focus / visibility change handler
        const onFocusOrVisible = () => {
            if (!refreshOnFocus) return;
            if (document.visibilityState === 'hidden') return;

            const now = Date.now();
            if (now - lastTriggerRef.current >= minFocusIntervalMs) {
                lastTriggerRef.current = now;
                callbackRef.current?.({ source: 'focus' });
            }
        };

        window.addEventListener('focus', onFocusOrVisible);
        document.addEventListener('visibilitychange', onFocusOrVisible);

        return () => {
            window.removeEventListener('mmpz:sync', onCustomEvent);
            if (channel) {
                channel.removeEventListener('message', onBroadcastMessage);
            }
            window.removeEventListener('focus', onFocusOrVisible);
            document.removeEventListener('visibilitychange', onFocusOrVisible);
        };
    }, [watchedEntities.join(','), refreshOnFocus, minFocusIntervalMs]);
}
