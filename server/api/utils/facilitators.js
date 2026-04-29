const FACILITATOR_ROLE_CODE = 'DEVELOPMENT_FACILITATOR';
const FACILITATOR_SYSTEM_ROLE = 'FACILITATOR';

export const isFacilitatorUser = (user) =>
    user?.role_code === FACILITATOR_ROLE_CODE || user?.system_role === FACILITATOR_SYSTEM_ROLE;

const resolveJoinedAt = (joinedAtCandidate) => {
    if (!joinedAtCandidate) return new Date().toISOString().slice(0, 10);
    return new Date(joinedAtCandidate).toISOString().slice(0, 10);
};

const hasDevelopmentFacilitatorsTable = async (db) => {
    const rows = await db`
        SELECT EXISTS (
            SELECT 1
            FROM information_schema.tables
            WHERE table_schema = current_schema()
              AND table_name = 'development_facilitators'
        ) AS exists
    `;
    return Boolean(rows[0]?.exists);
};

export const ensureFacilitatorProfile = async (db, { userId, joinedAt = null, activate = false }) => {
    if (!(await hasDevelopmentFacilitatorsTable(db))) return;
    await db`
        INSERT INTO development_facilitators (user_id, status, joined_at)
        VALUES (${userId}, 'active', ${resolveJoinedAt(joinedAt)})
        ON CONFLICT (user_id) DO UPDATE SET
            status = COALESCE(${activate ? 'active' : null}, development_facilitators.status),
            joined_at = COALESCE(development_facilitators.joined_at, EXCLUDED.joined_at)
    `;
};

export const syncFacilitatorProfileForUser = async (db, user) => {
    if (!user?.id) return;
    if (!(await hasDevelopmentFacilitatorsTable(db))) return;

    if (isFacilitatorUser(user)) {
        await ensureFacilitatorProfile(db, {
            userId: user.id,
            joinedAt: user.created_at,
            activate: true,
        });
        return;
    }

    await db`
        UPDATE development_facilitators
        SET status = 'inactive'
        WHERE user_id = ${user.id}
    `;
};

export const backfillFacilitatorProfiles = async (db) => {
    if (!(await hasDevelopmentFacilitatorsTable(db))) return false;
    await db`
        INSERT INTO development_facilitators (user_id, status, joined_at)
        SELECT
            u.id,
            'active',
            COALESCE(u.created_at::date, CURRENT_DATE)
        FROM users u
        LEFT JOIN development_facilitators df ON df.user_id = u.id
        WHERE df.user_id IS NULL
          AND (
              u.role_code = ${FACILITATOR_ROLE_CODE}
              OR u.system_role = ${FACILITATOR_SYSTEM_ROLE}
          )
        ON CONFLICT (user_id) DO NOTHING
    `;
    return true;
};
