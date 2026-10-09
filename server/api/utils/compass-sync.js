import { resolvePlatformEnv } from './platform-env.js';

export const triggerCompassMasterDataSync = () => {
    try {
        const rawUrl =
            resolvePlatformEnv('MMPZ_ME_INTERNAL_API_URL', 'ME_INTERNAL_API_URL', 'COMPASS_INTERNAL_API_URL') ||
            'http://mmpz-compass-app:4000/api';
        const cleanUrl = rawUrl.replace(/\/+$/, '');
        const compassApi = cleanUrl.endsWith('/api') ? cleanUrl : `${cleanUrl}/api`;
        const token =
            resolvePlatformEnv('MMPZ_ME_INTEGRATION_TOKEN', 'ME_INTEGRATION_TOKEN', 'MMPZ_INTEGRATION_TOKEN', 'ERP_INTEGRATION_TOKEN') ||
            '';

        if (!token) return;

        fetch(`${compassApi}/integrations/erp/sync-master-data`, {
            method: 'POST',
            headers: {
                'x-integration-token': token,
                'x-erp-integration-token': token,
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({}),
        }).catch((err) => {
            console.warn('[Compass Sync Notice] Auto master data sync notification:', err.message);
        });
    } catch {
        // Non-blocking background sync
    }
};
