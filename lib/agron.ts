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
  titleId?: string;
};

export type CopyItem = { location: string; status: string };
export type TitleDetails = { description?: string; publisher?: string; publicationYear?: string; subjects?: string[] };

const BASE = "https://lod.library.org.il";
const COMPLEX_FORM_URL = `${BASE}/agron-catalog/search-complex-menu`;
const COMPLEX_RESULTS_URL = `${COMPLEX_FORM_URL}?task=results`;
const SIMPLE_RESULTS_URL = `${BASE}/index.php?option=com_agronsearch&view=results&Itemid=72`;

function abs(h?: string) {
  if (!h) return undefined;
  try { return new URL(h, BASE).toString(); } catch { return undefined; }
}

async function getComplexToken(): Promise<string | undefined> {
  const res = await fetch(COMPLEX_FORM_URL, { cache: "no-store" });
  if (!res.ok) return undefined;
  const $ = cheerio.load(await res.text());
  return $("#searchTitle input[type='hidden'][value='1']").toArray().map((e) => $(e).attr("name") || "").find((n) => /^[a-f0-9]{24,}$/i.test(n));
}

function buildComplexPayload(query: string, column: SearchColumn, token?: string) {
  const body = new URLSearchParams();
  body.set("column0", column);
  body.set("exprStr0", query);
  body.set("matchBy0", "0");
  body.set("cond0", "0");
  body.set("column1", "0");
  body.set("exprStr1", "");
  body.set("matchBy1", "0");
  body.set("cond1", "0");
  body.set("column2", "0");
  body.set("exprStr2", "");
  body.set("matchBy2", "0");
  body.set("orderBy", "0");
  body.set("newSearch", "1");
  if (token) body.set(token, "1");
  return body;
}

function buildSimplePayload(query: string, column: SearchColumn) {
  const body = new URLSearchParams();
  body.set("column0", column);
  body.set("exprStr0", query);
  body.set("newSearch", "1");
  return body;
}

function parseResults(html: string): CatalogResult[] {
  const $ = cheerio.load(html);
  const out: CatalogResult[] = [];
  const rows = $(".spost").length ? $(".spost") : $(".agron_result, .result, .results .row, .search-result, table tr");

  rows.each((_, el) => {
    const row = $(el);
    const titleLink = row.find(".title-details h3 a, h3 a, a").first();
    const title = titleLink.text().replace(/\s+/g, " ").trim();
    if (!title || title.length < 2) return;
    const detailsUrl = abs(titleLink.attr("href"));
    const copiesUrl = abs(row.find("a[href*='#copies'], a:contains('עותקים')").first().attr("href")) || detailsUrl;
    const cover = abs(row.find(".images img, img").first().attr("src"));

    const text = row.text().replace(/\s+/g, " ").trim();
    const author = text.match(/מחברים?:\s*([^<\n\r]+?)(?:\s+מס'|\s+סימן|$)/)?.[1]?.trim();
    const shelfMark = text.match(/סימן מדף:\s*([^<\n\r]+?)(?:\s+מס'|\s+עותקים|$)/)?.[1]?.trim();
    const classification = text.match(/מס' מיון:\s*([^<\n\r]+?)(?:\s+סימן|$)/)?.[1]?.trim();
    const year = text.match(/(?:19|20)\d{2}/)?.[0];
    const titleId = detailsUrl?.match(/titleId=([^&#]+)/)?.[1];

    out.push({ title, author, shelfMark, classification, year, detailsUrl, copiesUrl, coverImageUrl: cover, rawText: text, titleId });
  });

  const unique = new Map<string, CatalogResult>();
  for (const r of out) unique.set(`${r.title}|${r.titleId || r.detailsUrl || ""}`, r);
  return Array.from(unique.values()).slice(0, 100);
}

async function postAndParse(url: string, body: URLSearchParams): Promise<CatalogResult[]> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, cache: "no-store" });
  if (!res.ok) return [];
  return parseResults(await res.text());
}

export async function searchCatalog(query: string, column: SearchColumn): Promise<CatalogResult[]> {
  const token = await getComplexToken();
  let results = await postAndParse(COMPLEX_RESULTS_URL, buildComplexPayload(query, column, token));

  // fallback to older/simple endpoint if complex returns generic/default page
  if (results.length === 0 || results.every((r) => !r.rawText?.includes(query))) {
    results = await postAndParse(SIMPLE_RESULTS_URL, buildSimplePayload(query, column));
  }

  return results;
}

function parseCopies(html: string): CopyItem[] {
  const $ = cheerio.load(html);
  const copies: CopyItem[] = [];
  $("#copies tr, table tr").each((_, tr) => {
    const tds = $(tr).find("td");
    if (tds.length < 2) return;
    const location = $(tds[1]).text().replace(/\s+/g, " ").trim();
    const status = $(tds[tds.length - 1]).text().replace(/\s+/g, " ").trim();
    if (!location && !status) return;
    copies.push({ location: location || "לא צוין", status: status || "לא צוין" });
  });
  return copies;
}

function parseTitleDetails(html: string): TitleDetails {
  const $ = cheerio.load(html);
  const text = $("body").text().replace(/\s+/g, " ").trim();
  const description = [
    "#description",
    ".description",
    ".title-details .well",
    ".item-page .well",
    "[itemprop='description']"
  ]
    .map((s) => $(s).first().text().replace(/\s+/g, " ").trim())
    .find((v) => v.length > 40) || text.match(/(?:תקציר|תיאור)\s*[:\-]?\s*(.{40,1000})/)?.[1]?.trim();

  const publisher = text.match(/(?:הוצאה|מו"ל|Publisher)\s*[:\-]?\s*([^|,.]{2,100})/)?.[1]?.trim();
  const publicationYear = text.match(/(?:שנת הוצאה|שנה)\s*[:\-]?\s*((?:19|20)\d{2})/)?.[1] || text.match(/(?:19|20)\d{2}/)?.[0];
  const subjects = Array.from(new Set((text.match(/(?:נושא|מילות מפתח)\s*[:\-]?\s*([^|]{2,200})/g) || []).map((s) => s.replace(/.*[:\-]\s*/, "").trim())));

  return { description, publisher, publicationYear, subjects };
}

export async function getCopiesForTitle(input: { detailsUrl?: string; copiesUrl?: string }): Promise<{ copies: CopyItem[]; total: number; available: number; details: TitleDetails }> {
  const target = input.copiesUrl || input.detailsUrl;
  if (!target) return { copies: [], total: 0, available: 0, details: {} };

  const res = await fetch(target, { cache: "no-store" });
  if (!res.ok) throw new Error(`Copies request failed with ${res.status}`);
  const html = await res.text();

  const copies = parseCopies(html);
  const available = copies.filter((c) => /זמין|פנוי|available|on shelf|במדף/i.test(c.status)).length;

  let details = parseTitleDetails(html);
  if ((!details.description || !details.publisher) && input.detailsUrl && input.detailsUrl !== target) {
    const dr = await fetch(input.detailsUrl, { cache: "no-store" });
    if (dr.ok) details = { ...details, ...parseTitleDetails(await dr.text()) };
  }

  return { copies, total: copies.length, available, details };
}
