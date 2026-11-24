/*
 * Legend Partner brand (brand book, Javad approved 2026-11-24). Single source for the colours, fonts and voice that
 * the site, the post images and the writing agents (media writer, solutions radar) follow. The full book with the
 * reasons lives in the project's Claude Doc "Legend Partner Brand Book"; logo files are in public/brand/.
 */

export const BRAND = {
  name: "Legend Partner",
  tagline: "Fewer hours lost. More jobs won.",
  positioning: "The first call when your company has a problem.",
  symbol: { name: "The Pact", files: { color: "/brand/symbol.svg", reversed: "/brand/symbol-reversed.svg", appIcon: "/brand/app-icon.svg" } },
  colors: {
    ink: "#111318",
    orange: "#FF5A1F", // big numbers, symbol, the one key action; ink text on it (white fails WCAG)
    orangeDeep: "#C93C0A", // white-text buttons and links on light backgrounds (5.1)
    paper: "#F4F2EE",
    stone: "#8A8F98", // secondary text on ink only
    stoneDark: "#5E636C", // secondary text on light (5.4)
    accents: { smes: "#FFC531", platform: "#4C8DFF", media: "#1F3D33" },
  },
  fonts: { headline: "Archivo", body: "Inter", persianArabic: "Vazirmatn" },
} as const;

/** Voice rules every customer-facing text follows (pasted into the writing agents' instructions). */
export const BRAND_VOICE = `Brand voice of ${BRAND.name} (from our brand book):
- We talk like the person a business owner calls when something breaks: direct, short, numbers first, on the owner's side.
- Company channels speak as "we" (${BRAND.name}), never as one person.
- Sell results, never tools: say hours saved, euros, jobs won. Never write "AI", "AI agent", "tokens", "LLM" or software names as the product.
- Hook in the first line, under 12 words. Sentences under 20 words, short paragraphs, one clear next step per piece.
- A real number wherever we have one; never invent a number.
- Never: "revolutionary", "game-changer", "disrupt", "synergy", emoji walls, several exclamation marks.
- Each language is written natively, never as a literal translation.`;
