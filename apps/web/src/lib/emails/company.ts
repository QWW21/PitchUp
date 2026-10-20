/**
 * A venue's approval or rejection — E09 (admin decision), sent to its
 * manager in their language. The layout helpers escape the text, so names
 * are passed as is.
 */
import type { Locale } from '@pitchup/shared'
import { webT } from '@/i18n/catalog'
import { renderButton, renderEmailLayout, renderMutedParagraph, renderParagraph } from './layout'
import type { VerificationEmail } from './verification'

export function renderCompanyApprovedEmail(
  companyName: string,
  dashboardUrl: string,
  locale: Locale
): VerificationEmail {
  const t = webT(locale)
  const company = companyName
  return {
    subject: t('email.companyApproved.subject', { company }),
    html: renderEmailLayout(locale, {
      heading: t('email.companyApproved.heading'),
      bodyHtml:
        renderParagraph(t('email.companyApproved.live', { company })) +
        renderParagraph(t('email.companyApproved.next')) +
        renderButton(t('email.companyApproved.button'), dashboardUrl),
      footerNote: t('email.companyApproved.footer'),
    }),
    text:
      `${t('email.companyApproved.subject', { company })}\n\n` +
      `${t('email.companyApproved.textLive')}\n\n` +
      t('email.companyApproved.textButton', { url: dashboardUrl }),
  }
}

export function renderCompanyRejectedEmail(
  companyName: string,
  reason: string,
  onboardingUrl: string,
  locale: Locale
): VerificationEmail {
  const t = webT(locale)
  const company = companyName
  return {
    subject: t('email.companyRejected.subject', { company }),
    html: renderEmailLayout(locale, {
      heading: t('email.companyRejected.heading'),
      bodyHtml:
        renderParagraph(t('email.companyRejected.reviewed', { company })) +
        renderParagraph(reason) +
        renderParagraph(t('email.companyRejected.next')) +
        renderButton(t('email.companyRejected.button'), onboardingUrl) +
        renderMutedParagraph(t('email.companyRejected.questions')),
      footerNote: t('email.companyRejected.footer'),
    }),
    text:
      `${t('email.companyRejected.subject', { company })}\n\n` +
      `${reason}\n\n` +
      t('email.companyRejected.textButton', { url: onboardingUrl }),
  }
}
