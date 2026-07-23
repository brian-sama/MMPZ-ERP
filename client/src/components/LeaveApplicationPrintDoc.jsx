import React from 'react';

export const LEAVE_CATEGORY_OPTIONS = [
    { value: 'vacation_annual', label: 'Vacation/Annual' },
    { value: 'sick', label: 'Sick' },
    { value: 'maternity', label: 'Maternity' },
    { value: 'study', label: 'Study' },
    { value: 'compassionate', label: 'Compassionate' },
    { value: 'off_days', label: 'Off Days' },
];

const FINANCE_REVIEW_ROLES = [
    'FINANCE_OFFICER',
    'ADMIN_FINANCE_ASSISTANT',
    'FINANCE_ADMIN_OFFICER',
    'ADMIN_ASSISTANT',
    'LOGISTICS_ASSISTANT',
];

const DAY_MS = 24 * 60 * 60 * 1000;

const ORGANIZATION = {
    name: 'Million Memory Project Zimbabwe (MMPZ)',
    address: 'Mpilo Opportunistic Infections Clinic, Old Victoria Falls Road, Mzilikazi, Bulawayo, Zimbabwe',
    email: 'mmpztrust@zol.co.zw',
    mobile: '+263781706087',
    landline: '+263292201899',
    logoSrc: '/mmpz-logo.png',
};

export const parseLeaveMetadata = (metadata) => {
    if (!metadata) return {};
    if (typeof metadata === 'string') {
        try {
            return JSON.parse(metadata) || {};
        } catch {
            return {};
        }
    }
    return metadata;
};

const parseJsonArray = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }
    return [];
};

const toNumber = (value, fallback = 0) => {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
};

const roundDays = (value) => Math.round(toNumber(value) * 100) / 100;

export const formatDayNumber = (value) => {
    const rounded = roundDays(value);
    return Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1);
};

const normalizeLeaveType = (value) => {
    const normalized = String(value || '')
        .trim()
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/\//g, '_')
        .replace(/\s+/g, '_')
        .replace(/-+/g, '_');

    if (['annual', 'vacation', 'vacation_annual', 'vacation_and_annual'].includes(normalized)) {
        return 'vacation_annual';
    }
    if (['off', 'offdays', 'off_days'].includes(normalized)) return 'off_days';
    if (normalized === 'compassion') return 'compassionate';
    return LEAVE_CATEGORY_OPTIONS.some((option) => option.value === normalized)
        ? normalized
        : 'vacation_annual';
};

export const getLeaveTypeLabel = (value) => {
    const normalized = normalizeLeaveType(value);
    return LEAVE_CATEGORY_OPTIONS.find((option) => option.value === normalized)?.label || 'Vacation/Annual';
};

const parseDateOnly = (value) => {
    if (!value) return null;
    const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return null;
    const [, y, m, d] = match;
    const date = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(date.getTime()) ? null : date;
};

export const calculateLeaveDays = (startDate, endDate, basis = 'calendar') => {
    const start = parseDateOnly(startDate);
    const end = parseDateOnly(endDate);
    if (!start || !end || end < start) return 0;

    if (basis === 'business') {
        let count = 0;
        const cursor = new Date(start);
        while (cursor <= end) {
            const day = cursor.getDay();
            if (day !== 0 && day !== 6) count += 1;
            cursor.setDate(cursor.getDate() + 1);
        }
        return count;
    }

    return Math.floor((end - start) / DAY_MS) + 1;
};

const formatRoleLabel = (value) =>
    String(value || '')
        .split('_')
        .filter(Boolean)
        .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
        .join(' ');

export const getDefaultEmployeeNo = (user) => {
    if (!user) return '';
    return (
        user.employee_no ||
        user.employee_number ||
        user.staff_number ||
        user.staff_no ||
        (user.id ? `MMPZ-${String(user.id).padStart(4, '0')}` : '')
    );
};

export const getDefaultPosition = (user) =>
    user?.identity?.displayTitle || user?.job_title || formatRoleLabel(user?.role_code) || '';

export const getLeaveBalanceSnapshot = (leaveBalance) => {
    const allocated = toNumber(leaveBalance?.allocated_days);
    const used = toNumber(leaveBalance?.used_days);
    const pending = toNumber(leaveBalance?.pending_days);
    return {
        allocated,
        used,
        pending,
        remaining: roundDays(allocated - used - pending),
    };
};

export const buildLeaveBreakdownRows = (metadata, leaveBalance) => {
    const meta = parseLeaveMetadata(metadata);
    const selectedType = normalizeLeaveType(meta.leave_type || meta.leave_category);
    const requested = roundDays(
        meta.days_requested ||
        calculateLeaveDays(meta.start_date, meta.end_date, meta.day_count_basis || 'calendar'),
    );
    const submittedRows = Array.isArray(meta.leave_breakdown) ? meta.leave_breakdown : null;
    const balance = getLeaveBalanceSnapshot(leaveBalance);

    return LEAVE_CATEGORY_OPTIONS.map((option) => {
        const submitted = submittedRows?.find((row) =>
            normalizeLeaveType(row.leave_type || row.type || row.label) === option.value
        );
        const defaultBalance = option.value === 'vacation_annual' ? balance.remaining : 0;
        const balanceBf = roundDays(submitted?.balance_bf ?? submitted?.balanceBF ?? defaultBalance);
        const daysTaken = roundDays(
            submitted?.days_taken ??
            submitted?.days_requested ??
            (option.value === selectedType ? requested : 0)
        );

        return {
            leave_type: option.value,
            label: option.label,
            balance_bf: balanceBf,
            days_taken: daysTaken,
            balance_remaining: roundDays(
                submitted?.balance_remaining ?? submitted?.balanceRemaining ?? (balanceBf - daysTaken),
            ),
        };
    });
};

const formatDateDisplay = (value, includeTime = false) => {
    if (!value) return '';

    const date = includeTime ? new Date(value) : parseDateOnly(value);
    if (!date || Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        ...(includeTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
};

const findVerificationSignature = (signatures) =>
    signatures.find((signature) => String(signature.action || '').toLowerCase() === 'verify') ||
    signatures.find((signature) =>
        FINANCE_REVIEW_ROLES.includes(signature.role) &&
        ['approve', 'approved'].includes(String(signature.action || '').toLowerCase())
    );

const findAuthorizationSignature = (signatures) =>
    signatures.find((signature) =>
        signature.role === 'DIRECTOR' &&
        ['approve', 'approved'].includes(String(signature.action || '').toLowerCase())
    ) ||
    signatures.find((signature) => ['approve', 'approved'].includes(String(signature.action || '').toLowerCase()));

export const buildLeavePrintModel = (submission, currentUser, leaveBalance) => {
    const metadata = parseLeaveMetadata(submission?.metadata);
    const signatures = parseJsonArray(submission?.signatures);
    const daysRequested = roundDays(
        metadata.days_requested ||
        calculateLeaveDays(metadata.start_date, metadata.end_date, metadata.day_count_basis || 'calendar'),
    );
    const employeeName = metadata.employee_name || submission?.submitter_name || currentUser?.name || '';
    const employeeNo = metadata.employee_no || getDefaultEmployeeNo(currentUser);
    const position = metadata.position || getDefaultPosition(currentUser);
    const employeeSignature = metadata.employee_signature || {
        name: employeeName,
        timestamp: submission?.created_at,
    };

    return {
        organization: ORGANIZATION,
        title: 'LEAVE APPLICATION FORM.',
        status: submission?.status || 'draft',
        submittedAt: submission?.created_at,
        metadata: {
            ...metadata,
            employee_name: employeeName,
            employee_no: employeeNo,
            position,
            leave_type: normalizeLeaveType(metadata.leave_type || metadata.leave_category),
            leave_type_label: metadata.leave_type_label || getLeaveTypeLabel(metadata.leave_type || metadata.leave_category),
            days_requested: daysRequested,
            day_count_basis: metadata.day_count_basis || 'calendar',
        },
        rows: buildLeaveBreakdownRows({ ...metadata, days_requested: daysRequested }, leaveBalance),
        employeeSignature,
        verificationSignature: findVerificationSignature(signatures),
        authorizationSignature: findAuthorizationSignature(signatures),
    };
};

const escapeHtml = (value) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const renderField = (label, value) => `
    <div class="leave-field">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || '')}</strong>
    </div>
`;

const renderSignature = ({ heading, role, signature, stampText, pendingText }) => `
    <section class="signature-box">
        <div class="signature-heading">${escapeHtml(heading)}</div>
        <div class="signature-line">${signature ? escapeHtml(signature.name || '') : '&nbsp;'}</div>
        <div class="signature-role">${escapeHtml(role)}</div>
        <div class="digital-stamp ${signature ? 'complete' : 'pending'}">
            ${escapeHtml(signature ? stampText : pendingText)}
        </div>
        <div class="signature-date">${signature ? escapeHtml(formatDateDisplay(signature.timestamp, true)) : '&nbsp;'}</div>
    </section>
`;

const leavePrintStyles = `
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    body {
        margin: 0;
        background: #f2f2f2;
        color: #111;
        font-family: Arial, Helvetica, sans-serif;
    }
    .print-toolbar {
        position: sticky;
        top: 0;
        z-index: 5;
        display: flex;
        justify-content: center;
        gap: 10px;
        padding: 12px;
        background: #ffffff;
        border-bottom: 1px solid #d0d0d0;
    }
    .print-toolbar button {
        border: 1px solid #23533f;
        background: #2f5d50;
        color: #fff;
        border-radius: 6px;
        padding: 9px 14px;
        font: 700 13px Arial, Helvetica, sans-serif;
        cursor: pointer;
    }
    .leave-print-doc {
        width: 210mm;
        min-height: 297mm;
        margin: 18px auto;
        padding: 17mm 16mm 15mm;
        background: #fff;
        border: 1px solid #cfcfcf;
        box-shadow: 0 20px 50px rgba(0, 0, 0, 0.12);
    }
    .official-header {
        display: grid;
        grid-template-columns: 86px 1fr;
        align-items: center;
        gap: 16px;
        padding-bottom: 12px;
        border-bottom: 2px solid #111;
    }
    .official-logo {
        width: 82px;
        height: 82px;
        object-fit: contain;
    }
    .official-org {
        text-align: center;
        line-height: 1.35;
    }
    .official-org h1 {
        margin: 0 0 4px;
        font-size: 18px;
        letter-spacing: 0.04em;
        text-transform: uppercase;
    }
    .official-org p {
        margin: 1px 0;
        font-size: 11px;
    }
    .document-title {
        margin: 18px 0 14px;
        text-align: center;
        font-size: 17px;
        font-weight: 800;
        text-decoration: underline;
        letter-spacing: 0.04em;
    }
    .field-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 9px 18px;
        margin-bottom: 12px;
    }
    .leave-field {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 8px;
        align-items: end;
        min-height: 28px;
        font-size: 12px;
    }
    .leave-field.wide {
        grid-column: 1 / -1;
    }
    .leave-field span {
        font-weight: 700;
        white-space: nowrap;
    }
    .leave-field strong {
        min-height: 22px;
        padding: 0 4px 2px;
        border-bottom: 1px dotted #222;
        font-weight: 600;
    }
    .leave-period {
        display: grid;
        grid-template-columns: 1fr 1fr 0.8fr;
        gap: 12px;
        margin: 12px 0;
    }
    .official-table {
        width: 100%;
        border-collapse: collapse;
        margin: 12px 0 16px;
        font-size: 11.5px;
    }
    .official-table th,
    .official-table td {
        border: 1px solid #111;
        padding: 7px 8px;
        text-align: center;
    }
    .official-table th:first-child,
    .official-table td:first-child {
        text-align: left;
        font-weight: 700;
    }
    .official-table th {
        background: #efefef;
        font-weight: 800;
    }
    .signature-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 12px;
        margin-top: 18px;
    }
    .signature-box {
        min-height: 132px;
        border: 1px solid #111;
        padding: 10px;
        display: grid;
        align-content: start;
        gap: 6px;
    }
    .signature-heading {
        font-size: 11px;
        font-weight: 800;
        text-transform: uppercase;
    }
    .signature-line {
        min-height: 28px;
        border-bottom: 1px solid #111;
        font-family: Georgia, 'Times New Roman', serif;
        font-size: 15px;
        font-style: italic;
        padding-top: 5px;
    }
    .signature-role,
    .signature-date {
        font-size: 10.5px;
    }
    .digital-stamp {
        justify-self: start;
        border: 2px solid #111;
        border-radius: 4px;
        padding: 4px 7px;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.05em;
    }
    .digital-stamp.complete {
        color: #1f6b3d;
        border-color: #1f6b3d;
    }
    .digital-stamp.pending {
        color: #777;
        border-color: #999;
    }
    .footer-notice {
        margin-top: 18px;
        border-top: 2px solid #111;
        padding-top: 9px;
        font-size: 10.5px;
        line-height: 1.45;
    }
    .status-strip {
        margin-top: 10px;
        text-align: right;
        font-size: 10px;
        text-transform: uppercase;
        font-weight: 800;
        color: #333;
    }
    @page { size: A4; margin: 10mm; }
    @media print {
        body { background: #fff; }
        .print-toolbar { display: none; }
        .leave-print-doc {
            width: auto;
            min-height: auto;
            margin: 0;
            padding: 0;
            border: none;
            box-shadow: none;
        }
    }
`;

const renderLeaveDocumentHtml = (model) => {
    const meta = model.metadata;
    const periodBasis = meta.day_count_basis === 'business' ? 'Business days' : 'Calendar days';

    return `
        <article class="leave-print-doc">
            <header class="official-header">
                <img class="official-logo" src="${escapeHtml(model.organization.logoSrc)}" alt="MMPZ logo" />
                <div class="official-org">
                    <h1>${escapeHtml(model.organization.name)}</h1>
                    <p>${escapeHtml(model.organization.address)}</p>
                    <p>Email: ${escapeHtml(model.organization.email)} | Mobile: ${escapeHtml(model.organization.mobile)} | Landline: ${escapeHtml(model.organization.landline)}</p>
                </div>
            </header>

            <div class="document-title">${escapeHtml(model.title)}</div>

            <section class="field-grid">
                ${renderField('Employee Name:', meta.employee_name)}
                ${renderField('Employee No:', meta.employee_no)}
                ${renderField('Position:', meta.position)}
                ${renderField('Leave Category:', meta.leave_type_label)}
                <div class="leave-field wide">
                    <span>Contact address during leave period:</span>
                    <strong>${escapeHtml(meta.contact_address || '')}</strong>
                </div>
            </section>

            <section class="leave-period">
                ${renderField('From:', formatDateDisplay(meta.start_date))}
                ${renderField('To:', formatDateDisplay(meta.end_date))}
                ${renderField(`Total leave days (${periodBasis}):`, formatDayNumber(meta.days_requested))}
            </section>

            <table class="official-table">
                <thead>
                    <tr>
                        <th>Leave Type</th>
                        <th>Balance b/f</th>
                        <th>Days taken</th>
                        <th>Balance remaining</th>
                    </tr>
                </thead>
                <tbody>
                    ${model.rows.map((row) => `
                        <tr>
                            <td>${escapeHtml(row.label)}</td>
                            <td>${escapeHtml(formatDayNumber(row.balance_bf))}</td>
                            <td>${escapeHtml(formatDayNumber(row.days_taken))}</td>
                            <td>${escapeHtml(formatDayNumber(row.balance_remaining))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>

            <section class="signature-grid">
                ${renderSignature({
                    heading: 'Employee Signature',
                    role: 'Applicant',
                    signature: model.employeeSignature,
                    stampText: 'DIGITALLY SUBMITTED',
                    pendingText: 'PENDING SUBMISSION',
                })}
                ${renderSignature({
                    heading: 'Verified By',
                    role: 'Fin & Admin Officer',
                    signature: model.verificationSignature,
                    stampText: 'DIGITALLY VERIFIED',
                    pendingText: 'PENDING VERIFICATION',
                })}
                ${renderSignature({
                    heading: 'Authorized By',
                    role: 'Director',
                    signature: model.authorizationSignature,
                    stampText: 'DIGITALLY AUTHORIZED',
                    pendingText: 'PENDING AUTHORIZATION',
                })}
            </section>

            <footer class="footer-notice">
                <strong>Notice:</strong> Leave applications should be submitted at least one month before the intended commencement date to allow proper planning. C.I.L.L. payroll processing is handled only after Finance & Administration verification and Director authorization.
            </footer>
            <div class="status-strip">Submission status: ${escapeHtml(model.status)}</div>
        </article>
    `;
};

export const buildLeaveApplicationPrintHtml = (submission, options = {}) => {
    const model = buildLeavePrintModel(submission, options.currentUser, options.leaveBalance);
    return `<!doctype html>
<html>
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>MMPZ Leave Application Form</title>
    <style>${leavePrintStyles}</style>
</head>
<body>
    <div class="print-toolbar">
        <button type="button" onclick="window.print()">Print / Download Form</button>
    </div>
    ${renderLeaveDocumentHtml(model)}
    <script>
        window.addEventListener('load', function () {
            setTimeout(function () { window.print(); }, 300);
        });
    </script>
</body>
</html>`;
};

export const openLeaveApplicationPrintWindow = (submission, options = {}) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return false;
    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(buildLeaveApplicationPrintHtml(submission, options));
    printWindow.document.close();
    return true;
};

const SignatureBlock = ({ heading, role, signature, stampText, pendingText }) => (
    <section className="leave-print-signature-box">
        <div className="leave-print-signature-heading">{heading}</div>
        <div className="leave-print-signature-line">{signature?.name || ''}</div>
        <div className="leave-print-signature-role">{role}</div>
        <div className={`leave-print-digital-stamp ${signature ? 'complete' : 'pending'}`}>
            {signature ? stampText : pendingText}
        </div>
        <div className="leave-print-signature-date">
            {signature ? formatDateDisplay(signature.timestamp, true) : ''}
        </div>
    </section>
);

export default function LeaveApplicationPrintDoc({ submission, currentUser, leaveBalance }) {
    const model = buildLeavePrintModel(submission, currentUser, leaveBalance);
    const meta = model.metadata;
    const periodBasis = meta.day_count_basis === 'business' ? 'Business days' : 'Calendar days';

    return (
        <article className="leave-print-doc">
            <header className="leave-print-header">
                <img className="leave-print-logo" src={model.organization.logoSrc} alt="MMPZ logo" />
                <div className="leave-print-org">
                    <h1>{model.organization.name}</h1>
                    <p>{model.organization.address}</p>
                    <p>Email: {model.organization.email} | Mobile: {model.organization.mobile} | Landline: {model.organization.landline}</p>
                </div>
            </header>

            <div className="leave-print-title">{model.title}</div>

            <section className="leave-print-fields">
                <div><span>Employee Name:</span><strong>{meta.employee_name}</strong></div>
                <div><span>Employee No:</span><strong>{meta.employee_no}</strong></div>
                <div><span>Position:</span><strong>{meta.position}</strong></div>
                <div><span>Leave Category:</span><strong>{meta.leave_type_label}</strong></div>
                <div className="wide"><span>Contact address during leave period:</span><strong>{meta.contact_address}</strong></div>
                <div><span>From:</span><strong>{formatDateDisplay(meta.start_date)}</strong></div>
                <div><span>To:</span><strong>{formatDateDisplay(meta.end_date)}</strong></div>
                <div><span>Total leave days ({periodBasis}):</span><strong>{formatDayNumber(meta.days_requested)}</strong></div>
            </section>

            <table className="leave-print-table">
                <thead>
                    <tr>
                        <th>Leave Type</th>
                        <th>Balance b/f</th>
                        <th>Days taken</th>
                        <th>Balance remaining</th>
                    </tr>
                </thead>
                <tbody>
                    {model.rows.map((row) => (
                        <tr key={row.leave_type}>
                            <td>{row.label}</td>
                            <td>{formatDayNumber(row.balance_bf)}</td>
                            <td>{formatDayNumber(row.days_taken)}</td>
                            <td>{formatDayNumber(row.balance_remaining)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            <section className="leave-print-signature-grid">
                <SignatureBlock
                    heading="Employee Signature"
                    role="Applicant"
                    signature={model.employeeSignature}
                    stampText="DIGITALLY SUBMITTED"
                    pendingText="PENDING SUBMISSION"
                />
                <SignatureBlock
                    heading="Verified By"
                    role="Fin & Admin Officer"
                    signature={model.verificationSignature}
                    stampText="DIGITALLY VERIFIED"
                    pendingText="PENDING VERIFICATION"
                />
                <SignatureBlock
                    heading="Authorized By"
                    role="Director"
                    signature={model.authorizationSignature}
                    stampText="DIGITALLY AUTHORIZED"
                    pendingText="PENDING AUTHORIZATION"
                />
            </section>

            <footer className="leave-print-footer">
                <strong>Notice:</strong> Leave applications should be submitted at least one month before the intended commencement date to allow proper planning. C.I.L.L. payroll processing is handled only after Finance & Administration verification and Director authorization.
            </footer>
        </article>
    );
}
