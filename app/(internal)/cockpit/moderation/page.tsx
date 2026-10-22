import { moderation } from "@/mock/data";
import { PageHead } from "@/ui/Shell";
import { Tone } from "@/ui/bits";

export default function Moderation() {
  return (
    <main>
      <PageHead title="نظارت پیام‌ها" crumbs="کابین › تحویل" sub="ایجنت ناظر ایمیل، تلفن، لینک و نام شرکت را از پیام‌های بین مشتری و همکار حذف می‌کند و موارد مشکوک را اینجا نگه می‌دارد." />
      <div className="card table-wrap">
        <table className="table">
          <thead><tr><th>پروژه</th><th>فرستنده</th><th>متن اصلی</th><th>متن تحویل‌شده</th><th>دلیل</th><th>وضعیت</th><th></th></tr></thead>
          <tbody>
            {moderation.map((m, i) => (
              <tr key={i}>
                <td className="ltr">{m.project}</td><td>{m.side}</td><td className="ltr small">{m.original}</td><td className="ltr small">{m.delivered}</td><td><span className="badge bad">{m.reason}</span></td><td><Tone text={m.status} /></td>
                <td><div className="row"><button className="btn sm">ارسال پنهان‌شده</button><button className="btn sm danger">رد + هشدار</button></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
