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

/**
 * Sent after a password is successfully changed.
 *
 * Not in the ticket, but without it a stolen reset link is silent: the real
 * owner finds out only when they can no longer sign in. This is the one
 * message that reaches them while the account can still be recovered.
 */
export function renderPasswordChangedEmail(): VerificationEmail {
  return {
    subject: 'Your PitchUp password was changed',
    html: renderEmailLayout({
      heading: 'Your password was changed',
      bodyHtml:
        renderParagraph('The password on your PitchUp account has just been changed.') +
        renderParagraph(
          'If that was you, there is nothing to do. You have been signed out on your ' +
            'other devices and will need to sign in again.'
        ) +
        renderMutedParagraph(
          'If it was not you, someone else may have access to your email. Reset your ' +
            'password again immediately and contact support.'
        ),
      footerNote: 'This message is sent whenever an account password changes.',
    }),
    text:
      `Your PitchUp password was changed\n\n` +
      `If that was you, nothing to do — you have been signed out on your other\n` +
      `devices and will need to sign in again.\n\n` +
      `If it was not you, someone may have access to your email. Reset your\n` +
      `password again immediately and contact support.`,
  }
}
