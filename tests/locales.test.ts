import { describe, expect, it } from "vitest";
import { negotiateLocale } from "@/config/locales";

describe("negotiateLocale", () => {
  it("picks exact, then language, then default", () => {
    expect(negotiateLocale("de-DE,de;q=0.9")).toBe("de-de");
    expect(negotiateLocale("de-AT")).toBe("de-de");
    expect(negotiateLocale("ja,fa;q=0.5")).toBe("fa-ir");
    expect(negotiateLocale("ja")).toBe("en-gb");
    expect(negotiateLocale(null)).toBe("en-gb");
  });
});
