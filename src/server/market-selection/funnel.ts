import { FUNNEL_TARGETS } from "./criteria";

/**
 * Diagnostic funnel (doc 13 §2.6 ز, Javad 2026-10-23: the chain's one output is customers who buy).
 * Finds the first broken step and names what to fix. Industry or country are only questioned when
 * every step below them is healthy and there are still no sales, and never before the patience rule.
 */

export type FunnelCounts = {
  contacted: number;
  replied: number;
  interested: number; // check-up or meeting booked
  meetings: number;
  won: number;
  // after the sale, monthly
  monthlyChurn?: number;
  nrr?: number;
  daysSinceStart: number;
  // optional economics
  cacEur?: number;
  ltvEur?: number;
  monthlyGrossProfitPerCustomerEur?: number;
};

export type Fix = "message" | "offer" | "product-or-price" | "delivery" | "industry" | "none" | "wait";

export type Diagnosis = {
  fix: Fix;
  // which level of the chain must change
  owner: "company-agent" | "content/offer" | "product-card" | "delivery" | "industry-agent" | "none";
  reason: string;
  rates: { reply: number | null; interest: number | null; win: number | null };
  economics: { ltvToCac: number | null; paybackMonths: number | null; ok: boolean | null };
};

// a rate is only judged once it rests on enough cases
const MIN = { contacted: 40, replied: 6, meetings: 5 };

export function diagnose(c: FunnelCounts, t = FUNNEL_TARGETS): Diagnosis {
  const reply = c.contacted ? c.replied / c.contacted : null;
  const interest = c.replied ? c.interested / c.replied : null;
  const win = c.meetings ? c.won / c.meetings : null;
  const ltvToCac = c.cacEur && c.ltvEur ? c.ltvEur / c.cacEur : null;
  const paybackMonths = c.cacEur && c.monthlyGrossProfitPerCustomerEur ? c.cacEur / c.monthlyGrossProfitPerCustomerEur : null;
  const economicsOk =
    ltvToCac === null && paybackMonths === null
      ? null
      : (ltvToCac === null || ltvToCac >= t.ltvToCac) && (paybackMonths === null || paybackMonths <= t.maxCacPaybackMonths);
  const base = { rates: { reply, interest, win }, economics: { ltvToCac, paybackMonths, ok: economicsOk } };

  if (c.contacted >= MIN.contacted && reply !== null && reply < t.replyRate) {
    return { ...base, fix: "message", owner: "company-agent", reason: `reply rate ${pct(reply)} < ${pct(t.replyRate)}: change message, channel or timing first` };
  }
  if (c.replied >= MIN.replied && interest !== null && interest < t.interestRate) {
    return { ...base, fix: "offer", owner: "content/offer", reason: `interest ${pct(interest)} < ${pct(t.interestRate)}: free offer or hook is weak` };
  }
  if (c.meetings >= MIN.meetings && win !== null && win < t.winRate) {
    return { ...base, fix: "product-or-price", owner: "product-card", reason: `win rate ${pct(win)} < ${pct(t.winRate)}: fix product or price on the product card` };
  }
  if (c.won > 0 && ((c.monthlyChurn ?? 0) > t.maxMonthlyChurn || (c.nrr ?? 1) < t.minNrr)) {
    return { ...base, fix: "delivery", owner: "delivery", reason: "customers leave or shrink: delivery or results problem" };
  }
  const patienceOver = c.daysSinceStart >= t.industryPatienceDays || c.meetings >= t.industryPatienceMeetings;
  if (c.won === 0) {
    if (!patienceOver) {
      return { ...base, fix: "wait", owner: "none", reason: `no sales yet, but too early to judge the industry (< ${t.industryPatienceDays} days and < ${t.industryPatienceMeetings} meetings)` };
    }
    return { ...base, fix: "industry", owner: "industry-agent", reason: "every step is healthy but no one buys: review the industry choice (then the country)" };
  }
  if (economicsOk === false) {
    return { ...base, fix: "product-or-price", owner: "product-card", reason: "selling, but LTV/CAC or payback misses target: raise price or cut acquisition cost" };
  }
  return { ...base, fix: "none", owner: "none", reason: "funnel healthy" };
}

function pct(n: number) {
  return `${Math.round(n * 1000) / 10}%`;
}
