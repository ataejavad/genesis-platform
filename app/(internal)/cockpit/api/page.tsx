import { PageHead } from "@/ui/Shell";

const endpoints = [
  { m: "POST", p: "/api/v1/drafts", d: "Agent sends a page draft (live)", live: true },
  { m: "GET", p: "/api/v1/drafts/:id", d: "Approval status of a draft (live)", live: true },
  { m: "GET", p: "/api/v1/catalog", d: "Catalogue for buyer agents (sample)", live: true },
  { m: "GET", p: "/llms.txt", d: "Machine-readable site summary (live)", live: true },
  { m: "POST", p: "/api/v1/concierge", d: "Concierge chat turn (streaming) + detected need", live: false },
  { m: "POST", p: "/api/v1/checkups", d: "Check-up answers → report + CRM lead", live: false },
  { m: "POST", p: "/api/v1/companies/:id/signals", d: "Engagement signal → persona tier upgrade", live: false },
  { m: "POST", p: "/api/v1/orders", d: "Order → invoice → provision My Apps", live: false },
  { m: "POST", p: "/api/v1/contracts", d: "Generate contract for any relationship", live: false },
  { m: "POST", p: "/api/v1/deliverables/:id/checks", d: "QA judge writes per-criterion results", live: false },
  { m: "POST", p: "/api/v1/messages", d: "Mediated message (auto-masking, translation)", live: false },
  { m: "MCP", p: "mcp://legendpartner", d: "MCP server for external agents", live: false },
];

export default function Api() {
  return (
    <main>
      <PageHead title="API & connections" crumbs="Cockpit › Machine" sub="API-first: every screen action is also an API, used by n8n, agents and later customers." actions={<button className="btn primary">＋ New API key</button>} />
      <div className="card table-wrap" style={{ marginBottom: 18 }}>
        <table className="table"><thead><tr><th>Method</th><th>Path</th><th>What</th><th>Status</th></tr></thead>
          <tbody>{endpoints.map((e) => (<tr key={e.p}><td><span className="badge">{e.m}</span></td><td className="ltr">{e.p}</td><td>{e.d}</td><td>{e.live ? <span className="badge ok">built</span> : <span className="badge gray">planned</span>}</td></tr>))}</tbody></table>
      </div>
      <div className="grid g4">
        <div className="card"><h3>n8n</h3><p className="muted small">Runs the agents; every system event goes to its webhook.</p><span className="badge warn">webhook not set</span></div>
        <div className="card"><h3>Langfuse</h3><p className="muted small">LLM traces, cost, prompt versions, A/B (self-hosted, EU).</p><span className="badge gray">to install</span></div>
        <div className="card"><h3>Telegram</h3><p className="muted small">Approvals, alerts and emergency stop on your phone.</p><span className="badge warn">bot not created</span></div>
        <div className="card"><h3>Claude API</h3><p className="muted small">The agents' brain. Key lives in .env on the server, never in chat.</p><span className="badge warn">waiting for key</span></div>
      </div>
    </main>
  );
}
