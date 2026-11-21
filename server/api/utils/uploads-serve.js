// Secure serving of files stored under the uploads directory.
//
// Security model (audit findings P1-04 / X-1 / X-2):
//   * Only /uploads/avatars/<file> (image extensions) is public.
//   * Everything else requires an authenticated session AND per-file authorization.
//   * Requested paths are decoded safely, null bytes rejected, and the resolved
//     (symlink-free) path must stay inside the uploads root.
//   * A miss is a plain 404 - never a redirect to another application.
//
// This module is intentionally free of DB/session imports so it can be unit tested;
// authentication/authorization are injected by the caller.
import fs from 'fs';
import path from 'path';
import express from 'express';

const fsp = fs.promises;

export const PUBLIC_AVATAR_DIR = 'avatars';

const MIME_BY_EXT = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.csv': 'text/csv',
    '.txt': 'text/plain',
};

const AVATAR_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif']);
const INLINE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'application/pdf',
]);

const isOutside = (relative) =>
    !relative || relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative);

export class PathRejectedError extends Error {
    constructor(status) {
        super('Invalid path');
        this.status = status;
    }
}

/**
 * Decode a request path safely and return its normalised relative form
 * (forward slashes, no leading slash). Throws PathRejectedError(400) on any
 * malformed, null-byte, backslash or traversal input.
 */
export const normalizeRequestedPath = (rawPath) => {
    let decoded;
    try {
        decoded = decodeURIComponent(String(rawPath ?? ''));
    } catch {
        throw new PathRejectedError(400);
    }
    if (decoded.includes('\0') || decoded.includes('\\')) throw new PathRejectedError(400);
    const segments = decoded.split('/').filter((segment) => segment !== '');
    if (segments.length === 0) throw new PathRejectedError(404);
    for (const segment of segments) {
        if (segment === '.' || segment === '..') throw new PathRejectedError(400);
    }
    return segments.join('/');
};

/**
 * Resolve a normalised relative path to a real file inside `root`.
 * Throws PathRejectedError (400 traversal / 404 missing).
 */
export const resolveInsideRoot = async (root, relativePath) => {
    const resolvedRoot = path.resolve(root);
    const candidate = path.resolve(resolvedRoot, relativePath);
    if (isOutside(path.relative(resolvedRoot, candidate))) throw new PathRejectedError(400);

    let realRoot;
    let realCandidate;
    try {
        realRoot = await fsp.realpath(resolvedRoot);
        realCandidate = await fsp.realpath(candidate);
    } catch {
        throw new PathRejectedError(404);
    }
    // Symlink escape check
    if (isOutside(path.relative(realRoot, realCandidate))) throw new PathRejectedError(400);

    let stat;
    try {
        stat = await fsp.stat(realCandidate);
    } catch {
        throw new PathRejectedError(404);
    }
    if (!stat.isFile()) throw new PathRejectedError(404);

    return {
        absolutePath: realCandidate,
        realRoot,
        relativeToRoot: path.relative(realRoot, realCandidate).split(path.sep).join('/'),
    };
};

const sanitizeDispositionName = (name) =>
    String(name || 'download')
        .replace(/[^A-Za-z0-9._-]+/g, '_')
        .slice(0, 120) || 'download';

export const buildDownloadHeaders = (fileName, { cache = 'private, no-store' } = {}) => {
    const ext = path.extname(String(fileName || '')).toLowerCase();
    const mime = MIME_BY_EXT[ext] || 'application/octet-stream';
    const disposition = INLINE_MIME_TYPES.has(mime) ? 'inline' : 'attachment';
    return {
        'Content-Type': mime,
        'X-Content-Type-Options': 'nosniff',
        'Content-Disposition': `${disposition}; filename="${sanitizeDispositionName(fileName)}"`,
        'Cache-Control': cache,
    };
};

const sendResolvedFile = (res, resolved, options) => {
    const headers = buildDownloadHeaders(path.basename(resolved.absolutePath), options);
    res.sendFile(resolved.relativeToRoot, {
        root: resolved.realRoot,
        dotfiles: 'deny',
        cacheControl: false,
        headers,
    }, (err) => {
        if (err && !res.headersSent) res.status(404).json({ error: 'File not found' });
    });
};

const sendRejection = (res, error) => {
    const status = error instanceof PathRejectedError ? error.status : 500;
    const message = status === 400 ? 'Invalid path' : status === 404 ? 'File not found' : 'Unable to serve file';
    res.status(status).json({ error: message });
};

const isPublicAvatarPath = (relativePath) => {
    const segments = relativePath.split('/');
    return (
        segments.length === 2 &&
        segments[0] === PUBLIC_AVATAR_DIR &&
        AVATAR_EXTENSIONS.has(path.extname(segments[1]).toLowerCase()) &&
        !segments[1].startsWith('.')
    );
};

/**
 * Express router to mount at /uploads.
 *
 * @param {object}   opts
 * @param {string}   opts.uploadsRoot  Absolute uploads directory.
 * @param {(req)=>Promise<number|string|null>|number|string|null} opts.authenticate
 *        Returns the authenticated user id, or null/undefined if unauthenticated.
 * @param {(ctx:{req, userId, publicPath:string, relativePath:string})=>Promise<boolean>|boolean} opts.authorize
 *        Per-file authorization; must fail closed.
 */
export const createUploadsRouter = ({ uploadsRoot, authenticate, authorize }) => {
    const router = express.Router();

    router.use(async (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
            res.setHeader('Allow', 'GET, HEAD');
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        try {
            const relativePath = normalizeRequestedPath(req.path);

            if (isPublicAvatarPath(relativePath)) {
                const resolved = await resolveInsideRoot(uploadsRoot, relativePath);
                sendResolvedFile(res, resolved, { cache: 'public, max-age=300' });
                return;
            }

            // Private file: authenticate first so unauthenticated callers learn nothing
            // about which files exist.
            const userId = await authenticate(req);
            if (!userId) {
                res.status(401).json({ error: 'Authentication required' });
                return;
            }

            const resolved = await resolveInsideRoot(uploadsRoot, relativePath);
            const publicPath = `/uploads/${resolved.relativeToRoot}`;
            let allowed = false;
            try {
                allowed = (await authorize({ req, userId, publicPath, relativePath: resolved.relativeToRoot })) === true;
            } catch (authError) {
                console.error('Upload authorization failed:', authError?.message || authError);
                allowed = false;
            }
            if (!allowed) {
                res.status(403).json({ error: 'You do not have access to this file' });
                return;
            }

            sendResolvedFile(res, resolved, { cache: 'private, no-store' });
        } catch (error) {
            sendRejection(res, error);
        }
    });

    return router;
};

/**
 * Handler for the server-to-server file fetch used by the Monitoring app
 * (replaces the old cross-app redirect). Token-authenticated, restricted to an
 * allow-list of sub-directories.
 *
 * GET /api/integration/files?path=/uploads/<dir>/<file>
 */
export const createIntegrationFileHandler = ({ uploadsRoot, allowedDirs, verifyToken }) =>
    async (req, res) => {
        try {
            if (!verifyToken(req)) {
                res.status(401).json({ error: 'Unauthorized integration request' });
                return;
            }
            let requested = String(req.query?.path ?? '');
            requested = requested.replace(/^\/?uploads\//i, '');
            const relativePath = normalizeRequestedPath(requested);
            const [topDir] = relativePath.split('/');
            if (!allowedDirs.includes(topDir)) {
                res.status(403).json({ error: 'File is not available through the integration API' });
                return;
            }
            const resolved = await resolveInsideRoot(uploadsRoot, relativePath);
            sendResolvedFile(res, resolved, { cache: 'private, no-store' });
        } catch (error) {
            sendRejection(res, error);
        }
    };
