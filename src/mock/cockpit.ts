// Sample data for the cockpit (English UI, doc 15 §9 day 10). Replaced by real queries as each area is wired.
export const eur = (n: number) => `€${n.toLocaleString("en-US")}`;

export const kpis = { mrr: 1190, mrrGoal: 10000, customers: 1, pipeline: 18400, margin: 46, aiSpend: 19.3, aiBudget: 150, approvalsWaiting: 5, javadHoursWeek: 3.5 };

export const brief = "Overnight: Lead hunter added 120 glaziers in Germany (31 match the ICP → light personas). Concierge chat had 14 conversations, 3 booked check-ups. QA passed 1 of 2 deliveries; P-301 misses one optional criterion. AI spend yesterday €2.40. Nothing is blocked except 5 approvals below.";

export const approvals = [
  { kind: "Outreach", t: "20 personalised first emails · Glass × Germany", by: "Offer agent", risk: "high", why: "First message to new companies (hard limit)" },
  { kind: "Delivery", t: "P-301 quote agent v2 → customer", by: "QA judge", risk: "medium", why: "Customer-facing delivery" },
  { kind: "Contract", t: "Freelancer contract · Lena Hoffmann (DE)", by: "Contract agent", risk: "high", why: "Contract signing (hard limit)" },
  { kind: "Content", t: "Hub page: Glass × Italy (IT)", by: "Content agent", risk: "low", why: "Sampled 1 in 5" },
  { kind: "Protocol", t: "PR-01 v3: add 'discount rules' criterion", by: "Learning agent", risk: "medium", why: "Protocol versions need Javad" },
];

export const alerts = [
  { tone: "warn", t: "Customer health: Glas Becker usage of follow-up app is 0 (setup pending 5 days)." },
  { tone: "bad", t: "Partner H-31 insurance document expires in 9 days." },
  { tone: "ok", t: "Hub Glass × Italy seed content ready → can go live." },
];

export const markets = [
  { filter: "Glass × Germany", nace: "C23.12", demand: 8.6, competition: 6.1, access: 7.8, law: 7.0, margin: 8.0, total: 7.7, hub: "live" },
  { filter: "Glass × Italy", nace: "C23.12", demand: 7.9, competition: 7.4, access: 6.5, law: 7.5, margin: 7.2, total: 7.3, hub: "seed ready" },
  { filter: "Heating installers × UK", nace: "F43.22", demand: 8.8, competition: 5.2, access: 8.1, law: 8.0, margin: 7.0, total: 7.4, hub: "candidate" },
  { filter: "Dental clinics × Germany", nace: "Q86.23", demand: 7.1, competition: 4.8, access: 6.0, law: 5.5, margin: 8.4, total: 6.4, hub: "rejected" },
];

export const leads = [
  { id: "glastec-nord", company: "GlasTec Nord", city: "Hamburg", hub: "Glass × DE", tier: 2, score: 85, stage: "Meeting", signals: ["Checkup", "Chat", "Tender match"], next: "Send proposal" },
  { id: "fensterbau-mueller", company: "Fensterbau Müller", city: "Munich", hub: "Glass × DE", tier: 2, score: 78, stage: "Engaged", signals: ["Identified visit", "Newsletter"], next: "First email awaiting approval" },
  { id: "vetreria-bianchi", company: "Vetreria Bianchi", city: "Milan", hub: "Glass × IT", tier: 1, score: 66, stage: "ICP match", signals: [], next: "Light persona built" },
  { id: "glas-becker", company: "Glas Becker GmbH", city: "Cologne", hub: "Glass × DE", tier: 3, score: 92, stage: "Customer", signals: ["Contract"], next: "Upsell step 3" },
  { id: "riva", company: "Studio Dentale Riva", city: "Turin", hub: "Dental × IT", tier: 0, score: 40, stage: "Directory", signals: [], next: "Hub not active" },
];

export const persona = {
  id: "glastec-nord", company: "GlasTec Nord", tier: 2, cost: 0.74,
  facts: [["NACE", "C23.12 / F43.34"], ["Employees", "≈ 40"], ["Founded", "2003"], ["Revenue (est.)", "€6–8m"], ["Website stack", "WordPress, Calendly, Outlook"], ["Decision maker", "Managing director (public register)"]],
  pains: ["Facade projects need fast, precise quotes (tenders)", "No after-hours phone coverage", "Manual tender search"],
  path: ["Quote agent (step 2) — ROI 6×", "Tender alerts (free tool) → hub membership", "Custom: link quotes to their ERP (step 3)"],
  signals: [["Oct 18", "Visited hub Glass × DE, 4 pages (company-level ID, consented)"], ["Oct 19", "Concierge chat: asked about facade quotes"], ["Oct 20", "Completed free check-up · score 71"], ["Oct 21", "Matched tender: Glazing for office building, Bonn"]],
  sources: "Company register, website, TED tenders, own interactions. Lawful basis: legitimate interest (LIA #3), opt-out link in every message.",
};

export const catalog = [
  { name: "Glass quote agent", hubs: "Glass × DE, IT", process: "APQC 3.5", protocol: "PR-01 v2", license: "own", price: "€290–490/mo", status: "live" },
  { name: "24/7 phone & chat answering", hubs: "Glass × DE, IT · Installers × UK", process: "APQC 5.2", protocol: "PR-02 v3", license: "reseller OK · DPA signed", price: "€390/mo", status: "live" },
  { name: "Ecobonus paperwork assistant", hubs: "Glass × IT", process: "APQC 8.6", protocol: "PR-06 v1", license: "own", price: "€49/file", status: "live" },
  { name: "Automatic quote follow-up", hubs: "Glass × DE · Installers × UK", process: "APQC 3.5", protocol: "PR-07 v1", license: "SSO only (no white-label)", price: "€190/mo", status: "live" },
  { name: "Voice receptionist (VoiceFlow)", hubs: "—", process: "APQC 5.2", protocol: "missing", license: "under review", price: "—", status: "blocked" },
];

export type Proj = {
  id: string; title: string; kind: "customer" | "internal"; customer?: string; package: string; risk: "low" | "medium" | "high";
  status: string; progress: number; due: string; owner: string; sell: number; cost: number; estimate: string;
  milestones: { t: string; amount: number; state: "accepted" | "in review" | "open" }[];
  changes: { t: string; impact: string; state: string }[];
  costs: { k: string; v: number }[];
};

export const projects: Proj[] = [
  { id: "P-301", title: "Quote agent setup", kind: "customer", customer: "Glas Becker GmbH", package: "Quote agent v2 (catalogue)", risk: "medium", status: "QA", progress: 85, due: "Nov 1", owner: "NovaAI Studio (H-17)", sell: 2400, cost: 1300, estimate: "8–10 days · 80%",
    milestones: [{ t: "Price data imported", amount: 800, state: "accepted" }, { t: "Agent built & tested", amount: 800, state: "in review" }, { t: "Go-live + training", amount: 800, state: "open" }],
    changes: [{ t: "Add tinted-glass prices", impact: "+€180 · +3 days", state: "waiting for customer" }],
    costs: [{ k: "Supplier", v: 1100 }, { k: "AI / models", v: 38 }, { k: "Tools", v: 22 }, { k: "Our time (est.)", v: 140 }] },
  { id: "P-302", title: "Phone → CRM integration", kind: "customer", customer: "Glas Becker GmbH", package: "CRM link v1 (catalogue)", risk: "low", status: "In progress", progress: 40, due: "Nov 11", owner: "Marco Rossi (H-22)", sell: 1800, cost: 950, estimate: "5–7 days · 75%",
    milestones: [{ t: "Field map", amount: 600, state: "open" }, { t: "Integration live", amount: 1200, state: "open" }], changes: [], costs: [{ k: "Supplier", v: 900 }, { k: "AI / models", v: 12 }, { k: "Tools", v: 8 }, { k: "Our time (est.)", v: 30 }] },
  { id: "P-118", title: "LinkedIn campaign · Glass × DE", kind: "internal", package: "Content campaign v1", risk: "low", status: "In progress", progress: 55, due: "Nov 6", owner: "Sara K. (H-09)", sell: 0, cost: 600, estimate: "3 weeks", milestones: [], changes: [], costs: [{ k: "Freelancer", v: 560 }, { k: "AI / models", v: 9 }] },
  { id: "P-119", title: "20 hub pages · Italy", kind: "internal", package: "Hub seed content v3", risk: "low", status: "To do", progress: 0, due: "Nov 21", owner: "Content agent", sell: 0, cost: 30, estimate: "4 days", milestones: [], changes: [], costs: [{ k: "AI / models", v: 30 }] },
];

export const tasks = [
  { id: "T-1", title: "Build price table from list", project: "P-301", assignee: "H-17", due: "Oct 24", status: "done" as const, priority: "High" },
  { id: "T-2", title: "20 test quotes + report", project: "P-301", assignee: "H-17", due: "Oct 28", status: "review" as const, priority: "High" },
  { id: "T-3", title: "QA against PR-01 v2", project: "P-301", assignee: "QA judge", agent: true, due: "Oct 29", status: "doing" as const, priority: "High" },
  { id: "T-4", title: "Get HubSpot API key from customer", project: "P-302", assignee: "Us", due: "Oct 25", status: "todo" as const, priority: "High", forUs: true },
  { id: "T-5", title: "Field map phone ↔ CRM", project: "P-302", assignee: "H-22", due: "Oct 30", status: "doing" as const, priority: "Medium" },
  { id: "T-6", title: "Write 4 posts week 1", project: "P-118", assignee: "H-09", due: "Oct 26", status: "review" as const, priority: "Medium" },
  { id: "T-8", title: "Research 20 Italian hubs", project: "P-119", assignee: "Market agent", agent: true, due: "Nov 3", status: "todo" as const, priority: "Medium" },
];

export const partners = [
  { code: "H-17", name: "NovaAI Studio", kind: "Company", role: "Delivery supplier", country: "NL", tier: "Top", score: 4.8, jobs: 7, onTime: 96, firstPass: 86, docs: "ok" },
  { code: "H-22", name: "Marco Rossi", kind: "Freelancer", role: "Delivery supplier", country: "IT", tier: "Pro", score: 4.5, jobs: 4, onTime: 90, firstPass: 75, docs: "ok" },
  { code: "H-09", name: "Sara K.", kind: "Freelancer", role: "Internal contributor", country: "DE", tier: "Verified", score: 4.6, jobs: 3, onTime: 100, firstPass: 67, docs: "ok" },
  { code: "AG-content", name: "Content agent", kind: "Agent", role: "Agent", country: "—", tier: "L2", score: 4.2, jobs: 31, onTime: 100, firstPass: 71, docs: "—" },
  { code: "H-31", name: "VoiceFlow Partners Ltd", kind: "Company", role: "Applicant", country: "UK", tier: "—", score: 0, jobs: 0, onTime: 0, firstPass: 0, docs: "insurance expiring" },
];

export const applications = [
  { name: "VoiceFlow Partners Ltd", kind: "Company", country: "UK", for: "Supplier: voice agents", ai: 82, note: "6 yrs voice AI, 40 projects, insured, signs DPA." },
  { name: "Lena Hoffmann", kind: "Freelancer", country: "DE", for: "Internal: phone sales", ai: 74, note: "3 yrs B2B sales in construction; native German. Classification check: freelancer OK (own clients, own hours)." },
  { name: "Arash M.", kind: "Freelancer", country: "TR", for: "Supplier: n8n automation", ai: 69, note: "25 n8n workflows; non-personal-data work only." },
];

export const protocols = [
  { id: "PR-01", title: "Quote agent setup", version: "v2", nace: "C23.12", process: "APQC 3.5", service: "Ready solution", risk: "medium", used: 6, pass: 83,
    goal: "90% of quote requests answered within 15 minutes at ±3% accuracy.",
    inputs: ["Customer price list (Excel/PDF)", "Discount rules", "Branded quote template"],
    steps: ["Import prices", "Configure rules", "20 test quotes", "Staff guide", "Go-live"],
    criteria: [
      { t: "20 test quotes within ±3%", must: true, weight: 30, method: "Automatic" },
      { t: "Reply under 15 min in 90% of cases", must: true, weight: 20, method: "Automatic" },
      { t: "No partner name or logo in outputs (white-label)", must: true, weight: 15, method: "QA judge" },
      { t: "Discloses AI in every message (AI Act)", must: true, weight: 10, method: "QA judge" },
      { t: "Short guide for customer staff", must: false, weight: 15, method: "Human" },
      { t: "Test report with samples", must: false, weight: 10, method: "Human" },
    ],
    sla: "Live in 10 working days; 99% uptime; fixes within 1 business day" },
  { id: "PR-02", title: "Phone & chat answering", version: "v3", nace: "*", process: "APQC 5.2", service: "Ready solution", risk: "medium", used: 9, pass: 89 },
  { id: "PR-03", title: "CRM link", version: "v1", nace: "*", process: "APQC 3.5", service: "Custom", risk: "low", used: 2, pass: 50 },
  { id: "PR-04", title: "Hub page", version: "v3", nace: "*", process: "Internal · media", service: "Internal", risk: "low", used: 31, pass: 71 },
  { id: "PR-05", title: "LinkedIn content campaign", version: "v1", nace: "*", process: "Internal · marketing", service: "Internal", risk: "low", used: 1, pass: 67 },
];

export const qa = [
  { project: "P-301", deliverable: "Quote agent v2 + test report", by: "H-17", protocol: "PR-01 v2", risk: "medium", passed: 5, total: 6, note: "'Staff guide' incomplete: discount section missing.", forCustomer: true },
  { project: "P-118", deliverable: "4 posts, week 1", by: "H-09", protocol: "PR-05 v1", risk: "low", passed: 4, total: 4, note: "All criteria met; tone matches brand guide.", forCustomer: false },
];

export const moderation = [
  { where: "P-302 · partner H-22", original: "my number is +39 333 123 4567, call me", delivered: "my number is [removed], call me", reason: "Phone number", state: "Held" },
  { where: "P-301 · customer C-1042", original: "Can you email me at t.becker@glas-becker.de?", delivered: "Can you email me at [removed]?", reason: "Email", state: "Delivered masked" },
  { where: "Hub Glass × DE · member post", original: "Looking for a partner for a Hamburg facade project", delivered: "—", reason: "Member post (pre-approval)", state: "Waiting" },
];

export const relationships = [
  { kind: "Customer", name: "GlasTec Nord", country: "DE", data: "Check-up, chat, approved quote €4,900, scope from P-template, 3 milestones", contract: "Service agreement + SLA + DPA (Art. 28)" },
  { kind: "Supplier (white-label)", name: "VoiceFlow Partners Ltd", country: "UK", data: "Application, call notes, price list, SLA", contract: "Subcontract + sub-processor terms + UK IDTA + NDA + non-circumvention" },
  { kind: "Freelancer", name: "Lena Hoffmann", country: "DE", data: "Application, interview notes, rate €40/h", contract: "Independent contractor + NDA (classification check passed)" },
  { kind: "Hire", name: "Internal marketer (planned)", country: "IT", data: "Role brief, salary band", contract: "Employment contract (CCNL) via EoR + NDA + IP assignment" },
  { kind: "Referral partner", name: "Steuerbüro Klein", country: "DE", data: "Intro call, 10% first-year commission", contract: "Referral agreement + non-circumvention" },
];

export const countryPacks = [
  { country: "🇮🇹 Italy", law: "Italian law", dp: "EU GDPR DPA", tax: "IT VAT · reverse charge EU", einv: "SDI (live)", cur: "EUR", status: "ready" },
  { country: "🇩🇪 Germany", law: "German law", dp: "EU GDPR DPA", tax: "Reverse charge §13b", einv: "XRechnung/ZUGFeRD", cur: "EUR", status: "ready" },
  { country: "🇬🇧 United Kingdom", law: "English law", dp: "UK GDPR + IDTA", tax: "UK VAT / outside scope", einv: "MTD", cur: "GBP", status: "lawyer review" },
  { country: "🇦🇹 Austria", law: "—", dp: "—", tax: "—", einv: "—", cur: "EUR", status: "not started" },
];

export const contracts = [
  { title: "Service + DPA", party: "Glas Becker GmbH", pack: "DE v1.3", status: "Signed", renew: "2027-08-23" },
  { title: "Supplier subcontract", party: "NovaAI Studio", pack: "EU v1.1", status: "Signed", renew: "2027-08-01" },
  { title: "Freelancer", party: "Sara K.", pack: "DE v1.0", status: "Awaiting signature", renew: "—" },
];

export const finance = {
  invoices: [
    { no: "LP-2026-0052", to: "Glas Becker GmbH", amount: 1190, due: "Nov 7", state: "Open", rail: "SEPA" },
    { no: "LP-2026-0049", to: "Glas Becker GmbH", amount: 800, due: "Oct 30", state: "Milestone (P-301 #1)", rail: "SEPA" },
    { no: "LP-2026-0041", to: "Glas Becker GmbH", amount: 1190, due: "Oct 7", state: "Paid", rail: "SEPA" },
  ],
  payouts: [
    { to: "NovaAI Studio (H-17)", amount: 1100, after: "QA pass P-301 #2", state: "Waiting QA" },
    { to: "Sara K. (H-09)", amount: 280, after: "Posts week 1 accepted", state: "Ready · batch Fri" },
  ],
  margin: [
    { name: "Glas Becker GmbH", revenue: 5380, cost: 2930 },
  ],
  rails: [
    { name: "Invoice + SEPA", state: "active" },
    { name: "Stripe", state: "adapter ready · Javad connects later" },
    { name: "EU PSP fallback", state: "planned" },
  ],
};

export const stages = ["0 · Select market", "1 · Find & enrich", "2 · Attract", "3 · Convert", "4 · Deliver", "5 · Retain & grow"];

export const agents = [
  { id: "market", name: "Market selection", stage: 0, state: "on", level: 1, cost: 3.2, runs: 14, kpi: "3 filters scored", gate: "New hub goes live" },
  { id: "hunter", name: "Lead hunter", stage: 1, state: "on", level: 2, cost: 6.8, runs: 42, kpi: "120 companies today" },
  { id: "persona", name: "Persona builder", stage: 1, state: "on", level: 2, cost: 1.9, runs: 31, kpi: "31 light, 4 full personas" },
  { id: "content", name: "Content & hubs", stage: 2, state: "on", level: 2, cost: 4.4, runs: 31, kpi: "2 hub pages drafted", gate: "Sampled review" },
  { id: "translate", name: "Translation", stage: 2, state: "on", level: 2, cost: 0.8, runs: 12, kpi: "DE/IT/EN" },
  { id: "concierge", name: "Concierge chat", stage: 3, state: "on", level: 2, cost: 1.2, runs: 14, kpi: "3 check-ups booked" },
  { id: "checkup", name: "Check-up diagnostic", stage: 3, state: "on", level: 2, cost: 0.6, runs: 3, kpi: "avg score 64" },
  { id: "offer", name: "Personal offer", stage: 3, state: "wait", level: 1, cost: 2.1, runs: 20, kpi: "20 emails ready", gate: "First message to new company" },
  { id: "contract", name: "Contract agent", stage: 3, state: "wait", level: 1, cost: 0.3, runs: 2, kpi: "1 draft ready", gate: "Signing" },
  { id: "planner", name: "Planner & allocator", stage: 4, state: "on", level: 2, cost: 0.5, runs: 6, kpi: "2 projects staffed" },
  { id: "qa", name: "QA judge", stage: 4, state: "on", level: 2, cost: 0.9, runs: 9, kpi: "first-pass 78%", gate: "High-risk deliveries" },
  { id: "watch", name: "Delivery watch", stage: 4, state: "err", level: 1, cost: 0.1, runs: 40, kpi: "n8n webhook failing (3 retries)" },
  { id: "mod", name: "Message moderator", stage: 4, state: "on", level: 3, cost: 0.6, runs: 140, kpi: "2 messages masked" },
  { id: "advisor", name: "Customer advisor", stage: 5, state: "on", level: 2, cost: 0.7, runs: 18, kpi: "1 upsell suggested" },
  { id: "report", name: "Reports & daily brief", stage: 5, state: "on", level: 3, cost: 1.1, runs: 22, kpi: "brief sent 07:30" },
];
