"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { SiteCopy } from "@/config/site-copy";
import { isEmail, matchAnswer, prefill, type ChatQuestion } from "@/lib/chat-match";
import { detectIndustry } from "@/lib/industry-words";
import type { Answers, LockedReport, LocalizedCheckup, Report } from "@/server/checkup";
import { CheckupReport } from "./CheckupReport";

export type CheckupDefs = Record<string, LocalizedCheckup & { name: string; icon: string; country: string }>;

type Props = {
  defs: CheckupDefs;
  industry?: string;
  locale: string;
  entrance: "page" | "home";
  source?: string;
  c: SiteCopy;
  brand: string;
  // Claude runs the dialogue when the server has a key; otherwise the scripted conversation below.
  llm?: boolean;
  // Home page: lets the concierge react to what was said (matched solutions beside the chat).
  onUserText?: (text: string) => string | null;
  greeting?: string;
};

type Msg = { role: "user" | "assistant"; text?: string; node?: "report" | "plan" | "other" };
type Stage = "greet" | "trade" | "q" | "busy" | "email" | "consent" | "remind" | "plan" | "phone" | "done";

const SPEECH_LANG: Record<string, string> = { it: "it-IT", en: "en-GB", de: "de-DE", fa: "fa-IR" };

/**
 * One conversation engine for the check-up (and later flows): the visitor writes, speaks or taps an option;
 * the chat understands typed answers, skips what was already said and steers to the next open question.
 */
export function Conversation({ defs, industry: initial, locale, entrance, source, c, brand, llm, onUserText, greeting }: Props) {
  const k = c.checkup;
  const lang = locale.slice(0, 2);
  const trades = Object.keys(defs);
  const [msgs, setMsgs] = useState<Msg[]>([{ role: "assistant", text: greeting ?? k.hello }]);
  const [stage, setStage] = useState<Stage>("greet");
  const [industry, setIndustry] = useState<string | null>(initial && defs[initial] ? initial : null);
  const [answers, setAnswers] = useState<Answers>({});
  const [multi, setMulti] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ id: string; report: LockedReport | Report } | null>(null);
  const [email, setEmail] = useState("");
  const [called, setCalled] = useState(false);
  const [listening, setListening] = useState(false);
  const log = useRef<HTMLDivElement>(null);
  const consentText = k.consent.replace("{brand}", brand);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [msgs, stage]);

  const say = (...m: Msg[]) => setMsgs((all) => [...all, ...m]);
  const bot = (text: string): Msg => ({ role: "assistant", text });
  const ack = () => k.acks[Math.floor(Math.random() * k.acks.length)];
  const questions = (slug: string | null): ChatQuestion[] => (slug ? defs[slug].questions : []);
  const openQuestion = (slug: string | null, a: Answers) => questions(slug).find((q) => a[q.id] === undefined);
  const transcript = (extra: Msg[] = []) =>
    [...msgs, ...extra].filter((m) => m.text).map((m) => ({ role: m.role, text: m.text!.slice(0, 2000) })).slice(-80);

  const post = async (url: string, body: unknown) => {
    const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    return res?.ok ? res.json() : null;
  };

  async function finish(slug: string, a: Answers, extra: Msg[]) {
    setStage("busy");
    const data = await post("/api/v1/checkups", { industry: slug, country: defs[slug].country, locale, entrance, source, answers: a, transcript: transcript(extra) });
    if (!data) {
      say(bot(k.error));
      return setStage("q");
    }
    setResult(data);
    say(bot(k.resultIntro), { role: "assistant", node: "report" }, bot(k.askEmail));
    setStage("email");
  }

  // Moves to the next open question, or computes the report when all are answered.
  function advance(slug: string, a: Answers, lead: string, extra: Msg[] = []) {
    const q = openQuestion(slug, a);
    setMulti([]);
    if (!q) return void finish(slug, a, extra);
    say(bot(`${lead} ${q.label}`.trim()));
    setStage("q");
  }

  function startTrade(slug: string, a: Answers, extra: Msg[] = []) {
    setIndustry(slug);
    setAnswers(a);
    advance(slug, a, k.gotTrade.replace("{name}", defs[slug].name), extra);
  }

  function answer(q: ChatQuestion, value: string | string[], label: string) {
    const a = { ...answers, [q.id]: value };
    setAnswers(a);
    const user: Msg = { role: "user", text: label };
    say(user);
    advance(industry!, a, ack(), [user]);
  }

  async function unlock(reminders: boolean) {
    setStage("busy");
    const data = await post(`/api/v1/checkups/${result!.id}/unlock`, { email, consent: true, consentText, reminders });
    if (!data) {
      say(bot(k.error));
      return setStage("remind");
    }
    setResult({ ...result!, report: data.report });
    say(bot(k.planIntro), { role: "assistant", node: "plan" });
    setStage("plan");
  }

  async function handle(text: string) {
    text = text.trim();
    if (!text || stage === "busy") return;
    const user: Msg = { role: "user", text };
    say(user);
    setInput("");
    const reply = onUserText?.(text) ?? null;

    if (stage === "email") {
      if (!isEmail(text)) return say(bot(k.badEmail));
      setEmail(text.trim());
      say(bot(`${k.consentAsk} ${consentText}`));
      return setStage("consent");
    }
    if (stage === "consent" || stage === "remind") {
      const pickYes = matchAnswer({ id: "yn", multi: false, label: "", options: [{ id: "y", label: k.yes }, { id: "n", label: k.no }] }, text);
      if (!pickYes) return say(bot(k.notSure));
      return stage === "consent" ? consent(pickYes === "y") : void unlock(pickYes === "y");
    }
    if (stage === "phone") {
      // Speed to lead: the call request reaches Javad at once; the visitor can add a time in the same line.
      if ((text.match(/\d/g) ?? []).length < 6) return say(bot(k.badPhone));
      setStage("busy");
      const ok = await post(`/api/v1/checkups/${result!.id}/call`, { phone: text.slice(0, 80) });
      setCalled(Boolean(ok));
      say(bot(ok ? k.called : k.error));
      return setStage("plan");
    }
    if (stage === "plan" || stage === "done") return reply ? say(bot(reply)) : undefined;

    if (llm) {
      setStage("busy");
      const turn = await post("/api/v1/checkups/chat", { locale, industry, answers, transcript: transcript([user]) });
      if (turn) {
        const slug: string | null = turn.industry ?? industry;
        const a = { ...answers, ...turn.answers };
        setIndustry(slug);
        setAnswers(a);
        if (slug && !openQuestion(slug, a)) return void finish(slug, a, [user, bot(turn.reply)]);
        say(bot(turn.reply));
        return setStage(slug ? "q" : "trade");
      }
      setStage(industry ? "q" : "greet"); // AI unavailable: fall through to the scripted chat
    }

    // Scripted conversation: understand the trade first, then each open question.
    if (!industry || stage === "greet" || stage === "trade") {
      const slug = detectIndustry(text, trades) ?? industry;
      if (slug) {
        if (reply) say(bot(reply));
        return startTrade(slug, prefill(questions(slug), text, {}), [user]);
      }
      say(bot(reply ? `${reply} ${k.askTrade}` : stage === "greet" ? k.askTrade : k.notSure));
      return setStage("trade");
    }
    const q = openQuestion(industry, answers);
    if (!q) return;
    const found = matchAnswer(q, text);
    const extra = prefill(questions(industry), text, { ...answers, [q.id]: found ?? undefined });
    if (!found && !Object.keys(extra).length) return say(bot(reply ? `${reply} ${k.notSure}` : k.notSure));
    const a = { ...answers, ...extra, ...(found ? { [q.id]: found } : {}) };
    setAnswers(a);
    advance(industry, a, ack(), [user]);
  }

  function consent(yes: boolean) {
    if (!yes) {
      say(bot(k.noThanks));
      return setStage("done");
    }
    say(bot(k.remindAsk));
    setStage("remind");
  }

  function listen() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = SPEECH_LANG[lang] ?? "en-GB";
    rec.interimResults = false;
    rec.onresult = (e) => void handle(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  const q = stage === "q" && industry ? openQuestion(industry, answers) : undefined;
  const chip = (key: string, label: string, onClick: () => void, on = false) => (
    <button key={key} className="chip" aria-pressed={on} onClick={onClick} style={on ? { borderColor: "var(--brand)", background: "var(--brand-soft)" } : undefined}>{on ? "✓ " : ""}{label}</button>
  );
  const tradeChips = () => [
    ...trades.map((s) => chip(s, `${defs[s].icon} ${defs[s].name}`, () => { say({ role: "user", text: defs[s].name }); startTrade(s, {}); })),
    chip("other", k.other, () => { say({ role: "user", text: k.other }, bot(k.otherText), { role: "assistant", node: "other" }); setStage("done"); }),
  ];

  return (
    <div className="conversation">
      <div className="chatlog" ref={log} aria-live="polite">
        {msgs.map((m, i) => (
          <div key={i} className={`msg ${m.role === "user" ? "me" : "them"} fade-in`} style={m.node && m.node !== "other" ? { maxWidth: "100%", width: "100%" } : undefined}>
            {m.text}
            {m.node === "report" && result && <CheckupReport report={result.report} c={k} locale={locale} compact={entrance === "home"} />}
            {m.node === "plan" && result && <CheckupReport report={result.report} c={k} locale={locale} only="plan" />}
            {m.node === "other" && <Link className="btn sm primary" href={`/${locale}/explore`}>{k.explore}</Link>}
          </div>
        ))}
        {stage === "busy" && <div className="msg them fade-in muted">…</div>}
      </div>
      <div className="row chips" style={{ margin: "10px 0" }}>
        {stage === "greet" && <>{c.chat.examples.map((e) => chip(e, e, () => void handle(e)))}{!industry && tradeChips()}{industry && chip("start", `🩺 ${k.inChat}`, () => startTrade(industry, {}))}</>}
        {stage === "trade" && tradeChips()}
        {q && !q.multi && q.options.map((o) => chip(o.id, o.label, () => answer(q, o.id, o.label)))}
        {q?.multi && (
          <>
            {q.options.map((o) => chip(o.id, o.label, () => setMulti((m) => (m.includes(o.id) ? m.filter((x) => x !== o.id) : [...m, o.id])), multi.includes(o.id)))}
            <button className="btn sm primary" disabled={!multi.length} onClick={() => answer(q, multi, q.options.filter((o) => multi.includes(o.id)).map((o) => o.label).join(", "))}>{k.next}</button>
          </>
        )}
        {stage === "consent" && <>{chip("y", k.consentYes, () => { say({ role: "user", text: k.consentYes }); consent(true); })}{chip("n", k.consentNo, () => { say({ role: "user", text: k.consentNo }); consent(false); })}</>}
        {stage === "remind" && <>{chip("y", k.yes, () => { say({ role: "user", text: k.yes }); void unlock(true); })}{chip("n", k.no, () => { say({ role: "user", text: k.no }); void unlock(false); })}</>}
        {stage === "plan" && result && (
          <>
            {called ? <span className="badge ok" role="status">✓ {k.called}</span> : chip("call", `📞 ${k.call}`, () => { say({ role: "user", text: k.call }, bot(k.askPhone)); setStage("phone"); })}
            <Link className="btn sm" href={`/${locale}/checkup/r/${result.id}`}>{k.link}</Link>
          </>
        )}
      </div>
      <form className="row" onSubmit={(e) => { e.preventDefault(); void handle(input); }}>
        <label className="sr-only" htmlFor={`conv-${entrance}`}>{k.placeholder}</label>
        <input id={`conv-${entrance}`} value={input} onChange={(e) => setInput(e.target.value)} placeholder={listening ? k.listening : stage === "email" ? k.email : k.placeholder} type={stage === "email" ? "email" : stage === "phone" ? "tel" : "text"} style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={listen} aria-label={k.mic} title={k.mic}>🎤</button>
        <button className="btn primary">{k.send}</button>
      </form>
    </div>
  );
}

type SpeechRec = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void;
  onend: () => void;
  start: () => void;
};
