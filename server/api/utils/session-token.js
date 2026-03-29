import crypto from 'crypto';

const DEFAULT_TTL_SECONDS = 60 * 60 * 12;
const TOKEN_SECRET =
    process.env.MMPZ_AUTH_SECRET ||
    process.env.AUTH_SECRET ||
    process.env.SESSION_SECRET ||
    'mmpz-local-dev-secret-change-me';

const base64UrlEncode = (value) =>
    Buffer.from(value)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

const base64UrlDecode = (value) => {
    const normalized = String(value)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
    return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
};

const createSignature = (payloadSegment) =>
    crypto
        .createHmac('sha256', TOKEN_SECRET)
        .update(payloadSegment)
        .digest('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');

export const issueSessionToken = (userId, options = {}) => {
    const ttlSeconds = Number(options.ttlSeconds || DEFAULT_TTL_SECONDS);
    const issuedAt = Math.floor(Date.now() / 1000);
    const payload = {
        sub: Number(userId),
        iat: issuedAt,
        exp: issuedAt + ttlSeconds,
    };

    const payloadSegment = base64UrlEncode(JSON.stringify(payload));
    const signatureSegment = createSignature(payloadSegment);
    return `${payloadSegment}.${signatureSegment}`;
};

export const verifySessionToken = (token) => {
    if (!token || typeof token !== 'string') return null;

    const [payloadSegment, signatureSegment] = token.split('.');
    if (!payloadSegment || !signatureSegment) return null;

    const expectedSignature = createSignature(payloadSegment);
    const expectedBuffer = Buffer.from(expectedSignature);
    const providedBuffer = Buffer.from(signatureSegment);
    if (
        expectedBuffer.length !== providedBuffer.length ||
        !crypto.timingSafeEqual(expectedBuffer, providedBuffer)
    ) {
        return null;
    }

    let payload;
    try {
        payload = JSON.parse(base64UrlDecode(payloadSegment));
    } catch {
        return null;
    }

    if (!payload?.sub || !payload?.exp) return null;
    const now = Math.floor(Date.now() / 1000);
    if (now >= Number(payload.exp)) return null;

    return {
        userId: Number(payload.sub),
        issuedAt: Number(payload.iat || 0),
        expiresAt: Number(payload.exp),
    };
};

export const getBearerTokenFromHeaders = (headers = {}) => {
    const authHeader =
        headers.authorization ||
        headers.Authorization ||
        headers.AUTHORIZATION ||
        '';

    if (typeof authHeader !== 'string') return null;
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    return match?.[1] || null;
};
