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
  const [expanded, setExpanded] = useState<Record<string, { mode: "details" | "copies"; lines: string[] }>>({});
  const [panelLoading, setPanelLoading] = useState<string | null>(null);

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

  const openPanel = async (key: string, url: string, mode: "details" | "copies") => {
    setPanelLoading(`${key}-${mode}`);
    try {
      const res = await fetch(`/api/details?url=${encodeURIComponent(url)}&mode=${mode}`);
      const data = (await res.json()) as { lines?: string[]; error?: string };
      if (!res.ok) return;
      const lines = data.lines ?? [];
      setExpanded((prev) => ({ ...prev, [key]: { mode, lines } }));
    } finally {
      setPanelLoading(null);
    }
  };

  const getTitleId = (url?: string): string | null => {
    if (!url) return null;
    try {
      const u = new URL(url);
      return u.searchParams.get("titleId");
    } catch {
      return null;
    }
  };

  const cleanLine = (line: string): string | null => {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized) return null;
    if (/SCROLL_TO_TOP|פרטים נוספים|דף הבית|אירועים|אודות|כניסה|שכחתי סיסמא/i.test(normalized)) return null;
    if (normalized.length < 3) return null;
    return normalized;
  };

  return (
    <main className="container kiosk">
      <header className="topBar">
        <div>
          <p className="eyebrow">הספרייה העירונית לוד</p>
          <h1>חיפוש בקטלוג הספרייה</h1>
        </div>
      </header>

      <section className="hero">
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

      <section className="resultsBoard" aria-live="polite">
        <div className="resultsHeader">
        {!loading && searched && !error && visibleResults.length > 0 && (
          <p className="resultsCount">נמצאו {visibleResults.length} תוצאות</p>
        )}
        {!loading && searched && !error && visibleResults.length === 0 && <p>לא נמצאו תוצאות מתאימות.</p>}
        </div>

        <div className="results">
        {visibleResults.map((item, idx) => (
          <article key={`${item.title}-${idx}`} className="card">
            <div className="cardLayout">
              <div className="cardText">
                <h2>{item.title}</h2>
                <div className="metaGrid">
                  {item.author && <div className="metaItem"><span>מחבר/ת</span><strong>{item.author}</strong></div>}
                  {item.year && <div className="metaItem"><span>שנת הוצאה</span><strong>{item.year}</strong></div>}
                  {item.shelfMark && <div className="metaItem"><span>מיקום מדף</span><strong>{item.shelfMark}</strong></div>}
                  {item.classification && <div className="metaItem"><span>סיווג</span><strong>{item.classification}</strong></div>}
                  {item.seriesNumber && <div className="metaItem"><span>מס׳ בסדרה</span><strong>{item.seriesNumber}</strong></div>}
                </div>
                <div className="actions">
                  {item.detailsUrl && (
                    getTitleId(item.detailsUrl) ? (
                      <Link href={`/title/${getTitleId(item.detailsUrl)}`}>פרטים נוספים</Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openPanel(`${item.title}-${idx}`, item.detailsUrl!, "details")}
                        disabled={panelLoading === `${item.title}-${idx}-details`}
                      >
                        פרטים נוספים
                      </button>
                    )
                  )}
                  {item.copiesUrl && (
                    <button
                      type="button"
                      onClick={() => openPanel(`${item.title}-${idx}`, item.copiesUrl!, "copies")}
                      disabled={panelLoading === `${item.title}-${idx}-copies`}
                    >
                      בדיקת עותקים
                    </button>
                  )}
                </div>
                {expanded[`${item.title}-${idx}`] && (
                  <div className="detailsPanel">
                    <h3>{expanded[`${item.title}-${idx}`].mode === "copies" ? "פרטי עותקים" : "פרטי רשומה"}</h3>
                    {(() => {
                      const sanitized = expanded[`${item.title}-${idx}`].lines
                        .map(cleanLine)
                        .filter((line): line is string => Boolean(line))
                        .slice(0, 14);
                      return (
                    <div className="detailsBlocks">
                      {sanitized.map((line, i) => (
                        <div className="detailsLine" key={`${i}-${line}`}>{line}</div>
                      ))}
                    </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              <div className="coverWrap" aria-hidden="true">
                {item.coverUrl ? (
                  <Image
                    src={`/api/cover?url=${encodeURIComponent(item.coverUrl)}`}
                    alt=""
                    className="coverImage"
                    width={110}
                    height={150}
                    unoptimized
                  />
                ) : (
                  <div className="coverFallback">אין תמונה</div>
                )}
              </div>
            </div>
          </article>
        ))}
        </div>
      </section>
    </main>
  );
}
