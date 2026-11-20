"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const YEAR = 60 * 60 * 24 * 365;

// Returns true when the saved industry changed.
export function rememberIndustry(slug: string) {
  if (document.cookie.split("; ").includes(`industry=${slug}`)) return false;
  document.cookie = `industry=${slug}; path=/; max-age=${YEAR}; samesite=lax`;
  return true;
}

// Opening an industry hub makes it the visitor's industry for the rest of the site (header, home, solutions).
export function RememberIndustry({ slug }: { slug: string }) {
  const router = useRouter();
  useEffect(() => {
    if (rememberIndustry(slug)) router.refresh();
  }, [slug, router]);
  return null;
}
