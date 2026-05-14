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

const AGRON_COMPLEX_RESULTS_URL = "https://lod.library.org.il/agron-catalog/search-complex-menu?task=results";
const AGRON_BASE_URL = "https://lod.library.org.il";

function toAbsoluteUrl(href?: string): string | undefined {
  if (!href) return undefined;
  try {
    return new URL(href, AGRON_BASE_URL).toString();
  } catch {
    return undefined;
  }
}

function buildComplexFormData(query: string, column: SearchColumn): URLSearchParams {
  const body = new URLSearchParams();
  body.set("column0", column);
  body.set("exprStr0", query);
  body.set("matchBy0", "1");
  body.set("cond0", "AND");
  body.set("column1", "");
  body.set("exprStr1", "");
  body.set("newSearch", "1");
  return body;
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

export async function searchCatalog(query: string, column: SearchColumn): Promise<CatalogResult[]> {
  const res = await fetch(AGRON_COMPLEX_RESULTS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: buildComplexFormData(query, column),
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Agron request failed with ${res.status}`);
  const html = await res.text();
  return parseComplexResults(html);
}
