/**
 * prQueryEmailTemplates.ts
 *
 * Pure functions — no SMTP, no I/O.
 * Each function receives the query data and returns { subject, htmlBody }
 * ready to be stored in PrQueryEmailQueue and later sent by the email worker.
 *
 * Logo: served from the frontend's public directory.
 * Set FRONTEND_URL in .env to the deployed frontend origin (e.g. https://portal.devday26.com).
 * Falls back to http://localhost:3001 for local development.
 */

export interface PrQueryEmailPayload {
    subject:  string
    htmlBody: string
}

interface QueryDetails {
    participantName:  string
    participantEmail: string
    rollNumber:       string | null
    competitionName:  string
    resolvedNote?:    string | null
}

// ─── Logo URL ─────────────────────────────────────────────────────────────────

const FRONTEND_URL   = (process.env.FRONTEND_URL ?? 'http://localhost:3001').replace(/\/$/, '')
const LOGO_URL       = `${FRONTEND_URL}/logos/devday26-logo.png`
const LOGO_ALT       = 'Developers Day 2026'

// ─── Shared styles ────────────────────────────────────────────────────────────

const BASE_STYLES = `
    body        { margin:0; padding:0; background:#f0f0f0; font-family: Arial, sans-serif; }
    .wrapper    { max-width:600px; margin:40px auto; background:#ffffff; border-radius:10px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,0.10); }
    .header     { padding:28px 40px 20px; display:flex; align-items:center; gap:16px; }
    .logo       { width:52px; height:auto; display:block; }
    .brand      { display:flex; flex-direction:column; }
    .body       { padding:24px 40px 32px; color:#333333; font-size:15px; line-height:1.65; }
    .detail-box { border-left:4px solid #cccccc; padding:14px 18px; margin:20px 0; border-radius:4px; background:#f7f7f7; }
    .detail-box p { margin:5px 0; font-size:14px; color:#555; }
    .detail-box strong { color:#222; }
    .note-box   { background:#fffbf0; border-left:4px solid #f5c518; padding:14px 18px; margin:20px 0; border-radius:4px; font-size:14px; color:#666; }
    .divider    { border:none; border-top:1px solid #eeeeee; margin:24px 0; }
    .footer     { padding:18px 40px; background:#f7f7f7; font-size:12px; color:#aaa; text-align:center; border-top:1px solid #e8e8e8; }
    h1          { margin:0; font-size:20px; font-weight:700; }
    h2          { margin:0 0 4px; font-size:13px; font-weight:400; letter-spacing:0.05em; }
    p           { margin:0 0 12px; }
`

// ─── Logo block (shared) ──────────────────────────────────────────────────────

function logoBlock(headerBg: string, subtitle: string, subtitleColor: string): string {
    return `
    <div class="header" style="background:${headerBg};">
      <img src="${LOGO_URL}" alt="${LOGO_ALT}" class="logo" width="52" />
      <div class="brand">
        <h1 style="color:#ffffff;">${LOGO_ALT}</h1>
        <h2 style="color:${subtitleColor};">${subtitle}</h2>
      </div>
    </div>`
}

// ─── APPROVAL template ────────────────────────────────────────────────────────

export function buildApprovalEmail(details: QueryDetails): PrQueryEmailPayload {
    const { participantName, rollNumber, competitionName, resolvedNote } = details

    const subject = `✅ Competition Request Approved — ${competitionName} | Developers Day 2026`

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Request Approved</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="wrapper">

    ${logoBlock('#1a1a1a', '✅ Competition Request Approved', '#6fcf8a')}

    <div class="body">
      <p>Dear <strong>${escapeHtml(participantName)}</strong>,</p>
      <p>
        Great news! The PR team has reviewed your competition change request and it has been
        <strong style="color:#1a7a3c;">approved</strong>.
      </p>

      <div class="detail-box" style="border-left-color:#1a7a3c; background:#f2fbf5;">
        <p><strong>Participant Name:</strong> ${escapeHtml(participantName)}</p>
        ${rollNumber ? `<p><strong>Roll Number:</strong> ${escapeHtml(rollNumber)}</p>` : ''}
        <p><strong>Competition:</strong> ${escapeHtml(competitionName)}</p>
        <p><strong>Status:</strong> <span style="color:#1a7a3c; font-weight:bold;">✅ APPROVED</span></p>
      </div>

      ${resolvedNote ? `
      <div class="note-box">
        <strong>📝 Note from PR Team:</strong><br/><br/>
        ${escapeHtml(resolvedNote)}
      </div>` : ''}

      <hr class="divider" />

      <p>
        Please check the updated schedule and report to your competition venue on time.
        If you have any further questions, feel free to reach out to the PR team directly.
      </p>
      <p>Best of luck! 🎉<br/><strong>Developers Day 2026 — PR Team</strong></p>
    </div>

    <div class="footer">
      This is an automated notification from the Developers Day 2026 portal.<br/>
      Please do not reply to this email directly.
    </div>
  </div>
</body>
</html>`

    return { subject, htmlBody }
}

// ─── REJECTION template ───────────────────────────────────────────────────────

export function buildRejectionEmail(details: QueryDetails): PrQueryEmailPayload {
    const { participantName, rollNumber, competitionName, resolvedNote } = details

    const subject = `❌ Competition Request Could Not Be Approved — ${competitionName} | Developers Day 2026`

    const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Request Not Approved</title>
  <style>${BASE_STYLES}</style>
</head>
<body>
  <div class="wrapper">

    ${logoBlock('#1a1a1a', '❌ Competition Request Not Approved', '#f0a0a0')}

    <div class="body">
      <p>Dear <strong>${escapeHtml(participantName)}</strong>,</p>
      <p>
        Thank you for submitting your request. Unfortunately, after reviewing your competition
        change request, the PR team has been unable to <strong style="color:#8b1a1a;">approve</strong> it at this time.
      </p>

      <div class="detail-box" style="border-left-color:#8b1a1a; background:#fdf5f5;">
        <p><strong>Participant Name:</strong> ${escapeHtml(participantName)}</p>
        ${rollNumber ? `<p><strong>Roll Number:</strong> ${escapeHtml(rollNumber)}</p>` : ''}
        <p><strong>Competition:</strong> ${escapeHtml(competitionName)}</p>
        <p><strong>Status:</strong> <span style="color:#8b1a1a; font-weight:bold;">❌ REJECTED</span></p>
      </div>

      ${resolvedNote ? `
      <div class="note-box" style="border-left-color:#e05252; background:#fff5f5;">
        <strong>📝 Reason from PR Team:</strong><br/><br/>
        ${escapeHtml(resolvedNote)}
      </div>` : ''}

      <hr class="divider" />

      <p>
        If you believe this decision was made in error or would like to discuss further,
        please contact the PR team directly at your earliest convenience.
      </p>
      <p>
        We apologise for any inconvenience caused.<br/>
        <strong>Developers Day 2026 — PR Team</strong>
      </p>
    </div>

    <div class="footer">
      This is an automated notification from the Developers Day 2026 portal.<br/>
      Please do not reply to this email directly.
    </div>
  </div>
</body>
</html>`

    return { subject, htmlBody }
}

// ─── Helper ───────────────────────────────────────────────────────────────────

/** Escape characters that could break HTML or allow XSS if inserted from user input. */
function escapeHtml(text: string): string {
    return text
        .replace(/&/g,  '&amp;')
        .replace(/</g,  '&lt;')
        .replace(/>/g,  '&gt;')
        .replace(/"/g,  '&quot;')
        .replace(/'/g,  '&#039;')
}
