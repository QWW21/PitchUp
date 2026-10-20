/** Email and SMS text, Romanian. */
import type { CatalogShape } from '@pitchup/shared'
import type { emailEn } from '../en/email'

export const emailRo: CatalogShape<typeof emailEn> = {
  layout: {
    tagline: 'PitchUp · Rezervă un teren de fotbal lângă tine',
    openPitchUp: 'Deschide PitchUp',
    choose: 'Alege ce emailuri primești din setările de notificări: {url}',
    chooseText: 'Alege ce emailuri primești: {url}',
    footer: 'Primești acest mesaj pentru că folosești PitchUp.',
  },
  verification: {
    subject: 'Confirmă-ți emailul pentru PitchUp',
    heading: 'Confirmă-ți adresa de email',
    intro: 'Introdu acest cod în aplicație ca să termini crearea contului:',
    expires: 'Codul expiră în {minutes} de minute.',
    footer: 'Dacă nu ți-ai creat un cont PitchUp, poți ignora acest email.',
    textCode: 'Introdu acest cod în aplicație: {code}',
    textExpires: 'Expiră în {minutes} de minute.',
    textIgnore: 'Dacă nu ți-ai creat un cont PitchUp, ignoră acest email.',
  },
  alreadyRegistered: {
    subject: 'Ai deja un cont PitchUp',
    heading: 'Ai deja un cont',
    tried:
      'Cineva a încercat să creeze un cont PitchUp cu această adresă de email. Ai deja unul, așa că nu s-a schimbat nimic.',
    signIn: 'Dacă ai fost tu, conectează-te — sau folosește „Ai uitat parola?” dacă nu poți intra.',
    notYou: 'Dacă nu ai fost tu, nu trebuie să faci nimic.',
    footer: 'Acest mesaj a fost trimis pentru că există deja un cont pentru această adresă.',
  },
  passwordReset: {
    subject: 'Resetează-ți parola PitchUp',
    heading: 'Resetează-ți parola',
    intro: 'Folosește butonul de mai jos ca să alegi o parolă nouă.',
    button: 'Resetează parola',
    expires: 'Linkul expiră în {minutes} de minute și poate fi folosit o singură dată.',
    paste: 'Dacă butonul nu merge, copiază asta în browser: {url}',
    footer: 'Dacă nu ai cerut resetarea parolei, ignoră acest email — parola ta nu s-a schimbat.',
    textOpen: 'Deschide acest link ca să alegi o parolă nouă:',
    textIgnore: 'Dacă nu ai cerut asta, ignoră acest email — nu s-a schimbat nimic.',
  },
  passwordChanged: {
    subject: 'Parola ta PitchUp a fost schimbată',
    heading: 'Parola ta a fost schimbată',
    changed: 'Parola contului tău PitchUp tocmai a fost schimbată.',
    wasYou:
      'Dacă ai fost tu, nu trebuie să faci nimic. Ai fost deconectat de pe celelalte dispozitive și va trebui să te conectezi din nou.',
    notYou:
      'Dacă nu ai fost tu, altcineva poate avea acces la emailul tău. Resetează-ți imediat parola și contactează suportul.',
    footer: 'Acest mesaj este trimis de fiecare dată când se schimbă parola unui cont.',
  },
  bookingConfirmed: {
    subject: 'Rezervare confirmată: {pitch}, {date} {time}',
    heading: 'Rezervarea ta este confirmată',
    reference: 'Referința {reference}. Ne vedem pe teren!',
    pitchAt: '{pitch} la {company}',
    when: '{date}, {start}–{end} ({duration})',
    teams: '{count} echipe',
    shirts: {
      one: 'Tricouri gratuite: {count} set, pregătit la teren.',
      few: 'Tricouri gratuite: {count} seturi, pregătite la teren.',
      other: 'Tricouri gratuite: {count} de seturi, pregătite la teren.',
    },
    paid: 'Plătit: {total} RON',
    depositPaid: 'Avans plătit: {deposit} RON{refund}. De plătit la teren: {due} RON.',
    depositRefunded: ', returnat după meci',
    toPay: 'De plătit la teren: {due} RON.',
    policy: 'Anulare: {policy}',
    footer: 'Primești acest mesaj pentru că ai rezervat un teren pe PitchUp.',
    textHeading: 'Rezervarea ta este confirmată ({reference})',
  },
  companyApproved: {
    subject: '{company} este aprobată pe PitchUp',
    heading: 'Baza ta sportivă este aprobată',
    live: '{company} este acum activă pe PitchUp. Jucătorii o găsesc în Descoperă.',
    next: 'Adaugă terenurile și prețurile, și pot începe rezervările.',
    button: 'Deschide panoul de control',
    footer: 'Primești acest mesaj pentru că ai înscris o bază sportivă pe PitchUp.',
    textLive:
      'Baza ta sportivă este activă. Adaugă terenurile și prețurile, și pot începe rezervările.',
    textButton: 'Deschide panoul de control: {url}',
  },
  companyRejected: {
    subject: '{company} are nevoie de câteva modificări',
    heading: 'Baza ta sportivă are nevoie de câteva modificări',
    reviewed: 'Am verificat {company} și încă nu este gata să apară pe PitchUp:',
    next: 'Actualizează datele și trimite din nou; verificăm în 1–2 zile lucrătoare.',
    button: 'Actualizează baza sportivă',
    questions: 'Întrebări? Răspunde la acest email.',
    footer: 'Primești acest mesaj pentru că ai înscris o bază sportivă pe PitchUp.',
    textButton: 'Actualizează datele și trimite din nou: {url}',
  },
  sms: {
    phoneCode: '{code} este codul tău de verificare PitchUp. Expiră în {minutes} de minute.',
  },
}
