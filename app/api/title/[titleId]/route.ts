export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

const BASE = "https://lod.library.org.il";

function normalize(src?: string): string | undefined {
  if (!src) return undefined;
  const cleaned = src.replace(/[\r\n\t ]+/g, "").trim();
  if (!cleaned) return undefined;
  try { return new URL(cleaned, BASE).toString(); } catch { return undefined; }
}

export async function GET(_: NextRequest, { params }: { params: { titleId: string } }) {
  const titleId = params.titleId?.trim();
  if (!titleId) return NextResponse.json({ error: "מזהה כותר חסר." }, { status: 400 });

  const detailsUrl = `${BASE}/agron-catalog/search-results-menu?view=details&titleId=${encodeURIComponent(titleId)}`;
  try {
    const res = await fetch(detailsUrl, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) return NextResponse.json({ error: "לא ניתן לטעון את עמוד הפרטים." }, { status: 502 });
    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $("h1, h2, .title h3, .title-details h3").first().text().replace(/\s+/g, " ").trim();
    const image = normalize($('img[id^="image"]').first().attr("src") || $(".images img").first().attr("src"));

    const fields: Array<{label:string; value:string}> = [];
    $(".title-details, .record, .details, .content").first().find("br").replaceWith("\n");
    const block = $(".title-details, .record, .details, .content").first().text();
    block.split("\n").map((x)=>x.replace(/\s+/g," ").trim()).filter(Boolean).forEach((line)=>{
      const m = line.match(/^([^:]{2,30})\s*:\s*(.+)$/);
      if (m) fields.push({label:m[1], value:m[2]});
    });

    const copies: string[] = [];
    $("#copies tr, .copies tr").each((_, tr) => {
      const t = $(tr).text().replace(/\s+/g, " ").trim();
      if (t) copies.push(t);
    });

    return NextResponse.json({ title: title || "פרטי כותר", image, fields, copies, detailsUrl });
  } catch {
    return NextResponse.json({ error: "אירעה שגיאה זמנית בטעינת העמוד." }, { status: 502 });
  }
}
