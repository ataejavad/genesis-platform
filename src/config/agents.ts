/*
 * Agent registry (step 9, doc 15 §6ز; value filter 2026-10-22): every agent has one KPI tied to customers or cost,
 * a target and a monthly € budget. Over budget → it rests until next month. KPI under target for two weeks (with
 * spend) → Javad decides keep / stop in the daily brief. Javad's switches live in the database (agent_settings).
 */

export type KpiId = "costPerLead" | "costPerReply" | "unlockRate" | "costPerActiveCustomer" | "costPerActivePartner" | "judgeAgreement" | "costPerConversation" | "costPerAdoption";

export type AgentDef = {
  id: string;
  name: string;
  /** what it does for the company, in one line */
  job: string;
  /** where it runs */
  runs: "app" | "script" | "github";
  kpi: { id: KpiId; label: string; target: number; better: "lower" | "higher"; unit: "€" | "%" };
  budgetEur: number;
};

export const AGENTS: AgentDef[] = [
  { id: "hub-research", name: "Hub research", job: "Keeps industry × country hubs current (news + impact)", runs: "script", kpi: { id: "costPerLead", label: "€ per hub lead", target: 5, better: "lower", unit: "€" }, budgetEur: 30 },
  { id: "company-research", name: "Company research", job: "Researches prospects, writes persona and first line", runs: "script", kpi: { id: "costPerReply", label: "€ per prospect reply", target: 25, better: "lower", unit: "€" }, budgetEur: 60 },
  { id: "checkup-chat", name: "Check-up chat", job: "Runs the free check-up conversation", runs: "app", kpi: { id: "unlockRate", label: "check-ups unlocked", target: 30, better: "higher", unit: "%" }, budgetEur: 20 },
  { id: "checkup-advisor", name: "Check-up advisor", job: "Writes the three-sentence advice in the report", runs: "app", kpi: { id: "unlockRate", label: "check-ups unlocked", target: 30, better: "higher", unit: "%" }, budgetEur: 10 },
  { id: "portal-advisor", name: "Customer advisor", job: "Answers customers in their dashboard chat", runs: "app", kpi: { id: "costPerActiveCustomer", label: "€ per active customer / month", target: 5, better: "lower", unit: "€" }, budgetEur: 20 },
  { id: "partner-advisor", name: "Partner advisor", job: "Answers partners in their portal chat", runs: "app", kpi: { id: "costPerActivePartner", label: "€ per active partner / month", target: 3, better: "lower", unit: "€" }, budgetEur: 15 },
  { id: "qa-judge", name: "QA judge", job: "Checks deliveries against the protocol before customers see them", runs: "app", kpi: { id: "judgeAgreement", label: "agreement with human review", target: 85, better: "higher", unit: "%" }, budgetEur: 25 },
  { id: "ai-scout", name: "AI scout", job: "Monthly: new AI that takes over a person's step or cuts a partner cost", runs: "app", kpi: { id: "costPerAdoption", label: "€ per adopted idea", target: 20, better: "lower", unit: "€" }, budgetEur: 10 },
  { id: "whatsapp-agent", name: "WhatsApp agent", job: "Answers prospects on WhatsApp", runs: "app", kpi: { id: "costPerConversation", label: "€ per conversation", target: 0.5, better: "lower", unit: "€" }, budgetEur: 15 },
];

export const agentDef = (id: string) => AGENTS.find((a) => a.id === id);
