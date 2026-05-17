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
  coverImageUrl?: string;
  rawText?: string;
};

export type CopyItem = {
  location: string;
  status: string;
};

export type TitleDetails = {
  description?: string;
  publisher?: string;
  publicationYear?: string;
};

const AGRON_COMPLEX_SEARCH_URL = "https://lod.library.org.il/agron-catalog/search-complex-menu";
const AGRON_COMPLEX_RESULTS_URL = `${AGRON_COMPLEX_SEARCH_URL}?task=results`;
const AGRON_BASE_URL = "https://lod.library.org.il";

function toAbsoluteUrl(href?: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, AGRON_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

function buildComplexFormData(query: string, column: SearchColumn, tokenName?: string): URLSearchParams {
  const body = new URLSearchParams();
  body.set("column0", column);
  body.set("exprStr0", query);
  body.set("matchBy0", "0");
  body.set("cond0", "AND");
  body.set("column1", "0");
  body.set("exprStr1", "");
  body.set("matchBy1", "0");
  body.set("cond1", "AND");
  body.set("column2", "0");
  body.set("exprStr2", "");
  body.set("matchBy2", "0");
  body.set("orderBy", "0");
  body.set("newSearch", "1");
  if (tokenName) body.set(tokenName, "1");
  return body;
}


async function getComplexSearchToken(): Promise<string | undefined> {
  const res = await fetch(AGRON_COMPLEX_SEARCH_URL, { cache: "no-store" });
  if (!res.ok) return undefined;
  const html = await res.text();
  const $ = cheerio.load(html);
  return $("#searchTitle input[type='hidden'][value='1']")
    .toArray()
    .map((el) => $(el).attr("name") || "")
    .find((name) => /^[a-f0-9]{24,}$/i.test(name));
}

function parseComplexResults(html: string): CatalogResult[] {
  const $ = cheerio.load(html);
  const results: CatalogResult[] = [];

  $(".spost").each((_, el) => {
    const row = $(el);
    const titleLink = row.find(".title-details h3 a").first();
    const title = titleLink.text().replace(/\s+/g, " ").trim();
    if (!title) return;

    const detailsHref = titleLink.attr("href");
    const copiesHref = row.find('.title-details a[href*="#copies"]').attr("href");
    const coverImage = row.find(".images img").first().attr("src") || row.find(".images a").first().attr("href");

    const text = row.find(".title-details").text().replace(/\s+/g, " ").trim();
    const author = text.match(/מחברים?:\s*([^<\n\r]+?)(?:\s+מס'|\s+סימן|$)/)?.[1]?.trim();
    const shelfMark = text.match(/סימן מדף:\s*([^<\n\r]+?)(?:\s+מס'|\s+עותקים|$)/)?.[1]?.trim();
    const classification = text.match(/מס' מיון:\s*([^<\n\r]+?)(?:\s+סימן|$)/)?.[1]?.trim();
    const year = text.match(/(?:19|20)\d{2}/)?.[0];

    results.push({
      title,
      author,
      year,
      shelfMark,
      classification,
      detailsUrl: toAbsoluteUrl(detailsHref),
      copiesUrl: toAbsoluteUrl(copiesHref),
      coverImageUrl: toAbsoluteUrl(coverImage),
      rawText: text,
    });
  });

  return results.slice(0, 100);
}

function parseCopies(html: string): CopyItem[] {
  const $ = cheerio.load(html);
  const copies: CopyItem[] = [];

  const rows = $("#copies").find("tr");
  rows.each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    const location = $(tds[1]).text().replace(/\s+/g, " ").trim();
    const status = $(tds[tds.length - 1]).text().replace(/\s+/g, " ").trim();
    if (!location && !status) return;
    copies.push({ location: location || "לא צוין", status: status || "לא צוין" });
  });

  return copies;
}

export async function searchCatalog(query: string, column: SearchColumn): Promise<CatalogResult[]> {
  const tokenName = await getComplexSearchToken();
  const res = await fetch(AGRON_COMPLEX_RESULTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildComplexFormData(query, column, tokenName),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Agron request failed with ${res.status}`);
  const html = await res.text();
  return parseComplexResults(html);
}

function parseTitleDetails(html: string): TitleDetails {
  const $ = cheerio.load(html);
  const byMeta = [
    "#description",
    ".description",
    ".title-details .well",
    "article .well",
    ".item-page .well"
  ];
  let description = "";
  for (const sel of byMeta) {
    const text = $(sel).first().text().replace(/\s+/g, " " ).trim();
    if (text && text.length > 30) { description = text; break; }
  }
  if (!description) {
    const allText = $("#copies").parent().text().replace(/\s+/g, " " ).trim();
    const m = allText.match(/(?:תקציר|תיאור)\s*[:\-]?\s*(.{30,500})/);
    description = m?.[1]?.trim() || "";
  }

  const full = $("body").text().replace(/\s+/g, " " );
  const publisher = full.match(/(?:הוצאה|Publisher)\s*[:\-]?\s*([^|,.]{2,80})/)?.[1]?.trim();
  const publicationYear = full.match(/(?:19|20)\d{2}/)?.[0];
  return { description: description || undefined, publisher, publicationYear };
}

export async function getCopiesForTitle(input: { detailsUrl?: string; copiesUrl?: string }): Promise<{ copies: CopyItem[]; total: number; available: number; details: TitleDetails }> {
  const target = input.copiesUrl || input.detailsUrl;
  if (!target) return { copies: [], total: 0, available: 0, details: {} };

  const res = await fetch(target, { cache: "no-store" });
  if (!res.ok) throw new Error(`Copies request failed with ${res.status}`);

  const html = await res.text();
  const copies = parseCopies(html);
  const available = copies.filter((c) => /זמין|פנוי|available|on shelf/i.test(c.status)).length;

  let details = parseTitleDetails(html);
  if ((!details.description || !details.publisher) && input.detailsUrl && input.detailsUrl !== target) {
    try {
      const detailsRes = await fetch(input.detailsUrl, { cache: "no-store" });
      if (detailsRes.ok) {
        details = { ...details, ...parseTitleDetails(await detailsRes.text()) };
      }
    } catch {}
  }

  return { copies, total: copies.length, available, details };
}
