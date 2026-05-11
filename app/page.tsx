"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { CatalogResult, SearchColumn } from "../lib/agron";

type SearchResponse =
  | { results: CatalogResult[]; error?: never }
  | { results?: never; error: string };

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [column, setColumn] = useState<SearchColumn>("0");
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const canSearch = useMemo(() => query.trim().length >= 2, [query]);
  const visibleResults = useMemo(() => results.filter((item) => Boolean(item.copiesUrl)), [results]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSearch) return;

    setLoading(true);
    setError(null);
    setSearched(true);

    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}&column=${column}`);
      const data = (await response.json()) as SearchResponse;
      if (!response.ok || "error" in data) {
        setResults([]);
        setError(data.error || "אירעה שגיאה זמנית בחיפוש.");
        return;
      }
      setResults(data.results);
    } catch {
      setError("החיבור לשרת נכשל. נסו שוב.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const getTitleId = (url?: string): string | null => {
    if (!url) return null;
    try { return new URL(url).searchParams.get("titleId"); } catch { return null; }
  };

  return (
    <main className="kioskRoot">
      <header className="kioskHeader">הספרייה העירונית לוד</header>

      <section className="searchHero">
        <h1>חיפוש בקטלוג הספרייה</h1>
        <p>מצאו ספרים לפי כותר, מחבר/ת או נושא</p>

        <form className="heroForm" onSubmit={onSubmit} aria-label="טופס חיפוש">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="שם ספר, מחבר/ת או נושא..."
            autoComplete="off"
          />
          <select value={column} onChange={(e) => setColumn(e.target.value as SearchColumn)}>
            <option value="0">כותר</option>
            <option value="1">מחבר/ת</option>
            <option value="2">נושא</option>
          </select>
          <button type="submit" disabled={!canSearch || loading}>חיפוש</button>
        </form>

        <div className="statusLine" aria-live="polite">
          {loading && <p>מחפש בקטלוג...</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </section>

      {searched && (
        <section className="resultsStage" aria-live="polite">
          <div className="resultsTitleRow">
            {!loading && !error && visibleResults.length > 0 && <h2>תוצאות חיפוש ({visibleResults.length})</h2>}
            {!loading && !error && visibleResults.length === 0 && <h2>לא נמצאו תוצאות מתאימות</h2>}
          </div>

          <div className="catalogList">
            {visibleResults.map((item, idx) => {
              const titleId = getTitleId(item.detailsUrl);
              return (
                <article key={`${item.title}-${idx}`} className="catalogRow">
                  <div className="coverCol">
                    {item.coverUrl ? (
                      <Image src={`/api/cover?url=${encodeURIComponent(item.coverUrl)}`} alt="" width={140} height={196} unoptimized />
                    ) : (
                      <div className="coverPlaceholder">אין תמונה</div>
                    )}
                  </div>

                  <div className="infoCol">
                    <h3>{item.title}</h3>
                    <div className="metaMatrix">
                      <div><span>מחבר/ת</span><strong>{item.author || "לא זמין"}</strong></div>
                      <div><span>שנת הוצאה</span><strong>{item.year || "לא זמין"}</strong></div>
                      <div><span>מיקום מדף</span><strong>{item.shelfMark || "לא זמין"}</strong></div>
                      <div><span>סיווג</span><strong>{item.classification || "לא זמין"}</strong></div>
                    </div>
                  </div>

                  <div className="actionCol">
                    {titleId ? <Link href={`/title/${titleId}`}>פרטי הספר</Link> : <span className="disabledBtn">פרטי הספר</span>}
                    {item.copiesUrl ? <a href={item.copiesUrl} target="_blank" rel="noreferrer noopener">בדיקת עותקים</a> : <span className="disabledBtn">בדיקת עותקים</span>}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </main>
  );
}
