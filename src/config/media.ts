/*
 * Media engine plan (doc 11 §5–§7, Javad "turn it on" 2026-11-21). The newsletter is the hub we own; LinkedIn posts on
 * the Legend Partner COMPANY page feed it (Javad 2026-11-24: English only, company page not his profile, no video for now to
 * save model cost; images + text). Every piece links to the newsletter or the free check-up.
 * Change the week's mix here; the agent, the schedule and the cockpit read it.
 */

export type MediaTheme = "news" | "pain" | "build";
export type MediaChannel = "linkedin" | "youtube" | "newsletter";
export type Cta = "newsletter" | "checkup";

/** Rome time; weekday 1 = Monday … 7 = Sunday */
export type Slot = { weekday: number; at: string };

export const MEDIA = {
  /** our LinkedIn company page (created 2026-11-24); the site's media page links to it */
  linkedinPage: "https://www.linkedin.com/company/legendpartner",
  /** one industry × country first (doc 11 §9.3: narrow beats broad); env MEDIA_FOCUS="installers-IT" overrides */
  focus: { industry: "installers", country: "IT" },
  /** 3–5 posts a week on the Legend Partner LinkedIn company page (doc 11 §5), English only (Javad 2026-11-24) */
  linkedin: [
    { theme: "news", lang: "en", cta: "checkup", slot: { weekday: 2, at: "08:30" } },
    { theme: "pain", lang: "en", cta: "newsletter", slot: { weekday: 3, at: "12:30" } },
    { theme: "build", lang: "en", cta: "newsletter", slot: { weekday: 4, at: "08:30" } },
    { theme: "news", lang: "en", cta: "checkup", slot: { weekday: 5, at: "08:30" } },
  ] as { theme: MediaTheme; lang: string; cta: Cta; slot: Slot }[],
  /** short video scripts; OFF for now (Javad 2026-11-24: no video, saves model cost). Add an entry to switch back on. */
  youtube: [] as { theme: MediaTheme; lang: string; cta: Cta; slot: Slot }[],
  /** the weekly newsletter issue per language; subscribers get the issue in their language, English otherwise */
  newsletter: { langs: ["en"], slot: { weekday: 4, at: "09:00" } as Slot },
  /** never two LinkedIn posts closer than this (an approval after its slot moves to the next free time) */
  minGapHours: 20,
  /** goal in 6 months (doc 11 §7 stage 1) */
  goals: { subscribers: 500, checkupsPerMonth: 5, openRate: 40, by: "2027-05-21" },
  /** a post handed to Javad and not confirmed as posted after this many hours shows up in ops-watch */
  handedHours: 48,
  /** drafts not decided after this many hours: ops-watch reminds (the week's posts lose their slot) */
  draftHours: 72,
};

export const THEME_LABEL: Record<MediaTheme | "digest", string> = {
  news: "industry news + our impact take",
  pain: "sector pain point",
  build: "building the company with agents, in public",
  digest: "weekly newsletter",
};

export function mediaFocus(env: Record<string, string | undefined> = process.env) {
  const m = env.MEDIA_FOCUS?.match(/^([a-z0-9-]+)-([A-Za-z]{2})$/);
  return m ? { industry: m[1], country: m[2].toUpperCase() } : MEDIA.focus;
}
