/*
 * Solutions radar (Javad 2026-11-24): every day the radar reads what is new (product launches, technology news),
 * the agent says what problem each one solves, for which industries (NACE) and processes (APQC), and whether we
 * should resell it, build our own version, or ignore it. Javad keeps or dismisses the proposals on his phone.
 * A kept solution becomes a LinkedIn post (English), news with our take on the matching hubs, a marketplace
 * candidate, and a seed for the weekly media writer. Change the limits here.
 */

export type RadarDecision = "resell" | "build" | "ignore";

export const RADAR = {
  /** Rome time; before the 08:00 morning brief */
  at: "06:30",
  /** read items published in the last N hours (a missed day is caught up) */
  lookbackHours: 36,
  /** at most this many new items go to the agent per day, newest first, spread over the feeds */
  maxItems: 60,
  perSource: 15,
  /** at most this many proposals a day reach Javad (value filter: few, good ones) */
  maxPicks: 5,
  /** proposals below this fit (1–5) are kept as "ignored" */
  minFit: 3,
  /** a kept solution shows on matching hubs for this many days, at most this many per hub */
  hubDays: 45,
  hubMax: 3,
  /** proposals not decided after this many hours: ops-watch reminds */
  decideHours: 72,
};

/** APQC Process Classification Framework, level 1 (cross-industry 7.x): the "process" axis of our taxonomy (doc 13). */
export const APQC = [
  "1.0 Develop Vision and Strategy",
  "2.0 Develop and Manage Products and Services",
  "3.0 Market and Sell Products and Services",
  "4.0 Manage Supply Chain for Physical Products",
  "5.0 Deliver Services",
  "6.0 Manage Customer Service",
  "7.0 Develop and Manage Human Capital",
  "8.0 Manage Information Technology",
  "9.0 Manage Financial Resources",
  "10.0 Acquire, Construct, and Manage Assets",
  "11.0 Manage Enterprise Risk, Compliance, Remediation, and Resiliency",
  "12.0 Manage External Relationships",
  "13.0 Develop and Manage Business Capabilities",
];

export const DECISION_LABEL: Record<RadarDecision, { en: string; fa: string; icon: string }> = {
  resell: { en: "Resell (partner / white-label)", fa: "بفروشیم (همکاری / white-label)", icon: "🤝" },
  build: { en: "Build our own", fa: "خودمان بسازیم", icon: "🛠" },
  ignore: { en: "Ignore", fa: "رد", icon: "⏭" },
};

/** NACE division of a code: "F43.21" → "43", "C25" → "25", "62.01" → "62". */
export const naceDivision = (code: string) => code.toUpperCase().replace(/^[A-U]\s*/, "").match(/^(\d{2})/)?.[1] ?? null;
