/** Email verification code — ticket E02-09. In the recipient's language. */
import type { Locale } from '@pitchup/shared'
import { webT } from '@/i18n/catalog'
import { renderCodeBlock, renderEmailLayout, renderMutedParagraph, renderParagraph } from './layout'

export interface VerificationEmail {
  subject: string
  html: string
  /** Plain-text alternative. Some clients prefer it, and spam filters
   *  penalise HTML-only mail. */
  text: string
}

export function renderVerificationEmail(
  code: string,
  expiryMinutes: number,
  locale: Locale
): VerificationEmail {
  const t = webT(locale)
  return {
    subject: t('email.verification.subject'),
    html: renderEmailLayout(locale, {
      heading: t('email.verification.heading'),
      bodyHtml:
        renderParagraph(t('email.verification.intro')) +
        renderCodeBlock(code) +
        renderMutedParagraph(t('email.verification.expires', { minutes: expiryMinutes })),
      footerNote: t('email.verification.footer'),
    }),
    text:
      `${t('email.verification.heading')}\n\n` +
      `${t('email.verification.textCode', { code })}\n\n` +
      `${t('email.verification.textExpires', { minutes: expiryMinutes })}\n\n` +
      t('email.verification.textIgnore'),
  }
}

/**
 * Sent when someone tries to register an address that already has a verified
 * account. The register endpoint answers 201 either way, so this is the only
 * place the fact surfaces — and it reaches only the inbox owner.
 */
export function renderAlreadyRegisteredEmail(locale: Locale): VerificationEmail {
  const t = webT(locale)
  return {
    subject: t('email.alreadyRegistered.subject'),
    html: renderEmailLayout(locale, {
      heading: t('email.alreadyRegistered.heading'),
      bodyHtml:
        renderParagraph(t('email.alreadyRegistered.tried')) +
        renderParagraph(t('email.alreadyRegistered.signIn')) +
        renderMutedParagraph(t('email.alreadyRegistered.notYou')),
      footerNote: t('email.alreadyRegistered.footer'),
    }),
    text:
      `${t('email.alreadyRegistered.subject')}\n\n` +
      `${t('email.alreadyRegistered.tried')}\n\n` +
      `${t('email.alreadyRegistered.signIn')}\n` +
      t('email.alreadyRegistered.notYou'),
  }
}
