"use client";

import { FormEvent, useMemo, useState } from "react";
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
      const url = `/api/search?q=${encodeURIComponent(query.trim())}&column=${column}`;
      const response = await fetch(url);
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

  return (
    <main className="container">
      <section className="hero">
        <h1>חיפוש בקטלוג הספרייה</h1>
        <form className="searchForm" onSubmit={onSubmit} aria-label="טופס חיפוש">
          <label htmlFor="query" className="srOnly">
            טקסט לחיפוש
          </label>
          <input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="שם ספר, מחבר/ת או נושא..."
            autoComplete="off"
          />

          <label htmlFor="column" className="srOnly">
            סוג חיפוש
          </label>
          <select id="column" value={column} onChange={(e) => setColumn(e.target.value as SearchColumn)}>
            <option value="0">כותר</option>
            <option value="1">מחבר/ת</option>
            <option value="2">נושא</option>
          </select>

          <button type="submit" disabled={!canSearch || loading}>
            חיפוש
          </button>
        </form>

        <div className="assistive" aria-live="polite">
          {loading && <p>מחפש בקטלוג...</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </section>

      <section className="results" aria-live="polite">
        {!loading && searched && !error && visibleResults.length > 0 && (
          <p className="resultsCount">נמצאו {visibleResults.length} תוצאות</p>
        )}
        {!loading && searched && !error && visibleResults.length === 0 && <p>לא נמצאו תוצאות מתאימות.</p>}

        {visibleResults.map((item, idx) => (
          <article key={`${item.title}-${idx}`} className="card">
            <div className="cardLayout">
              <div className="cardText">
                <h2>{item.title}</h2>
                <ul>
                  {item.author && <li>מחבר/ת: {item.author}</li>}
                  {item.year && <li>שנת הוצאה: {item.year}</li>}
                  {item.shelfMark && <li>מיקום מדף: {item.shelfMark}</li>}
                  {item.classification && <li>סיווג: {item.classification}</li>}
                  {item.seriesNumber && <li>מס' בסדרה: {item.seriesNumber}</li>}
                </ul>
                <div className="actions">
                  {item.detailsUrl && (
                    <a href={item.detailsUrl} target="_blank" rel="noreferrer noopener">
                      פרטים נוספים
                    </a>
                  )}
                  {item.copiesUrl && (
                    <a href={item.copiesUrl} target="_blank" rel="noreferrer noopener">
                      בדיקת עותקים
                    </a>
                  )}
                </div>
              </div>

              <div className="coverWrap" aria-hidden="true">
                {item.coverUrl ? (
                  <img src={`/api/cover?url=${encodeURIComponent(item.coverUrl)}`} alt="" className="coverImage" loading="lazy" />
                ) : (
                  <div className="coverFallback">אין תמונה</div>
                )}
              </div>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
