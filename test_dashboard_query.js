import 'dotenv/config';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('Missing DATABASE_URL');
    process.exit(1);
}

const sql = postgres(databaseUrl);

async function test() {
    try {
        console.log('Testing Dashboard Query...');
        const metrics = await sql`
            SELECT 
                (SELECT COUNT(*)::int FROM programs WHERE status = 'active') as active_programs,
                (SELECT COUNT(*)::int FROM projects WHERE status = 'active') as active_projects,
                (SELECT COUNT(*)::int FROM users WHERE role_code = 'DEVELOPMENT_FACILITATOR') as active_facilitators,
                (SELECT COALESCE(SUM(total_budget), 0)::float FROM indicators WHERE status = 'active') as budget_total,
                (SELECT COALESCE(SUM(current_budget_balance), 0)::float FROM indicators WHERE status = 'active') as budget_remaining,
                (SELECT COUNT(*)::int FROM approval_requests WHERE status = 'pending') as pending_approvals
        `;
        console.log('Metrics:', metrics[0]);

        const keyIndicators = await sql`
            SELECT 
                title, 
                target_value, 
                current_value,
                CASE WHEN target_value > 0 
                    THEN ROUND((current_value::float / target_value::float) * 100) 
                    ELSE 0 
                END as progress_percentage,
                priority,
                status
            FROM indicators
            WHERE status != 'archived'
            ORDER BY priority DESC, created_at DESC
            LIMIT 5
        `;
        console.log('Key Indicators count:', keyIndicators.length);

        const pendingApprovalsList = await sql`
            SELECT 
                id,
                request_type,
                entity_id,
                created_at,
                (SELECT name FROM users WHERE id = requested_by_user_id) as requester_name
            FROM approval_requests
            WHERE status = 'pending'
            ORDER BY created_at DESC
            LIMIT 5
        `;
        console.log('Pending Approvals count:', pendingApprovalsList.length);

        console.log('All queries successful!');
        process.exit(0);
    } catch (err) {
        console.error('QUERY FAILURE:', err);
        process.exit(1);
    }
}

test();
