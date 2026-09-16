export function resolvePlatformEnv(...names) {
    for (const name of names) {
        const value = process.env[name];
        if (typeof value === 'string' && value.trim().length > 0) return value.trim();
    }
    return undefined;
}

export function canonicalizePlatformEnv() {
    const authSecret = resolvePlatformEnv('MMPZ_AUTH_SECRET', 'AUTH_SECRET', 'SESSION_SECRET');
    if (authSecret) {
        process.env.MMPZ_AUTH_SECRET ??= authSecret;
        process.env.AUTH_SECRET ??= authSecret;
        process.env.SESSION_SECRET ??= authSecret;
    }

    const erpToken = resolvePlatformEnv('MMPZ_INTEGRATION_TOKEN', 'ERP_INTEGRATION_TOKEN');
    if (erpToken) {
        process.env.MMPZ_INTEGRATION_TOKEN ??= erpToken;
        process.env.ERP_INTEGRATION_TOKEN ??= erpToken;
    }

    const meToken = resolvePlatformEnv('MMPZ_ME_INTEGRATION_TOKEN', 'ME_INTEGRATION_TOKEN');
    if (meToken) {
        process.env.MMPZ_ME_INTEGRATION_TOKEN ??= meToken;
        process.env.ME_INTEGRATION_TOKEN ??= meToken;
    }

    const mePublicUrl = resolvePlatformEnv('MMPZ_ME_PUBLIC_URL', 'ME_PUBLIC_URL', 'ERP_PUBLIC_URL', 'MMPZ_PUBLIC_URL');
    if (mePublicUrl) {
        process.env.MMPZ_ME_PUBLIC_URL ??= mePublicUrl;
        process.env.ME_PUBLIC_URL ??= mePublicUrl;
        process.env.ERP_PUBLIC_URL ??= mePublicUrl;
        process.env.MMPZ_PUBLIC_URL ??= mePublicUrl;
    }

    const meInternalApiUrl = resolvePlatformEnv('MMPZ_ME_INTERNAL_API_URL', 'ME_INTERNAL_API_URL', 'COMPASS_INTERNAL_API_URL', 'ME_API_URL');
    if (meInternalApiUrl) {
        process.env.MMPZ_ME_INTERNAL_API_URL ??= meInternalApiUrl;
        process.env.ME_INTERNAL_API_URL ??= meInternalApiUrl;
        process.env.COMPASS_INTERNAL_API_URL ??= meInternalApiUrl;
    }

    return {
        authSecret,
        erpToken,
        meToken,
        mePublicUrl,
        meInternalApiUrl,
    };
}
