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

  const openPanel = async (key: string, url: string, mode: "details" | "copies") => {
    setPanelLoading(`${key}-${mode}`);
    try {
      const res = await fetch(`/api/details?url=${encodeURIComponent(url)}&mode=${mode}`);
      const data = (await res.json()) as { lines?: string[] };
      if (!res.ok) return;
      const lines = data.lines ?? [];
      setExpanded((prev) => ({ ...prev, [key]: { mode, lines } }));
    } finally {
      setPanelLoading(null);
    }
  };

  const getTitleId = (url?: string): string | null => {
    if (!url) return null;
    try { return new URL(url).searchParams.get("titleId"); } catch { return null; }
  };

  const cleanLine = (line: string): string | null => {
    const normalized = line.replace(/\s+/g, " ").trim();
    if (!normalized || normalized.length < 3) return null;
    if (/SCROLL_TO_TOP|פרטים נוספים|דף הבית|אירועים|אודות|כניסה|שכחתי סיסמא/i.test(normalized)) return null;
    return normalized;
  };

  return (
    <main className="kioskShell">
      <section className="heroZone">
        <p className="kioskBadge">הספרייה העירונית לוד</p>
        <h1>חיפוש בקטלוג הספרייה</h1>
        <p className="heroHint">הקלידו שם ספר, מחבר/ת או נושא ולחצו חיפוש</p>

        <form className="heroSearch" onSubmit={onSubmit} aria-label="טופס חיפוש">
          <input
            id="query"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="שם ספר, מחבר/ת או נושא..."
            autoComplete="off"
          />
          <div className="searchControls">
            <select id="column" value={column} onChange={(e) => setColumn(e.target.value as SearchColumn)}>
              <option value="0">כותר</option>
              <option value="1">מחבר/ת</option>
              <option value="2">נושא</option>
            </select>
            <button type="submit" disabled={!canSearch || loading}>חיפוש</button>
          </div>
        </form>

        <div className="statusLine" aria-live="polite">
          {loading && <p>מחפש בקטלוג...</p>}
          {error && <p className="error">{error}</p>}
        </div>
      </section>

      {searched && (
        <section className="resultsZone" aria-live="polite">
          <div className="resultsTop">
            {!loading && !error && visibleResults.length > 0 && <p>נמצאו {visibleResults.length} תוצאות</p>}
            {!loading && !error && visibleResults.length === 0 && <p>לא נמצאו תוצאות מתאימות.</p>}
          </div>

          <div className="resultsGrid">
            {visibleResults.map((item, idx) => {
              const key = `${item.title}-${idx}`;
              const titleId = getTitleId(item.detailsUrl);
              const details = expanded[key];
              const sanitized = details ? details.lines.map(cleanLine).filter((line): line is string => Boolean(line)).slice(0, 14) : [];

              return (
                <article key={key} className="bookCard">
                  <div className="bookCardMain">
                    <h2>{item.title}</h2>
                    <div className="bookByline">
                      {item.author && <span>מאת {item.author}</span>}
                      {item.year && <span className="yearChip">{item.year}</span>}
                    </div>
                    <div className="chips">
                      {item.shelfMark && <span>מיקום מדף: {item.shelfMark}</span>}
                      {item.classification && <span>סיווג: {item.classification}</span>}
                      {item.seriesNumber && <span>מס׳ בסדרה: {item.seriesNumber}</span>}
                    </div>

                    <div className="cardActions">
                      {item.detailsUrl && (titleId ? <Link href={`/title/${titleId}`}>פרטים נוספים</Link> :
                        <button type="button" onClick={() => openPanel(key, item.detailsUrl!, "details")} disabled={panelLoading === `${key}-details`}>פרטים נוספים</button>)}
                      {item.copiesUrl && <button type="button" onClick={() => openPanel(key, item.copiesUrl!, "copies")} disabled={panelLoading === `${key}-copies`}>בדיקת עותקים</button>}
                    </div>

                    {details && (
                      <div className="detailsBox">
                        <h3>{details.mode === "copies" ? "פרטי עותקים" : "פרטי רשומה"}</h3>
                        <div className="detailsFlow">{sanitized.map((line, i) => <div key={`${i}-${line}`}>{line}</div>)}</div>
                      </div>
                    )}
                  </div>

                  <div className="bookCover" aria-hidden="true">
                    {item.coverUrl ? <Image src={`/api/cover?url=${encodeURIComponent(item.coverUrl)}`} alt="" width={150} height={210} unoptimized /> : <div>אין תמונה</div>}
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
