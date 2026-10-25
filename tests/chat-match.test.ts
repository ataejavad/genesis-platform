import { describe, expect, it } from "vitest";
import { isEmail, matchAnswer, prefill, type ChatQuestion } from "@/lib/chat-match";
import { localizeDef, loadCheckupDef } from "@/server/checkup";

const it_ = localizeDef(loadCheckupDef("installers")!, "it").questions;
const fa = localizeDef(loadCheckupDef("installers")!, "fa").questions;
const q = (qs: ChatQuestion[], id: string) => qs.find((x) => x.id === id)!;

describe("typed answers in the check-up chat", () => {
  it("reads numbers against option ranges, in Italian and Persian", () => {
    expect(matchAnswer(q(it_, "missedCalls"), "ne perdiamo circa 8 a settimana")).toBe("mid");
    expect(matchAnswer(q(it_, "missedCalls"), "almeno 30")).toBe("high");
    expect(matchAnswer(q(it_, "team"), "siamo in 12")).toBe("m");
    expect(matchAnswer(q(it_, "jobValue"), "di solito 1.500 euro")).toBe("mid");
    expect(matchAnswer(q(it_, "hourly"), "più o meno 44 euro l'ora")).toBe("high");
    expect(matchAnswer(q(fa, "team"), "ما ۴ نفریم")).toBe("s");
    expect(matchAnswer(q(it_, "missedCalls"), "una decina")).toBe("mid");
    expect(matchAnswer(q(it_, "office"), "una dozzina di ore")).toBe("mid");
    expect(matchAnswer(q(it_, "missedCalls"), "tantissime, un sacco")).toBe("high");
    // a price never answers a count question
    expect(matchAnswer(q(it_, "missedCalls"), "circa 1.500 euro")).toBeNull();
  });

  it("reads words and synonyms, and says when it is not sure", () => {
    expect(matchAnswer(q(it_, "work"), "soprattutto caldaie e condizionatori")).toEqual(["clima", "boiler"]);
    expect(matchAnswer(q(it_, "incentives"), "nessuna, non le facciamo")).toBe("none");
    expect(matchAnswer(q(it_, "office"), "boh, dipende")).toBeNull();
  });

  it("fills other open questions from a free sentence, never guessing numbers", () => {
    expect(prefill(it_, "Installo pompe di calore e fotovoltaico, perdiamo 10 chiamate", {})).toEqual({ work: ["heatpump", "solar"] });
    expect(isEmail("mario@impianti.it")).toBe(true);
    expect(isEmail("mario at impianti")).toBe(false);
  });
});
