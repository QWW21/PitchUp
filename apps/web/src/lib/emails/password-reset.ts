/** Password reset — template used by E02-11. */
import { renderButton, renderEmailLayout, renderMutedParagraph, renderParagraph } from './layout'
import type { VerificationEmail } from './verification'

export function renderPasswordResetEmail(
  resetUrl: string,
  expiryMinutes: number
): VerificationEmail {
  return {
    subject: 'Reset your PitchUp password',
    html: renderEmailLayout({
      heading: 'Reset your password',
      bodyHtml:
        renderParagraph('Use the button below to choose a new password.') +
        renderButton('Reset password', resetUrl) +
        renderMutedParagraph(
          `This link expires in ${expiryMinutes} minutes and can be used once.`
        ) +
        renderMutedParagraph(
          `If the button does not work, paste this into your browser: ${resetUrl}`
        ),
      footerNote:
        'If you did not ask to reset your password, ignore this email — your password has not changed.',
    }),
    text:
      `Reset your PitchUp password\n\n` +
      `Open this link to choose a new password:\n${resetUrl}\n\n` +
      `It expires in ${expiryMinutes} minutes and can be used once.\n\n` +
      `If you did not ask for this, ignore this email — nothing has changed.`,
  }
}
