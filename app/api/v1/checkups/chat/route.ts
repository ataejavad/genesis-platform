import { z } from "zod";
import { chatEnabled, chatTurn } from "@/agents/checkup-chat";
import { LOCALES, isLocale } from "@/config/locales";
import { AppError } from "@/server/errors";
import { errorResponse } from "@/server/http";
import { checkupDefsFor } from "@/ui/site/checkup-defs";

const input = z.object({
  locale: z.string(),
  industry: z.string().nullable(),
  answers: z.record(z.string(), z.union([z.string(), z.array(z.string())])),
  transcript: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).min(1).max(80),
});

// Public: one conversation turn by Claude. Off (404) until ANTHROPIC_API_KEY is set; the browser then uses the scripted chat.
export async function POST(req: Request) {
  try {
    if (!chatEnabled()) throw new AppError(404, "not_found", "AI conversation is off");
    const body = input.parse(await req.json());
    const locale = isLocale(body.locale) ? body.locale : "en-gb";
    return Response.json(await chatTurn({ ...body, lang: LOCALES[locale].lang, defs: checkupDefsFor(locale) }));
  } catch (err) {
    return errorResponse(err);
  }
}
