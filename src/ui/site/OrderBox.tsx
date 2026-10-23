"use client";

import Link from "next/link";
import { useState } from "react";

// Order flow (doc 15 §6ه.5): order → invoice + SEPA (payment adapter; Stripe later) → auto-provision into "My Apps".
export function OrderBox({ locale, plans }: { locale: string; plans: { name: string; price: number; per: string; features: string[] }[] }) {
  const fa = locale.startsWith("fa");
  const [plan, setPlan] = useState(0);
  const [step, setStep] = useState<"pick" | "form" | "done">("pick");
  return (
    <aside className="card stack" style={{ position: "sticky", top: 90 }}>
      {step === "pick" && (
        <>
          <h3>{fa ? "پلن‌ها و قیمت" : "Plans & pricing"}</h3>
          {plans.map((p, i) => (
            <label key={p.name} className="choice" style={{ alignItems: "flex-start" }}>
              <input type="radio" name="plan" checked={plan === i} onChange={() => setPlan(i)} />
              <div><b>{p.name} · €{p.price}</b> <span className="muted small">{p.per}</span><ul className="small" style={{ margin: "4px 0 0", paddingInlineStart: 18 }}>{p.features.map((f) => <li key={f}>{f}</li>)}</ul></div>
            </label>
          ))}
          <button className="btn primary lg" onClick={() => setStep("form")}>{fa ? "سفارش" : "Order"}</button>
          <button className="btn">{fa ? "از چت بپرسید" : "Ask the chat"}</button>
          <p className="muted small" style={{ margin: 0 }}>{fa ? "بدون قرارداد بلندمدت · لغو ماهانه" : "No long-term contract · cancel monthly"}</p>
        </>
      )}
      {step === "form" && (
        <form className="stack" onSubmit={(e) => { e.preventDefault(); setStep("done"); }}>
          <h3>{fa ? "اطلاعات صورتحساب" : "Billing details"}</h3>
          <label className="field">{fa ? "نام شرکت" : "Company"}<input required /></label>
          <label className="field">{fa ? "شماره مالیاتی (VAT)" : "VAT number"}<input className="ltr" required /></label>
          <label className="field">{fa ? "ایمیل" : "Email"}<input type="email" className="ltr" required /></label>
          <label className="field">{fa ? "روش پرداخت" : "Payment method"}
            <select><option>{fa ? "فاکتور + انتقال SEPA" : "Invoice + SEPA transfer"}</option><option disabled>Stripe ({fa ? "به‌زودی" : "soon"})</option></select>
          </label>
          <label className="choice"><input type="checkbox" required /><span className="small">{fa ? "شرایط خدمات و قرارداد حفاظت داده (DPA) را می‌پذیرم." : "I accept the terms and the data processing agreement (DPA)."}</span></label>
          <button className="btn primary">{fa ? `ثبت سفارش ${plans[plan].name}` : `Place order: ${plans[plan].name}`}</button>
        </form>
      )}
      {step === "done" && (
        <div className="stack">
          <span className="badge ok" style={{ justifySelf: "start" }}>✓ {fa ? "سفارش ثبت شد" : "Order placed"}</span>
          <p>{fa ? "فاکتور با اطلاعات SEPA به ایمیل شما رفت. پس از پرداخت، این محصول خودکار در «اپ‌های من» فعال می‌شود." : "The invoice with SEPA details is in your inbox. After payment the product activates automatically in My Apps."}</p>
          <Link className="btn primary" href="/portal/apps">{fa ? "دیدن «اپ‌های من»" : "Go to My Apps"}</Link>
        </div>
      )}
    </aside>
  );
}
