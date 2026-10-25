/**
 * Rules of the partner portal (doc 15 §6ب, step 6). Pure functions, so the portal, the cockpit, the agent API
 * and the tests use the same numbers. Every automated decision here (match, level) returns its reasons: the
 * EU Platform Work Directive (national laws by 2 Dec 2026) asks for transparency and a human review on request.
 * We never measure hours or activity; only accepted work, quality and on-time delivery count.
 */

type L = Record<"en" | "it" | "de" | "fa", string>;

// Standard skill tags (doc 15: "skills as standard tags").
export const SKILLS: { id: string; label: L }[] = [
  { id: "automation", label: { en: "Automation (n8n, Make)", it: "Automazione (n8n, Make)", de: "Automatisierung (n8n, Make)", fa: "اتوماسیون (n8n، Make)" } },
  { id: "ai-setup", label: { en: "AI assistant setup", it: "Configurazione assistenti AI", de: "Einrichtung KI-Assistenten", fa: "راه‌اندازی دستیار هوش مصنوعی" } },
  { id: "web", label: { en: "Web development", it: "Sviluppo web", de: "Webentwicklung", fa: "توسعه وب" } },
  { id: "crm", label: { en: "CRM and integrations", it: "CRM e integrazioni", de: "CRM und Integrationen", fa: "CRM و اتصال سیستم‌ها" } },
  { id: "content", label: { en: "Content and copywriting", it: "Contenuti e copywriting", de: "Content und Texte", fa: "محتوا و متن‌نویسی" } },
  { id: "marketing", label: { en: "Marketing and ads", it: "Marketing e pubblicità", de: "Marketing und Anzeigen", fa: "بازاریابی و تبلیغات" } },
  { id: "sales", label: { en: "Sales and calls", it: "Vendite e chiamate", de: "Vertrieb und Telefon", fa: "فروش و تماس" } },
  { id: "design", label: { en: "Design", it: "Design", de: "Design", fa: "طراحی" } },
  { id: "translation", label: { en: "Translation", it: "Traduzione", de: "Übersetzung", fa: "ترجمه" } },
  { id: "data", label: { en: "Data and research", it: "Dati e ricerca", de: "Daten und Recherche", fa: "داده و تحقیق" } },
  { id: "admin", label: { en: "Paperwork and incentives", it: "Pratiche e incentivi", de: "Anträge und Förderungen", fa: "کارهای اداری و مشوق‌ها" } },
  { id: "industry", label: { en: "Industry expert", it: "Esperto di settore", de: "Branchenexperte", fa: "کارشناس صنعت" } },
  { id: "assembly", label: { en: "Assembling parts into one delivery", it: "Assemblaggio delle parti in una consegna", de: "Teile zu einer Lieferung zusammenführen", fa: "مونتاژ بخش‌ها در یک تحویل" } },
  { id: "qa", label: { en: "Quality checks (QA)", it: "Controllo qualità (QA)", de: "Qualitätsprüfung (QA)", fa: "کنترل کیفیت (QA)" } },
];
export const skillLabel = (id: string, lang: string) => {
  const s = SKILLS.find((x) => x.id === id);
  return s ? (s.label[lang as keyof L] ?? s.label.en) : id;
};

/* ───────────── Levels: higher level = more offers and faster pay ───────────── */

export type Stats = { accepted: number; avgQuality: number | null; onTimeRate: number | null };
export const TIERS = [
  { id: "new", payoutDays: 14, min: { accepted: 0, quality: 0, onTime: 0 } },
  { id: "rising", payoutDays: 10, min: { accepted: 3, quality: 3.5, onTime: 0 } },
  { id: "trusted", payoutDays: 7, min: { accepted: 10, quality: 4.0, onTime: 0.85 } },
  { id: "top", payoutDays: 3, min: { accepted: 25, quality: 4.5, onTime: 0.95 } },
] as const;
export type TierId = (typeof TIERS)[number]["id"];

const meets = (s: Stats, t: (typeof TIERS)[number]) => s.accepted >= t.min.accepted && (s.avgQuality ?? 0) >= t.min.quality && (s.onTimeRate ?? 0) >= t.min.onTime;

/** The partner's level and exactly what is missing for the next one. */
export function tierOf(s: Stats) {
  const i = TIERS.reduce((best, t, idx) => (meets(s, t) ? idx : best), 0);
  const next = TIERS[i + 1];
  const missing = next
    ? [
        ...(s.accepted < next.min.accepted ? [{ what: "accepted", need: next.min.accepted, have: s.accepted }] : []),
        ...((s.avgQuality ?? 0) < next.min.quality ? [{ what: "quality", need: next.min.quality, have: s.avgQuality ?? 0 }] : []),
        ...((s.onTimeRate ?? 0) < next.min.onTime ? [{ what: "onTime", need: next.min.onTime, have: s.onTimeRate ?? 0 }] : []),
      ]
    : [];
  return { tier: TIERS[i], next: next ?? null, missing };
}

/* ───────────── Matching a job to partners (with reasons) ───────────── */

export type MatchJob = { skills: string[]; language: string | null; country: string | null; personalData: boolean; role?: string };
export type MatchPartner = { skills: string[]; languages: string[]; country: string; capacity: number; active: number; stats: Stats; dpaSigned: boolean };

// EU/EEA plus countries with an EU adequacy decision (personal data may go there without extra clauses).
const SAFE = new Set("AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH GB AD AR CA FO GG IL IM JP JE NZ KR UY".split(" "));

/** null when the partner may not take the job at all; otherwise the score and its parts. */
export function match(job: MatchJob, p: MatchPartner) {
  if (job.personalData && (!p.dpaSigned || !SAFE.has(p.country.toUpperCase()))) return null;
  // assembling and checking are roles: only partners who said they do them (a QA company, an assembler agent)
  if (job.role && job.role !== "work" && !job.skills.every((s) => p.skills.includes(s))) return null;
  const why: { factor: string; points: number; max: number }[] = [];
  const need = job.skills.length ? job.skills : [];
  const covered = need.filter((s) => p.skills.includes(s)).length;
  why.push({ factor: "skills", points: need.length ? Math.round((45 * covered) / need.length) : 45, max: 45 });
  why.push({ factor: "language", points: !job.language || p.languages.includes(job.language) ? 15 : 0, max: 15 });
  why.push({ factor: "country", points: !job.country || p.country.toUpperCase() === job.country.toUpperCase() ? 10 : 4, max: 10 });
  const q = p.stats.avgQuality;
  why.push({ factor: "quality", points: q === null ? 10 : Math.round((20 * Math.max(0, q - 1)) / 4), max: 20 });
  why.push({ factor: "capacity", points: p.active < p.capacity ? 10 : 0, max: 10 });
  return { fit: why.reduce((s, w) => s + w.points, 0), why };
}

/* ───────────── Contact masking (white-label: nobody goes around us) ───────────── */

const PATTERNS: RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g, // email
  /(?:https?:\/\/|www\.)\S+/gi, // links
  /(?:\+|00)?\d[\d\s().-]{6,}\d/g, // phone numbers
  /(?:^|\s)@[A-Za-z0-9_.]{3,}/g, // social handles
  /\b(?:whatsapp|telegram|skype|t\.me|wa\.me|linkedin\.com|instagram\.com)\b\S*/gi,
];

/** What the other side reads: contact details replaced; flagged so we can look at it. */
export function maskContacts(text: string, hidden = "[contact hidden]") {
  let shown = text;
  for (const re of PATTERNS) shown = shown.replace(re, (m) => (m.startsWith(" ") ? ` ${hidden}` : hidden));
  return { shown, flagged: shown !== text };
}

/* ───────────── Screening an application (rules; Claude adds a summary when the key is set) ───────────── */

export function screen(a: { skills: string[]; links: string[]; languages: string[]; pitch: string | null }, openSkills: string[]) {
  const why: string[] = [];
  let score = 30;
  const wanted = a.skills.filter((s) => openSkills.includes(s));
  if (wanted.length) {
    score += Math.min(30, wanted.length * 15);
    why.push(`skills we need now: ${wanted.join(", ")}`);
  }
  if (a.links.length) {
    score += 20;
    why.push("portfolio or CV link given");
  } else why.push("no portfolio link yet");
  if (a.languages.some((l) => ["it", "de"].includes(l))) {
    score += 10;
    why.push("speaks a market language (it/de)");
  }
  if ((a.pitch ?? "").trim().length > 80) {
    score += 10;
    why.push("explained their experience");
  }
  return { score: Math.min(100, score), why, by: "rules" };
}
