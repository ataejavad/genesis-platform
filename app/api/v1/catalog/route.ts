import { BRAND, ladder } from "@/mock/data";

// Machine-readable service catalog for buyer agents (doc 06 §3و). Sample data until the catalog module exists.
export function GET() {
  return Response.json({
    provider: BRAND,
    currency: "EUR",
    offerings: ladder.map((s) => ({ step: s.n, name: s.title, description: s.desc, price: s.price })),
    contact: { checkup: "/fa-ir/checkup" },
  });
}
