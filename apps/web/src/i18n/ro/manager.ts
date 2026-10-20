/** The manager dashboard's frame and settings, Romanian. */
import type { CatalogShape } from '@pitchup/shared'
import type { managerEn } from '../en/manager'

export const managerRo: CatalogShape<typeof managerEn> = {
  shell: {
    nav: {
      overview: 'Prezentare',
      calendar: 'Calendar',
      bookings: 'Rezervări',
      pitches: 'Terenuri',
      reviews: 'Recenzii',
      analytics: 'Statistici',
      settings: 'Setări',
    },
    section: { manage: 'Administrare', business: 'Afacere', account: 'Cont' },
    dashboard: 'Panou',
    menu: 'Meniu',
    closeMenu: 'Închide meniul',
    openMenu: 'Deschide meniul',
    home: 'PitchUp, prezentare',
    navLabel: 'Administrator',
    soon: 'În curând',
    comingSoon: '{label} (în curând)',
    comingSoonSr: ', în curând',
    role: 'Administrator',
    expand: 'Extinde bara laterală',
    collapse: 'Restrânge bara laterală',
    accountMenu: 'Meniul contului pentru {name}',
    discover: 'Vezi Descoperă',
    signOut: 'Deconectare',
  },
  settings: {
    title: 'Setări | PitchUp',
    heading: 'Setări',
    tabs: {
      label: 'Setări',
      bookings: 'Rezervări și plăți',
      venue: 'Detaliile bazei sportive',
      account: 'Contul tău',
    },
    saved: 'Salvat.',
    saving: 'Se salvează…',
    save: 'Salvează',
    payments: {
      heading: 'Cum plătesc jucătorii',
      modes: {
        ONLINE: { label: 'Doar online', hint: 'Jucătorii plătesc prețul întreg cu cardul.' },
        ONLINE_OR_VENUE: {
          label: 'Online sau la bază',
          hint: 'Jucătorii cu scor de încredere de cel puțin 70 pot plăti la bază.',
        },
        VENUE: {
          label: 'Doar la bază',
          hint: 'Numerar sau terminalul tău de card. Doar jucătorii cu scor de încredere de cel puțin 70 pot rezerva.',
        },
      },
      deposit: 'Avans plătit online',
      noDeposit: 'Fără avans',
      noDepositHint:
        'Fără avans nu se plătește nimic online: îți asumi riscul ca jucătorii să nu vină. Comisionul PitchUp îți este facturat.',
      depositHint:
        'Jucătorii aleg: avansul intră în preț sau le este returnat după ce confirmi că au venit și au plătit integral la bază. Dacă nu vin, avansul rămâne la tine.',
    },
    bookings: {
      label: 'Rezervări și rambursări',
      heading: 'Rezervări noi',
      auto: 'Confirmă automat fiecare rezervare',
      autoHint:
        'Jucătorii sunt rezervați imediat ce plătesc. Poți totuși anula o rezervare, cu rambursare integrală.',
      manual: 'Confirm eu fiecare rezervare',
      manualHint:
        'Jucătorii plătesc, iar intervalul e păstrat până accepți sau refuzi. Fără răspuns, rezervarea e refuzată la {within} ore după ce a fost făcută sau cu {cutoff} ore înainte de meci, iar banii sunt returnați.',
      refund: 'Politica de rambursare',
      refundIntro:
        'Ce primesc înapoi jucătorii când anulează. Rezervările păstrează politica în vigoare când au fost făcute.',
      fullHours: 'Rambursare integrală până la (ore înainte)',
      thenRefund: 'Apoi rambursează',
      upTo: 'Până la (ore înainte)',
      checkPolicy: 'Verifică politica',
      playersSee: 'Jucătorii văd: {policy}',
    },
    account: {
      title: 'Contul tău | PitchUp',
      edit: 'Editează numele, telefonul și emailul',
      password: 'Schimbă parola',
      notifications: 'Notificări: despre ce afli și cum',
      own: 'Datele tale personale, nu ale bazei sportive: jucătorii nu le văd.',
    },
    venue: {
      title: 'Detaliile bazei sportive | PitchUp',
      sections: {
        info: 'numele și descrierea',
        location: 'adresa',
        contactHours: 'contactul și programul',
      },
      intro:
        'Asta văd jucătorii pe pagina ta. Modificările sunt verificate de PitchUp înainte să apară; până atunci pagina păstrează detaliile actuale.',
      waiting: 'Așteaptă aprobarea: {sections} noi{sent}.',
      sent: ' (trimise pe {when})',
      formsShow: 'Formularele de mai jos arată ce ai trimis.',
      rejected: 'Ultimele tale modificări nu au fost aprobate.',
      info: 'Nume și descriere',
      address: 'Adresă',
      contact: 'Contact și program',
      withdrawing: 'Se retrag…',
      withdraw: 'Retrage aceste modificări',
    },
  },
}
