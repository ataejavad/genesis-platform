/*
 * Provider registry (Javad 2026-11-20: every outside company must be swappable without touching business logic).
 *
 * Rule: business code (src/server, src/agents, src/worker, app, scripts) never talks to a vendor directly. It asks
 * src/providers/<kind> for an adapter with our own interface. Each kind:
 *   - one interface in src/providers/<kind>/index.ts
 *   - the provider is picked by env `<KIND>_PROVIDER` (or automatically from which keys are set)
 *   - a mock/fallback adapter, so the machine keeps running without the vendor
 * Switching company = add one adapter file here + set `<KIND>_PROVIDER`; nothing else changes.
 * tests/providers.test.ts enforces that no vendor SDK or vendor API host appears outside src/providers.
 * Cockpit › Systems and › API & connections show the active provider per kind from `providerBoard()`.
 */

export type ProviderKind = "llm" | "email" | "voice" | "admin_chat" | "whatsapp" | "company_search" | "people_search" | "storage" | "payments" | "einvoice" | "vat_check";

export type ProviderOption = {
  id: string;
  label: string;
  /** env keys this provider needs (names only, never values) */
  keys: string[];
  /** "ready" = adapter exists; "planned" = named as the next option, adapter not written yet */
  state: "ready" | "planned";
  /** fallback/mock adapters work without any vendor */
  fallback?: boolean;
  /** a warning shown next to it in the cockpit (data protection, limits) */
  note?: string;
  /** personal data may pass only when this env key is "1" (e.g. a paid tier with a DPA); unset = always allowed */
  personalData?: string;
};

export type KindDef = { kind: ProviderKind; label: string; why: string; env: string; options: ProviderOption[] };

export const KINDS: KindDef[] = [
  {
    kind: "llm",
    label: "AI model",
    why: "agents think: research, chat, QA judge, advisors",
    env: "LLM_PROVIDER",
    options: [
      { id: "anthropic", label: "Claude (Anthropic)", keys: ["ANTHROPIC_API_KEY"], state: "ready" },
      { id: "gemini", label: "Google Gemini", keys: ["GEMINI_API_KEY"], state: "ready", note: "Free tier: Google may use prompts for training. Agents that see personal data (customer/partner chat, WhatsApp, QA judge, check-up chat) stay off until GEMINI_PAID_TIER=1 or Claude.", personalData: "GEMINI_PAID_TIER" },
      { id: "openai-compatible", label: "OpenAI-compatible API (OpenAI, Mistral, OpenRouter, a local model …)", keys: ["LLM_BASE_URL", "LLM_API_KEY", "LLM_MODEL"], state: "ready" },
      { id: "mock", label: "Mock (tests; agents answer from rules)", keys: [], state: "ready", fallback: true },
    ],
  },
  {
    kind: "email",
    label: "Email",
    why: "every email: invites, contracts, invoices, reminders, outreach",
    env: "EMAIL_PROVIDER",
    options: [
      { id: "brevo", label: "Brevo", keys: ["BREVO_API_KEY", "MAIL_FROM"], state: "ready" },
      { id: "outbox", label: "No sender: mails wait in Cockpit › Outbox", keys: [], state: "ready", fallback: true },
      { id: "mock", label: "Mock (tests)", keys: [], state: "ready", fallback: true },
    ],
  },
  {
    kind: "voice",
    label: "AI phone calls",
    why: "AI voice calls where allowed",
    env: "VOICE_PROVIDER",
    options: [
      { id: "vapi", label: "Vapi", keys: ["VAPI_API_KEY", "VAPI_ASSISTANT_ID", "VAPI_PHONE_NUMBER_ID"], state: "ready" },
      { id: "none", label: "No AI caller: calls stay tasks for a person", keys: [], state: "ready", fallback: true },
      { id: "mock", label: "Mock (tests)", keys: [], state: "ready", fallback: true },
    ],
  },
  {
    kind: "admin_chat",
    label: "Founder alerts + approvals",
    why: "approvals, alerts, daily brief on your phone",
    env: "ADMIN_CHAT_PROVIDER",
    options: [
      { id: "telegram", label: "Telegram bot", keys: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_ADMIN_CHAT_ID"], state: "ready" },
      { id: "none", label: "Cockpit only (Needs you + Today)", keys: [], state: "ready", fallback: true },
      { id: "mock", label: "Mock (tests)", keys: [], state: "ready", fallback: true },
    ],
  },
  {
    kind: "whatsapp",
    label: "WhatsApp",
    why: "WhatsApp agent (speed to lead)",
    env: "WHATSAPP_PROVIDER",
    options: [
      { id: "meta", label: "Meta WhatsApp Cloud API", keys: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN"], state: "ready" },
      { id: "twilio", label: "Twilio WhatsApp", keys: [], state: "planned" },
      { id: "none", label: "Off", keys: [], state: "ready", fallback: true },
    ],
  },
  {
    kind: "company_search",
    label: "Company finder",
    why: "finds firms of a trade in a region",
    env: "COMPANY_SEARCH_PROVIDER",
    options: [
      { id: "apify", label: "Apify (Google Maps)", keys: ["APIFY_TOKEN"], state: "ready" },
      { id: "import", label: "Imported list (npm run agents:outbound -- --import)", keys: [], state: "ready", fallback: true },
    ],
  },
  {
    kind: "people_search",
    label: "Decision-maker finder",
    why: "owners' and managers' names and roles",
    env: "PEOPLE_SEARCH_PROVIDER",
    options: [
      { id: "apollo", label: "Apollo.io", keys: ["APOLLO_API_KEY"], state: "ready" },
      { id: "none", label: "Role only + LinkedIn search link for a person", keys: [], state: "ready", fallback: true },
    ],
  },
  {
    kind: "storage",
    label: "File storage",
    why: "customer and partner files",
    env: "STORAGE_PROVIDER",
    options: [
      { id: "local", label: "Server disk (FILES_DIR)", keys: [], state: "ready", fallback: true },
      { id: "database", label: "Our Postgres database (hosts without a disk, e.g. Vercel; small files)", keys: [], state: "ready", fallback: true },
      { id: "s3", label: "EU object storage (S3-compatible, e.g. Hetzner)", keys: [], state: "planned" },
    ],
  },
  {
    kind: "payments",
    label: "Customer payments",
    why: "deposits, milestones, monthly fees",
    env: "PAYMENTS_PROVIDER",
    options: [
      { id: "bank-transfer", label: "Bank transfer: IBAN + EPC QR, marked paid in Finance", keys: [], state: "ready", fallback: true },
      { id: "stripe", label: "Stripe (after company registration)", keys: [], state: "planned" },
    ],
  },
  {
    kind: "einvoice",
    label: "E-invoice (SdI)",
    why: "sends legal invoices to the tax system",
    env: "EINVOICE_PROVIDER",
    options: [
      { id: "manual", label: "Numbered here, sent by hand / accountant", keys: [], state: "ready", fallback: true },
      { id: "sdi-provider", label: "SdI intermediary (chosen after registration)", keys: [], state: "planned" },
    ],
  },
  {
    kind: "vat_check",
    label: "VAT number check",
    why: "reverse charge only for valid EU VAT numbers",
    env: "VAT_CHECK_PROVIDER",
    options: [
      { id: "vies", label: "EU VIES (free, official)", keys: [], state: "ready" },
      { id: "none", label: "Off (VIES_DISABLED=1): orders stay unchecked", keys: [], state: "ready", fallback: true },
    ],
  },
];

export type Env = Record<string, string | undefined>;

const has = (o: ProviderOption, env: Env) => o.keys.every((k) => Boolean(env[k]));

/**
 * The provider id for a kind: `<KIND>_PROVIDER` when set to a ready adapter, otherwise the first ready vendor
 * whose keys are all set, otherwise the first fallback.
 */
export function chosen(kind: ProviderKind, env: Env = process.env): string {
  const def = KINDS.find((k) => k.kind === kind)!;
  const wanted = env[def.env]?.trim();
  const ready = def.options.filter((o) => o.state === "ready");
  if (wanted && ready.some((o) => o.id === wanted)) return wanted;
  return (ready.find((o) => !o.fallback && has(o, env)) ?? ready.find((o) => o.fallback) ?? ready[0]).id;
}

/** The active provider and whether it can work (its keys are set). A fallback counts as "not connected". */
export function providerStatus(kind: ProviderKind, env: Env = process.env) {
  const def = KINDS.find((k) => k.kind === kind)!;
  const id = chosen(kind, env);
  const opt = def.options.find((o) => o.id === id)!;
  const missing = opt.keys.filter((k) => !env[k]);
  return { kind, id, label: opt.label, note: opt.note ?? null, connected: !opt.fallback && missing.length === 0, missing, fallback: Boolean(opt.fallback) };
}

/** Every kind with its active provider and the alternatives (Cockpit › API & connections). */
export function providerBoard(env: Env = process.env) {
  return KINDS.map((d) => {
    const s = providerStatus(d.kind, env);
    // keys still missing for the chosen vendor, or for the first vendor when only the fallback runs
    const target = s.fallback ? d.options.find((o) => !o.fallback && o.state === "ready") : d.options.find((o) => o.id === s.id);
    return { ...d, active: s, keysToConnect: s.connected ? [] : (target?.keys ?? []).filter((k) => !env[k]) };
  });
}
