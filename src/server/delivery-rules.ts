/**
 * Rules of project delivery (doc 15 §6د2, step 7). Pure functions, so the cockpit, the worker and the tests
 * use the same numbers: how risky a project is (who approves what), where a delivery goes after QA, and how
 * healthy a running project is.
 */

export type Risk = "low" | "medium" | "high";

/** Risk-tiered approvals: low = automatic with sampling, medium = QA judge + Javad at the end, high = Javad at each step. */
export function riskOf(p: { priceEur: number; fromPackage: boolean; sensitiveData?: boolean }): { level: Risk; why: string[] } {
  const why: string[] = [];
  let level: Risk = "low";
  const up = (to: Risk, reason: string) => {
    why.push(reason);
    if (to === "high" || (to === "medium" && level === "low")) level = to;
  };
  if (!p.fromPackage) up("medium", "custom work (no catalogue package)");
  if (p.priceEur > 3000) up("high", "over €3,000");
  else if (p.priceEur > 1000) up("medium", "over €1,000");
  if (p.sensitiveData) up("high", "sensitive data (health, finance, minors)");
  if (!why.length) why.push("catalogue package under €1,000");
  return { level, why };
}

export type Judge = { verdict: "accept" | "changes" | "review" } | null;

/**
 * Where a delivery goes after QA. Without a judge (no Claude key yet) a person always decides.
 * Low risk: accepted automatically when the judge accepts and the partner is trusted, except a 15% sample.
 * Medium: the judge decides tasks, a person the last milestone. High: always a person.
 */
export function qaRoute(i: { risk: Risk | null; judge: Judge; partnerTier: string; lastMilestone: boolean; sample: number }): { route: "auto" | "human"; why: string } {
  if (!i.risk) return { route: "human", why: "job outside a project" };
  if (!i.judge) return { route: "human", why: "no QA judge yet" };
  if (i.judge.verdict !== "accept") return { route: "human", why: `judge: ${i.judge.verdict}` };
  if (i.risk === "high") return { route: "human", why: "high-risk project" };
  if (i.risk === "medium") return i.lastMilestone ? { route: "human", why: "final delivery of a medium-risk project" } : { route: "auto", why: "judge accepted (medium risk)" };
  if (!["trusted", "top"].includes(i.partnerTier)) return { route: "human", why: "partner not trusted yet" };
  if (i.sample < 0.15) return { route: "human", why: "random 15% sample" };
  return { route: "auto", why: "judge accepted, trusted partner, low risk" };
}

export type HealthInput = {
  priceEur: number;
  budgetEur: number;
  costEur: number;
  tasks: { payEur: number; status: string; dueAt: Date }[];
  waiting: { readyAt: Date | null }[];
  now: Date;
};

/** Live project health: earned progress, budget burn, expected margin and what to look at (delivery watchdog). */
export function health(h: HealthInput) {
  const total = h.tasks.reduce((s, t) => s + t.payEur, 0) || 1;
  const progress = h.tasks.filter((t) => t.status === "accepted").reduce((s, t) => s + t.payEur, 0) / total;
  const burn = h.budgetEur ? h.costEur / h.budgetEur : 0;
  const expectedCost = Math.max(h.costEur, h.budgetEur);
  const marginPct = h.priceEur ? (h.priceEur - expectedCost) / h.priceEur : 0;
  const late = h.tasks.filter((t) => !["accepted", "cancelled"].includes(t.status) && t.dueAt < h.now).length;
  const stuck = h.waiting.filter((w) => w.readyAt && h.now.getTime() - w.readyAt.getTime() > 864e5).length;
  const flags: string[] = [];
  if (burn >= 0.8 && progress < 0.6) flags.push(`budget ${Math.round(burn * 100)}% spent at ${Math.round(progress * 100)}% done`);
  if (late) flags.push(`${late} task(s) late`);
  if (marginPct < 0.3) flags.push(`margin ${Math.round(marginPct * 100)}% (target 30%+)`);
  if (stuck) flags.push(`${stuck} milestone(s) waiting for the customer > 24h`);
  return { progress: Math.round(progress * 100) / 100, burn: Math.round(burn * 100) / 100, marginPct: Math.round(marginPct * 100) / 100, late, flags };
}

/** At closing: criteria that failed more than once become lessons (proposals for the next protocol version). */
export function lessonsFrom(failures: { protocol: string; criterion: string }[], lateTasks: number) {
  const count = new Map<string, number>();
  for (const f of failures) count.set(`${f.protocol}: ${f.criterion}`, (count.get(`${f.protocol}: ${f.criterion}`) ?? 0) + 1);
  const out = [...count.entries()].filter(([, n]) => n > 1).map(([k, n]) => `${k} failed ${n}×: make it clearer in the protocol or the brief`);
  if (lateTasks) out.push(`${lateTasks} task(s) delivered late: check the standard days`);
  return out;
}

/** Customer code shown to partners instead of the name (white-label). */
export const customerCode = (orgId: string, industry: string | null, country: string | null) => `C-${orgId.slice(0, 4).toUpperCase()} · ${industry ?? "?"} · ${country ?? "?"}`;
