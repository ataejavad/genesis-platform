import type { Status } from "@/mock/data";
import { statusLabel } from "@/mock/data";

export function Stat({ label, value, delta, up }: { label: string; value: React.ReactNode; delta?: string; up?: boolean }) {
  return (
    <div className="card stat">
      <div className="label">{label}</div>
      <div className="value num">{value}</div>
      {delta && <div className={`delta ${up === undefined ? "muted" : up ? "up" : "down"}`}>{delta}</div>}
    </div>
  );
}

export function Progress({ value }: { value: number }) {
  return (
    <div className="progress" title={`${value}%`}>
      <span style={{ width: `${value}%` }} />
    </div>
  );
}

export function Ring({ value, label }: { value: number; label?: string }) {
  return (
    <div style={{ display: "grid", justifyItems: "center", gap: 6 }}>
      <div className="ring" style={{ ["--p" as string]: value }}>
        <div>{value}</div>
      </div>
      {label && <div className="muted small">{label}</div>}
    </div>
  );
}

const statusTone: Record<Status, string> = { todo: "gray", doing: "", review: "warn", done: "ok" };
export function StatusBadge({ status }: { status: Status }) {
  return <span className={`badge ${statusTone[status]}`}>{statusLabel[status]}</span>;
}

export function Tone({ text }: { text: string }) {
  const tone = /فعال|پرداخت‌شده|امضاشده|تمام|قبول|تحویل‌شده/.test(text)
    ? "ok"
    : /منتظر|درخواست|نامزد|بازبینی|نگه‌داشته|پس از/.test(text)
      ? "warn"
      : /رد|معلق/.test(text)
        ? "bad"
        : "gray";
  return <span className={`badge ${tone}`}>{text}</span>;
}

export function Steps({ steps }: { steps: { t: string; state: "done" | "now" | "next" }[] }) {
  return (
    <div className="timeline">
      {steps.map((s) => (
        <div key={s.t} className={`step ${s.state}`}>
          <span className="dot" />
          <div>
            <div style={{ fontWeight: s.state === "now" ? 700 : 500 }}>{s.t}</div>
            <div className="muted small">{s.state === "done" ? "انجام شد" : s.state === "now" ? "در جریان" : "بعدی"}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function Chat({ items }: { items: { from: string; who: string; text: string }[] }) {
  return (
    <div className="chat">
      {items.map((m, i) => (
        <div key={i} className={`msg ${m.from}`}>
          <div className="who">{m.who}</div>
          {m.text}
        </div>
      ))}
    </div>
  );
}
