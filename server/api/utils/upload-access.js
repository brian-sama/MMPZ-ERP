// Authentication + per-file authorization for GET /uploads/* (private files).
// Reuses the ERP's existing bearer session token and RBAC helpers.
import crypto from 'crypto';
import { sql } from './db.js';
import { getBearerTokenFromHeaders, verifySessionToken } from './session-token.js';
import { getUserContext, hasPermission } from './rbac.js';
import { canAccessFinanceVault } from '../vault.js';

const VAULT_DIR = 'vault';
const VAULT_CATEGORY = 'Finance Vault';

/** Resolve the authenticated user id from the Authorization: Bearer header. */
export const authenticateUpload = (req) => {
    const session = verifySessionToken(getBearerTokenFromHeaders(req.headers));
    return session?.userId || null;
};

/**
 * Per-file authorization. Mirrors the checks of the API download endpoints:
 *   - document_library_files (Finance Vault => vault roles only; other docs => any signed-in user,
 *     same as GET /api/documents/:id/download)
 *   - volunteer_submissions  (owner / assigned recipient / volunteer.read_all)
 *   - anything else (no DB record linking the file) => SUPER_ADMIN only (fail closed).
 */
export const authorizeUploadAccess = async ({ userId, publicPath, relativePath }) => {
    const actor = await getUserContext(userId);
    const isSuperAdmin = actor.system_role === 'SUPER_ADMIN';
    const topDir = String(relativePath).split('/')[0];

    // The vault directory is always vault-restricted, even if its DB record is missing.
    if (topDir === VAULT_DIR && !canAccessFinanceVault(actor)) return false;

    const documents = await sql`
        SELECT category FROM document_library_files WHERE file_path = ${publicPath} LIMIT 1
    `;
    if (documents.length > 0) {
        if (documents[0].category === VAULT_CATEGORY || topDir === VAULT_DIR) {
            return canAccessFinanceVault(actor);
        }
        return true;
    }

    try {
        const submissions = await sql`
            SELECT id, user_id FROM volunteer_submissions WHERE file_path = ${publicPath} LIMIT 1
        `;
        if (submissions.length > 0) {
            const submission = submissions[0];
            if (hasPermission(actor, 'volunteer.read_all')) return true;
            if (Number(submission.user_id) === Number(actor.id)) return true;
            const recipients = await sql`
                SELECT id FROM volunteer_submission_recipients
                WHERE submission_id = ${submission.id} AND user_id = ${actor.id}
                LIMIT 1
            `;
            return recipients.length > 0;
        }
    } catch (error) {
        // Table missing / schema drift: fall through to fail-closed.
        console.warn('volunteer submission file lookup failed:', error?.message || error);
    }

    return isSuperAdmin;
};

/** Constant-time check of the shared ERP<->Monitoring integration token. */
export const verifyIntegrationToken = (req) => {
    const expected = process.env.ERP_INTEGRATION_TOKEN || process.env.INTEGRATION_TOKEN || '';
    if (!expected) return false;
    const header = (name) => {
        const value = req.headers?.[name];
        return typeof value === 'string' ? value.trim() : '';
    };
    const supplied =
        header('x-integration-token') ||
        header('x-erp-integration-token') ||
        getBearerTokenFromHeaders(req.headers) ||
        '';
    const a = Buffer.from(supplied);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
};
