import postgres from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const sql = postgres(process.env.DATABASE_URL);

async function backfill() {
    console.log('Starting governance/approvals backfill...');
    try {
        await sql.begin(async (tx) => {
            const requests = await tx`
                SELECT id, request_type, entity_id, requested_by_user_id, status, created_at, updated_at 
                FROM approval_requests
            `;

            console.log(`Backfilling ${requests.length} approval requests...`);

            for (const req of requests) {
                // Insert into canonical approvals
                const approval = await tx`
                    INSERT INTO approvals (
                        entity_type, 
                        entity_id, 
                        requested_by_user_id, 
                        status, 
                        created_at, 
                        updated_at
                    )
                    VALUES (
                        ${req.request_type}, 
                        ${req.entity_id}, 
                        ${req.requested_by_user_id}, 
                        ${req.status}, 
                        ${req.created_at}, 
                        ${req.updated_at}
                    )
                    RETURNING id
                `;

                // Fetch steps for this request
                const steps = await tx`
                    SELECT step_order, approver_user_id, action, acted_at, comments, created_at
                    FROM approval_steps
                    WHERE approval_request_id = ${req.id}
                    ORDER BY step_order ASC
                `;

                for (const step of steps) {
                    if (step.action !== 'pending') {
                        await tx`
                            INSERT INTO approval_logs (
                                approval_id, 
                                step_number, 
                                action, 
                                actor_user_id, 
                                comments, 
                                created_at
                            )
                            VALUES (
                                ${approval[0].id}, 
                                ${step.step_order}, 
                                ${step.action}, 
                                ${step.approver_user_id}, 
                                ${step.comments}, 
                                ${step.acted_at || step.created_at}
                            )
                        `;
                    }
                }
            }
        });

        console.log('✅ Approvals backfill completed.');
    } catch (err) {
        console.error('❌ Approvals backfill failed:', err);
    } finally {
        await sql.end();
    }
}

backfill();
