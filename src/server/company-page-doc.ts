import { z } from "zod";

// Shape of a company page (see company-pages.ts). A leaf module, so the CRM input schema can use it without
// pulling the page builder (and its imports) in at load time.
const source = z.object({ name: z.string().max(120), url: z.url() });
export const pageDocSchema = z.object({
  company: z.string(),
  city: z.string().nullable(),
  facts: z.array(z.object({ text: z.string().max(300), source })).max(12),
  persona: z.object({
    summary: z.string().max(600),
    offers: z.array(z.string().max(120)).max(8),
    customers: z.string().max(200).nullable(),
    pains: z.array(z.object({ text: z.string().max(200), why: z.string().max(300) })).max(5),
    questions: z.array(z.string().max(200)).max(5),
  }),
  estimate: z.object({ answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])), report: z.record(z.string(), z.unknown()) }),
  preparedAt: z.string(),
  by: z.enum(["agent", "template"]),
});
export type PageDoc = z.infer<typeof pageDocSchema>;
// what the company-research agent may send; the estimate is always computed here, never by a model
export const researchedPage = pageDocSchema.pick({ facts: true, persona: true });
