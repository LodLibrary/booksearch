"use client";

import { FormEvent, useMemo, useState } from "react";
import type { CatalogResult, SearchColumn } from "@/lib/agron";

type SearchResponse =
  | { results: CatalogResult[]; error?: never }
  | { results?: never; error: string };

type ViewMode = "home" | "results" | "details";

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [column, setColumn] = useState<SearchColumn>("0");
  const [results, setResults] = useState<CatalogResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const [view, setView] = useState<ViewMode>("home");
  const [selectedBook, setSelectedBook] = useState<CatalogResult | null>(null);

  const canSearch = useMemo(() => query.trim().length >= 2, [query]);

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
        setView("results");
        return;
      }

      setResults(data.results);
      setView("results");
    } catch {
      setError("החיבור לשרת נכשל. נסו שוב.");
      setResults([]);
      setView("results");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="kioskShell">
      <div className="kioskFrame">
        <header className="masthead">
          <p>הספרייה העירונית</p>
          <strong>עמדת חיפוש דיגיטלית</strong>
        </header>

        <section className="heroSearch" aria-label="חיפוש">
          <h1>חיפוש בקטלוג הספרייה</h1>
          <p className="helper">ברוכים הבאים. הקלידו ביטוי, בחרו סוג חיפוש ולחצו כדי להתחיל.</p>

          <form className="searchForm" onSubmit={onSubmit} aria-label="טופס חיפוש">
            <label htmlFor="query" className="srOnly">
              טקסט לחיפוש
            </label>
            <input
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="שם ספר, מחבר/ת או נושא"
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
              {loading ? "מחפש..." : "התחלת חיפוש"}
            </button>
          </form>

          <div className="assistive" aria-live="polite">
            {error && <p className="error">{error}</p>}
          </div>
        </section>

        {view === "results" && (
          <section className="resultsZone" aria-live="polite">
            <div className="zoneHeader">
              <h2>תוצאות חיפוש</h2>
              <button className="ghostBtn" onClick={() => setView("home")}>
                חזרה למסך הראשי
              </button>
            </div>

            {!loading && searched && !error && results.length === 0 && <p className="empty">לא נמצאו תוצאות מתאימות.</p>}

            <div className="resultsTable" role="list">
              {results.map((item, idx) => (
                <article key={`${item.title}-${idx}`} className="resultRow" role="listitem">
                  <div className="cover" aria-hidden>
                    <span>כריכה</span>
                  </div>
                  <div className="bookCore">
                    <h3>{item.title}</h3>
                    <div className="metaGrid">
                      <p><strong>מחבר/ת:</strong> {item.author || "לא צוין"}</p>
                      <p><strong>שנה:</strong> {item.year || "לא צוין"}</p>
                      <p><strong>מיקום:</strong> {item.shelfMark || "לא צוין"}</p>
                      <p><strong>סיווג:</strong> {item.classification || "לא צוין"}</p>
                    </div>
                  </div>
                  <div className="rowActions">
                    <button
                      onClick={() => {
                        setSelectedBook(item);
                        setView("details");
                      }}
                    >
                      פרטי כותר
                    </button>
                    {item.copiesUrl && (
                      <a href={item.copiesUrl} target="_blank" rel="noreferrer noopener">
                        עותקים
                      </a>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}

        {view === "details" && selectedBook && (
          <section className="detailsZone">
            <div className="zoneHeader">
              <h2>פרטי כותר</h2>
              <button className="ghostBtn" onClick={() => setView("results")}>
                חזרה לתוצאות
              </button>
            </div>

            <div className="detailsLayout">
              <aside className="coverLarge">כריכה</aside>
              <section className="detailBlock">
                <h3>פרטי הספר</h3>
                <p className="bigTitle">{selectedBook.title}</p>
              </section>
              <section className="detailBlock">
                <h3>מחבר/ת ופרסום</h3>
                <div className="kv"><span>מחבר/ת</span><strong>{selectedBook.author || "לא צוין"}</strong></div>
                <div className="kv"><span>שנת הוצאה</span><strong>{selectedBook.year || "לא צוין"}</strong></div>
              </section>
              <section className="detailBlock">
                <h3>מיקום בספרייה</h3>
                <div className="kv"><span>מיקום מדף</span><strong>{selectedBook.shelfMark || "לא צוין"}</strong></div>
                <div className="kv"><span>סיווג</span><strong>{selectedBook.classification || "לא צוין"}</strong></div>
              </section>
              <section className="detailBlock">
                <h3>תיאור</h3>
                <p>כותר זמין בקטלוג הספרייה. לפרטים מלאים ניתן לעבור לרשומת המקור.</p>
                {selectedBook.detailsUrl && (
                  <a className="inlineAction" href={selectedBook.detailsUrl} target="_blank" rel="noreferrer noopener">
                    מעבר לרשומה מלאה
                  </a>
                )}
              </section>
              <section className="detailBlock">
                <h3>עותקים</h3>
                <p>בדיקת זמינות, השאלה והחזרה.</p>
                {selectedBook.copiesUrl ? (
                  <a className="inlineAction" href={selectedBook.copiesUrl} target="_blank" rel="noreferrer noopener">
                    פתיחת מסך עותקים
                  </a>
                ) : (
                  <p>מידע עותקים לא זמין כרגע.</p>
                )}
              </section>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
