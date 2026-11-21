import { desc } from "drizzle-orm";
import { getDb } from "@/db";
import { apiKeys } from "@/db/schema";
import { adminChatFromEnv, phoneAskStats } from "@/server/admin-chat";
import { connections } from "@/server/systems";
import { PageHead } from "@/ui/Shell";
import { NewKey, RevokeKey } from "../systems/Forms";
import { SendAsksNow, TestConnections } from "./Forms";

const endpoints = [
  ["POST", "/api/v1/drafts", "Agent sends a page draft (content:draft)"],
  ["POST", "/api/v1/prospects", "Company finder adds a company (crm:write)"],
  ["GET/POST", "/api/v1/agents/runs", "Script agents: may I run? report usage; lessons (content:draft / crm:write)"],
  ["GET", "/api/v1/market-filters", "Paused market filters for the finder (crm:write)"],
  ["POST", "/api/v1/outreach/run", "Send due emails and AI calls (outreach:run)"],
  ["POST", "/api/v1/outcomes", "A delivering agent records a customer result (portal:write)"],
  ["POST", "/api/v1/customer-approvals", "Ask a customer for a yes (portal:write)"],
  ["GET/POST", "/api/v1/partner/jobs · offers · deliveries", "Agent partners pull and deliver work (partner:work)"],
  ["POST", "/api/v1/orders", "Order from the marketplace, dashboard or chat"],
  ["GET", "/llms.txt · /sitemap.xml", "Machine-readable site for agents and search engines"],
];
// the lead-search test waits for Apify (Google Maps), which can take a minute
export const maxDuration = 120;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "never");

// API & connections (step 10): real keys (only the hash is stored), and which services are connected (never the key itself).
export default async function Api() {
  const db = getDb();
  const keys = await db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt)).limit(100);
  const conns = connections();
  const chat = adminChatFromEnv();
  const hook = chat?.status ? await chat.status().catch((e: unknown) => ({ connected: false, lastError: e instanceof Error ? e.message.slice(0, 160) : "unreachable" })) : null;
  const asks = await phoneAskStats(db);
  return (
    <main>
      <PageHead title="API & connections" crumbs="Cockpit › Machine" sub="Every agent works through the API with its own scoped key; nothing writes to the database directly. Every outside company sits behind our own adapter (src/providers): to change company, set the switch in .env and add its keys; no business code changes. Keys live in .env on the computer or server, never in chat." />
      <section className="grid g4" style={{ marginBottom: 18 }}>
        {conns.map((c) => <div key={c.name} className="card"><div className="row" style={{ justifyContent: "space-between" }}><b>{c.name}</b><span className={`badge ${c.ok ? "ok" : "warn"}`}>{c.ok ? "connected" : "not set"}</span></div><p className="muted small">{c.why}</p><div className="small">Now: <b>{c.provider}</b></div>{c.note && <div className="small" style={{ color: "var(--warn, #b45309)" }}>⚠ {c.note}</div>}{!c.ok && c.keys && <div className="muted small ltr">.env: {c.keys}</div>}{c.options.length > 1 && <div className="muted small ltr">switch: {c.switchEnv} = {c.options.join(" | ")}</div>}</div>)}
      </section>
      <TestConnections />
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>Approve on the phone</h3>
          <span className={`badge ${hook?.connected && !hook.lastError ? "ok" : "warn"}`}>{!chat ? "no phone channel" : !chat.status ? chat.provider : hook?.connected ? (hook.lastError ? "button error" : "buttons connected") : "buttons not connected"}</span>
        </div>
        <p className="muted small">First messages to companies, partner applications, finished tests and website drafts arrive with ✅ / ❌ buttons. A press does exactly what the cockpit button does (same send path and legal checks); only you can press, each item is decided once, and a press on an edited text does nothing. Items that need a closer look (QA checklist, orders, customer files) stay here with a link.</p>
        <div className="small">Last 7 days: <b>{asks.sent}</b> sent · <b>{asks.waiting}</b> waiting · <b>{asks.approved}</b> approved · <b>{asks.rejected}</b> rejected on the phone</div>
        {hook?.lastError && <div className="small" style={{ color: "var(--warn, #b45309)" }}>⚠ {hook.lastError}</div>}
        {chat && hook && !hook.connected && <div className="muted small">Press “Send test phone message” above once to connect the buttons.</div>}
        <div style={{ marginTop: 8 }}><SendAsksNow /></div>
      </div>
      <section className="grid g-2-1" style={{ marginBottom: 18 }}>
        <div className="card table-wrap">
          <h3>Agent keys</h3>
          <table className="table"><thead><tr><th>Name</th><th>Key starts</th><th>Scopes</th><th>Last used</th><th>Created</th><th /></tr></thead>
            <tbody>{keys.map((k) => (
              <tr key={k.id} style={{ opacity: k.revokedAt ? 0.5 : 1 }}>
                <td><b>{k.name}</b></td><td className="ltr small">{k.prefix}…</td><td className="small">{k.scopes.join(", ")}</td><td className="small">{day(k.lastUsedAt)}</td><td className="small">{day(k.createdAt)}</td>
                <td>{k.revokedAt ? <span className="muted small">revoked</span> : <RevokeKey id={k.id} />}</td>
              </tr>
            ))}</tbody></table>
        </div>
        <NewKey />
      </section>
      <div className="card table-wrap">
        <h3>Endpoints</h3>
        <table className="table"><thead><tr><th>Method</th><th>Path</th><th>What</th></tr></thead>
          <tbody>{endpoints.map(([m, p, d]) => <tr key={p}><td><span className="badge">{m}</span></td><td className="ltr small">{p}</td><td className="small">{d}</td></tr>)}</tbody></table>
      </div>
    </main>
  );
}
