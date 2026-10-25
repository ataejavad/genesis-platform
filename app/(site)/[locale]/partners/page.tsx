import type { Metadata } from "next";
import { partnerCopy } from "@/config/partner-copy";
import { BRAND } from "@/mock/data";
import { SKILLS, skillLabel } from "@/server/partner-rules";
import { Apply } from "./apply";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { title: partnerCopy(locale.slice(0, 2)).apply.kicker };
}

// "Work with us": who we look for, why it pays to deliver with us, and the application as a conversation.
export default async function PartnersPage({ params }: Props) {
  const { locale } = await params;
  const lang = locale.slice(0, 2);
  const t = partnerCopy(lang).apply;
  return (
    <main>
      <section className="wrap-site hero" style={{ paddingBottom: 24 }}>
        <div>
          <span className="badge ai" style={{ marginBottom: 14 }}>{t.kicker}</span>
          <h1>{t.title}</h1>
          <p className="lead">{t.lead}</p>
          <div className="stack">{t.why.map((w) => <div key={w} className="row"><span className="badge ok">✓</span><span>{w}</span></div>)}</div>
        </div>
        <div className="grid">
          {t.kinds.map((k) => (
            <div key={k.t} className="card row" style={{ alignItems: "flex-start" }}>
              <span style={{ fontSize: 28 }}>{k.icon}</span>
              <div><h3 style={{ marginBottom: 4 }}>{k.t}</h3><div className="muted small">{k.d}</div></div>
            </div>
          ))}
        </div>
      </section>
      <section className="wrap-site section" style={{ maxWidth: 820, paddingTop: 0 }}>
        <Apply t={t} skills={SKILLS.map((s) => ({ id: s.id, label: skillLabel(s.id, lang) }))} locale={locale} brand={BRAND} />
      </section>
    </main>
  );
}
