import { describe, expect, it } from "vitest";
import { negotiateLocale, pickLocale } from "@/config/locales";

describe("negotiateLocale", () => {
  it("picks exact, then language, then default", () => {
    expect(negotiateLocale("de-DE,de;q=0.9")).toBe("de-de");
    expect(negotiateLocale("de-AT")).toBe("de-de");
    expect(negotiateLocale("ja,fa;q=0.5")).toBe("fa-ir");
    expect(negotiateLocale("ja")).toBe("en-gb");
    expect(negotiateLocale(null)).toBe("en-gb");
  });
});

describe("pickLocale", () => {
  it("prefers the saved choice, then the browser, then the IP country", () => {
    expect(pickLocale({ saved: "it-it", acceptLanguage: "de-DE", country: "GB" })).toBe("it-it");
    expect(pickLocale({ saved: "xx", acceptLanguage: "de-DE", country: "IT" })).toBe("de-de");
    expect(pickLocale({ acceptLanguage: "ja", country: "it" })).toBe("it-it");
    expect(pickLocale({ acceptLanguage: "ja", country: "US" })).toBe("en-gb");
    expect(pickLocale({})).toBe("en-gb");
  });
});
