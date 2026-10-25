"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { PartnerCopy } from "@/config/partner-copy";
import type { PortalCopy } from "@/config/portal-copy";
import type { PartnerCard } from "@/server/partner-chat";
import type { Card } from "@/server/portal-chat";
import { PartnerCardView } from "../partner/PartnerCards";
import * as partnerActions from "../partner/actions";
import * as portalActions from "./actions";
import { CardView } from "./Cards";

type AnyCard = Card | PartnerCard;
type Msg = { role: "user" | "assistant"; text: string; cards?: AnyCard[] };
type Props =
  | { kind: "portal"; t: PortalCopy; lang: string; name: string; threads: Thread[] }
  | { kind: "partner"; t: PartnerCopy; lang: string; name: string; threads: Thread[] };
type Thread = { id: string; title: string };

const SPEECH_LANG: Record<string, string> = { it: "it-IT", en: "en-GB", de: "de-DE", fa: "fa-IR" };

/**
 * Home of the outside doors (Javad 2026-10-25): a conversation like Claude's. Earlier conversations on the side,
 * the answer in the middle with live cards from the user's own data. Customer dashboard and partner portal
 * share it; each brings its own actions and cards.
 */
export function PortalChat(props: Props) {
  const { t, lang, name, threads: initialThreads } = props;
  const { sendMessage, loadThread } = props.kind === "portal" ? portalActions : partnerActions;
  const hello: Msg = { role: "assistant", text: t.hello.replace("{name}", name) };
  const [threads, setThreads] = useState(initialThreads);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([hello]);
  const [input, setInput] = useState("");
  const [listening, setListening] = useState(false);
  const [pending, start] = useTransition();
  const log = useRef<HTMLDivElement>(null);

  useEffect(() => {
    log.current?.scrollTo({ top: log.current.scrollHeight, behavior: "smooth" });
  }, [msgs, pending]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q || pending) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", text: q }]);
    start(async () => {
      const r = await sendMessage(threadId, q);
      if (!r) return;
      setMsgs((m) => [...m, { role: "assistant", text: r.text, cards: r.cards }]);
      if (!threadId) setThreads((ts) => [{ id: r.threadId, title: q.slice(0, 80) }, ...ts]);
      setThreadId(r.threadId);
    });
  };

  const open = (id: string) =>
    start(async () => {
      const m = await loadThread(id);
      if (!m) return;
      setThreadId(id);
      setMsgs([hello, ...m]);
    });

  const fresh = () => {
    setThreadId(null);
    setMsgs([hello]);
  };

  function listen() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
    const Rec = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Rec) return;
    const rec = new Rec();
    rec.lang = SPEECH_LANG[lang] ?? "en-GB";
    rec.interimResults = false;
    rec.onresult = (e) => send(e.results[0][0].transcript);
    rec.onend = () => setListening(false);
    setListening(true);
    rec.start();
  }

  const note = (text: string) => setMsgs((m) => [...m, { role: "assistant", text }]);

  // project material: a file answers the open question in the conversation (customer side only)
  const fileInput = useRef<HTMLInputElement>(null);
  const attach = (file: File | undefined) => {
    if (!file || pending || props.kind !== "portal") return;
    setMsgs((m) => [...m, { role: "user", text: `📎 ${file.name}` }]);
    const form = new FormData();
    form.set("file", file);
    start(async () => {
      const r = await portalActions.sendFile(threadId, form);
      if (fileInput.current) fileInput.current.value = "";
      if (!r) return;
      setMsgs((m) => [...m, { role: "assistant", text: r.text, cards: r.cards }]);
      if (!threadId) setThreads((ts) => [{ id: r.threadId, title: `📎 ${file.name}` }, ...ts]);
      setThreadId(r.threadId);
    });
  };

  return (
    <div className="pchat">
      <aside className="pthreads" aria-label={t.history}>
        <button className="btn sm primary" onClick={fresh}>＋ {t.newChat}</button>
        {threads.length > 0 && <div className="muted small" style={{ marginTop: 12 }}>{t.history}</div>}
        <nav>
          {threads.map((th) => (
            <button key={th.id} className={`pthread${th.id === threadId ? " on" : ""}`} onClick={() => open(th.id)} title={th.title}>{th.title}</button>
          ))}
        </nav>
      </aside>
      <section className="pconv">
        <div className="plog" ref={log} aria-live="polite">
          {msgs.map((m, i) => (
            <div key={i} className={`pturn ${m.role} fade-in`}>
              <div className={`msg ${m.role === "user" ? "me" : "them"}`}>{m.text}</div>
              {m.cards?.map((c, j) => (
                <div key={j} className="pcardwrap">
                  {props.kind === "portal" ? <CardView card={c as Card} t={props.t} lang={lang} onDone={note} onSend={send} /> : <PartnerCardView card={c as PartnerCard} t={props.t} lang={lang} onDone={note} />}
                </div>
              ))}
            </div>
          ))}
          {pending && <div className="pturn assistant"><div className="msg them muted">{t.thinking}</div></div>}
        </div>
        <div className="row chips" style={{ flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
          {t.chips.map((c) => <button key={c} className="chip" onClick={() => send(c)} disabled={pending}>{c}</button>)}
        </div>
        <form className="pinput" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <label className="sr-only" htmlFor="portal-input">{t.placeholder}</label>
          <textarea
            id="portal-input"
            rows={2}
            value={input}
            placeholder={t.placeholder}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          />
          <div className="row" style={{ gap: 6 }}>
            {props.kind === "portal" && (
              <>
                <input ref={fileInput} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.md,.docx,.xlsx" onChange={(e) => attach(e.target.files?.[0])} />
                <button type="button" className="btn" onClick={() => fileInput.current?.click()} aria-label={props.t.attach} title={props.t.attach} disabled={pending}>📎</button>
              </>
            )}
            <button type="button" className="btn" onClick={listen} aria-label={t.speak} title={t.speak} aria-pressed={listening}>🎤</button>
            <button className="btn primary" disabled={pending}>{t.send}</button>
          </div>
        </form>
        <div className="muted small" style={{ marginTop: 6 }}>✦ {t.disclosure}</div>
      </section>
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
