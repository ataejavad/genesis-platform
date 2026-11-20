"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

// Cockpit jump bar: type a page, module or agent name and press Enter. Plain matching, no AI and no made-up answers.
export function JumpBar({ items }: { items: { label: string; href: string; hint?: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const hits = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    return items.filter((i) => words.every((w) => `${i.label} ${i.hint ?? ""}`.toLowerCase().includes(w))).slice(0, 7);
  }, [q, items]);
  const go = (href: string) => {
    setQ("");
    router.push(href);
  };
  return (
    <div className="cmd" style={{ position: "relative" }}>
      <span className="spark" aria-hidden>⌕</span>
      <label className="sr-only" htmlFor="jump">Jump to a page or module</label>
      <input id="jump" value={q} placeholder="Jump to… (page, module, agent)" autoComplete="off" onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && hits[0] && go(hits[0].href)} />
      {hits.length > 0 && (
        <div className="card" role="listbox" style={{ position: "absolute", top: "100%", insetInlineStart: 0, insetInlineEnd: 0, zIndex: 20, padding: 6, marginTop: 4 }}>
          {hits.map((h) => (
            <button key={h.label + h.href} type="button" role="option" aria-selected={false} className="btn sm" style={{ display: "flex", width: "100%", justifyContent: "space-between", border: 0 }} onClick={() => go(h.href)}>
              <span>{h.label}</span><span className="muted small">{h.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
