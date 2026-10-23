import { NextResponse, type NextRequest } from "next/server";
import { LOCALES } from "@/config/locales";

// hreflang for every public page as an HTTP Link header: each URL lists its other language versions,
// so search engines show visitors their own language without us redirecting anyone by IP.
export function proxy(request: NextRequest) {
  const [, first, ...rest] = request.nextUrl.pathname.split("/");
  const response = NextResponse.next();
  if (!Object.hasOwn(LOCALES, first)) return response;
  const tail = rest.length ? `/${rest.join("/")}` : "";
  const origin = request.nextUrl.origin;
  const links = Object.keys(LOCALES).map((code) => `<${origin}/${code}${tail}>; rel="alternate"; hreflang="${code}"`);
  links.push(`<${origin}/>; rel="alternate"; hreflang="x-default"`);
  response.headers.set("Link", links.join(", "));
  return response;
}

export const config = { matcher: ["/((?!api|_next|portal|partner|cockpit|map|.*\\..*).*)"] };
