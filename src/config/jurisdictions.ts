/*
 * Country packs (doc 15 §6ج "Jurisdiction Pack"): law, court, VAT wording, e-invoice format, payment terms and the
 * clause library of each contract, versioned in Git. A new country = a new pack, no code change.
 * The clause texts are drafts until a lawyer of that country reviews them (`reviewed`); the cockpit shows it.
 * `onerous` clauses need their own approval in Italy (art. 1341-1342 c.c.; Cassazione n. 20945/2026: a tick is
 * not enough, a separate one-time code is).
 */

export type Lang = "it" | "en" | "de";
export type Clause = { id: string; title: Record<Lang, string>; text: Record<Lang, string>; onerous?: boolean; principle?: string };

export type Pack = {
  code: string;
  name: string;
  templateVersion: string;
  reviewed: boolean;
  law: Record<Lang, string>;
  court: string;
  currency: "EUR";
  vatRate: number;
  paymentDays: number;
  // what the invoice says when no VAT is charged
  reverseCharge: Record<Lang, string>;
  outsideEu: Record<Lang, string>;
  einvoice: string;
};

export const PACKS: Record<string, Pack> = {
  IT: {
    code: "IT", name: "Italy", templateVersion: "IT-2026.2", reviewed: false,
    law: { it: "legge italiana", en: "Italian law", de: "italienisches Recht" }, court: "Milano", currency: "EUR", vatRate: 22, paymentDays: 14,
    reverseCharge: { it: "Operazione non soggetta – inversione contabile, art. 7-ter DPR 633/72 e art. 196 Dir. 2006/112/CE", en: "VAT reverse charge – art. 196 Directive 2006/112/EC (art. 7-ter DPR 633/72)", de: "Steuerschuldnerschaft des Leistungsempfängers – Art. 196 RL 2006/112/EG" },
    outsideEu: { it: "Operazione non soggetta, art. 7-ter DPR 633/72", en: "Outside the scope of Italian VAT, art. 7-ter DPR 633/72", de: "Nicht steuerbar, Art. 7-ter DPR 633/72" },
    einvoice: "FatturaPA via SdI",
  },
};

// Until a pack exists for the customer's country, our own (Italian) pack applies: we are the seller.
export const packFor = (country: string | null | undefined) => PACKS[(country ?? "").toUpperCase()] ?? PACKS.IT;
export const contractLang = (locale: string | null | undefined): Lang => (["it", "en", "de"].includes((locale ?? "").slice(0, 2)) ? ((locale ?? "").slice(0, 2) as Lang) : "en");

export const EU = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" "));

/* ───────────── Customer service contract (service + DPA annex) ───────────── */

export const CUSTOMER_CLAUSES: Clause[] = [
  {
    id: "object", principle: "sell results, not tools",
    title: { it: "Oggetto", en: "Subject", de: "Gegenstand" },
    text: {
      it: "{company} fornisce a {customer} il risultato «{service}» secondo lo standard di qualità indicato nel catalogo, con le fasi elencate al punto 3, e poi il servizio mensile che lo mantiene in funzione.",
      en: "{company} delivers to {customer} the result \"{service}\" to the quality standard in the catalogue, in the milestones listed in clause 3, followed by the monthly service that keeps it running.",
      de: "{company} liefert {customer} das Ergebnis „{service}“ nach dem Qualitätsstandard des Katalogs in den unter Punkt 3 genannten Phasen und danach den monatlichen Service, der es am Laufen hält.",
    },
  },
  {
    id: "price",
    title: { it: "Prezzo e pagamento", en: "Price and payment", de: "Preis und Zahlung" },
    text: {
      it: "Avvio: {setup} + IVA se dovuta; poi {monthly} al mese. Ogni fase si paga prima che inizi: la prima ({deposit}) dopo la firma, ognuna delle successive quando la precedente è accettata. Pagamento con bonifico SEPA entro {days} giorni dalla richiesta. In caso di ritardo si applicano gli interessi del D.Lgs. 231/2002 e l'indennizzo di 40 €.",
      en: "Set-up: {setup} plus VAT where due; then {monthly} per month. Each milestone is paid before it starts: the first ({deposit}) after signing, each next one when the previous one is accepted. Payment by SEPA transfer within {days} days of the request. Late payment carries the interest of Legislative Decree 231/2002 and the €40 compensation.",
      de: "Einrichtung: {setup} zzgl. USt., soweit geschuldet; danach {monthly} pro Monat. Jede Phase wird vor ihrem Beginn bezahlt: die erste ({deposit}) nach der Unterschrift, jede weitere, sobald die vorherige abgenommen ist. Zahlung per SEPA-Überweisung binnen {days} Tagen. Bei Verzug gelten die Zinsen nach D.Lgs. 231/2002 und die Pauschale von 40 €.",
    },
  },
  {
    id: "milestones",
    title: { it: "Fasi e collaudo", en: "Milestones and acceptance", de: "Phasen und Abnahme" },
    text: {
      it: "Fasi: {milestones}. Al termine di ogni fase {customer} la verifica nella propria area e la accetta oppure indica cosa cambiare. Ogni fase comprende {revisions} giri di modifiche nell'ambito concordato; altre modifiche si quotano prima di eseguirle.",
      en: "Milestones: {milestones}. At the end of each milestone {customer} checks it in its dashboard and accepts it or says what to change. Each milestone includes {revisions} rounds of changes within the agreed scope; further changes are priced before any work.",
      de: "Phasen: {milestones}. Am Ende jeder Phase prüft {customer} sie im eigenen Bereich und nimmt sie ab oder nennt die Änderungen. Jede Phase enthält {revisions} Änderungsrunden im vereinbarten Umfang; weitere Änderungen werden vorher angeboten.",
    },
  },
  {
    id: "deemed", onerous: true,
    title: { it: "Accettazione tacita della fase", en: "Deemed acceptance", de: "Stillschweigende Abnahme" },
    text: {
      it: "Se entro 7 giorni dalla consegna di una fase, e dopo tre promemoria (giorno 1, 3 e 6), {customer} non la accetta né indica cosa non funziona, la fase si considera accettata.",
      en: "If within 7 days of a milestone's delivery, and after three reminders (day 1, 3 and 6), {customer} neither accepts it nor states what does not work, the milestone is deemed accepted.",
      de: "Nimmt {customer} eine Phase binnen 7 Tagen nach Lieferung und nach drei Erinnerungen (Tag 1, 3 und 6) weder ab noch benennt Mängel, gilt sie als abgenommen.",
    },
  },
  {
    id: "suspend", onerous: true,
    title: { it: "Sospensione per mancato pagamento", en: "Suspension for non-payment", de: "Aussetzung bei Nichtzahlung" },
    text: {
      it: "Se un pagamento è in ritardo di oltre 14 giorni dopo un sollecito scritto, {company} può sospendere i lavori e il servizio mensile fino al pagamento.",
      en: "If a payment is more than 14 days late after a written reminder, {company} may suspend the work and the monthly service until it is paid.",
      de: "Ist eine Zahlung nach schriftlicher Mahnung mehr als 14 Tage überfällig, darf {company} Arbeiten und Monatsservice bis zur Zahlung aussetzen.",
    },
  },
  {
    id: "term",
    title: { it: "Durata del servizio mensile", en: "Monthly service term", de: "Laufzeit des Monatsservice" },
    text: {
      it: "Il servizio mensile inizia alla conferma dell'ultima fase e si rinnova di mese in mese. {customer} può disdirlo in qualsiasi momento con 30 giorni di preavviso dalla propria area.",
      en: "The monthly service starts when the last milestone is accepted and renews month by month. {customer} may cancel at any time with 30 days' notice from its dashboard.",
      de: "Der Monatsservice beginnt mit Abnahme der letzten Phase und verlängert sich monatlich. {customer} kann jederzeit mit 30 Tagen Frist im eigenen Bereich kündigen.",
    },
  },
  {
    id: "data", principle: "GDPR art. 28",
    title: { it: "Protezione dei dati", en: "Data protection", de: "Datenschutz" },
    text: {
      it: "Per i dati personali che tratta per conto di {customer}, {company} è responsabile del trattamento ai sensi dell'art. 28 GDPR secondo l'Allegato A (accordo sul trattamento dei dati). I dati restano nell'UE. {company} può usare sub-responsabili selezionati con gli stessi obblighi.",
      en: "For personal data it processes on behalf of {customer}, {company} is a processor under art. 28 GDPR per Annex A (data processing agreement). Data stays in the EU. {company} may use selected sub-processors bound by the same obligations.",
      de: "Für personenbezogene Daten, die {company} im Auftrag von {customer} verarbeitet, ist {company} Auftragsverarbeiter nach Art. 28 DSGVO gemäß Anlage A. Die Daten bleiben in der EU. Ausgewählte Unterauftragsverarbeiter mit gleichen Pflichten sind zulässig.",
    },
  },
  {
    id: "subcontract",
    title: { it: "Collaboratori", en: "Subcontractors", de: "Unterauftragnehmer" },
    text: {
      it: "{company} può affidare parti del lavoro a collaboratori selezionati e controllati; ne resta pienamente responsabile.",
      en: "{company} may give parts of the work to selected and checked subcontractors; it remains fully responsible for them.",
      de: "{company} darf Teile der Arbeit an ausgewählte, geprüfte Unterauftragnehmer vergeben und bleibt voll verantwortlich.",
    },
  },
  {
    id: "ai", principle: "AI Act art. 50",
    title: { it: "Intelligenza artificiale", en: "Artificial intelligence", de: "Künstliche Intelligenz" },
    text: {
      it: "Ogni assistente AI fornito dichiara di essere un'AI e i contenuti generati sono indicati come tali (AI Act, art. 50). {customer} approva i testi che l'assistente usa con i propri clienti.",
      en: "Every AI assistant we deliver says it is an AI and generated content is labelled as such (AI Act, art. 50). {customer} approves the texts the assistant uses with its own customers.",
      de: "Jeder gelieferte KI-Assistent gibt sich als KI zu erkennen, generierte Inhalte sind gekennzeichnet (KI-Verordnung Art. 50). {customer} gibt die Texte frei, die der Assistent mit seinen Kunden nutzt.",
    },
  },
  {
    id: "ip",
    title: { it: "Proprietà", en: "Ownership", de: "Rechte" },
    text: {
      it: "Dopo il pagamento, le configurazioni fatte per {customer} sono sue. Strumenti, modelli e metodi di {company} restano di {company}, con licenza d'uso per la durata del servizio.",
      en: "After payment, the configurations made for {customer} are its own. {company}'s tools, templates and methods remain {company}'s, licensed for the duration of the service.",
      de: "Nach Zahlung gehören die für {customer} erstellten Konfigurationen {customer}. Werkzeuge, Vorlagen und Methoden von {company} bleiben bei {company}, lizenziert für die Servicedauer.",
    },
  },
  {
    id: "liability", onerous: true,
    title: { it: "Limitazione di responsabilità", en: "Limitation of liability", de: "Haftungsbegrenzung" },
    text: {
      it: "Salvo dolo o colpa grave (art. 1229 c.c.), la responsabilità di {company} è limitata agli importi pagati da {customer} negli ultimi 12 mesi.",
      en: "Except for wilful misconduct or gross negligence (art. 1229 Italian Civil Code), {company}'s liability is limited to the amounts {customer} paid in the last 12 months.",
      de: "Außer bei Vorsatz oder grober Fahrlässigkeit (Art. 1229 c.c.) ist die Haftung von {company} auf die von {customer} in den letzten 12 Monaten gezahlten Beträge begrenzt.",
    },
  },
  {
    id: "nonsolicit", onerous: true, principle: "non-circumvention",
    title: { it: "Collaboratori: nessun contatto diretto", en: "No direct hiring of our subcontractors", de: "Keine Direktbeauftragung unserer Partner" },
    text: {
      it: "Per la durata del contratto e per 12 mesi dopo, {customer} non incarica direttamente i collaboratori che {company} ha usato per i suoi lavori.",
      en: "During the contract and for 12 months after, {customer} does not engage directly the subcontractors {company} used for its work.",
      de: "Während des Vertrags und 12 Monate danach beauftragt {customer} die von {company} eingesetzten Unterauftragnehmer nicht direkt.",
    },
  },
  {
    id: "law", onerous: true,
    title: { it: "Legge e foro", en: "Law and court", de: "Recht und Gerichtsstand" },
    text: {
      it: "Si applica la {law}. Per ogni controversia è competente in via esclusiva il Foro di {court}.",
      en: "{law} applies. The Court of {court} has exclusive jurisdiction over any dispute.",
      de: "Es gilt {law}. Ausschließlicher Gerichtsstand ist {court}.",
    },
  },
];

/* ───────────── Partner framework (independent work, NDA, sub-processing, white-label) ───────────── */

export const PARTNER_CLAUSES: Clause[] = [
  {
    id: "independent", principle: "no false self-employment",
    title: { it: "Lavoro autonomo", en: "Independent work", de: "Selbständige Tätigkeit" },
    text: {
      it: "{partner} lavora in autonomia: sceglie metodi, orari e strumenti, può lavorare per altri clienti e non è obbligato ad accettare le offerte di {company}. Ogni lavoro accettato è un incarico separato con il prezzo indicato nell'offerta.",
      en: "{partner} works independently: chooses methods, hours and tools, may work for other clients and is not obliged to accept {company}'s offers. Each accepted job is a separate assignment at the price in the offer.",
      de: "{partner} arbeitet selbständig: wählt Methoden, Zeiten und Werkzeuge, darf für andere Kunden arbeiten und muss Angebote von {company} nicht annehmen. Jeder angenommene Auftrag ist ein eigener Auftrag zum angebotenen Preis.",
    },
  },
  {
    id: "quality",
    title: { it: "Qualità e consegna", en: "Quality and delivery", de: "Qualität und Lieferung" },
    text: {
      it: "Ogni consegna rispetta i criteri del protocollo indicato nel lavoro. {company} paga dopo l'accettazione, nei giorni del livello di {partner}, contro fattura di {partner}.",
      en: "Each delivery meets the criteria of the protocol named in the job. {company} pays after acceptance, within the days of {partner}'s level, against {partner}'s invoice.",
      de: "Jede Lieferung erfüllt die Kriterien des im Auftrag genannten Protokolls. {company} zahlt nach Abnahme innerhalb der Tage der Stufe von {partner} gegen Rechnung von {partner}.",
    },
  },
  {
    id: "nda", principle: "confidentiality",
    title: { it: "Riservatezza", en: "Confidentiality", de: "Vertraulichkeit" },
    text: {
      it: "{partner} tiene riservate tutte le informazioni ricevute su {company} e sui suoi clienti, durante la collaborazione e per 3 anni dopo, e le usa solo per il lavoro affidato.",
      en: "{partner} keeps confidential all information received about {company} and its customers, during the collaboration and for 3 years after, and uses it only for the assigned work.",
      de: "{partner} behandelt alle Informationen über {company} und deren Kunden vertraulich, während der Zusammenarbeit und 3 Jahre danach, und nutzt sie nur für den Auftrag.",
    },
  },
  {
    id: "gdpr", principle: "GDPR art. 28(4)",
    title: { it: "Dati personali (sub-responsabile)", en: "Personal data (sub-processor)", de: "Personenbezogene Daten (Unterauftragsverarbeiter)" },
    text: {
      it: "Quando un lavoro comporta dati personali, {partner} agisce come sub-responsabile (art. 28.4 GDPR) con gli stessi obblighi di {company}: solo istruzioni scritte, sicurezza adeguata, nessuna copia fuori dai sistemi indicati, cancellazione alla consegna.",
      en: "When a job involves personal data, {partner} acts as a sub-processor (art. 28(4) GDPR) with the same obligations as {company}: written instructions only, appropriate security, no copies outside the named systems, deletion at hand-over.",
      de: "Bei personenbezogenen Daten handelt {partner} als Unterauftragsverarbeiter (Art. 28 Abs. 4 DSGVO) mit denselben Pflichten wie {company}: nur nach Weisung, angemessene Sicherheit, keine Kopien außerhalb der genannten Systeme, Löschung bei Übergabe.",
    },
  },
  {
    id: "whitelabel", principle: "white-label",
    title: { it: "Marchio di {company}", en: "{company}'s brand", de: "Marke von {company}" },
    text: {
      it: "Tutto ciò che il cliente vede porta solo il marchio di {company}: nessun nome, logo o contatto di {partner}.",
      en: "Everything the customer sees carries only {company}'s brand: no name, logo or contact of {partner}.",
      de: "Alles, was der Kunde sieht, trägt nur die Marke von {company}: kein Name, Logo oder Kontakt von {partner}.",
    },
  },
  {
    id: "ai", principle: "AI Act art. 50",
    title: { it: "Intelligenza artificiale", en: "Artificial intelligence", de: "Künstliche Intelligenz" },
    text: {
      it: "Ogni AI che parla con persone dichiara di essere un'AI; i contenuti generati sono indicati come tali.",
      en: "Every AI that talks with people says it is an AI; generated content is labelled.",
      de: "Jede KI, die mit Menschen spricht, gibt sich als KI zu erkennen; generierte Inhalte sind gekennzeichnet.",
    },
  },
  {
    id: "ip",
    title: { it: "Diritti sul lavoro", en: "Rights in the work", de: "Rechte an der Arbeit" },
    text: {
      it: "Con il pagamento, i diritti sul lavoro consegnato passano a {company}, che può cederli al cliente.",
      en: "On payment, the rights in the delivered work pass to {company}, which may transfer them to the customer.",
      de: "Mit Zahlung gehen die Rechte an der Lieferung auf {company} über, die sie an den Kunden weitergeben darf.",
    },
  },
  {
    id: "noncircumvent", onerous: true, principle: "non-circumvention",
    title: { it: "Nessun contatto diretto con i clienti", en: "No direct dealings with customers", de: "Kein Direktgeschäft mit Kunden" },
    text: {
      it: "Per la durata della collaborazione e per 12 mesi dopo, {partner} non contatta né lavora direttamente per i clienti di {company} conosciuti tramite un lavoro. In caso di violazione è dovuta una penale pari a 3 volte il compenso dell'ultimo lavoro per quel cliente.",
      en: "During the collaboration and for 12 months after, {partner} does not contact or work directly for {company}'s customers met through a job. A breach costs a penalty of 3 times the pay of the last job for that customer.",
      de: "Während der Zusammenarbeit und 12 Monate danach kontaktiert {partner} Kunden von {company}, die über einen Auftrag bekannt wurden, nicht direkt und arbeitet nicht direkt für sie. Bei Verstoß fällt eine Vertragsstrafe von dem 3-fachen Honorar des letzten Auftrags für diesen Kunden an.",
    },
  },
  {
    id: "liability", onerous: true,
    title: { it: "Limitazione di responsabilità", en: "Limitation of liability", de: "Haftungsbegrenzung" },
    text: {
      it: "Salvo dolo o colpa grave, la responsabilità di {company} verso {partner} è limitata ai compensi dovuti per i lavori in corso.",
      en: "Except for wilful misconduct or gross negligence, {company}'s liability to {partner} is limited to the pay due for jobs in progress.",
      de: "Außer bei Vorsatz oder grober Fahrlässigkeit ist die Haftung von {company} gegenüber {partner} auf die Vergütung laufender Aufträge begrenzt.",
    },
  },
  {
    id: "law", onerous: true,
    title: { it: "Legge e foro", en: "Law and court", de: "Recht und Gerichtsstand" },
    text: {
      it: "Si applica la {law}. Per ogni controversia è competente in via esclusiva il Foro di {court}.",
      en: "{law} applies. The Court of {court} has exclusive jurisdiction over any dispute.",
      de: "Es gilt {law}. Ausschließlicher Gerichtsstand ist {court}.",
    },
  },
];

// Three questions before a partner signs: any "no" is a sign of dependent work (false self-employment risk).
export const INDEPENDENCE_QUESTIONS: { id: string; text: Record<string, string> }[] = [
  { id: "ownHours", text: { en: "I decide my own hours and methods", it: "Decido io orari e metodi", de: "Ich bestimme Arbeitszeit und Methoden selbst", fa: "ساعت و روش کارم را خودم تعیین می‌کنم" } },
  { id: "otherClients", text: { en: "I work (or may work) for other clients too", it: "Lavoro (o posso lavorare) anche per altri clienti", de: "Ich arbeite (oder darf arbeiten) auch für andere Kunden", fa: "برای مشتری‌های دیگر هم کار می‌کنم (یا می‌توانم)" } },
  { id: "ownTools", text: { en: "I use my own tools and equipment", it: "Uso strumenti e attrezzature miei", de: "Ich nutze eigene Werkzeuge und Geräte", fa: "از ابزار و تجهیزات خودم استفاده می‌کنم" } },
];

export const DRAFT_BANNER: Record<Lang, string> = {
  it: "Bozza standard – testo non ancora rivisto da un avvocato.",
  en: "Standard draft – text not yet reviewed by a lawyer.",
  de: "Standardentwurf – Text noch nicht anwaltlich geprüft.",
};

export const CONTRACT_TITLES: Record<string, Record<Lang, string>> = {
  customer: { it: "Contratto di servizio", en: "Service agreement", de: "Dienstleistungsvertrag" },
  partner: { it: "Accordo quadro di collaborazione (con riservatezza)", en: "Framework collaboration agreement (with NDA)", de: "Rahmenvertrag Zusammenarbeit (mit Geheimhaltung)" },
};

export const DPA_ANNEX: Record<Lang, string> = {
  it: "Allegato A – Accordo sul trattamento dei dati (art. 28 GDPR): oggetto e durata come il contratto; categorie di dati: contatti e richieste dei clienti di {customer}; misure: cifratura, accessi minimi, server UE, cancellazione o restituzione a fine contratto; sub-responsabili: fornitori cloud UE e collaboratori vincolati da pari obblighi; assistenza per i diritti degli interessati e notifica delle violazioni entro 48 ore.",
  en: "Annex A – Data processing agreement (art. 28 GDPR): subject and term as the contract; data: contacts and enquiries of {customer}'s customers; measures: encryption, least access, EU servers, deletion or return at the end; sub-processors: EU cloud providers and subcontractors bound by the same obligations; help with data-subject rights and breach notice within 48 hours.",
  de: "Anlage A – Auftragsverarbeitung (Art. 28 DSGVO): Gegenstand und Dauer wie der Vertrag; Daten: Kontakte und Anfragen der Kunden von {customer}; Maßnahmen: Verschlüsselung, minimale Zugriffe, EU-Server, Löschung oder Rückgabe am Ende; Unterauftragsverarbeiter: EU-Cloudanbieter und Partner mit gleichen Pflichten; Unterstützung bei Betroffenenrechten und Meldung von Verletzungen binnen 48 Stunden.",
};
