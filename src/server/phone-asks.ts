import { createHash } from "node:crypto";
import { and, asc, eq, gte, inArray, ne, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { experiments, mediaPosts, partners, phoneAsks, prospects, radarItems, touches } from "@/db/schema";
import { DECISION_LABEL, type RadarDecision } from "@/config/radar";
import type { AdminChat, ApprovalPress, DecisionAsk } from "@/providers/admin-chat";
import { type Actor, actorRef } from "./actor";
import { conflict, AppError } from "./errors";
import { audit } from "./events";
import { decideExperiment } from "./improve";
import { confirmMediaPosted, ctaLink, decideMedia } from "./media";
import { approveSequence, rejectSequence } from "./outreach";
import { decideApplication } from "./partners";
import { decideRadar } from "./radar";

/*
 * Approve / reject on the founder's phone for everything that waits on Javad as a plain yes/no, besides content
 * drafts (those have their own flow in admin-chat.ts): first messages to companies, partner applications and
 * finished tests. Each decision calls the SAME module function as the cockpit button, so the send path, the legal
 * checks at send time (country switches, Registro, opt-out) and the audit log are identical.
 * Items that need more than yes/no stay in the cockpit (QA checklist, order reason, customer files to look at).
 *
 * - An ask is sent once per item and text version (phone_asks unique on kind + subject + fingerprint).
 * - A press is claimed atomically (sent → deciding), so two presses or a press racing the cockpit decide once.
 * - A press on an older text (edited, or rewritten by research) does nothing; the new version is asked instead.
 */

type Item = { subjectId: string; fingerprint: string; ask: Omit<DecisionAsk, "ref"> };
type Kind = {
  /** what waits now, as asks */
  pending: (db: Db) => Promise<Item[]>;
  /** fingerprint of what waits for this subject now, or null when nothing waits any more */
  current: (db: Db, subjectId: string) => Promise<string | null>;
  /** applies the decision through the module function the cockpit uses; returns the answer shown in the chat */
  decide: (db: Db, actor: Actor, subjectId: string, approve: boolean) => Promise<string>;
};

const hash = (parts: unknown[]) => createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 16);
const cut = (s: string | null | undefined, n: number) => (!s ? "" : s.length > n ? `${s.slice(0, n)}…` : s);

/* ───────────── outbound first messages ───────────── */

// Companies found on Maps get their drafts rewritten once research adds the personal line: ask after that.
const researchDone = sql`not (${prospects.source} = 'maps' and coalesce(${prospects.signals}->>'researched', '') in ('', 'failed'))`;

async function draftsOf(db: Db, prospectIds: string[]) {
  if (!prospectIds.length) return [];
  return db.select().from(touches).where(and(inArray(touches.prospectId, prospectIds), eq(touches.status, "draft"))).orderBy(asc(touches.prospectId), asc(touches.position));
}
/** Steps the law or a switch holds back right now, so the founder sees what an approval will NOT send. */
const held = (list: (typeof touches.$inferSelect)[]) => {
  const reasons = [...new Set(list.filter((t) => t.blockedReason).map((t) => `${t.channel}: ${t.blockedReason}`))];
  return reasons.length ? `⏸ فعلاً نمی‌رود:\n${reasons.join("\n")}` : "";
};
const outreachPrint = (list: (typeof touches.$inferSelect)[]) => hash(list.map((t) => [t.id, t.subject, t.body]));

const outreach: Kind = {
  async pending(db) {
    const waiting = await db
      .selectDistinct({ id: prospects.id })
      .from(prospects)
      .innerJoin(touches, eq(touches.prospectId, prospects.id))
      .where(and(eq(touches.status, "draft"), ne(prospects.stage, "do_not_contact"), researchDone));
    const ids = waiting.map((w) => w.id);
    if (!ids.length) return [];
    const rows = await db.select().from(prospects).where(inArray(prospects.id, ids)).orderBy(asc(prospects.createdAt));
    const drafts = await draftsOf(db, ids);
    return rows.map((p) => {
      const list = drafts.filter((t) => t.prospectId === p.id);
      const first = list.find((t) => t.channel === "email") ?? list[0];
      const plan = Object.entries(list.reduce<Record<string, number>>((m, t) => ((m[t.channel] = (m[t.channel] ?? 0) + 1), m), {}))
        .map(([c, n]) => `${c} ×${n}`)
        .join("، ");
      return {
        subjectId: p.id,
        fingerprint: outreachPrint(list),
        ask: {
          title: `پیام اول به ${p.name}`,
          lines: [
            [`${p.city ?? p.region ?? ""} (${p.country}) · ${p.industry}`, p.website ?? ""].filter(Boolean).join("\n"),
            `برنامه: ${list.length} قدم (${plan})`,
            first ? `${first.channel === "email" ? "✉️" : first.channel === "phone" ? "📞" : "💼"} ${first.subject ? `${first.subject}\n` : ""}${cut(first.body, 1400)}` : "",
            first?.bodyFa ? `ترجمه فارسی:\n${cut(first.bodyFa, 1000)}` : "",
            held(list),
            "با تأیید، صفحه شرکت آنلاین می‌شود. هر قدم سر وقت خودش دوباره با قانون همان کشور چک می‌شود: ایمیل یا تماس خودکار بدون رضایت قبلی هرگز خودکار نمی‌رود (در ایتالیا خاموش است). LinkedIn و تماس انسانی کارهایی برای یک نفر می‌شوند.",
          ],
          approveLabel: "✅ تأیید",
          rejectLabel: "❌ رد",
          link: `/cockpit/crm/${p.id}`,
          linkLabel: "✏️ ویرایش متن در کابین",
        },
      };
    });
  },
  async current(db, id) {
    const list = await draftsOf(db, [id]);
    return list.length ? outreachPrint(list) : null;
  },
  async decide(db, actor, id, approve) {
    if (approve) {
      const n = await approveSequence(db, actor, id);
      return `✅ تأیید شد: ${n} قدم برنامه‌ریزی شد و سر وقت ارسال می‌شود.`;
    }
    // reject only what still waits: a reject must never cancel a sequence that was already approved
    if (!(await draftsOf(db, [id])).length) throw conflict("nothing waiting for approval");
    await rejectSequence(db, actor, id, "rejected in Telegram");
    return "❌ رد شد؛ چیزی برای این شرکت ارسال نمی‌شود.";
  },
};

/* ───────────── partner applications ───────────── */

const partnerKind: Kind = {
  async pending(db) {
    const rows = await db.select().from(partners).where(eq(partners.status, "applied")).orderBy(asc(partners.createdAt));
    return rows.map((p) => ({
      subjectId: p.id,
      fingerprint: "v1",
      ask: {
        title: `درخواست همکاری: ${p.name}`,
        lines: [`${p.kind} · ${p.country} · زبان‌ها: ${p.languages.join(", ") || "—"}`, `مهارت‌ها: ${p.skills.join(", ") || "—"}`, p.links.join("\n"), cut(p.pitch, 600)],
        approveLabel: "✅ بپذیر",
        rejectLabel: "❌ رد",
        link: "/cockpit/partners",
        linkLabel: "🔎 جزئیات در کابین",
      },
    }));
  },
  async current(db, id) {
    const [p] = await db.select({ status: partners.status }).from(partners).where(eq(partners.id, id));
    return p?.status === "applied" ? "v1" : null;
  },
  async decide(db, actor, id, approve) {
    // the one-time password is not sent to a chat: the partner gets a set-your-password link with the agreement
    await decideApplication(db, actor, id, approve);
    return approve ? "✅ پذیرفته شد؛ قرارداد همکاری و لینک ورود برایش ایمیل می‌شود." : "❌ رد شد.";
  },
};

/* ───────────── finished tests ───────────── */

const experimentKind: Kind = {
  async pending(db) {
    const rows = await db.select().from(experiments).where(eq(experiments.status, "ready")).orderBy(asc(experiments.createdAt));
    return rows.map((e) => {
      const r = (e.result ?? {}) as { why?: string; winner?: string };
      const winner = e.variants.find((v) => v.id === r.winner);
      return {
        subjectId: e.id,
        fingerprint: hash([r.winner ?? null]),
        ask: {
          title: `آزمایش تمام شد: ${e.key}`,
          lines: [e.hypothesis, `معیار: ${e.metric}`, r.why ?? "", winner ? `پیشنهاد: «${winner.description}»` : ""],
          approveLabel: "✅ برنده را اجرا کن",
          rejectLabel: "↩️ همان قبلی بماند",
          link: "/cockpit/experiments",
        },
      };
    });
  },
  async current(db, id) {
    const [e] = await db.select().from(experiments).where(eq(experiments.id, id));
    return e?.status === "ready" ? hash([(e.result as { winner?: string } | null)?.winner ?? null]) : null;
  },
  async decide(db, actor, id, approve) {
    const r = await decideExperiment(db, actor, id, approve);
    return approve ? `✅ اجرا شد (${r.winner}).` : "↩️ همان قبلی ماند.";
  },
};


/* ───────────── media: drafts to approve, posts to put on LinkedIn ───────────── */

const CHANNEL_FA: Record<string, string> = { linkedin: "💼 لینکدین", youtube: "🎬 ویدیو یوتیوب", newsletter: "📬 خبرنامه" };
const THEME_FA: Record<string, string> = { news: "خبر + تحلیل ما", pain: "درد صنف", build: "ساختن شرکت با ایجنت‌ها", solution: "راه‌حل تازه از رادار", digest: "شماره هفتگی" };
const romeTime = (d: Date | null) => (d ? new Intl.DateTimeFormat("fa-IR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Rome" }).format(d) : "—");
type MediaRow = typeof mediaPosts.$inferSelect;
const mediaPrint = (p: MediaRow) => (p.status === "handed" ? `handed:${hash([p.publishedRef])}` : hash([p.title, p.body]));

function mediaAsk(p: MediaRow): Omit<DecisionAsk, "ref"> {
  if (p.status === "handed" && p.channel === "linkedin") {
    return {
      title: `⏰ وقت پست لینکدین: ${p.title}`,
      lines: [
        "۱) «📲 باز کردن لینکدین» را بزن؛ متن آماده است، فقط Post را بزن.",
        "۲) بعد اینجا «✅ پست کردم» را بزن.",
        `اگر لینکدین متن را پر نکرد، این را کپی کن:\n\n${cut(p.body, 2600)}\n\n👉 ${ctaLink(p)}`,
      ],
      approveLabel: "✅ پست کردم",
      rejectLabel: "⏭ این یکی را نمی‌گذارم",
      link: p.publishedRef?.startsWith("https://") ? `/api/media/${p.id}/share` : `/cockpit/media#${p.id}`,
      linkLabel: "📲 باز کردن لینکدین",
    };
  }
  if (p.status === "handed") {
    return {
      title: `🎬 اسکریپت ویدیوی این هفته: ${p.title}`,
      lines: [cut(p.body, 2600), `لینک توضیحات ویدیو: ${ctaLink(p)}`, "ضبط با گوشی (حدود ۳۰ دقیقه)، بعد «✅ منتشر کردم»."],
      approveLabel: "✅ ضبط و منتشر کردم",
      rejectLabel: "⏭ این هفته نه",
      link: `/cockpit/media#${p.id}`,
    };
  }
  const isIssue = p.channel === "newsletter";
  return {
    title: `${CHANNEL_FA[p.channel] ?? p.channel} (${p.lang}) · ${THEME_FA[p.theme] ?? p.theme}: ${p.title}`,
    lines: [
      isIssue ? `موضوع ایمیل: ${p.title}\n\n${cut(p.body, 1500)}` : cut(p.body, 1500),
      p.bodyFa ? `${isIssue ? "خلاصه" : "ترجمه"} فارسی:\n${cut(p.bodyFa, 1200)}` : "",
      p.sourceUrl ? `منبع: ${p.sourceTitle ?? ""} ${p.sourceUrl}` : "",
      `زمان انتشار: ${romeTime(p.scheduledFor)} (اگر گذشته باشد، اولین وقت آزاد)`,
      `لینک انتهای پست: ${p.cta === "checkup" ? "چک‌آپ رایگان" : "عضویت خبرنامه"}`,
      p.writer === "rules" ? "⚠️ نسخه ساده از تحقیق هاب (مدل هوش مصنوعی در دسترس نبود)" : "",
    ],
    approveLabel: isIssue ? "✅ تأیید، ارسال سر وقت" : "✅ تأیید",
    rejectLabel: "❌ رد",
    link: `/cockpit/media#${p.id}`,
    linkLabel: "✏️ ویرایش متن در کابین",
  };
}

const mediaKind: Kind = {
  async pending(db) {
    const rows = await db.select().from(mediaPosts).where(inArray(mediaPosts.status, ["draft", "handed"])).orderBy(asc(mediaPosts.scheduledFor), asc(mediaPosts.createdAt));
    return rows.map((p) => ({ subjectId: p.id, fingerprint: mediaPrint(p), ask: mediaAsk(p) }));
  },
  async current(db, id) {
    const [p] = await db.select().from(mediaPosts).where(eq(mediaPosts.id, id));
    return p && ["draft", "handed"].includes(p.status) ? mediaPrint(p) : null;
  },
  async decide(db, actor, id, approve) {
    const [p] = await db.select({ status: mediaPosts.status }).from(mediaPosts).where(eq(mediaPosts.id, id));
    if (p?.status === "handed") {
      await confirmMediaPosted(db, actor, id, approve);
      return approve ? "✅ ثبت شد. ممنون!" : "⏭ رد شد؛ این یکی منتشر نمی‌شود.";
    }
    const row = await decideMedia(db, actor, id, approve, approve ? undefined : "rejected in Telegram");
    return approve ? `✅ تأیید شد؛ انتشار: ${romeTime(row.scheduledFor)}` : "❌ رد شد؛ ایجنت هفته بعد از آن یاد می‌گیرد.";
  },
};

/* ───────────── solutions radar: keep (+ LinkedIn post) or dismiss ───────────── */

type RadarRow = typeof radarItems.$inferSelect;
const radarPrint = (r: RadarRow) => hash([r.decision, r.linkedin]);

const radarKind: Kind = {
  async pending(db) {
    const rows = await db.select().from(radarItems).where(eq(radarItems.status, "proposed")).orderBy(asc(radarItems.day), asc(radarItems.createdAt));
    return rows.map((r) => {
      const d = DECISION_LABEL[(r.decision ?? "ignore") as RadarDecision];
      return {
        subjectId: r.id,
        fingerprint: radarPrint(r),
        ask: {
          title: `📡 راه‌حل تازه: ${r.maker ?? r.title} · ${d.icon} ${d.fa} · تناسب ${r.fit}/5`,
          lines: [
            r.summaryFa ?? "",
            `صنعت‌ها: ${r.industries.map((i) => `${i.name} (${i.nace})`).join("، ")}\nفرایند: ${r.processes.join("، ")}`,
            r.why ? `چرا: ${cut(r.why, 400)}` : "",
            `منبع: ${r.source} ${r.url}`,
            r.linkedin ? `💼 پست لینکدین (انگلیسی) که با ✅ زمان‌بندی می‌شود:\n\n${cut(r.linkedin, 1500)}` : "",
            "با ✅: در فهرست راه‌حل‌ها می‌ماند، در هاب‌های همان صنعت با تحلیل ما نشان داده می‌شود، کاندید فروشگاه می‌شود و پست در اولین وقت آزاد آماده می‌شود.",
          ],
          approveLabel: "✅ نگه دار + پست",
          rejectLabel: "❌ رد",
          link: `/cockpit/radar#${r.id}`,
          linkLabel: "✏️ جزئیات / فقط نگه داشتن بدون پست",
        },
      };
    });
  },
  async current(db, id) {
    const [r] = await db.select().from(radarItems).where(eq(radarItems.id, id));
    return r?.status === "proposed" ? radarPrint(r) : null;
  },
  async decide(db, actor, id, approve) {
    const r = await decideRadar(db, actor, id, approve ? "keep_post" : "dismiss", approve ? undefined : "dismissed in Telegram");
    return approve ? `✅ نگه داشته شد${r.mediaPostId ? "؛ پست لینکدین در اولین وقت آزاد برایت می‌آید" : ""}.` : "❌ رد شد؛ رادار از آن یاد می‌گیرد.";
  },
};

export const PHONE_KINDS: Record<string, Kind> = { outreach, partner: partnerKind, experiment: experimentKind, media: mediaKind, radar: radarKind };

/** Sends asks for everything that waits and was not asked in this version yet (worker tick; cockpit button). */
export async function sendWaitingAsks(db: Db, chat: AdminChat, max = 10) {
  let sent = 0;
  const errors: string[] = [];
  for (const [kind, k] of Object.entries(PHONE_KINDS)) {
    for (const item of await k.pending(db)) {
      if (sent >= max) return { sent, errors, more: true };
      const [row] = await db.insert(phoneAsks).values({ kind, subjectId: item.subjectId, fingerprint: item.fingerprint }).onConflictDoNothing().returning();
      if (!row) continue; // this version was asked before
      try {
        const messageId = await chat.askDecision({ ref: row.id, ...item.ask });
        await db.update(phoneAsks).set({ messageId }).where(eq(phoneAsks.id, row.id));
        // older versions of the same item can no longer be decided
        await db.update(phoneAsks).set({ status: "stale" }).where(and(eq(phoneAsks.kind, kind), eq(phoneAsks.subjectId, item.subjectId), eq(phoneAsks.status, "sent"), ne(phoneAsks.id, row.id)));
        sent++;
      } catch (err) {
        // not delivered: forget it, so the next pass tries again
        await db.delete(phoneAsks).where(eq(phoneAsks.id, row.id));
        errors.push(err instanceof Error ? err.message.slice(0, 200) : String(err));
        return { sent, errors, more: true };
      }
    }
  }
  return { sent, errors, more: false };
}

const ALREADY: Record<string, string> = {
  approved: "قبلاً تأیید شده ✅",
  rejected: "قبلاً رد شده ❌",
  deciding: "در حال انجام است…",
  stale: "این نسخه قدیمی است؛ نسخه تازه را ببین",
  elsewhere: "قبلاً در کابین تصمیم گرفته شده",
};

/** A press on a decision ask. Returns the status the ask ended in (null when the press was not allowed). */
export async function handleAskPress(db: Db, press: ApprovalPress) {
  const actor: Actor = { type: "telegram", id: press.by };
  if (!press.allowed) {
    await audit(db, actor, "phone.press_denied", { type: "phone_ask", id: press.id }, null, { decision: press.decision });
    await press.ack("اجازه تأیید ندارید");
    return null;
  }
  const [ask] = await db.update(phoneAsks).set({ status: "deciding" }).where(and(eq(phoneAsks.id, press.id), eq(phoneAsks.status, "sent"))).returning();
  if (!ask) {
    const [was] = await db.select({ status: phoneAsks.status }).from(phoneAsks).where(eq(phoneAsks.id, press.id));
    await press.ack(was ? (ALREADY[was.status] ?? "قبلاً تصمیم گرفته شده") : "این دکمه دیگر معتبر نیست");
    return was?.status ?? null;
  }
  const kind = PHONE_KINDS[ask.kind];
  const finish = async (status: string, answer: string) => {
    await db.update(phoneAsks).set({ status, decidedBy: actorRef(actor), decidedAt: new Date() }).where(eq(phoneAsks.id, ask.id));
    await press.ack(answer);
    return status;
  };
  const now = kind ? await kind.current(db, ask.subjectId) : null;
  if (now === null) return finish("elsewhere", ALREADY.elsewhere);
  if (now !== ask.fingerprint) return finish("stale", "متن عوض شده؛ نسخه تازه برایت فرستاده می‌شود. چیزی ارسال نشد.");
  try {
    const answer = await kind.decide(db, actor, ask.subjectId, press.decision === "approved");
    return await finish(press.decision, answer);
  } catch (err) {
    if (err instanceof AppError && err.status === 409) return finish("elsewhere", ALREADY.elsewhere);
    // anything else: the ask can be pressed again
    await db.update(phoneAsks).set({ status: "sent" }).where(eq(phoneAsks.id, ask.id));
    await press.ack(err instanceof AppError ? `انجام نشد: ${err.message}` : "خطا؛ دوباره بزن یا از کابین انجام بده");
    if (!(err instanceof AppError)) throw err;
    return "sent";
  }
}

/** Cockpit status: what went to the phone in the last 7 days and what was decided there. */
export async function phoneAskStats(db: Db, now = new Date()) {
  const since = new Date(now.getTime() - 7 * 864e5);
  const rows = await db
    .select({ status: phoneAsks.status, n: sql<number>`count(*)::int` })
    .from(phoneAsks)
    .where(gte(phoneAsks.createdAt, since))
    .groupBy(phoneAsks.status);
  const by = Object.fromEntries(rows.map((r) => [r.status, Number(r.n)]));
  return { sent: rows.reduce((s, r) => s + Number(r.n), 0), waiting: by.sent ?? 0, approved: by.approved ?? 0, rejected: by.rejected ?? 0 };
}
