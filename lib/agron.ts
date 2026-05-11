import * as cheerio from "cheerio";

export type SearchColumn = "0" | "1" | "2";

export type CatalogResult = {
  title: string;
  author?: string;
  year?: string;
  shelfMark?: string;
  classification?: string;
  detailsUrl?: string;
  copiesUrl?: string;
  rawText?: string;
};

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

async function getCsrfToken(): Promise<string | null> {
  const response = await fetch(AGRON_SEARCH_URL, { cache: "no-store" });
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

function parseResultCards(html: string): CatalogResult[] {
  const $ = cheerio.load(html);
  const results: CatalogResult[] = [];

  // TODO: Agron markup may change. Adjust selectors below if cards/rows stop being discovered.
  const candidateRows = $(
    ".agron_result, .result, .results .row, table tr, .items-row, .item, .search-result"
  );

  const rows = candidateRows.length > 0 ? candidateRows : $("a").closest("div, tr, li");

  rows.each((_, row) => {
    const rowEl = $(row);
    const allLinks = rowEl.find("a");
    if (!allLinks.length) return;

    const titleLink =
      allLinks
        .toArray()
        .map((a) => $(a))
        .find((a) => (a.text() || "").trim().length > 2) || allLinks.first();

    const title = (titleLink.text() || "").trim();
    if (!title) return;

    const rawText = rowEl.text().replace(/\s+/g, " ").trim();

    const detailsHref = titleLink.attr("href") || allLinks.first().attr("href");
    const copiesHref =
      allLinks
        .toArray()
        .map((a) => $(a))
        .find((a) => /עותקים|copies|copy|השאלה/i.test(a.text()) || /copy/i.test(a.attr("href") || ""))
        ?.attr("href") || undefined;

    const authorMatch = rawText.match(/(?:מחבר|Author)\s*[:\-]?\s*([^|,.;]{2,60})/i);
    const yearMatch = rawText.match(/(?:19|20)\d{2}/);
    const shelfMatch = rawText.match(/(?:מדף|מיקום|Shelf(?:\s*Mark)?)\s*[:\-]?\s*([^|,.;]{1,50})/i);
    const classMatch = rawText.match(/(?:סיווג|Classification)\s*[:\-]?\s*([^|,.;]{1,50})/i);

    results.push({
      title,
      author: authorMatch?.[1]?.trim(),
      year: yearMatch?.[0],
      shelfMark: shelfMatch?.[1]?.trim(),
      classification: classMatch?.[1]?.trim(),
      detailsUrl: toAbsoluteUrl(detailsHref),
      copiesUrl: toAbsoluteUrl(copiesHref),
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
