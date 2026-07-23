import { sql } from './utils/db.js';
import {
    HttpError,
    getRequestUserId,
    getUserContext,
    hasPermission,
} from './utils/rbac.js';
import { successResponse, errorResponse, corsResponse, parseBody, getQueryParams } from './utils/response.js';
import ExcelJS from 'exceljs';

const responseCorsOrigin =
    process.env.CORS_RESPONSE_ORIGIN ||
    process.env.PUBLIC_ORIGIN ||
    'https://mmpzmne.co.zw';

const baseHeaders = {
    'Access-Control-Allow-Origin': responseCorsOrigin,
    'Vary': 'Origin',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Expose-Headers': 'Content-Disposition',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
};

const formatCurrency = (value) =>
    `$${Number(value || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Allowed categories must match DB CHECK constraint (lowercase)
const ALLOWED_ITEM_CATEGORIES = new Set([
    'personnel', 'materials', 'travel', 'training', 'equipment', 'procurement', 'logistics', 'other'
]);

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') return corsResponse();

    const method = event.httpMethod;
    const path = event.path || '';
    const query = getQueryParams(event);

    try {
        const userId = getRequestUserId(event);
        const userContext = await getUserContext(userId);

        // 1. GET /api/funding-requests/:id/excel - Programmatic Excel export using exceljs
        const excelMatch = path.match(/\/api\/funding-requests\/([^\/]+)\/excel$/);
        if (method === 'GET' && excelMatch) {
            const rffId = excelMatch[1];

            const [rff] = await sql`
                SELECT fr.*, u.name as submitter_name, p.name as project_name, pg.name as program_name,
                       s.status as submission_status, s.signatures as submission_signatures
                FROM funding_requests fr
                JOIN users u ON fr.submitter_user_id = u.id
                LEFT JOIN projects p ON fr.project_id = p.id
                LEFT JOIN programs pg ON fr.program_id = pg.id
                LEFT JOIN unified_submissions s ON fr.submission_id = s.id
                WHERE fr.id = ${rffId}
                LIMIT 1
            `;
            if (!rff) throw new HttpError('Request for Funds not found', 404);

            const items = await sql`
                SELECT * FROM funding_request_items
                WHERE funding_request_id = ${rffId}
                ORDER BY created_at ASC
            `;

            // Build high-fidelity spreadsheet
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'MMPZ ERP';
            workbook.lastModifiedBy = 'MMPZ ERP';
            workbook.created = new Date();
            workbook.modified = new Date();

            const sheet = workbook.addWorksheet('Request for Funds');
            sheet.views = [{ showGridLines: true }];

            // Primary Styling Palettes (Forest Green & Gold accents)
            const headerColor = '1B4D3E'; // Forest Green
            const subHeaderColor = 'E2E8F0'; // Soft Gray
            const borderStyle = { style: 'thin', color: { argb: 'CBD5E1' } };

            // Title Block
            sheet.mergeCells('A1:E2');
            const titleCell = sheet.getCell('A1');
            titleCell.value = 'MMPZ - REQUEST FOR FUNDS (RFF)';
            titleCell.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FFFFFF' } };
            titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: headerColor } };
            titleCell.alignment = { vertical: 'middle', horizontal: 'center' };

            // Metadata Block
            const metaFields = [
                ['RFF ID:', rff.id, 'Date Submitted:', new Date(rff.created_at).toLocaleDateString()],
                ['Submitter:', rff.submitter_name, 'Status:', (rff.submission_status || 'Draft').toUpperCase()],
                ['Project:', rff.project_name || 'N/A', 'Program:', rff.program_name || 'N/A'],
                ['Activity Name:', rff.activity_name, 'District:', `${rff.district_name || 'N/A'} (${rff.district_code || 'N/A'})`]
            ];

            let currentRow = 4;
            metaFields.forEach((rowVals) => {
                sheet.getCell(`A${currentRow}`).value = rowVals[0];
                sheet.getCell(`A${currentRow}`).font = { bold: true };
                sheet.getCell(`B${currentRow}`).value = rowVals[1];

                sheet.getCell(`C${currentRow}`).value = rowVals[2];
                sheet.getCell(`C${currentRow}`).font = { bold: true };
                sheet.getCell(`D${currentRow}`).value = rowVals[3];

                currentRow++;
            });

            // Narrative Block
            currentRow++;
            sheet.getCell(`A${currentRow}`).value = 'NARRATIVE JUSTIFICATION:';
            sheet.getCell(`A${currentRow}`).font = { bold: true };
            sheet.mergeCells(`A${currentRow + 1}:E${currentRow + 3}`);
            const narrativeCell = sheet.getCell(`A${currentRow + 1}`);
            narrativeCell.value = rff.narrative_justification;
            narrativeCell.alignment = { wrapText: true, vertical: 'top' };
            narrativeCell.border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

            currentRow += 5;

            // Budget Items Table Headers
            const headers = ['Description', 'Category', 'Quantity', 'Unit Cost (USD)', 'Total Cost (USD)'];
            headers.forEach((h, colIndex) => {
                const cell = sheet.getCell(currentRow, colIndex + 1);
                cell.value = h;
                cell.font = { bold: true, color: { argb: 'FFFFFF' } };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '2D3748' } };
                cell.alignment = { horizontal: colIndex >= 2 ? 'right' : 'left' };
                cell.border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };
            });

            // Budget Items Data
            let budgetStartRow = currentRow + 1;
            items.forEach((item) => {
                currentRow++;
                sheet.getCell(`A${currentRow}`).value = item.description;
                sheet.getCell(`B${currentRow}`).value = item.category;
                
                const qtyCell = sheet.getCell(`C${currentRow}`);
                qtyCell.value = Number(item.quantity);
                qtyCell.numFmt = '#,##0.00';
                
                const unitCell = sheet.getCell(`D${currentRow}`);
                unitCell.value = Number(item.unit_cost);
                unitCell.numFmt = '$#,##0.00';

                const totalCell = sheet.getCell(`E${currentRow}`);
                totalCell.value = { formula: `C${currentRow}*D${currentRow}` };
                totalCell.numFmt = '$#,##0.00';

                ['A', 'B', 'C', 'D', 'E'].forEach((col) => {
                    sheet.getCell(`${col}${currentRow}`).border = {
                        top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle
                    };
                });
            });

            // Grand Total Row
            currentRow++;
            sheet.mergeCells(`A${currentRow}:D${currentRow}`);
            const totalLabel = sheet.getCell(`A${currentRow}`);
            totalLabel.value = 'GRAND TOTAL REQUESTED:';
            totalLabel.font = { bold: true };
            totalLabel.alignment = { horizontal: 'right' };

            const grandTotalCell = sheet.getCell(`E${currentRow}`);
            grandTotalCell.value = { formula: `SUM(E${budgetStartRow}:E${currentRow - 1})` };
            grandTotalCell.font = { bold: true };
            grandTotalCell.numFmt = '$#,##0.00';
            grandTotalCell.border = {
                top: borderStyle,
                bottom: { style: 'double', color: { argb: '00000' } }
            };

            // Signatures block
            currentRow += 3;
            sheet.getCell(`A${currentRow}`).value = 'SIGNATURE & APPROVAL LOGS:';
            sheet.getCell(`A${currentRow}`).font = { bold: true, size: 12 };

            const sigs = rff.submission_signatures || [];
            sigs.forEach((sig) => {
                currentRow++;
                sheet.mergeCells(`A${currentRow}:E${currentRow}`);
                const sigCell = sheet.getCell(`A${currentRow}`);
                const dateStr = new Date(sig.timestamp).toLocaleString();
                sigCell.value = `✓ Signed by ${sig.name} (${sig.role}) - Action: ${sig.action.toUpperCase()} on ${dateStr}. Comment: ${sig.comment || 'N/A'}`;
                sigCell.font = { italic: true, color: { argb: '2F5D50' } };
            });

            // Column widths
            sheet.getColumn(1).width = 30; // Description
            sheet.getColumn(2).width = 15; // Category
            sheet.getColumn(3).width = 12; // Qty
            sheet.getColumn(4).width = 18; // Unit Cost
            sheet.getColumn(5).width = 20; // Total Cost

            const buffer = await workbook.xlsx.writeBuffer();

            return {
                statusCode: 200,
                headers: {
                    ...baseHeaders,
                    'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    'Content-Disposition': `attachment; filename="RFF_Report_${rffId}.xlsx"`,
                },
                body: buffer.toString('base64'),
                isBase64Encoded: true,
            };
        }

        // 2. GET /api/funding-requests/:id/print - Beautiful browser printable HTML report
        const printMatch = path.match(/\/api\/funding-requests\/([^\/]+)\/print$/);
        if (method === 'GET' && printMatch) {
            const rffId = printMatch[1];

            const [rff] = await sql`
                SELECT fr.*, u.name as submitter_name, p.name as project_name, pg.name as program_name,
                       ind.title as indicator_title, s.status as submission_status, s.signatures as submission_signatures
                FROM funding_requests fr
                JOIN users u ON fr.submitter_user_id = u.id
                LEFT JOIN projects p ON fr.project_id = p.id
                LEFT JOIN programs pg ON fr.program_id = pg.id
                LEFT JOIN indicators ind ON fr.indicator_id = ind.id
                LEFT JOIN unified_submissions s ON fr.submission_id = s.id
                WHERE fr.id = ${rffId}
                LIMIT 1
            `;
            if (!rff) throw new HttpError('Request for Funds not found', 404);

            const items = await sql`
                SELECT * FROM funding_request_items
                WHERE funding_request_id = ${rffId}
                ORDER BY created_at ASC
            `;

            const bodyRows = items.map((item) => `
                <tr>
                    <td>${item.description}</td>
                    <td><span class="category-tag">${item.category}</span></td>
                    <td class="num">${Number(item.quantity).toLocaleString()}</td>
                    <td class="num">${formatCurrency(item.unit_cost)}</td>
                    <td class="num highlight">${formatCurrency(item.total_cost)}</td>
                </tr>
            `).join('');

            const sigs = rff.submission_signatures || [];
            const sigStamps = sigs.map((sig) => `
                <div class="sig-stamp">
                    <div class="sig-header">
                        <span class="sig-badge ${sig.action}">${sig.action.toUpperCase()}</span>
                        <strong>${sig.name}</strong>
                    </div>
                    <div class="sig-role">${sig.role.replace(/_/g, ' ')}</div>
                    <div class="sig-date">${new Date(sig.timestamp).toLocaleString()}</div>
                    ${sig.comment ? `<div class="sig-comment">"${sig.comment}"</div>` : ''}
                </div>
            `).join('');

            const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>MMPZ ERP - Request for Funds Printable Report</title>
    <style>
        body {
            font-family: 'Outfit', 'Inter', -apple-system, sans-serif;
            color: #1a202c;
            background: #fff;
            margin: 40px;
            font-size: 14px;
            line-height: 1.5;
        }
        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #1b4d3e;
            padding-bottom: 20px;
            margin-bottom: 25px;
        }
        .logo-section h1 {
            color: #1b4d3e;
            margin: 0;
            font-size: 24px;
            font-weight: 800;
            letter-spacing: -0.5px;
        }
        .logo-section p {
            margin: 4px 0 0;
            color: #718096;
            font-size: 12px;
            text-transform: uppercase;
            font-weight: bold;
        }
        .doc-badge {
            background: #e6fffa;
            color: #319795;
            border: 1px solid #b2f5ea;
            border-radius: 6px;
            padding: 8px 16px;
            font-weight: bold;
            text-transform: uppercase;
            font-size: 12px;
        }
        .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            background: #f7fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 30px;
        }
        .meta-item {
            display: flex;
            flex-direction: column;
        }
        .meta-item label {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #a0aec0;
            margin-bottom: 4px;
        }
        .meta-item span {
            font-size: 14px;
            font-weight: 600;
            color: #2d3748;
        }
        .section-title {
            font-size: 15px;
            font-weight: 800;
            text-transform: uppercase;
            color: #1b4d3e;
            margin: 0 0 12px;
            border-left: 4px solid #1b4d3e;
            padding-left: 10px;
        }
        .narrative-box {
            background: #fcfcfc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            font-style: italic;
            color: #4a5568;
            margin-bottom: 30px;
            white-space: pre-wrap;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 35px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #e2e8f0;
        }
        th {
            background: #1b4d3e;
            color: white;
            font-weight: bold;
            font-size: 12px;
            text-transform: uppercase;
        }
        td {
            font-size: 13px;
        }
        .num {
            text-align: right;
        }
        .highlight {
            font-weight: bold;
            color: #1b4d3e;
        }
        .category-tag {
            background: #edf2f7;
            color: #4a5568;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 11px;
            text-transform: uppercase;
            font-weight: bold;
        }
        .total-row td {
            font-weight: 800;
            font-size: 16px;
            background: #f7fafc;
            border-top: 2px solid #1b4d3e;
            border-bottom: 2px double #1b4d3e;
        }
        .sig-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
            margin-top: 20px;
        }
        .sig-stamp {
            border: 1px solid #cbd5e0;
            border-radius: 8px;
            padding: 12px;
            background: #fcfdfd;
        }
        .sig-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 6px;
        }
        .sig-badge {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 2px 6px;
            border-radius: 999px;
        }
        .sig-badge.approve, .sig-badge.verify {
            background: #c6f6d5;
            color: #22543d;
        }
        .sig-badge.reject {
            background: #fed7d7;
            color: #742a2a;
        }
        .sig-badge.submit {
            background: #ebf8ff;
            color: #2b6cb0;
        }
        .sig-role {
            font-size: 11px;
            color: #718096;
            margin-bottom: 4px;
        }
        .sig-date {
            font-size: 11px;
            color: #a0aec0;
        }
        .sig-comment {
            margin-top: 8px;
            font-size: 11px;
            background: #f7fafc;
            border-left: 2px solid #cbd5e0;
            padding: 4px 8px;
            font-style: italic;
        }
        .print-btn {
            background: #1b4d3e;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-weight: bold;
            cursor: pointer;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            margin-bottom: 20px;
        }
        @media print {
            .print-btn { display: none; }
            body { margin: 20px; }
        }
    </style>
</head>
<body>
    <button class="print-btn" onclick="window.print()">🖨️ Print Request</button>

    <div class="header">
        <div class="logo-section">
            <h1>MMPZ OPERATIONS ERP</h1>
            <p>Monitoring & Evaluation Fund Disbursal Program</p>
        </div>
        <div class="doc-badge">Request For Funds</div>
    </div>

    <div class="meta-grid">
        <div class="meta-item">
            <label>RFF Reference ID</label>
            <span>${rff.id}</span>
        </div>
        <div class="meta-item">
            <label>Date Generated</label>
            <span>${new Date(rff.created_at).toLocaleString()}</span>
        </div>
        <div class="meta-item">
            <label>Submitter</label>
            <span>${rff.submitter_name}</span>
        </div>
        <div class="meta-item">
            <label>Workflow Status</label>
            <span>${(rff.submission_status || 'Draft').toUpperCase()}</span>
        </div>
        <div class="meta-item">
            <label>Project</label>
            <span>${rff.project_name || 'N/A'}</span>
        </div>
        <div class="meta-item">
            <label>Program</label>
            <span>${rff.program_name || 'N/A'}</span>
        </div>
        <div class="meta-item">
            <label>District</label>
            <span>${rff.district_name || 'N/A'} (${rff.district_code || 'N/A'})</span>
        </div>
        <div class="meta-item">
            <label>Indicator Link</label>
            <span>${rff.indicator_title || 'N/A'}</span>
        </div>
    </div>

    <div class="section-title">Activity Justification</div>
    <div class="narrative-box">${rff.narrative_justification}</div>

    <div class="section-title">Itemized Funding Request Lines</div>
    <table>
        <thead>
            <tr>
                <th>Line Description</th>
                <th>Category</th>
                <th class="num">Quantity</th>
                <th class="num">Unit Cost (USD)</th>
                <th class="num">Subtotal (USD)</th>
            </tr>
        </thead>
        <tbody>
            ${bodyRows}
            <tr class="total-row">
                <td colspan="4" class="num">Grand Total Requested:</td>
                <td class="num">${formatCurrency(rff.total_requested_amount)}</td>
            </tr>
        </tbody>
    </table>

    <div class="section-title">E-Signature Approval Log</div>
    <div class="sig-container">
        ${sigStamps.length > 0 ? sigStamps : '<div style="color: #a0aec0; font-style: italic;">No workflow signatures recorded yet. This is a draft document.</div>'}
    </div>
</body>
</html>
            `;

            return {
                statusCode: 200,
                headers: {
                    ...baseHeaders,
                    'Content-Type': 'text/html; charset=utf-8',
                },
                body: html,
            };
        }

        // 3. POST /api/funding-requests - Create a new request (draft or full submit)
        if (method === 'POST' && path === '/api/funding-requests') {
            const body = parseBody(event);
            const {
                project_id,
                program_id,
                indicator_id,
                district_code,
                district_name,
                activity_name,
                narrative_justification,
                items,
                submit,
            } = body;

            if (!activity_name) throw new HttpError('Activity name is required', 400);
            if (!items || !Array.isArray(items) || items.length === 0) {
                throw new HttpError('At least one budget line item is required', 400);
            }

            // Validate referenced entities (fail early with clear messages)
            if (project_id) {
                const [proj] = await sql`SELECT id FROM projects WHERE id = ${project_id} LIMIT 1`;
                if (!proj) throw new HttpError('Project not found', 400);
            }
            if (program_id) {
                const [prog] = await sql`SELECT id FROM programs WHERE id = ${program_id} LIMIT 1`;
                if (!prog) throw new HttpError('Program not found', 400);
            }
            if (indicator_id) {
                const [ind] = await sql`SELECT id FROM indicators WHERE id = ${indicator_id} LIMIT 1`;
                if (!ind) throw new HttpError('Indicator not found', 400);
            }

            // Calculate total requested and normalize categories to avoid DB CHECK errors
            let totalAmount = 0;
            const parsedItems = items.map((item) => {
                const qty = Number(item.quantity || 1);
                const cost = Number(item.unit_cost || 0);
                const total = Number((qty * cost).toFixed(2));
                totalAmount += total;
                let category = String(item.category || 'other').toLowerCase().trim();
                if (!ALLOWED_ITEM_CATEGORIES.has(category)) {
                    category = 'other';
                }
                return {
                    description: item.description || 'Budget Item',
                    category,
                    quantity: qty,
                    unit_cost: cost,
                    total_cost: total,
                };
            });

            // Start Transaction to insert funding request & items
            const [rff] = await sql`
                INSERT INTO funding_requests (
                    submitter_user_id,
                    project_id,
                    program_id,
                    indicator_id,
                    district_code,
                    district_name,
                    activity_name,
                    narrative_justification,
                    total_requested_amount
                ) VALUES (
                    ${userId},
                    ${project_id},
                    ${program_id},
                    ${indicator_id},
                    ${district_code},
                    ${district_name},
                    ${activity_name},
                    ${narrative_justification},
                    ${totalAmount}
                ) RETURNING *
            `;

            // Insert items
            for (const item of parsedItems) {
                await sql`
                    INSERT INTO funding_request_items (
                        funding_request_id,
                        description,
                        category,
                        quantity,
                        unit_cost,
                        total_cost
                    ) VALUES (
                        ${rff.id},
                        ${item.description},
                        ${item.category},
                        ${item.quantity},
                        ${item.unit_cost},
                        ${item.total_cost}
                    )
                `;
            }

            // If submit === true, push to unified submissions workflow
            if (submit) {
                const initialHandlerRole = 'PROGRAMS_ME_OFFICER';

                const [submission] = await sql`
                    INSERT INTO unified_submissions (
                        submitter_user_id,
                        submission_type,
                        title,
                        description,
                        current_handler_role,
                        status,
                        related_entity_type,
                        related_entity_id,
                        metadata,
                        signatures
                    ) VALUES (
                        ${userId},
                        'request_for_funds',
                        ${`RFF: ${activity_name}`},
                        ${narrative_justification},
                        ${initialHandlerRole},
                        'submitted',
                        'funding_request',
                        ${rff.id},
                        ${JSON.stringify({
                            project_id,
                            program_id,
                            indicator_id,
                            district_name,
                            activity_name,
                            total_requested_amount: totalAmount,
                        })}::jsonb,
                        '[]'::jsonb
                    ) RETURNING *
                `;

                // Link the submission back to the RFF
                await sql`
                    UPDATE funding_requests
                    SET submission_id = ${submission.id}
                    WHERE id = ${rff.id}
                `;

                // Log workflow action
                await sql`
                    INSERT INTO submission_workflow_logs (
                        submission_id,
                        action,
                        to_status,
                        acted_by_user_id,
                        comment
                    ) VALUES (
                        ${submission.id},
                        'submit',
                        'submitted',
                        ${userId},
                        'Funding request submitted for M&E Review'
                    )
                `;

                return successResponse({ ...rff, submission_id: submission.id, status: 'submitted' }, 201);
            }

            return successResponse({ ...rff, status: 'draft' }, 201);
        }

        // 4. PUT /api/funding-requests/:id - Update an existing RFF (e.g. from draft or changes requested)
        const idMatch = path.match(/\/api\/funding-requests\/([^\/]+)$/);
        if (method === 'PUT' && idMatch) {
            const rffId = idMatch[1];
            const body = parseBody(event);
            const {
                project_id,
                program_id,
                indicator_id,
                district_code,
                district_name,
                activity_name,
                narrative_justification,
                items,
                submit,
            } = body;

            const [existing] = await sql`
                SELECT * FROM funding_requests WHERE id = ${rffId} LIMIT 1
            `;
            if (!existing) throw new HttpError('Request for Funds not found', 404);
            if (existing.submitter_user_id !== userId) {
                throw new HttpError('You are not authorized to edit this request', 403);
            }

            // Calculate total requested and normalize categories to avoid DB CHECK errors
            let totalAmount = 0;
            const parsedItems = items.map((item) => {
                const qty = Number(item.quantity || 1);
                const cost = Number(item.unit_cost || 0);
                const total = Number((qty * cost).toFixed(2));
                totalAmount += total;
                let category = String(item.category || 'other').toLowerCase().trim();
                if (!ALLOWED_ITEM_CATEGORIES.has(category)) {
                    category = 'other';
                }
                return {
                    description: item.description || 'Budget Item',
                    category,
                    quantity: qty,
                    unit_cost: cost,
                    total_cost: total,
                };
            });

            // Update request
            const [rff] = await sql`
                UPDATE funding_requests
                SET project_id = ${project_id},
                    program_id = ${program_id},
                    indicator_id = ${indicator_id},
                    district_code = ${district_code},
                    district_name = ${district_name},
                    activity_name = ${activity_name},
                    narrative_justification = ${narrative_justification},
                    total_requested_amount = ${totalAmount},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${rffId}
                RETURNING *
            `;

            // Delete old items and insert updated ones
            await sql`DELETE FROM funding_request_items WHERE funding_request_id = ${rffId}`;
            for (const item of parsedItems) {
                await sql`
                    INSERT INTO funding_request_items (
                        funding_request_id,
                        description,
                        category,
                        quantity,
                        unit_cost,
                        total_cost
                    ) VALUES (
                        ${rffId},
                        ${item.description},
                        ${item.category},
                        ${item.quantity},
                        ${item.unit_cost},
                        ${item.total_cost}
                    )
                `;
            }

            // Handle submission transitions
            if (submit) {
                const initialHandlerRole = 'PROGRAMS_ME_OFFICER';

                // Check if there is an existing submission record
                const [existingSub] = await sql`
                    SELECT id FROM unified_submissions WHERE id = ${existing.submission_id} LIMIT 1
                `;

                if (existingSub) {
                    // Update existing submission
                    await sql`
                        UPDATE unified_submissions
                        SET current_handler_role = ${initialHandlerRole},
                            status = 'submitted',
                            title = ${`RFF: ${activity_name}`},
                            description = ${narrative_justification},
                            metadata = ${JSON.stringify({
                                project_id,
                                program_id,
                                indicator_id,
                                district_name,
                                activity_name,
                                total_requested_amount: totalAmount,
                            })}::jsonb,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE id = ${existing.submission_id}
                    `;

                    // Log workflow action
                    await sql`
                        INSERT INTO submission_workflow_logs (
                            submission_id,
                            action,
                            to_status,
                            acted_by_user_id,
                            comment
                        ) VALUES (
                            ${existing.submission_id},
                            'submit',
                            'submitted',
                            ${userId},
                            'Funding request updated and resubmitted for M&E Review'
                        )
                    `;
                } else {
                    // Create new submission record
                    const [submission] = await sql`
                        INSERT INTO unified_submissions (
                            submitter_user_id,
                            submission_type,
                            title,
                            description,
                            current_handler_role,
                            status,
                            related_entity_type,
                            related_entity_id,
                            metadata,
                            signatures
                        ) VALUES (
                            ${userId},
                            'request_for_funds',
                            ${`RFF: ${activity_name}`},
                            ${narrative_justification},
                            ${initialHandlerRole},
                            'submitted',
                            'funding_request',
                            ${rffId},
                            ${JSON.stringify({
                                project_id,
                                program_id,
                                indicator_id,
                                district_name,
                                activity_name,
                                total_requested_amount: totalAmount,
                            })}::jsonb,
                            '[]'::jsonb
                        ) RETURNING *
                    `;

                    await sql`
                        UPDATE funding_requests
                        SET submission_id = ${submission.id}
                        WHERE id = ${rffId}
                    `;

                    await sql`
                        INSERT INTO submission_workflow_logs (
                            submission_id,
                            action,
                            to_status,
                            acted_by_user_id,
                            comment
                        ) VALUES (
                            ${submission.id},
                            'submit',
                            'submitted',
                            ${userId},
                            'Funding request submitted for M&E Review'
                        )
                    `;
                }
                return successResponse({ ...rff, status: 'submitted' });
            }

            return successResponse({ ...rff, status: 'draft' });
        }

        // 5. GET /api/funding-requests/:id - Load specific funding request and its line items
        if (method === 'GET' && idMatch) {
            const rffId = idMatch[1];
            const [rff] = await sql`
                SELECT fr.*, u.name as submitter_name, p.name as project_name, pg.name as program_name,
                       s.status as submission_status, s.signatures as submission_signatures, s.current_handler_role
                FROM funding_requests fr
                JOIN users u ON fr.submitter_user_id = u.id
                LEFT JOIN projects p ON fr.project_id = p.id
                LEFT JOIN programs pg ON fr.program_id = pg.id
                LEFT JOIN unified_submissions s ON fr.submission_id = s.id
                WHERE fr.id = ${rffId}
                LIMIT 1
            `;
            if (!rff) throw new HttpError('Request for Funds not found', 404);

            const items = await sql`
                SELECT * FROM funding_request_items
                WHERE funding_request_id = ${rffId}
                ORDER BY created_at ASC
            `;

            const [liquidation] = await sql`
                SELECT l.*, u.name as verifier_name
                FROM liquidations l
                LEFT JOIN users u ON l.submitted_by_user_id = u.id
                WHERE l.funding_request_id = ${rffId}
                LIMIT 1
            `;

            return successResponse({
                ...rff,
                items,
                liquidation: liquidation || null,
            });
        }

        // 6. GET /api/funding-requests - List drafts or user requests
        if (method === 'GET' && (path === '/api/funding-requests' || path === '/api/funding-requests/')) {
            const limit = parseInt(query.limit) || 50;
            const offset = parseInt(query.offset) || 0;

            const results = await sql`
                SELECT fr.*, u.name as submitter_name, p.name as project_name, pg.name as program_name,
                       s.status as submission_status, s.current_handler_role
                FROM funding_requests fr
                JOIN users u ON fr.submitter_user_id = u.id
                LEFT JOIN projects p ON fr.project_id = p.id
                LEFT JOIN programs pg ON fr.program_id = pg.id
                LEFT JOIN unified_submissions s ON fr.submission_id = s.id
                WHERE fr.submitter_user_id = ${userId}
                ORDER BY fr.created_at DESC
                LIMIT ${limit} OFFSET ${offset}
            `;

            return successResponse(results);
        }

        // 7. POST /api/funding-requests/:id/liquidate - Liquidation submissions
        const liquidateMatch = path.match(/\/api\/funding-requests\/([^\/]+)\/liquidate$/);
        if (method === 'POST' && liquidateMatch) {
            const rffId = liquidateMatch[1];
            const body = parseBody(event);
            const { actual_amount_spent, notes, receipts, items } = body;

            const [rff] = await sql`
                SELECT fr.*, s.status as submission_status
                FROM funding_requests fr
                JOIN unified_submissions s ON fr.submission_id = s.id
                WHERE fr.id = ${rffId}
                LIMIT 1
            `;
            if (!rff) throw new HttpError('Request for Funds not found', 404);
            if (rff.submission_status !== 'approved') {
                throw new HttpError('Cannot liquidate an unapproved Request for Funds', 400);
            }

            const totalRequested = Number(rff.total_requested_amount);
            const actualSpent = Number(actual_amount_spent || 0);
            const variance = Number((totalRequested - actualSpent).toFixed(2));

            // Upsert liquidation record
            const [liquidation] = await sql`
                INSERT INTO liquidations (
                    funding_request_id,
                    submitted_by_user_id,
                    actual_amount_spent,
                    variance_amount,
                    notes,
                    status,
                    receipts,
                    items
                ) VALUES (
                    ${rffId},
                    ${userId},
                    ${actualSpent},
                    ${variance},
                    ${notes},
                    'pending',
                    ${JSON.stringify(receipts || [])}::jsonb,
                    ${JSON.stringify(items || [])}::jsonb
                )
                ON CONFLICT (funding_request_id) DO UPDATE
                SET actual_amount_spent = EXCLUDED.actual_amount_spent,
                    variance_amount = EXCLUDED.variance_amount,
                    notes = EXCLUDED.notes,
                    status = 'pending',
                    receipts = EXCLUDED.receipts,
                    items = EXCLUDED.items,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING *
            `;

            // Update submission status to 'liquidating' / verified if needed, or track it in metadata
            await sql`
                UPDATE unified_submissions
                SET metadata = jsonb_set(metadata, '{liquidation_status}', '"pending"'::jsonb)
                WHERE id = ${rff.submission_id}
            `;

            return successResponse(liquidation);
        }

        // 8. POST /api/funding-requests/:id/liquidate/verify - Finance action on liquidation
        const verifyLiquidationMatch = path.match(/\/api\/funding-requests\/([^\/]+)\/liquidate\/verify$/);
        if (method === 'POST' && verifyLiquidationMatch) {
            const rffId = verifyLiquidationMatch[1];
            const body = parseBody(event);
            const { action, comments } = body; // action: 'verify' or 'reject'

            if (!hasPermission(userContext, 'expense.review_finance') && userContext.role_code !== 'FINANCE_OFFICER') {
                throw new HttpError('You do not have permission to verify liquidations', 403);
            }

            const [liquidation] = await sql`
                SELECT * FROM liquidations WHERE funding_request_id = ${rffId} LIMIT 1
            `;
            if (!liquidation) throw new HttpError('Liquidation record not found', 404);

            const toStatus = action === 'verify' ? 'verified' : 'rejected';

            const [updated] = await sql`
                UPDATE liquidations
                SET status = ${toStatus},
                    notes = COALESCE(notes, '') || ${`\nVerification note: ${comments || 'No comment'}`},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${liquidation.id}
                RETURNING *
            `;

            // If verified, we can commit the changes to the project budget!
            if (toStatus === 'verified') {
                const [rff] = await sql`
                    SELECT * FROM funding_requests WHERE id = ${rffId} LIMIT 1
                `;
                // Increment used_amount of project's main budget line or allocate it proportionately
                // Wait! Let's find budget lines linked to the project and increase `used_amount` by actual spent.
                // For simplicity, we increment the first active budget line of the project.
                const [budgetLine] = await sql`
                    SELECT bl.id
                    FROM budget_lines bl
                    JOIN budgets b ON bl.budget_id = b.id
                    WHERE b.project_id = ${rff.project_id}
                    LIMIT 1
                `;

                if (budgetLine) {
                    await sql`
                        UPDATE budget_lines
                        SET used_amount = used_amount + ${updated.actual_amount_spent}
                        WHERE id = ${budgetLine.id}
                    `;
                }

                await sql`
                    UPDATE unified_submissions
                    SET metadata = jsonb_set(metadata, '{liquidation_status}', '"verified"'::jsonb)
                    WHERE id = ${rff.submission_id}
                `;
            } else {
                await sql`
                    UPDATE unified_submissions
                    SET metadata = jsonb_set(metadata, '{liquidation_status}', '"rejected"'::jsonb)
                    WHERE id = ${rff.submission_id}
                `;
            }

            return successResponse(updated);
        }

        throw new HttpError('Route not found', 404);
    } catch (err) {
        if (err instanceof HttpError) {
            return errorResponse(err.message, err.statusCode);
        }
        console.error('Funding Request API error:', err);
        return errorResponse('Internal server error', 500, err.message);
    }
};
