/*
 * Removing the customer's identity before anything reaches a partner (white-label + GDPR data minimisation).
 * Rules catch what we know (company name, people of the customer, their email domain) and what looks like an
 * identifier (email, phone, link, IBAN, VAT and tax codes, street addresses). With the Claude key a second pass
 * can catch the rest (cockpit wiring list); what the rules cannot read (PDFs, images) waits for a person.
 */

const LEGAL_FORMS = /\b(s\.?r\.?l\.?s?|s\.?p\.?a\.?|s\.?n\.?c\.?|s\.?a\.?s\.?|gmbh|ag|kg|ug|ltd|llc|inc|bv|sa|sas|sarl|srls)\b\.?/gi;
const GENERIC = new Set(["demo", "group", "gruppo", "italia", "italy", "impianti", "servizi", "service", "services", "studio", "company", "the", "and"]);

type Rule = { kind: string; re: RegExp; to: string };

const RULES: Rule[] = [
  { kind: "email", re: /[\w.+-]+@[\w-]+\.[\w.-]+/g, to: "[EMAIL]" },
  { kind: "link", re: /(?:https?:\/\/|www\.)\S+/gi, to: "[LINK]" },
  { kind: "iban", re: /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,4})?\b/g, to: "[IBAN]" },
  // IT/DE/EU VAT numbers, Italian fiscal codes
  { kind: "tax id", re: /\b(?:IT|DE|AT|FR|ES|NL|BE)\s?\d{9,11}\b|\b(?:p\.?\s?iva|partita iva|ust-?id(?:nr)?\.?|vat(?: no\.?)?)[:\s]*[A-Z]{0,2}\s?\d{8,11}\b|\b[A-Z]{6}\d{2}[A-Z]\d{2}[A-Z]\d{3}[A-Z]\b/gi, to: "[TAX ID]" },
  { kind: "phone", re: /(?:\+|00)?\d[\d\s()./-]{6,}\d/g, to: "[PHONE]" },
  { kind: "address", re: /\b(?:via|viale|piazza|piazzale|corso|largo|vicolo|strada|località|loc\.)\s+[A-ZÀ-ÿ][\wÀ-ÿ'. ]{1,40}?,?\s*\d{1,4}[a-z]?\b|\b[A-ZÄÖÜ][\wäöüß-]{2,}(?:straße|strasse|str\.|weg|platz|allee|gasse)\s*\d{1,4}[a-z]?\b/gi, to: "[ADDRESS]" },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Distinctive words of a company or person name that alone would identify them ("Rossi Impianti Srl" → "Rossi Impianti", "Rossi"). */
export function namesToHide(names: string[]) {
  const out = new Set<string>();
  for (const n of names) {
    const full = n.replace(/\(.*?\)/g, "").replace(/\s+/g, " ").trim();
    const base = full.replace(LEGAL_FORMS, "").replace(/\s+/g, " ").trim();
    for (const x of [full, base]) if (x.length >= 3) out.add(x);
    for (const w of base.split(/[\s,&-]+/)) if (w.length >= 4 && !GENERIC.has(w.toLowerCase())) out.add(w);
  }
  // longest first, so "Rossi Impianti" goes before "Rossi"
  return [...out].sort((a, b) => b.length - a.length);
}

/**
 * Text a partner may read. `company` and `people` are the customer's own names; the result says which kinds
 * of things were replaced so the cockpit can show it without showing the values again.
 */
export function redact(text: string, known: { company: string[]; people: string[] }) {
  let clean = text;
  const removed = new Set<string>();
  for (const r of RULES)
    clean = clean.replace(r.re, () => {
      removed.add(r.kind);
      return r.to;
    });
  // longest names first across both lists: "Rossi Impianti Srl" is one [CUSTOMER], "Mario Rossi" one [PERSON]
  const names = [...namesToHide(known.company).map((w) => ["company", w, "[CUSTOMER]"]), ...namesToHide(known.people).map((w) => ["person", w, "[PERSON]"])].sort((x, y) => y[1].length - x[1].length);
  for (const [kind, w, to] of names) {
    // never inside a placeholder already written ("Customer" must not eat "[CUSTOMER]")
    const re = new RegExp(`(?<![\\p{L}\\p{N}[])${escape(w)}(?![\\p{L}\\p{N}\\]])`, "giu");
    clean = clean.replace(re, () => {
      removed.add(kind);
      return to;
    });
  }
  return { clean, removed: [...removed] };
}

const ROLE_MAILBOXES = new Set(["info", "sales", "admin", "office", "contact", "hello", "mail", "support", "amministrazione", "ufficio", "commerciale", "segreteria", "kontakt", "verkauf", "buero", "service"]);

/** A person's name guessed from their email ("mario.rossi@…" → "Mario Rossi"); role mailboxes give none. */
export function nameFromEmail(email: string) {
  const parts = email.split("@")[0].split(/[._-]+/).filter((w) => /^[a-zà-ÿ]{3,}$/i.test(w) && !ROLE_MAILBOXES.has(w.toLowerCase()));
  return parts.length ? parts.map((w) => w[0].toUpperCase() + w.slice(1)).join(" ") : null;
}

/** Files whose text we can clean ourselves; everything else waits for a person before a partner sees it. */
export const TEXT_FILES = ["text/plain", "text/csv", "text/markdown"];
export const ALLOWED_FILES = [...TEXT_FILES, "application/pdf", "image/png", "image/jpeg", "image/webp", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"];
export const MAX_FILE_BYTES = 10 * 1024 * 1024;
