"use client";

import { useState } from "react";
import type { Status, Task } from "@/mock/data";
import { statusLabel } from "@/mock/data";

const order: Status[] = ["todo", "doing", "review", "done"];

// Minimal task board (doc 15 §6ب): move a card with the arrows. Local state only in the prototype.
export function Board({ tasks, partners }: { tasks: Task[]; partners?: { code: string; name: string }[] }) {
  const [items, setItems] = useState(tasks);
  const move = (id: string, dir: 1 | -1) =>
    setItems((all) =>
      all.map((t) => {
        if (t.id !== id) return t;
        const i = Math.min(order.length - 1, Math.max(0, order.indexOf(t.status) + dir));
        return { ...t, status: order[i] };
      }),
    );
  const nameOf = (code: string) => partners?.find((p) => p.code === code)?.name ?? code;
  return (
    <div className="kanban">
      {order.map((st) => (
        <div className="col" key={st}>
          <h4>{statusLabel[st]} <span className="badge gray">{items.filter((t) => t.status === st).length}</span></h4>
          {items.filter((t) => t.status === st).map((t) => (
            <div className="task" key={t.id}>
              <div>{t.forUs && <span className="badge warn" style={{ marginInlineEnd: 6 }}>از ما خواسته‌شده</span>}{t.title}</div>
              <div className="meta">
                <span className="ltr">{t.project}</span>
                <span>·</span>
                {t.agent ? <span className="badge ai">🤖 {t.assignee}</span> : <span>{nameOf(t.assignee)}</span>}
                <span>· مهلت {t.due}</span>
                <span className={`badge ${t.priority === "بالا" ? "bad" : t.priority === "متوسط" ? "warn" : "gray"}`}>{t.priority}</span>
              </div>
              <div className="row" style={{ marginTop: 8, justifyContent: "space-between" }}>
                <button className="btn sm" onClick={() => move(t.id, -1)} disabled={st === "todo"}>→</button>
                <button className="btn sm" onClick={() => move(t.id, 1)} disabled={st === "done"}>←</button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
