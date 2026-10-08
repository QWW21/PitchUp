/**
 * Shared HTML shell for transactional email — ticket E02-09.
 *
 * Every style is inline. Gmail and Outlook strip <style> blocks, so a
 * stylesheet silently becomes no styling at all. Tables rather than flexbox
 * for the same reason: Outlook renders with Word's engine, which has no
 * flex or grid support.
 */

/** Brand colours, from UIUX_SPEC. Repeated literally — email cannot import. */
const PRIMARY = '#16A34A'
const INK = '#111827'
const MUTED = '#6B7280'
const BORDER = '#E5E7EB'

/**
 * Escapes text interpolated into HTML.
 *
 * Names and city names reach these templates from user input; without this a
 * display name containing markup would be injected into the message.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export interface EmailLayoutOptions {
  heading: string
  /** Pre-escaped HTML for the message body. */
  bodyHtml: string
  /** Shown in small print at the bottom. */
  footerNote: string
}

export function renderEmailLayout({ heading, bodyHtml, footerNote }: EmailLayoutOptions): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:0;background:#F9FAFB;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
            <tr>
              <td style="background:${PRIMARY};padding:24px;text-align:center;">
                <span style="color:#FFFFFF;font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;letter-spacing:0.5px;">PitchUp</span>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 24px;font-family:Arial,Helvetica,sans-serif;color:${INK};">
                <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:${INK};">${escapeHtml(heading)}</h1>
                ${bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px 24px;font-family:Arial,Helvetica,sans-serif;color:${MUTED};font-size:12px;line-height:1.5;border-top:1px solid ${BORDER};">
                ${escapeHtml(footerNote)}
              </td>
            </tr>
          </table>
          <div style="font-family:Arial,Helvetica,sans-serif;color:${MUTED};font-size:11px;padding-top:16px;">
            PitchUp &middot; Book a football pitch near you
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

/** Large, spaced digits. Tracking makes a 6-digit code easy to read back. */
export function renderCodeBlock(code: string): string {
  return `<div style="font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:bold;letter-spacing:10px;color:${PRIMARY};text-align:center;padding:20px 0;background:#F0FDF4;border-radius:8px;margin:20px 0;">${escapeHtml(code)}</div>`
}

export function renderParagraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:15px;line-height:1.6;color:${INK};">${escapeHtml(text)}</p>`
}

export function renderMutedParagraph(text: string): string {
  return `<p style="margin:0 0 12px;font-size:13px;line-height:1.6;color:${MUTED};">${escapeHtml(text)}</p>`
}

export function renderButton(label: string, url: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0;">
    <tr>
      <td style="background:${PRIMARY};border-radius:8px;">
        <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:bold;color:#FFFFFF;text-decoration:none;">${escapeHtml(label)}</a>
      </td>
    </tr>
  </table>`
}
