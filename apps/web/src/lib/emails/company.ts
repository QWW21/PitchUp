/**
 * A venue's approval or rejection — E09 (admin decision), sent to its
 * manager. The layout helpers escape the text, so names are passed as is.
 */
import { renderButton, renderEmailLayout, renderMutedParagraph, renderParagraph } from './layout'
import type { VerificationEmail } from './verification'

export function renderCompanyApprovedEmail(
  companyName: string,
  dashboardUrl: string
): VerificationEmail {
  return {
    subject: `${companyName} is approved on PitchUp`,
    html: renderEmailLayout({
      heading: 'Your venue is approved',
      bodyHtml:
        renderParagraph(`${companyName} is now live on PitchUp. Players can find it on Discover.`) +
        renderParagraph('Add your pitches and their prices, and bookings can start.') +
        renderButton('Open your dashboard', dashboardUrl),
      footerNote: 'You receive this because you registered a venue on PitchUp.',
    }),
    text:
      `${companyName} is approved on PitchUp\n\n` +
      `Your venue is live. Add your pitches and their prices, and bookings can start.\n\n` +
      `Open your dashboard: ${dashboardUrl}`,
  }
}

export function renderCompanyRejectedEmail(
  companyName: string,
  reason: string,
  onboardingUrl: string
): VerificationEmail {
  return {
    subject: `${companyName} needs a few changes`,
    html: renderEmailLayout({
      heading: 'Your venue needs a few changes',
      bodyHtml:
        renderParagraph(`We reviewed ${companyName} and it isn't ready to go live yet:`) +
        renderParagraph(reason) +
        renderParagraph(
          'Update your details and submit again; we review within 1–2 business days.'
        ) +
        renderButton('Update your venue', onboardingUrl) +
        renderMutedParagraph('Questions? Reply to this email.'),
      footerNote: 'You receive this because you registered a venue on PitchUp.',
    }),
    text:
      `${companyName} needs a few changes\n\n` +
      `${reason}\n\n` +
      `Update your details and submit again: ${onboardingUrl}`,
  }
}
