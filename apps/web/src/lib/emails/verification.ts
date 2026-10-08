/** Email verification code — ticket E02-09. */
import { renderCodeBlock, renderEmailLayout, renderMutedParagraph, renderParagraph } from './layout'

export interface VerificationEmail {
  subject: string
  html: string
  /** Plain-text alternative. Some clients prefer it, and spam filters
   *  penalise HTML-only mail. */
  text: string
}

export function renderVerificationEmail(code: string, expiryMinutes: number): VerificationEmail {
  return {
    subject: 'Confirm your PitchUp email',
    html: renderEmailLayout({
      heading: 'Verify your email address',
      bodyHtml:
        renderParagraph('Enter this code in the app to finish setting up your account:') +
        renderCodeBlock(code) +
        renderMutedParagraph(`This code expires in ${expiryMinutes} minutes.`),
      footerNote: 'If you did not create a PitchUp account, you can ignore this email.',
    }),
    text:
      `Verify your email address\n\n` +
      `Enter this code in the app: ${code}\n\n` +
      `It expires in ${expiryMinutes} minutes.\n\n` +
      `If you did not create a PitchUp account, ignore this email.`,
  }
}

/**
 * Sent when someone tries to register an address that already has a verified
 * account. The register endpoint answers 201 either way, so this is the only
 * place the fact surfaces — and it reaches only the inbox owner.
 */
export function renderAlreadyRegisteredEmail(): VerificationEmail {
  return {
    subject: 'You already have a PitchUp account',
    html: renderEmailLayout({
      heading: 'You already have an account',
      bodyHtml:
        renderParagraph(
          'Someone just tried to create a PitchUp account with this email address. ' +
            'You already have one, so nothing has changed.'
        ) +
        renderParagraph(
          'If that was you, sign in instead — or use "Forgot password" if you cannot get in.'
        ) +
        renderMutedParagraph('If it was not you, no action is needed.'),
      footerNote: 'This message was sent because an account already exists for this address.',
    }),
    text:
      `You already have a PitchUp account\n\n` +
      `Someone just tried to create an account with this email address. You\n` +
      `already have one, so nothing has changed.\n\n` +
      `If that was you, sign in instead, or use "Forgot password".\n` +
      `If it was not you, no action is needed.`,
  }
}
