"use client";

import { useState } from "react";

export type BoardStatus = "todo" | "doing" | "review" | "done";
export type BoardTask = { id: string; title: string; project: string; assignee: string; agent?: boolean; due: string; status: BoardStatus; priority: string; forUs?: boolean };

const order: BoardStatus[] = ["todo", "doing", "review", "done"];
const labels = {
  fa: { todo: "انجام‌نشده", doing: "در حال انجام", review: "بازبینی", done: "تمام", due: "مهلت", forUs: "از ما خواسته‌شده" },
  en: { todo: "To do", doing: "In progress", review: "Review", done: "Done", due: "due", forUs: "Waiting on us" },
};
const high = /بالا|high/i;
const mid = /متوسط|medium/i;

// Minimal task board (doc 15 §6ب/§6د۲): move a card with the arrows. Local state only in the prototype.
export function Board({ tasks, names, lang = "fa" }: { tasks: BoardTask[]; names?: Record<string, string>; lang?: "fa" | "en" }) {
  const [items, setItems] = useState(tasks);
  const l = labels[lang];
  const move = (id: string, dir: 1 | -1) =>
    setItems((all) =>
      all.map((t) => (t.id !== id ? t : { ...t, status: order[Math.min(order.length - 1, Math.max(0, order.indexOf(t.status) + dir))] })),
    );
  const [back, fwd] = lang === "fa" ? ["→", "←"] : ["←", "→"];
  return (
    <div className="kanban">
      {order.map((st) => (
        <div className="col" key={st}>
          <h4>{l[st]} <span className="badge gray">{items.filter((t) => t.status === st).length}</span></h4>
          {items.filter((t) => t.status === st).map((t) => (
            <div className="task" key={t.id}>
              <div>{t.forUs && <span className="badge warn" style={{ marginInlineEnd: 6 }}>{l.forUs}</span>}{t.title}</div>
              <div className="meta">
                <span className="ltr">{t.project}</span>
                <span>·</span>
                {t.agent ? <span className="badge ai">🤖 {t.assignee}</span> : <span>{names?.[t.assignee] ?? t.assignee}</span>}
                <span>· {l.due} {t.due}</span>
                <span className={`badge ${high.test(t.priority) ? "bad" : mid.test(t.priority) ? "warn" : "gray"}`}>{t.priority}</span>
              </div>
              <div className="row" style={{ marginTop: 8, justifyContent: "space-between" }}>
                <button className="btn sm" aria-label="back" onClick={() => move(t.id, -1)} disabled={st === "todo"}>{back}</button>
                <button className="btn sm" aria-label="forward" onClick={() => move(t.id, 1)} disabled={st === "done"}>{fwd}</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
