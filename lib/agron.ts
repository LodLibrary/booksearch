import * as cheerio from "cheerio";

export type SearchColumn = "0" | "1" | "2";

export type CatalogResult = {
  title: string;
  author?: string;
  year?: string;
  shelfMark?: string;
  classification?: string;
  seriesNumber?: string;
  detailsUrl?: string;
  copiesUrl?: string;
  coverUrl?: string;
  rawText?: string;
};

function cleanFieldValue(value?: string): string | undefined {
  if (!value) return undefined;
  const normalized = value.replace(/\s+/g, " ").trim();
  if (!normalized) return undefined;
  return normalized;
}

const AGRON_SEARCH_URL =
  "https://lod.library.org.il/index.php?option=com_agronsearch&view=results&Itemid=72";
const AGRON_BASE_URL = "https://lod.library.org.il";

function toAbsoluteUrl(href?: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, AGRON_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

function normalizeImageUrl(src?: string): string | undefined {
  if (!src) return undefined;
  const cleaned = src.replace(/[\r\n\t ]+/g, "").trim();
  if (!cleaned) return undefined;

  try {
    const absolute = new URL(cleaned, AGRON_BASE_URL).toString();
    const parsed = new URL(absolute);
    const q = parsed.searchParams.get("q");

    if (q) {
      const normalizedQ = q.replace(/\s+/g, "");
      parsed.searchParams.set("q", normalizedQ);
    }

    return parsed.toString();
  } catch {
    // Agron image URLs may include non-URL-safe characters (like "{") inside query params.
    // In that case keep a sanitized absolute/http URL instead of dropping the image.
    if (cleaned.startsWith("http://") || cleaned.startsWith("https://")) return cleaned;
    if (cleaned.startsWith("/")) return `${AGRON_BASE_URL}${cleaned}`;
    return undefined;
  }
}

async function getCsrfToken(): Promise<string | null> {
  const response = await fetch(AGRON_SEARCH_URL, {
    cache: "no-store",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; LodCatalogProxy/1.0)",
      "Accept-Language": "he-IL,he;q=0.9,en;q=0.7",
    },
  });
  if (!response.ok) return null;

  const html = await response.text();
  const $ = cheerio.load(html);

  // Joomla token input tends to be a hashed name with value "1".
  const tokenInput = $('input[type="hidden"][value="1"]').filter((_, el) => {
    const name = $(el).attr("name") || "";
    return /^[a-zA-Z0-9]{16,}$/.test(name);
  });

  return tokenInput.first().attr("name") || null;
}

function buildFormData(query: string, column: SearchColumn, tokenName?: string): URLSearchParams {
  const body = new URLSearchParams();
  body.set("column0", column);
  body.set("exprStr0", query);
  body.set("newSearch", "1");

  if (tokenName) {
    body.set(tokenName, "1");
  }

  return body;
}

function isNoiseText(text: string): boolean {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return true;

  const noisePatterns = [
    /דף הבית|אירועים|אודות|צרו קשר|כניסה|שכחתי סיסמא|סיום|הבא|SCROLL_TO_TOP/i,
    /הספרייה העירונית|הודעות לקוראים|חדשות הספרייה|סדנאות|פעילויות|תמונות וסרטונים/i,
    /פרטים נוספים$/i,
  ];

  return noisePatterns.some((pattern) => pattern.test(cleaned));
}

function looksLikeCatalogLink(href?: string, text?: string): boolean {
  const h = (href || "").toLowerCase();
  const t = (text || "").trim();

  if (!h && !t) return false;
  if (isNoiseText(t)) return false;

  // TODO: Tighten patterns if Agron exposes stable item URLs.
  const positiveHref = /agron|itemid=72|view=results|option=com_agronsearch|tmpl=component|task=|record|book|details/i.test(h);
  const negativeHref = /login|contact|home|events|about|gallery|video|images|newsletter|mailto:|javascript:/i.test(h);

  if (negativeHref) return false;
  if (positiveHref) return true;

  // Fallback: long Hebrew/English title-like anchors are often records.
  return t.length >= 4 && t.length <= 140;
}

function parseResultCards(html: string): CatalogResult[] {
  const $ = cheerio.load(html);
  const results: CatalogResult[] = [];

  // Prefer explicit Agron result blocks where title and image live together.
  const spostRows = $(".spost.nomargin.clearfix");
  if (spostRows.length > 0) {
    spostRows.each((_, row) => {
      const rowEl = $(row);
      const titleLink = rowEl.find(".title-details h3 a").first();
      const title = titleLink.text().replace(/\s+/g, " ").trim();
      if (!title || isNoiseText(title)) return;

      const detailsHref = titleLink.attr("href");
      const frontImageHref =
        rowEl.find('a.image-fade.thumbnail:not(.col_last)').first().attr("href") ||
        rowEl.find('a.image-fade.tleft.thumbnail').first().attr("href") ||
        rowEl.find('img[id="image0"]').first().attr("src");

      const copiesHref =
        rowEl.find('a[href*="#copies"]').first().attr("href") ||
        rowEl.find("a").filter((_, a) => /עותקים|copies/i.test($(a).text())).first().attr("href");

      const rawText = rowEl.find(".title-details").text().replace(/\s+/g, " ").trim();
      const authorMatch = rawText.match(/(?:מחברים?|Author(?:s)?)\s*[:\-]?\s*(.+?)(?=\s*(?:שנת הוצאה|מס'?\s*מיון|סימן מדף|מס'?\s*בסדרה|$))/i);
      const yearMatch = rawText.match(/(?:19|20)\d{2}/);
      const shelfMatch = rawText.match(/(?:סימן מדף|מדף|מיקום(?:\s*מדף)?|Shelf(?:\s*Mark)?)\s*[:\-]?\s*(.+?)(?=\s*(?:מס'?\s*בסדרה|מס'?\s*מיון|סיווג|שנת הוצאה|$))/i);
      const classMatch = rawText.match(/(?:מס[']?\s*מיון|סיווג|Classification)\s*[:\-]?\s*(.+?)(?=\s*(?:סימן מדף|מס'?\s*בסדרה|שנת הוצאה|$))/i);
      const seriesMatch = rawText.match(/(?:מס[']?\s*בסדרה)\s*[:\-]?\s*(\d{1,4})/i);

      results.push({
        title,
        author: cleanFieldValue(authorMatch?.[1]),
        year: yearMatch?.[0],
        shelfMark: cleanFieldValue(shelfMatch?.[1]),
        classification: cleanFieldValue(classMatch?.[1]),
        seriesNumber: cleanFieldValue(seriesMatch?.[1]),
        detailsUrl: toAbsoluteUrl(detailsHref),
        copiesUrl: toAbsoluteUrl(copiesHref),
        coverUrl: normalizeImageUrl(frontImageHref),
        rawText,
      });
    });
  }

  if (results.length > 0) {
    const unique = new Map<string, CatalogResult>();
    for (const item of results) {
      const key = `${item.title}|${item.detailsUrl || ""}`;
      if (!unique.has(key)) unique.set(key, item);
    }
    return Array.from(unique.values()).slice(0, 100);
  }

  // TODO: Agron markup may change. Adjust selectors below if cards/rows stop being discovered.
  const candidateRows = $(
    ".agron_result, .result, .results .row, table tr, .items-row, .item, .search-result, .result-row"
  );

  const rows = candidateRows.length > 0 ? candidateRows : $("a").closest("div, tr, li");

  rows.each((_, row) => {
    const rowEl = $(row);
    const allLinks = rowEl.find("a");
    if (!allLinks.length) return;

    const recordLinks = allLinks
      .toArray()
      .map((a) => $(a))
      .filter((a) => looksLikeCatalogLink(a.attr("href"), a.text()));

    if (!recordLinks.length) return;

    const titleLink = recordLinks.find((a) => !/פרטים נוספים/i.test(a.text())) || recordLinks[0];
    const title = (titleLink.text() || "").replace(/\s+/g, " ").trim();

    if (!title || isNoiseText(title) || title.length < 2) return;

    let rawText = rowEl.text().replace(/\s+/g, " ").trim();

    // Remove common navigation/site chrome fragments from extracted text.
    rawText = rawText
      .replace(/(?:דף הבית|אירועים|אודות|צרו קשר|כניסה|שכחתי סיסמא|SCROLL_TO_TOP|הבא|סיום)/gi, " ")
      .replace(/(?:הספרייה העירונית\s*"?לדורות"?\s*לוד|תמונות וסרטונים|חדשות הספרייה|הודעות לקוראים)/gi, " ")
      .replace(/(?:פרטים נוספים\s*){1,}/gi, " ")
      .replace(/\s+/g, " ")
      .trim();

    const detailsHref = titleLink.attr("href") || recordLinks[0].attr("href");
    const frontAnchor =
      rowEl.find('a.thumbnail:not(.col_last) img[id^="image"]:not([id$="-b"])').first().closest("a") ||
      rowEl.find('a.thumbnail img[id="image0"]').first().closest("a");
    const frontImg =
      rowEl.find('img[id="image0"]').first().attr("src") ||
      rowEl.find('a.thumbnail:not(.col_last) img:not([id$="-b"])').first().attr("src") ||
      rowEl.find('img[id^="image"]:not([id$="-b"])').first().attr("src");
    const imageSrc = frontImg || frontAnchor.attr("href") || rowEl.find("img").first().attr("src");
    const copiesHref =
      recordLinks.find((a) => /עותקים|copies|copy|השאלה/i.test(a.text()) || /copy|loan|holding/i.test(a.attr("href") || ""))
        ?.attr("href") || undefined;

    const authorMatch = rawText.match(/(?:מחבר|Author)\s*[:\-]?\s*(.+?)(?=\s*(?:שנת הוצאה|מס'?\s*מיון|סימן מדף|מס'?\s*בסדרה|$))/i);
    const yearMatch = rawText.match(/(?:19|20)\d{2}/);
    const shelfMatch = rawText.match(/(?:סימן מדף|מדף|מיקום(?:\s*מדף)?|Shelf(?:\s*Mark)?)\s*[:\-]?\s*(.+?)(?=\s*(?:מס'?\s*בסדרה|מס'?\s*מיון|סיווג|שנת הוצאה|$))/i);
    const classMatch = rawText.match(/(?:מס[']?\s*מיון|סיווג|Classification)\s*[:\-]?\s*(.+?)(?=\s*(?:סימן מדף|מס'?\s*בסדרה|שנת הוצאה|$))/i);
    const seriesMatch = rawText.match(/(?:מס[']?\s*בסדרה)\s*[:\-]?\s*(\d{1,4})/i);

    results.push({
      title,
      author: cleanFieldValue(authorMatch?.[1]),
      year: yearMatch?.[0],
      shelfMark: cleanFieldValue(shelfMatch?.[1]),
      classification: cleanFieldValue(classMatch?.[1]),
      seriesNumber: cleanFieldValue(seriesMatch?.[1]),
      detailsUrl: toAbsoluteUrl(detailsHref),
      copiesUrl: toAbsoluteUrl(copiesHref),
      coverUrl: normalizeImageUrl(imageSrc),
      rawText,
    });
  });

  const unique = new Map<string, CatalogResult>();
  for (const item of results) {
    const key = `${item.title}|${item.detailsUrl || ""}`;
    if (!unique.has(key)) unique.set(key, item);
  }

  return Array.from(unique.values()).slice(0, 100);
}

export async function searchCatalog(query: string, column: SearchColumn): Promise<CatalogResult[]> {
  const attempt = async (tokenName?: string) => {
    const res = await fetch(AGRON_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "Mozilla/5.0 (compatible; LodCatalogProxy/1.0)",
        "Accept-Language": "he-IL,he;q=0.9,en;q=0.7",
      },
      body: buildFormData(query, column, tokenName),
      cache: "no-store",
    });

    if (!res.ok) throw new Error(`Agron request failed with ${res.status}`);
    return res.text();
  };

  let html = await attempt();
  let parsed = parseResultCards(html);

  if (parsed.length === 0) {
    const tokenName = await getCsrfToken();
    if (tokenName) {
      html = await attempt(tokenName);
      parsed = parseResultCards(html);
    }
  }

  return parsed;
}
