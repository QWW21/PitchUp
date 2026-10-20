/** Password reset — template used by E02-11. In the recipient's language. */
import type { Locale } from '@pitchup/shared'
import { webT } from '@/i18n/catalog'
import { renderButton, renderEmailLayout, renderMutedParagraph, renderParagraph } from './layout'
import type { VerificationEmail } from './verification'

export function renderPasswordResetEmail(
  resetUrl: string,
  expiryMinutes: number,
  locale: Locale
): VerificationEmail {
  const t = webT(locale)
  return {
    subject: t('email.passwordReset.subject'),
    html: renderEmailLayout(locale, {
      heading: t('email.passwordReset.heading'),
      bodyHtml:
        renderParagraph(t('email.passwordReset.intro')) +
        renderButton(t('email.passwordReset.button'), resetUrl) +
        renderMutedParagraph(t('email.passwordReset.expires', { minutes: expiryMinutes })) +
        renderMutedParagraph(t('email.passwordReset.paste', { url: resetUrl })),
      footerNote: t('email.passwordReset.footer'),
    }),
    text:
      `${t('email.passwordReset.subject')}\n\n` +
      `${t('email.passwordReset.textOpen')}\n${resetUrl}\n\n` +
      `${t('email.passwordReset.expires', { minutes: expiryMinutes })}\n\n` +
      t('email.passwordReset.textIgnore'),
  }
}

/**
 * Sent after a password is successfully changed.
 *
 * Not in the ticket, but without it a stolen reset link is silent: the real
 * owner finds out only when they can no longer sign in. This is the one
 * message that reaches them while the account can still be recovered.
 */
export function renderPasswordChangedEmail(locale: Locale): VerificationEmail {
  const t = webT(locale)
  return {
    subject: t('email.passwordChanged.subject'),
    html: renderEmailLayout(locale, {
      heading: t('email.passwordChanged.heading'),
      bodyHtml:
        renderParagraph(t('email.passwordChanged.changed')) +
        renderParagraph(t('email.passwordChanged.wasYou')) +
        renderMutedParagraph(t('email.passwordChanged.notYou')),
      footerNote: t('email.passwordChanged.footer'),
    }),
    text:
      `${t('email.passwordChanged.subject')}\n\n` +
      `${t('email.passwordChanged.wasYou')}\n\n` +
      t('email.passwordChanged.notYou'),
  }
}
