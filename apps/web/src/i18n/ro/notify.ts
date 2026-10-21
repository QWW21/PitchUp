/** Notification titles and bodies, Romanian. */
import type { CatalogShape } from '@pitchup/shared'
import type { notifyEn } from '../en/notify'

export const notifyRo: CatalogShape<typeof notifyEn> = {
  at: '{date}, ora {time}',
  refundedToCard: '{amount} RON îți sunt returnați pe card.',
  subscription: {
    started: {
      title: 'Luna gratuită a început',
      body: '{company} este publicată pe PitchUp până pe {date}, gratuit. Prima factură vine după aceea.',
    },
    trialEnding: {
      title: 'Luna gratuită se încheie pe {date}',
      body: 'După aceea, {company} rămâne publicată cu abonamentul tău. Verifică planul în Setări.',
    },
    paid: {
      title: '{company} este din nou publicată',
      body: 'Plata de {amount} lei a reușit. Jucătorii pot găsi și rezerva din nou baza ta.',
    },
    failed: {
      title: 'Plata abonamentului a eșuat',
      body: 'Actualizează cardul până pe {date}, altfel {company} nu mai primește rezervări noi.',
    },
    paused: {
      title: '{company} este pusă pe pauză',
      body: 'Jucătorii nu pot găsi sau rezerva baza ta până când abonamentul merge din nou. Rezervările deja făcute rămân.',
    },
    ended: {
      title: 'Abonamentul s-a încheiat',
      body: '{company} nu mai este listată. Abonează-te din nou în Setări ca să primești rezervări.',
    },
  },
  companyApproved: {
    title: '{company} este aprobată',
    body: 'Adaugă terenurile, apoi începe luna gratuită din Setări ca să fii publicată și să primești rezervări.',
  },
  companyRejected: { title: '{company} are nevoie de modificări' },
  companySuspended: {
    title: '{company} este suspendată',
    body: '{reason} Jucătorii nu o pot găsi sau rezerva până când PitchUp o reactivează. Rezervările deja făcute rămân.',
  },
  companyReinstated: {
    title: '{company} este din nou activă',
    body: 'PitchUp a reactivat baza ta sportivă: jucătorii o pot găsi și rezerva din nou.',
  },
  disputeUpheld: {
    title: 'Contestația ta a fost acceptată',
    body: 'Neprezentarea de la {pitch} a fost anulată și scorul tău de încredere a fost refăcut. {note}',
  },
  disputeRejected: {
    title: 'Contestația ta a fost respinsă',
    body: 'Neprezentarea de la {pitch} rămâne. {note}',
  },
  noShowOverturned: { title: 'O neprezentare a fost anulată' },
  noShowConfirmed: { title: 'O neprezentare a fost confirmată' },
  disputeOutcomeVenue: { body: '{pitch}: {note}' },
  reviewRemoved: {
    title: 'Recenzia ta a fost ștearsă',
    body: 'PitchUp a șters recenzia ta pentru {pitch}: {reason}',
  },
  accountReinstated: {
    title: 'Contul tău este din nou activ',
    body: 'PitchUp ți-a reactivat contul: te poți conecta și poți rezerva din nou.',
  },
  trustAdjusted: {
    title: 'PitchUp ți-a ajustat scorul de încredere cu {delta}',
    body: '{reason} Scorul tău este acum {score}.',
  },
  venueCancelled: {
    expiredTitle: 'Cererea ta de rezervare a expirat',
    declinedTitle: 'Cererea ta de rezervare a fost refuzată',
    cancelledTitle: 'Baza sportivă ți-a anulat rezervarea',
    body: '{pitch} la {company}, {slot}. {reason}{money}',
  },
  requestExpiredVenue: {
    title: 'O cerere de rezervare a expirat',
    body: 'Nimeni nu a răspuns la cererea pentru {pitch}, {slot}, așa că a fost refuzată și banii au fost returnați.',
  },
  playerCancelled: {
    title: 'Rezervare anulată',
    withdrawnTitle: 'Cerere de rezervare retrasă',
    body: '{pitch}, {slot}. {refund}',
    noRefund: 'Nu ți se returnează nimic.',
  },
  playerCancelledVenue: {
    title: 'O rezervare a fost anulată',
    withdrawnTitle: 'O cerere de rezervare a fost retrasă',
    body: '{player} a anulat {pitch}, {slot}.',
    withdrawnBody: '{player} și-a retras cererea pentru {pitch}, {slot}.',
  },
  disputeOpened: {
    title: 'Neprezentare contestată',
    body: 'Un jucător contestă neprezentarea de la rezervarea {reference}.',
  },
  depositRefunded: {
    title: 'Avansul tău se întoarce',
    body: '{pitch} a confirmat că ai jucat: {amount} RON îți sunt returnați pe card.',
  },
  noShowReported: {
    title: 'A fost raportată o neprezentare',
    body: '{pitch} a raportat că nu ai venit. Scorul tău de încredere a scăzut cu 20; poți contesta în {hours} de ore.',
  },
  venueChangesToReview: {
    title: 'Modificări de verificat la o bază sportivă',
    body: '{company} și-a schimbat datele. Apar după ce le aprobi.',
  },
  venueChangesLive: {
    title: 'Modificările tale sunt active',
    body: 'PitchUp a aprobat noile date pentru {company}; jucătorii le văd acum.',
  },
  venueChangesRejected: {
    title: 'Modificările tale nu au fost aprobate',
    body: '{reason} Pagina ta își păstrează datele actuale; poți trimite alte modificări din Setări.',
  },
  bookingConfirmed: {
    title: 'Rezervare confirmată',
    body: '{pitch} la {company}, {slot}.',
    acceptedBody: '{company} ți-a acceptat rezervarea: {pitch}, {slot}.',
  },
  bookingReceived: { title: 'Rezervare nouă', body: '{player} a rezervat {pitch}, {slot}.' },
  awaitingApproval: {
    title: 'Rezervare trimisă bazei sportive',
    body: '{company} confirmă fiecare rezervare. Afli curând despre {pitch}, {slot}; dacă o refuză, primești toți banii înapoi.',
  },
  bookingRequested: {
    title: 'O rezervare așteaptă răspunsul tău',
    body: '{player} vrea {pitch}, {slot}. Accept-o sau refuz-o.',
  },
  reminder: {
    title: 'Meciul tău este mâine',
    body: '{pitch} la {company}, mâine la ora {time}.',
  },
  venueSubmitted: {
    title: 'Bază sportivă nouă de verificat',
    body: '{company} a terminat înscrierea și așteaptă aprobarea.',
  },
  managerReplied: {
    title: '{company} a răspuns',
    body: 'Baza sportivă a răspuns la recenzia ta pentru {pitch}.',
  },
  reviewReported: { title: 'Recenzie raportată', body: 'O recenzie a fost raportată: {category}.' },
  reviewLeft: { title: 'Recenzie nouă', body: '{rating}★ pentru {pitch}' },
  tierChanged: {
    upTitle: 'Acum ești {tier}',
    downTitle: 'Nivelul tău de încredere este acum {tier}',
    body: 'Scorul tău de încredere este {score} (era {was}). {description}',
  },
}
