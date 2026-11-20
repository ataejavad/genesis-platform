// Understands a typed (or spoken) answer in the scripted conversation: numbers against option ranges,
// words against option labels and synonyms, yes/no. Pure, so the browser and the tests use the same rules.

export type ChatOption = { id: string; label: string; words?: string[] };
export type ChatQuestion = { id: string; multi: boolean; label: string; options: ChatOption[] };

const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
export function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[۰-۹]/g, (d) => String(FA_DIGITS.indexOf(d)))
    .replace(/٬/g, "")
    .replace(/(\d)[.,](\d{3})\b/g, "$1$2");
}

// Spoken numbers people type in a chat ("una decina", "a dozen"). Articles like "un/a/one" are left out on purpose.
const WORD_NUMBERS: Record<string, number> = {
  paio: 2, due: 2, tre: 3, quattro: 4, cinque: 5, sei: 6, sette: 7, otto: 8, nove: 9, dieci: 10, decina: 10, dozzina: 12, quindici: 15, venti: 20, ventina: 20, trenta: 30, trentina: 30, quaranta: 40, cinquanta: 50, cento: 100, centinaio: 100,
  couple: 2, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, dozen: 12, fifteen: 15, twenty: 20, thirty: 30, forty: 40, fifty: 50, hundred: 100,
  zwei: 2, drei: 3, vier: 4, funf: 5, zehn: 10, dutzend: 12, zwanzig: 20, dreissig: 30, hundert: 100,
  دو: 2, سه: 3, چهار: 4, پنج: 5, ده: 10, بیست: 20, سی: 30, صد: 100,
};
const numbers = (text: string) => {
  const t = normalize(text);
  const digits = [...t.matchAll(/\d+(?:[.,]\d+)?/g)].map((m) => Number(m[0].replace(",", ".")));
  if (digits.length) return digits;
  return t.split(/[^\p{L}]+/u).flatMap((w) => (w in WORD_NUMBERS ? [WORD_NUMBERS[w]] : []));
};
const MONEY = /€|\beur|euro|یورو/;
const LESS = /\b(meno|under|less|below|unter|weniger)\b|کمتر|زیر/;
const MORE = /\b(piu|over|more|oltre|uber|mehr|plus)\b|بیشتر|بالای/;
const YES = /^(si|yes|ja|ok|certo|sure|بله|آره|اره|اوکی)\b/;
const NO = /^(no|nein|nope|نه|خیر)\b/;

// Range an option label stands for, e.g. "5–15" → [5, 15], "Under 5" → [0, 5), "Over 15" → (15, ∞), "About €25" → 25.
function range(label: string): { lo: number; hi: number; about?: number } | null {
  const n = numbers(label);
  const l = normalize(label);
  if (n.length >= 2) return { lo: n[0], hi: n[1] };
  if (n.length === 1 && LESS.test(l)) return { lo: 0, hi: n[0] };
  if (n.length === 1 && MORE.test(l)) return { lo: n[0], hi: Infinity };
  if (n.length === 1) return { lo: n[0], hi: n[0], about: n[0] };
  return null;
}

function byNumber(q: ChatQuestion, value: number): string | null {
  const ranges = q.options.map((o) => ({ id: o.id, r: range(o.label) })).filter((x) => x.r);
  if (!ranges.length) return null;
  if (ranges.every((x) => x.r!.about !== undefined)) {
    return ranges.reduce((best, x) => (Math.abs(x.r!.about! - value) < Math.abs(best.r!.about! - value) ? x : best)).id;
  }
  return ranges.find((x) => value >= x.r!.lo && value <= x.r!.hi)?.id ?? (value > Math.max(...ranges.map((x) => x.r!.lo)) ? ranges.at(-1)!.id : null);
}

const keywords = (o: ChatOption) =>
  [...normalize(o.label).split(/[^\p{L}\d]+/u).filter((w) => w.length >= 5 && !/^\d/.test(w)), ...(o.words ?? []).map(normalize)];

function byWords(q: ChatQuestion, text: string): string[] {
  const t = normalize(text);
  return q.options.filter((o) => keywords(o).some((w) => t.includes(w))).map((o) => o.id);
}

/** The option(s) a free-text answer picks for this question, or null when it is not clear enough. */
export function matchAnswer(q: ChatQuestion, text: string): string | string[] | null {
  const words = byWords(q, text);
  if (q.multi) return words.length ? words : null;
  if (words.length === 1) return words[0];
  const t = normalize(text).trim();
  const yesNo = q.options.length === 2 ? (YES.test(t) ? q.options[0].id : NO.test(t) ? q.options[1].id : null) : null;
  if (yesNo) return yesNo;
  // A sum of money only answers a question whose options are sums of money (and the other way round).
  if (MONEY.test(normalize(text)) !== q.options.some((o) => MONEY.test(normalize(o.label)))) return null;
  const n = numbers(text);
  if (n.length) return byNumber(q, n[0]);
  if (/\b(tant[ei]|molt[ei]|sacco|lots?|many|viele|sehr)\b|خیلی|زیاد/.test(normalize(text))) return q.options.at(-1)!.id;
  if (/\b(poch[ei]|pochissim[ei]|few|wenige|kaum)\b|(^|\s)کم(\s|$)/.test(normalize(text))) return q.options[0].id;
  return null;
}

/** Answers that a free sentence gives away for other open questions (only clear word matches, never numbers). */
export function prefill(questions: ChatQuestion[], text: string, answered: Record<string, unknown>) {
  const found: Record<string, string | string[]> = {};
  for (const q of questions) {
    if (answered[q.id] !== undefined) continue;
    const words = byWords(q, text);
    if (q.multi && words.length) found[q.id] = words;
    else if (!q.multi && words.length === 1 && q.options.every((o) => range(o.label) === null)) found[q.id] = words[0];
  }
  return found;
}

export const isEmail = (text: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(text.trim());
