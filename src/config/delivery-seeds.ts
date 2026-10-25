import type { Criterion, MilestoneTemplate, TaskTemplate } from "@/db/schema";

/*
 * The first protocols and catalogue packages (doc 15 §6د: "no product is sold without a protocol").
 * These are the starting versions; changes go through a new draft that Javad approves in Cockpit › Protocols.
 * Criteria say WHAT and how well, never how or when (freelancers decide their method).
 */

// In every job, whoever does it (doc 15 §6ب white-label, GDPR, AI Act art. 50 from 2 Aug 2026).
export const FIXED_RULES = [
  "White-label: no partner name, logo or contact details anywhere the customer sees.",
  "GDPR: customer data only inside the systems named in the brief; nothing copied elsewhere; delete test data at hand-over.",
  "AI Act art. 50: every AI that talks with people says it is an AI at the start; generated content is labelled.",
  "Tone: plain, warm, in the customer's language; outcomes, not technology.",
];

type Seed = { code: string; title: string; nace?: string; apqc: string; goal: string; inputs: string[]; deliverables: string[]; criteria: Criterion[]; guidance: string; standardDays: number };

const c = (text: string, it: string, method: Criterion["method"], mandatory = true, weight = 2): Criterion => ({ text, texts: { en: text, it }, mandatory, weight, method });

export const PROTOCOL_SEEDS: Seed[] = [
  {
    code: "PR-02", title: "Phone assistant set-up", apqc: "5.2 Service › Inquiries",
    goal: "95% of calls answered within 5 seconds; every caller's name, need and number reach the office.",
    inputs: ["Opening hours and holidays", "Top 10 caller questions with answers", "Transfer number and when to transfer", "Approved greeting text"],
    deliverables: ["Configured assistant", "Test log of at least 20 calls", "One-page guide for the office"],
    criteria: [
      c("The assistant says it is an AI in the first sentence", "L'assistente dice di essere un'AI nella prima frase", "judge"),
      c("Greeting matches the approved text", "Il saluto corrisponde al testo approvato", "judge"),
      c("20 test calls logged without errors", "20 chiamate di prova registrate senza errori", "human"),
      c("Every call summary reaches the office with name, need and number", "Ogni riepilogo arriva all'ufficio con nome, esigenza e numero", "human"),
      c("Out-of-hours calls get the after-hours message and a callback entry", "Le chiamate fuori orario ricevono il messaggio e finiscono nella lista richiami", "judge", false, 1),
    ],
    guidance: "We usually start from the top 10 questions and test with real voices of the team.", standardDays: 5,
  },
  {
    code: "PR-08", title: "First-week live review and tuning", apqc: "5.2 Service › Inquiries",
    goal: "After one live week: fewer than 5% calls needing a human because the assistant failed.",
    inputs: ["Call log of the first live week", "Office feedback"],
    deliverables: ["Tuning changes made", "Short report: calls, failures, what changed"],
    criteria: [
      c("Report lists calls answered, failures and their causes", "Il report elenca chiamate, errori e cause", "judge"),
      c("Every recurring failure has a change made", "Ogni errore ricorrente ha una modifica fatta", "judge"),
      c("Office confirmed the changes", "L'ufficio ha confermato le modifiche", "human"),
    ],
    guidance: "Read 20 random calls before the failures; patterns show up there.", standardDays: 3,
  },
  {
    code: "PR-07", title: "Quote follow-up set-up", apqc: "3.5 Sales › Follow-up",
    goal: "Every quote gets a friendly reminder on day 3 and day 7 until the customer answers.",
    inputs: ["Where quotes are stored", "Approved reminder texts", "Who gets the replies"],
    deliverables: ["Running follow-up flow", "Test run on 3 sample quotes", "One-page guide"],
    criteria: [
      c("Reminders go out on day 3 and day 7", "I promemoria partono al giorno 3 e 7", "auto"),
      c("The flow stops when the customer replies", "Il flusso si ferma quando il cliente risponde", "human"),
      c("Texts match the approved versions", "I testi corrispondono alle versioni approvate", "judge"),
      c("Test run on 3 quotes documented", "Prova su 3 preventivi documentata", "judge"),
    ],
    guidance: "We usually build it in n8n with the CRM's own triggers.", standardDays: 4,
  },
  {
    code: "PR-03", title: "Lead form to CRM", apqc: "3.5 Sales › Leads",
    goal: "Every website lead reaches the CRM within 1 minute with source and phone, and the office is alerted.",
    inputs: ["Website form access", "CRM access", "Who gets the alert"],
    deliverables: ["Working connection", "Test with 3 leads", "One-page guide"],
    criteria: [
      c("A test lead arrives in the CRM within 1 minute", "Un contatto di prova arriva nel CRM entro 1 minuto", "auto"),
      c("Source and phone fields are filled", "I campi fonte e telefono sono compilati", "human"),
      c("The office gets the alert", "L'ufficio riceve l'avviso", "human"),
      c("Guide explains what to do when it stops", "La guida spiega cosa fare se si ferma", "judge", false, 1),
    ],
    guidance: "We prefer the CRM's native webhook over polling.", standardDays: 3,
  },
];

type PackageSeed = { slug: string; title: string; titles: Record<string, string>; setupEur: number; monthlyEur: number; tasks: TaskTemplate[]; milestones: MilestoneTemplate[] };

export const PACKAGE_SEEDS: PackageSeed[] = [
  {
    slug: "phone-agent", title: "AI phone assistant", titles: { en: "AI phone assistant", it: "Assistente telefonico AI", de: "KI-Telefonassistent", fa: "دستیار تلفنی هوشمند" },
    setupEur: 490, monthlyEur: 390,
    milestones: [{ title: "Set up and tested", titles: { it: "Configurato e collaudato", de: "Eingerichtet und getestet", fa: "راه‌اندازی و آزمون شد" }, sharePct: 60 }, { title: "First live week reviewed", titles: { it: "Prima settimana live verificata", de: "Erste Live-Woche geprüft", fa: "هفته اول کار واقعی بررسی شد" }, sharePct: 40 }],
    tasks: [
      { title: "Set up the phone assistant", brief: "Configure the phone assistant with the customer's hours, questions and transfer rules; test it.", protocol: "PR-02", skills: ["ai-setup"], payEur: 220, days: 5, milestone: 0 },
      { title: "First-week review and tuning", brief: "Review the first live week of calls and tune what failed.", protocol: "PR-08", skills: ["ai-setup"], payEur: 90, days: 10, milestone: 1 },
    ],
  },
  {
    slug: "followup-agent", title: "Quote follow-up", titles: { en: "Quote follow-up", it: "Follow-up dei preventivi", de: "Angebots-Nachfassen", fa: "پیگیری پیش‌فاکتور" },
    setupEur: 290, monthlyEur: 190,
    milestones: [{ title: "Follow-up running", titles: { it: "Follow-up attivo", de: "Nachfassen läuft", fa: "پیگیری فعال شد" }, sharePct: 100 }],
    tasks: [{ title: "Set up quote reminders", brief: "Send a friendly reminder 3 and 7 days after each quote; stop when the customer answers.", protocol: "PR-07", skills: ["automation", "crm"], payEur: 160, days: 4, milestone: 0 }],
  },
  {
    slug: "lead-crm", title: "Every lead in the CRM", titles: { en: "Every lead in the CRM", it: "Ogni contatto nel CRM", de: "Jeder Lead im CRM", fa: "هر سرنخ در CRM" },
    setupEur: 450, monthlyEur: 90,
    milestones: [{ title: "Leads flowing into the CRM", titles: { it: "I contatti arrivano nel CRM", de: "Leads fließen ins CRM", fa: "سرنخ‌ها به CRM می‌رسند" }, sharePct: 100 }],
    tasks: [{ title: "Connect the website form to the CRM", brief: "Website form leads must reach the CRM with source and phone filled, plus an alert to the office.", protocol: "PR-03", skills: ["automation", "crm"], payEur: 200, days: 3, milestone: 0 }],
  },
];
