import type { Metadata } from "next";
import { Checkup } from "./checkup";

export const metadata: Metadata = { title: "چک‌آپ رایگان AI" };

export default function CheckupPage() {
  return (
    <main className="wrap-site section" style={{ maxWidth: 760 }}>
      <Checkup />
    </main>
  );
}
