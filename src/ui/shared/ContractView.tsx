import type { contracts } from "@/db/schema";

type Contract = typeof contracts.$inferSelect;
type Labels = { give: string; get: string; money: string; risks: string };

/** The contract body is stored as plain lines (# title, _note_, **clause title**); rendered without HTML injection. */
export function ContractText({ body, lang }: { body: string; lang?: string }) {
  // contract languages (it/en/de) read left to right, also inside a Persian portal
  return (
    <div className="small" lang={lang} dir="ltr" style={{ lineHeight: 1.6, textAlign: "left" }}>
      {body.split("\n").map((line, i) => {
        if (line.startsWith("# ")) return <h3 key={i}>{line.slice(2)}</h3>;
        if (/^_.*_$/.test(line)) return <p key={i} className="callout small"><i>{line.slice(1, -1)}</i></p>;
        const m = /^\*\*(.+?)\*\*(.*)$/.exec(line);
        if (m) return <p key={i} style={{ margin: "12px 0 2px" }}><b>{m[1]}</b>{m[2]}</p>;
        return line ? <p key={i} style={{ margin: "2px 0" }}>{line}</p> : null;
      })}
    </div>
  );
}

/** One-page summary first (what each side gives, money, risks), full text below. */
export function ContractSummary({ c, labels }: { c: Contract; labels: Labels }) {
  const s = c.summary;
  if (!s) return null;
  const block = (title: string, items: string[]) => items.length ? <div><b className="small">{title}</b><ul className="small" style={{ margin: "4px 0 0" }}>{items.map((x) => <li key={x}>{x}</li>)}</ul></div> : null;
  return (
    <div className="grid g2">
      {block(labels.give, s.give)}
      {block(labels.get, s.get)}
      {block(labels.money, s.money)}
      {block(labels.risks, s.risks)}
    </div>
  );
}
