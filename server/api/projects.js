import { sql } from './utils/db.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams, getPathParam } from './utils/response.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    ensureAnyPermission,
    ensurePermission,
    hasPermission,
    setAuditActor,
} from './utils/rbac.js';

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    try {
        const method = event.httpMethod;
        const body = parseBody(event);
        const query = getQueryParams(event);
        const id = getPathParam(event, 'id') || getPathParam(event, 'projects');
        const actor = await getUserContext(getRequestUserId(event, body) || query.userId);

        if (method === 'GET') {
            ensureAnyPermission(actor, ['project.read', 'indicator.read_all', 'indicator.read_assigned'], {
                allowPending: true,
            });

            let rows;
            if (!id) {
                if (!actor.is_pending_reassignment && hasPermission(actor, 'indicator.read_all')) {
                    rows = await sql`
                        SELECT p.*, pr.name AS program_name, u.name AS owner_name
                        FROM projects p
                        LEFT JOIN programs pr ON p.program_id = pr.id
                        LEFT JOIN users u ON p.owner_user_id = u.id
                        ORDER BY p.created_at DESC
                    `;
                } else {
                    rows = await sql`
                        SELECT DISTINCT p.*, pr.name AS program_name, u.name AS owner_name
                        FROM projects p
                        LEFT JOIN programs pr ON p.program_id = pr.id
                        LEFT JOIN users u ON p.owner_user_id = u.id
                        LEFT JOIN project_assignments pa ON pa.project_id = p.id
                        WHERE p.owner_user_id = ${actor.id}
                           OR (pa.user_id = ${actor.id} AND pa.is_active = TRUE)
                        ORDER BY p.created_at DESC
                    `;
                }
                return successResponse(rows);
            }

            rows = await sql`
                SELECT p.*, pr.name AS program_name, u.name AS owner_name
                FROM projects p
                LEFT JOIN programs pr ON p.program_id = pr.id
                LEFT JOIN users u ON p.owner_user_id = u.id
                WHERE p.id = ${id}
                LIMIT 1
            `;
            if (rows.length === 0) return errorResponse('Project not found', 404);

            const project = rows[0];
            if (!hasPermission(actor, 'indicator.read_all')) {
                const assignment = await sql`
                    SELECT id
                    FROM project_assignments
                    WHERE project_id = ${project.id}
                      AND user_id = ${actor.id}
                      AND is_active = TRUE
                    LIMIT 1
                `;
                if (project.owner_user_id !== actor.id && assignment.length === 0) {
                    return errorResponse('Permission denied', 403);
                }
            }

            return successResponse(project);
        }

        if (method === 'POST') {
            ensurePermission(actor, 'project.create');
            if (!body.name) return errorResponse('Project name is required', 400);

            const inserted = await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                const rows = await tx`
                    INSERT INTO projects (
                        program_id,
                        name,
                        description,
                        donor,
                        start_date,
                        end_date,
                        status,
                        owner_user_id,
                        updated_at
                    )
                    VALUES (
                        ${body.program_id || null},
                        ${body.name},
                        ${body.description || null},
                        ${body.donor || null},
                        ${body.start_date || null},
                        ${body.end_date || null},
                        ${body.status || 'planning'},
                        ${body.owner_user_id || actor.id},
                        ${new Date().toISOString()}
                    )
                    RETURNING *
                `;
                return rows[0];
            });

            return successResponse({ message: 'Project created successfully', project: inserted });
        }

        if (method === 'PUT') {
            if (!id) return errorResponse('Project ID is required', 400);
            ensurePermission(actor, 'project.update');

            await sql.begin(async (tx) => {
                await setAuditActor(tx, actor.id);
                await tx`
                    UPDATE projects
                    SET
                        program_id = COALESCE(${body.program_id}, program_id),
                        name = COALESCE(${body.name}, name),
                        description = COALESCE(${body.description}, description),
                        donor = COALESCE(${body.donor}, donor),
                        start_date = COALESCE(${body.start_date}, start_date),
                        end_date = COALESCE(${body.end_date}, end_date),
                        status = COALESCE(${body.status}, status),
                        owner_user_id = COALESCE(${body.owner_user_id}, owner_user_id),
                        updated_at = ${new Date().toISOString()}
                    WHERE id = ${id}
                `;
            });

            return successResponse({ message: 'Project updated successfully' });
        }

        return errorResponse('Method not allowed', 405);
    } catch (error) {
        if (error instanceof HttpError) {
            return errorResponse(error.message, error.statusCode);
        }
        console.error('Projects function error:', error);
        return errorResponse('Internal server error', 500, error.message);
    }
};
