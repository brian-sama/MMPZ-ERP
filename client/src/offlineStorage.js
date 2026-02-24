import localforage from 'localforage';

// Configure IndexedDB instances
const indicatorsDB = localforage.createInstance({
    name: 'mmpz-indicators'
});

const syncQueueDB = localforage.createInstance({
    name: 'mmpz-sync-queue'
});

const userDB = localforage.createInstance({
    name: 'mmpz-user'
});

const activitiesDB = localforage.createInstance({
    name: 'mmpz-activities'
});

export const OfflineStorage = {
    // ============ Indicators ============
    async saveIndicators(indicators) {
        await indicatorsDB.setItem('indicators', indicators);
        await indicatorsDB.setItem('lastUpdated', new Date().toISOString());
    },

    async getIndicators() {
        return await indicatorsDB.getItem('indicators');
    },

    async getLastUpdated() {
        return await indicatorsDB.getItem('lastUpdated');
    },

    // ============ Activities ============
    async saveActivities(activities) {
        await activitiesDB.setItem('activities', activities);
    },

    async getActivities() {
        return await activitiesDB.getItem('activities');
    },

    // ============ Sync Queue ============
    async addToSyncQueue(action) {
        const queue = await syncQueueDB.getItem('queue') || [];
        const item = {
            id: Date.now() + Math.random(), // Ensure uniqueness
            action: action.type, // 'add_update', 'add_activity', 'delete_activity'
            data: action.data,
            timestamp: new Date().toISOString(),
            status: 'pending'
        };
        queue.push(item);
        await syncQueueDB.setItem('queue', queue);
        return item.id;
    },

    async getSyncQueue() {
        return await syncQueueDB.getItem('queue') || [];
    },

    async markSynced(itemId) {
        const queue = await this.getSyncQueue();
        const updated = queue.map(item =>
            item.id === itemId ? { ...item, status: 'synced' } : item
        );
        await syncQueueDB.setItem('queue', updated);
    },

    async markFailed(itemId, error) {
        const queue = await this.getSyncQueue();
        const updated = queue.map(item =>
            item.id === itemId ? { ...item, status: 'failed', error: error.message } : item
        );
        await syncQueueDB.setItem('queue', updated);
    },

    async clearSyncedItems() {
        const queue = await this.getSyncQueue();
        const pending = queue.filter(item => item.status !== 'synced');
        await syncQueueDB.setItem('queue', pending);
    },

    async clearAllQueue() {
        await syncQueueDB.setItem('queue', []);
    },

    // ============ User Session ============
    async saveUser(user) {
        await userDB.setItem('user', user);
        await userDB.setItem('loginTime', new Date().toISOString());
    },

    async getUser() {
        return await userDB.getItem('user');
    },

    async clearUser() {
        await userDB.clear();
    },

    // ============ Clear All Data ============
    async clearAll() {
        await indicatorsDB.clear();
        await syncQueueDB.clear();
        await userDB.clear();
        await activitiesDB.clear();
    }
};
