import "../globals.css";

export const metadata = { title: "Cockpit", robots: { index: false, follow: false } };

export default function InternalLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fa" dir="rtl">
      <body>
        <div className="wrap">{children}</div>
      </body>
    </html>
  );
}
