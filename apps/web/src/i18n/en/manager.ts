/** The manager dashboard's frame and settings (E09-10, C-8, C-10, C-13), English. */
export const managerEn = {
  shell: {
    nav: {
      overview: 'Overview',
      calendar: 'Calendar',
      bookings: 'Bookings',
      pitches: 'Pitches',
      reviews: 'Reviews',
      analytics: 'Analytics',
      settings: 'Settings',
    },
    section: { manage: 'Manage', business: 'Business', account: 'Account' },
    dashboard: 'Dashboard',
    menu: 'Menu',
    closeMenu: 'Close menu',
    openMenu: 'Open menu',
    home: 'PitchUp, overview',
    navLabel: 'Manager',
    soon: 'Soon',
    comingSoon: '{label} (coming soon)',
    comingSoonSr: ', coming soon',
    role: 'Manager',
    expand: 'Expand sidebar',
    collapse: 'Collapse sidebar',
    accountMenu: 'Account menu for {name}',
    discover: 'View Discover',
    signOut: 'Sign out',
  },
  settings: {
    title: 'Settings | PitchUp',
    heading: 'Settings',
    tabs: {
      label: 'Settings',
      bookings: 'Bookings and payments',
      venue: 'Venue details',
      account: 'Your account',
    },
    saved: 'Saved.',
    saving: 'Saving…',
    save: 'Save',
    payments: {
      heading: 'How players pay',
      modes: {
        ONLINE: { label: 'Online only', hint: 'Players pay the full price by card.' },
        ONLINE_OR_VENUE: {
          label: 'Online or at the venue',
          hint: 'Players with a trust score of 70+ may pay at the venue instead.',
        },
        VENUE: {
          label: 'At the venue only',
          hint: 'Cash or your card terminal. Only players with a trust score of 70+ can book.',
        },
      },
      deposit: 'Deposit paid online',
      noDeposit: 'No deposit',
      noDepositHint:
        'With no deposit, nothing is paid online: you take the risk that players don’t come. PitchUp’s commission is invoiced to you.',
      depositHint:
        'Players choose: the deposit counts towards the price, or it is refunded once you confirm they came and they pay in full here. If they don’t come, you keep it.',
    },
    bookings: {
      label: 'Bookings and refunds',
      heading: 'New bookings',
      auto: 'Confirm every booking automatically',
      autoHint:
        'Players are booked as soon as they pay. You can still cancel a booking, with a full refund.',
      manual: 'I confirm each booking',
      manualHint:
        'Players pay, and the slot is held until you accept or decline. Without an answer it is declined {within} hours after booking, or {cutoff} hours before kick-off, and refunded.',
      refund: 'Refund policy',
      refundIntro:
        'What players get back when they cancel. Bookings keep the policy they were made under.',
      fullHours: 'Full refund up to (hours before)',
      thenRefund: 'Then refund',
      upTo: 'Up to (hours before)',
      checkPolicy: 'Check the policy',
      playersSee: 'Players see: {policy}',
    },
    account: {
      title: 'Your account | PitchUp',
      edit: 'Edit your name, phone and email',
      password: 'Change your password',
      notifications: 'Notifications: what you hear about, and how',
      own: 'Your own details, not the venue’s: players don’t see them.',
    },
    venue: {
      title: 'Venue details | PitchUp',
      sections: {
        info: 'name and description',
        location: 'address',
        contactHours: 'contact and opening hours',
      },
      intro:
        'This is what players see on your page. Changes are checked by PitchUp before they show; until then your page keeps its current details.',
      waiting: 'Waiting for approval: your new {sections}{sent}.',
      sent: ' (sent {when})',
      formsShow: 'The forms below show what you sent.',
      rejected: 'Your last changes were not approved.',
      info: 'Name and description',
      address: 'Address',
      contact: 'Contact and opening hours',
      withdrawing: 'Withdrawing…',
      withdraw: 'Withdraw these changes',
    },
  },
} as const
