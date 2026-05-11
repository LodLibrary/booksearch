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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await fetch(`/api/title/${params.titleId}`);
      const payload = (await res.json()) as Payload;
      if (!res.ok || payload.error) {
        setError(payload.error || "לא ניתן לטעון פרטי כותר.");
        return;
      }
      setData(payload);
    };
    void run();
  }, [params.titleId]);

  if (error) return <main className="container"><p className="error">{error}</p></main>;
  if (!data) return <main className="container"><p>טוען פרטי כותר...</p></main>;

  return (
    <main className="container">
      <article className="card">
        <div className="cardLayout">
          <div className="cardText">
            <h1>{data.title}</h1>
            <div className="detailsPanel">
              <h3>פרטי כותר</h3>
              <ul>
                {data.fields.map((f, i) => <li key={`${f.label}-${i}`}><strong>{f.label}:</strong> {f.value}</li>)}
              </ul>
            </div>
            {data.description && (
              <div className="detailsPanel">
                <h3>תיאור</h3>
                <p>{data.description}</p>
              </div>
            )}
            {data.copies.length > 0 && (
              <div className="detailsPanel">
                <h3>פרטי עותקים</h3>
                <ul>{data.copies.map((c, i) => <li key={`${i}-${c}`}>{c}</li>)}</ul>
              </div>
            )}
            <p><a href={data.detailsUrl} target="_blank" rel="noreferrer noopener">צפייה בעמוד המקורי</a></p>
          </div>
          <div className="coverWrap" aria-hidden="true">
            {data.image ? <Image src={`/api/cover?url=${encodeURIComponent(data.image)}`} alt="" width={110} height={150} className="coverImage" unoptimized /> : <div className="coverFallback">אין תמונה</div>}
          </div>
        </div>
      </article>
    </main>
  );
}
