/** Notification titles and bodies (in-app, email and push), English. */
export const notifyEn = {
  at: '{date} at {time}',
  refundedToCard: '{amount} RON is refunded to your card.',
  companyApproved: {
    title: '{company} is approved',
    body: 'Your venue is live on PitchUp. Add your pitches to start taking bookings.',
  },
  companyRejected: { title: '{company} needs changes' },
  companySuspended: {
    title: '{company} is suspended',
    body: "{reason} Players can't find or book it until PitchUp reinstates it. Bookings already made stay.",
  },
  companyReinstated: {
    title: '{company} is live again',
    body: 'PitchUp reinstated your venue: players can find and book it again.',
  },
  disputeUpheld: {
    title: 'Your dispute was upheld',
    body: 'The no-show at {pitch} is removed and your trust score is restored. {note}',
  },
  disputeRejected: {
    title: 'Your dispute was not upheld',
    body: 'The no-show at {pitch} stands. {note}',
  },
  noShowOverturned: { title: 'A no-show was overturned' },
  noShowConfirmed: { title: 'A no-show was confirmed' },
  disputeOutcomeVenue: { body: '{pitch}: {note}' },
  reviewRemoved: {
    title: 'Your review was removed',
    body: 'PitchUp removed your review of {pitch}: {reason}',
  },
  accountReinstated: {
    title: 'Your account is active again',
    body: 'PitchUp reinstated your account: you can sign in and book again.',
  },
  trustAdjusted: {
    title: 'PitchUp adjusted your trust score by {delta}',
    body: '{reason} Your score is now {score}.',
  },
  venueCancelled: {
    expiredTitle: 'Your booking request expired',
    declinedTitle: 'Your booking request was declined',
    cancelledTitle: 'The venue cancelled your booking',
    body: '{pitch} at {company}, {slot}. {reason}{money}',
  },
  requestExpiredVenue: {
    title: 'A booking request expired',
    body: 'Nobody answered the request for {pitch}, {slot}, so it was declined and refunded.',
  },
  playerCancelled: {
    title: 'Booking cancelled',
    withdrawnTitle: 'Booking request withdrawn',
    body: '{pitch}, {slot}. {refund}',
    noRefund: 'No refund is due.',
  },
  playerCancelledVenue: {
    title: 'A booking was cancelled',
    withdrawnTitle: 'A booking request was withdrawn',
    body: '{player} cancelled {pitch}, {slot}.',
    withdrawnBody: '{player} withdrew their request for {pitch}, {slot}.',
  },
  disputeOpened: {
    title: 'No-show disputed',
    body: 'A player disputes the no-show on booking {reference}.',
  },
  depositRefunded: {
    title: 'Your deposit is on its way back',
    body: '{pitch} confirmed you played: {amount} RON is refunded to your card.',
  },
  noShowReported: {
    title: 'A no-show was reported',
    body: "{pitch} reported that you didn't come. Your trust score went down by 20; you can dispute it within {hours} hours.",
  },
  venueChangesToReview: {
    title: 'Venue changes to review',
    body: '{company} changed its details. They show once you approve them.',
  },
  venueChangesLive: {
    title: 'Your changes are live',
    body: 'PitchUp approved the new details of {company}; players see them now.',
  },
  venueChangesRejected: {
    title: 'Your changes were not approved',
    body: '{reason} Your page keeps its current details; you can send new changes in Settings.',
  },
  bookingConfirmed: {
    title: 'Booking confirmed',
    body: '{pitch} at {company}, {slot}.',
    acceptedBody: '{company} accepted your booking: {pitch}, {slot}.',
  },
  bookingReceived: { title: 'New booking', body: '{player} booked {pitch}, {slot}.' },
  awaitingApproval: {
    title: 'Booking sent to the venue',
    body: "{company} confirms each booking. You'll hear about {pitch}, {slot} soon; if they decline, you get all your money back.",
  },
  bookingRequested: {
    title: 'A booking waits for your answer',
    body: '{player} wants {pitch}, {slot}. Accept or decline it.',
  },
  reminder: {
    title: 'Your game is tomorrow',
    body: '{pitch} at {company}, tomorrow at {time}.',
  },
  venueSubmitted: {
    title: 'New venue to review',
    body: '{company} finished onboarding and waits for approval.',
  },
  managerReplied: {
    title: '{company} replied',
    body: 'The venue replied to your review of {pitch}.',
  },
  reviewReported: { title: 'Review reported', body: 'A review was reported: {category}.' },
  reviewLeft: { title: 'New review', body: '{rating}★ for {pitch}' },
  tierChanged: {
    upTitle: "You're now {tier}",
    downTitle: 'Your trust tier is now {tier}',
    body: 'Your trust score is {score} (was {was}). {description}',
  },
} as const
