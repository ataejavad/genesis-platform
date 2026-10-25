import { and, eq } from "drizzle-orm";
import { PACKAGE_MATCH } from "@/config/delivery-seeds";
import type { Db } from "@/db";
import { customerRequests, organizations, servicePackages } from "@/db/schema";
import { journeyCopy } from "@/config/journey-copy";
import { fmtEur } from "@/config/portal-copy";
import { normalize } from "@/lib/chat-match";
import type { Actor } from "./actor";
import { AppError, notFound } from "./errors";
import { answerRequest, QUOTE_HOURS } from "./portal";
import { createOrder } from "./projects";

/*
 * Brief card (marketplace lesson 2026-10-25, like Upwork's Uma or Fiverr's Dynamic Matching): after the customer
 * says what costs them time or money, the chat shows a short scope (their problem, the result, the steps, what is
 * and is not included, the price or when the price comes) and one press confirms it. A catalogue result becomes an
 * order at once; anything else becomes a request we price within 24 hours.
 */

export type Brief = {
  problem: string;
  package: { slug: string; title: string; setupEur: number; monthlyEur: number; revisions: number; days: number; steps: string[] } | null;
  quoteBy: string | null;
};

export async function matchPackage(db: Db, text: string) {
  const t = normalize(text).replace(/ي/g, "ی");
  for (const [slug, re] of PACKAGE_MATCH) {
    if (!re.test(t)) continue;
    const [pkg] = await db.select().from(servicePackages).where(and(eq(servicePackages.slug, slug), eq(servicePackages.active, true)));
    if (pkg) return pkg;
  }
  return null;
}

export async function draftBrief(db: Db, lang: string, text: string, now = new Date()): Promise<Brief> {
  const problem = text.trim().slice(0, 2000);
  const pkg = await matchPackage(db, problem);
  if (!pkg) return { problem, package: null, quoteBy: new Date(now.getTime() + QUOTE_HOURS * 36e5).toISOString() };
  return {
    problem,
    package: { slug: pkg.slug, title: pkg.titles[lang] ?? pkg.title, setupEur: pkg.setupEur, monthlyEur: pkg.monthlyEur, revisions: pkg.revisions, days: pkg.tasks.reduce((s, t) => s + t.days, 0), steps: pkg.milestones.map((m) => m.titles?.[lang] ?? m.title) },
    quoteBy: null,
  };
}

/** Javad prices a new problem with a catalogue result: the order is made (contract next) and the customer sees the price. */
export async function quoteRequest(db: Db, actor: Actor, requestId: string, slug: string) {
  const [r] = await db.select().from(customerRequests).where(eq(customerRequests.id, requestId));
  if (!r) throw notFound("request");
  if (r.status === "done") throw new AppError(409, "answered", "request already answered");
  const [pkg] = await db.select().from(servicePackages).where(and(eq(servicePackages.slug, slug), eq(servicePackages.active, true)));
  if (!pkg) throw notFound("package");
  const [org] = await db.select({ locale: organizations.locale }).from(organizations).where(eq(organizations.id, r.orgId));
  const lang = (org?.locale ?? "en").slice(0, 2);
  const j = journeyCopy(lang).brief;
  const order = await createOrder(db, actor, { packageSlug: slug, source: "request", orgId: r.orgId, locale: lang, note: r.text.slice(0, 2000) });
  await answerRequest(db, actor, requestId, `${pkg.titles[lang] ?? pkg.title}: ${j.price.replace("{setup}", fmtEur(pkg.setupEur, lang)).replace("{monthly}", fmtEur(pkg.monthlyEur, lang))}. ${j.ordered}`, "done");
  return order;
}
