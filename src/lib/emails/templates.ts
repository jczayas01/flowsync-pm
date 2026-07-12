// src/lib/emails/templates.ts
// Centralized transactional email templates for Resend
// All templates return { subject, html } for use with Resend

interface BaseCtx {
  recipientName:  string
  workspaceName?: string
  appUrl?:        string
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://flowsyncpm.com'

function layout(content: string, previewText = ''): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>FlowSync PM</title>
${previewText ? `<div style="display:none;max-height:0;overflow:hidden">${previewText}</div>` : ''}
</head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:Inter,-apple-system,BlinkMacSystemFont,sans-serif;-webkit-font-smoothing:antialiased">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:40px 0">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%">
  <!-- Header -->
  <tr><td style="background:#0D1B2A;border-radius:10px 10px 0 0;padding:24px 32px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td>
        <div style="display:inline-flex;align-items:center;gap:8px">
          <span style="font-size:18px;font-weight:700;color:#ffffff;letter-spacing:-.02em">
            FlowSync <span style="color:#F59E0B">PM</span>
          </span>
        </div>
      </td>
    </tr></table>
  </td></tr>
  <!-- Body -->
  <tr><td style="background:#ffffff;padding:36px 32px;border-left:1px solid #E2E8F0;border-right:1px solid #E2E8F0">
    ${content}
  </td></tr>
  <!-- Footer -->
  <tr><td style="background:#F8FAFC;border:1px solid #E2E8F0;border-top:none;border-radius:0 0 10px 10px;padding:20px 32px">
    <p style="margin:0;font-size:12px;color:#94A3B8;line-height:1.6">
      You received this email from <a href="${APP_URL}" style="color:#1B6CA8;text-decoration:none">FlowSync PM</a>.
      If you believe this was sent in error, you can safely ignore it.<br>
      © ${new Date().getFullYear()} FlowSync PM. All rights reserved.
    </p>
  </td></tr>
</table>
</td></tr>
</table>
</body>
</html>`
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 8px;font-size:22px;font-weight:600;color:#0F172A;letter-spacing:-.02em">${text}</h1>`
}
function p(text: string, muted = false): string {
  return `<p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:${muted ? '#64748B' : '#334155'}">${text}</p>`
}
function btn(text: string, url: string, color = '#1B6CA8'): string {
  return `<table cellpadding="0" cellspacing="0" style="margin:24px 0"><tr>
    <td style="background:${color};border-radius:8px">
      <a href="${url}" style="display:inline-block;padding:13px 24px;font-size:14px;font-weight:600;color:#fff;text-decoration:none;letter-spacing:-.01em">
        ${text}
      </a>
    </td>
  </tr></table>`
}
function divider(): string {
  return `<hr style="border:none;border-top:1px solid #E2E8F0;margin:24px 0">`
}
function infoBox(content: string, color = '#EFF6FF', border = '#DBEAFE'): string {
  return `<div style="background:${color};border:1px solid ${border};border-radius:8px;padding:16px 18px;margin:16px 0">
    ${content}
  </div>`
}

// ── TEMPLATE EXPORTS ──────────────────────────────────

export function workspaceInviteEmail({ recipientName, inviterName, workspaceName, role, acceptUrl }: {
  recipientName: string; inviterName: string; workspaceName: string; role: string; acceptUrl: string
}) {
  const roleLabel = role.replace(/_/g,' ').replace(/\w/g,c=>c.toUpperCase())
  return {
    subject: `${inviterName} invited you to ${workspaceName} on FlowSync PM`,
    html: layout(`
      ${h1(`You've been invited!`)}
      ${p(`<strong>${inviterName}</strong> has invited you to join <strong>${workspaceName}</strong> on FlowSync PM as a <strong>${roleLabel}</strong>.`)}
      ${infoBox(`
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td style="font-size:12px;color:#64748B;padding-bottom:4px">Workspace</td>
            <td style="font-size:12px;color:#64748B;padding-bottom:4px">Role</td>
          </tr>
          <tr>
            <td style="font-size:14px;font-weight:600;color:#0F172A">${workspaceName}</td>
            <td style="font-size:14px;font-weight:600;color:#1B6CA8">${roleLabel}</td>
          </tr>
        </table>
      `)}
      ${btn('Accept invitation →', acceptUrl)}
      ${p('This invitation expires in 7 days. If you did not expect this invitation, you can safely ignore this email.', true)}
    `, `${inviterName} invited you to ${workspaceName}`)
  }
}

export function taskAssignedEmail({ recipientName, taskTitle, taskCode, projectName, assignerName, dueDate, taskUrl }: {
  recipientName: string; taskTitle: string; taskCode: string; projectName: string;
  assignerName: string; dueDate?: string | null; taskUrl: string
}) {
  return {
    subject: `[${taskCode}] Task assigned: ${taskTitle}`,
    html: layout(`
      ${h1('Task assigned to you')}
      ${p(`<strong>${assignerName}</strong> assigned you a task in <strong>${projectName}</strong>.`)}
      ${infoBox(`
        <p style="margin:0 0 6px;font-size:12px;color:#64748B">${taskCode} · ${projectName}</p>
        <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#0F172A">${taskTitle}</p>
        ${dueDate ? `<p style="margin:0;font-size:13px;color:#DC2626;font-weight:500">Due ${new Date(dueDate).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'})}</p>` : ''}
      `)}
      ${btn('View task →', taskUrl)}
    `, `New task: ${taskTitle}`)
  }
}

export function taskOverdueEmail({ recipientName, taskTitle, taskCode, projectName, daysOverdue, taskUrl }: {
  recipientName: string; taskTitle: string; taskCode: string;
  projectName: string; daysOverdue: number; taskUrl: string
}) {
  return {
    subject: `⏰ Overdue: ${taskCode} — ${taskTitle}`,
    html: layout(`
      ${h1('Task is overdue')}
      ${p(`A task assigned to you in <strong>${projectName}</strong> is <strong>${daysOverdue} day${daysOverdue > 1 ? 's' : ''} overdue</strong>.`)}
      ${infoBox(`
        <p style="margin:0 0 4px;font-size:12px;color:#64748B">${taskCode} · ${projectName}</p>
        <p style="margin:0;font-size:15px;font-weight:600;color:#DC2626">${taskTitle}</p>
      `, '#FEF2F2', '#FECACA')}
      ${btn('Update task status →', taskUrl, '#DC2626')}
      ${p('Keeping task status up to date helps your project manager track progress accurately.', true)}
    `, `Overdue task: ${taskTitle}`)
  }
}

export function projectHealthChangedEmail({ recipientName, projectName, projectCode, oldHealth, newHealth, reason, projectUrl }: {
  recipientName: string; projectName: string; projectCode: string;
  oldHealth: string; newHealth: string; reason?: string; projectUrl: string
}) {
  const colors: Record<string,{bg:string;border:string;text:string;label:string}> = {
    GREEN: { bg:'#ECFDF5', border:'#A7F3D0', text:'#059669', label:'On track'  },
    AMBER: { bg:'#FFFBEB', border:'#FDE68A', text:'#D97706', label:'At risk'   },
    RED:   { bg:'#FEF2F2', border:'#FECACA', text:'#DC2626', label:'Off track' },
  }
  const c = colors[newHealth] || colors.AMBER
  return {
    subject: `${newHealth === 'RED' ? '🔴' : newHealth === 'AMBER' ? '🟡' : '🟢'} Project ${newHealth === 'RED' ? 'at risk' : 'update'}: ${projectName}`,
    html: layout(`
      ${h1(`Project health changed`)}
      ${p(`The health status of <strong>${projectName}</strong> has changed.`)}
      ${infoBox(`
        <table width="100%" cellpadding="0" cellspacing="0"><tr>
          <td style="text-align:center;padding:8px">
            <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.06em">Previous</p>
            <p style="margin:0;font-size:14px;font-weight:600;color:${colors[oldHealth]?.text || '#64748B'}">${colors[oldHealth]?.label || oldHealth}</p>
          </td>
          <td style="text-align:center;font-size:20px">→</td>
          <td style="text-align:center;padding:8px;background:${c.bg};border-radius:6px">
            <p style="margin:0 0 4px;font-size:11px;color:#64748B;text-transform:uppercase;letter-spacing:.06em">Now</p>
            <p style="margin:0;font-size:14px;font-weight:700;color:${c.text}">${c.label}</p>
          </td>
        </tr></table>
        ${reason ? `<p style="margin:12px 0 0;font-size:13px;color:#475569;font-style:italic">"${reason}"</p>` : ''}
      `, c.bg, c.border)}
      ${btn('Review project →', projectUrl, newHealth === 'RED' ? '#DC2626' : '#1B6CA8')}
    `, `${projectName} is now ${colors[newHealth]?.label || newHealth}`)
  }
}

export function weeklyStatusReportEmail({ recipientName, projectName, reportHtml, projectUrl, weekOf }: {
  recipientName: string; projectName: string; reportHtml: string; projectUrl: string; weekOf: string
}) {
  return {
    subject: `Weekly status: ${projectName} — ${weekOf}`,
    html: layout(`
      ${h1(`Weekly Status Report`)}
      ${p(`Your weekly project status report for <strong>${projectName}</strong> — week of ${weekOf}.`)}
      ${divider()}
      ${reportHtml}
      ${divider()}
      ${btn('View full report →', projectUrl)}
    `, `Weekly status for ${projectName}`)
  }
}

export function milestoneApproachingEmail({ recipientName, milestoneName, projectName, daysUntil, dueDate, projectUrl }: {
  recipientName: string; milestoneName: string; projectName: string;
  daysUntil: number; dueDate: string; projectUrl: string
}) {
  return {
    subject: `🎯 Milestone in ${daysUntil} day${daysUntil !== 1 ? 's' : ''}: ${milestoneName}`,
    html: layout(`
      ${h1('Upcoming milestone')}
      ${p(`A milestone in <strong>${projectName}</strong> is approaching.`)}
      ${infoBox(`
        <p style="margin:0 0 4px;font-size:12px;color:#64748B">${projectName}</p>
        <p style="margin:0 0 8px;font-size:16px;font-weight:600;color:#0F172A">◇ ${milestoneName}</p>
        <p style="margin:0;font-size:13px;font-weight:600;color:${daysUntil <= 3 ? '#DC2626' : '#D97706'}">
          Due ${new Date(dueDate).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'})} 
          (${daysUntil} day${daysUntil !== 1 ? 's' : ''} away)
        </p>
      `, daysUntil <= 3 ? '#FEF2F2' : '#FFFBEB', daysUntil <= 3 ? '#FECACA' : '#FDE68A')}
      ${btn('Review milestone →', projectUrl)}
    `, `Milestone due in ${daysUntil} days: ${milestoneName}`)
  }
}

export function passwordResetEmail({ recipientName, resetUrl }: {
  recipientName: string; resetUrl: string
}) {
  return {
    subject: 'Reset your FlowSync PM password',
    html: layout(`
      ${h1('Password reset request')}
      ${p(`Hi ${recipientName}, we received a request to reset the password for your FlowSync PM account.`)}
      ${btn('Reset password →', resetUrl)}
      ${p('This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email — your password will not change.', true)}
      ${divider()}
      ${p(`If the button doesn't work, copy and paste this link:<br><a href="${resetUrl}" style="color:#1B6CA8;word-break:break-all;font-size:12px">${resetUrl}</a>`, true)}
    `, 'Reset your FlowSync PM password')
  }
}

export function trialEndingSoonEmail({ recipientName, workspaceName, trialEndDate, daysLeft, upgradeUrl }: {
  recipientName: string; workspaceName: string; trialEndDate: string; daysLeft: number; upgradeUrl: string
}) {
  return {
    subject: `⚡ Your FlowSync PM trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`,
    html: layout(`
      ${h1(`Trial ending soon`)}
      ${p(`Your 14-day free trial of FlowSync PM for <strong>${workspaceName}</strong> ends on <strong>${new Date(trialEndDate).toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'UTC'})}</strong>.`)}
      ${infoBox(`
        <p style="margin:0 0 8px;font-size:13px;color:#0F172A;font-weight:600">${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining</p>
        <p style="margin:0;font-size:13px;color:#475569">Add a payment method to keep your access and lock in your current plan rate.</p>
      `, '#FFFBEB', '#FDE68A')}
      ${btn('Upgrade now — keep your data →', upgradeUrl, '#F59E0B')}
      ${p('Your projects, tasks, team members, and settings will all be preserved when you upgrade. Nothing is lost.', true)}
    `, `Trial ending in ${daysLeft} days — add payment to continue`)
  }
}

// ── Sender helper ──────────────────────────────────────
export async function sendEmail({ to, ...template }: {
  to: string; subject: string; html: string
}): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[Email] RESEND_API_KEY not set — skipping email to', to)
    return false
  }
  try {
    const { Resend } = await import('resend')
    const resend = new Resend(process.env.RESEND_API_KEY)
    await resend.emails.send({
      from:    process.env.RESEND_FROM_EMAIL || 'FlowSync PM <no-reply@flowsyncpm.com>',
      to,
      subject: template.subject,
      html:    template.html,
    })
    return true
  } catch (e) {
    console.error('[Email] Send failed:', e)
    return false
  }
}
