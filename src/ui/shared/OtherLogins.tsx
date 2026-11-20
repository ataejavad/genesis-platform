import Link from "next/link";

// Every login page links to the other two doors, so nobody has to know the addresses by heart.
const T: Record<string, { client: string; partner: string; team: string }> = {
  en: { client: "Client login", partner: "Partner login", team: "Team login" },
  it: { client: "Area clienti", partner: "Area partner", team: "Accesso team" },
  de: { client: "Kunden-Login", partner: "Partner-Login", team: "Team-Login" },
  fa: { client: "ورود مشتریان", partner: "ورود همکاران", team: "ورود تیم" },
};

export function OtherLogins({ lang, here }: { lang: string; here: "client" | "partner" | "team" }) {
  const t = T[lang] ?? T.en;
  const doors = [
    { id: "client", href: "/portal/login", label: t.client },
    { id: "partner", href: "/partner/login", label: t.partner },
    { id: "team", href: "/login", label: t.team },
  ].filter((d) => d.id !== here);
  return (
    <p className="muted small row" style={{ gap: 14, marginTop: 12 }}>
      {doors.map((d) => <Link key={d.id} href={d.href}>{d.label}</Link>)}
    </p>
  );
}
