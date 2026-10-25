import type { Metadata } from "next";
import { tx } from "@/config/tx";
import { visitorCountries } from "@/ui/site/country";
import { Signup } from "@/ui/site/Signup";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const country = (await visitorCountries(locale))[0] ?? "DE";
  return (
    <main className="wrap-site section">
      <h1>{tx(locale, "ساخت حساب شرکت", "Create your company account")}</h1>
      <p className="sub muted">{tx(locale, "یک دقیقه. ما صنعت شما را پیدا می‌کنیم تا همه چیز از روز اول تخصصی باشد.", "One minute. We find your industry so everything is specialised from day one.")}</p>
      <Signup locale={locale} country={country} />
    </main>
  );
}
