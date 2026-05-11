"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

type Payload = {
  title: string;
  image?: string;
  fields: Array<{ label: string; value: string }>;
  description?: string;
  copies: string[];
  detailsUrl: string;
  error?: string;
};

export default function TitleDetailsPage({ params }: { params: { titleId: string } }) {
  const [data, setData] = useState<Payload | null>(null);

  useEffect(() => {
    void (async () => {
      const res = await fetch(`/api/title/${params.titleId}`);
      const payload = (await res.json()) as Payload;
      setData(payload);
    })();
  }, [params.titleId]);

  if (!data) return <main className="kioskRoot"><p>טוען פרטי כותר...</p></main>;
  if (data.error) return <main className="kioskRoot"><p className="error">{data.error}</p></main>;

  const byGroup = (keys: RegExp) => data.fields.filter((f) => keys.test(f.label));

  return (
    <main className="kioskRoot detailsRoot">
      <header className="kioskHeader">פרטי הספר</header>
      <section className="detailsGrid">
        <div className="detailsCover">
          {data.image ? <Image src={`/api/cover?url=${encodeURIComponent(data.image)}`} alt="" width={220} height={310} unoptimized /> : <div className="coverPlaceholder">אין תמונה</div>}
          <h1>{data.title}</h1>
        </div>

        <section className="detailsSection"><h2>פרטי הספר</h2>{byGroup(/כותר|שם|ISBN|שפה|מס' בסדרה/i).map((f,i)=><div key={i}><span>{f.label}</span><strong>{f.value}</strong></div>)}</section>
        <section className="detailsSection"><h2>מחבר/ת ופרסום</h2>{byGroup(/מחבר|הוצאה|שנה|פרסום/i).map((f,i)=><div key={i}><span>{f.label}</span><strong>{f.value}</strong></div>)}</section>
        <section className="detailsSection"><h2>מיקום בספרייה</h2>{byGroup(/מיקום|מדף|סיווג|מיון/i).map((f,i)=><div key={i}><span>{f.label}</span><strong>{f.value}</strong></div>)}</section>
        {data.description && <section className="detailsSection wide"><h2>תיאור</h2><p>{data.description}</p></section>}
        {data.copies.length > 0 && <section className="detailsSection wide"><h2>עותקים</h2>{data.copies.map((c,i)=><div key={i}><strong>{c}</strong></div>)}</section>}
      </section>
    </main>
  );
}
