export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import * as cheerio from "cheerio";

function sanitizeUrl(raw: string): string | null {
  const cleaned = raw.replace(/[\r\n\t ]+/g, "").trim();
  if (!/^https?:\/\//i.test(cleaned)) return null;
  return cleaned;
}

export async function GET(request: NextRequest) {
  const rawUrl = request.nextUrl.searchParams.get("url") || "";
  const mode = request.nextUrl.searchParams.get("mode") || "details";
  const url = sanitizeUrl(rawUrl);

  if (!url) return NextResponse.json({ error: "קישור לא תקין." }, { status: 400 });

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LodCatalogProxy/1.0)",
        "Accept-Language": "he-IL,he;q=0.9,en;q=0.7",
      },
      cache: "no-store",
    });

    if (!res.ok) return NextResponse.json({ error: "לא ניתן לטעון את פרטי הרשומה כרגע." }, { status: 502 });

    const html = await res.text();
    const $ = cheerio.load(html);

    if (mode === "copies") {
      const rows: string[] = [];
      $("#copies tr, .copies tr, table tr").each((_, tr) => {
        const t = $(tr).text().replace(/\s+/g, " ").trim();
        if (t && !/פרטים נוספים|SCROLL_TO_TOP/i.test(t)) rows.push(t);
      });
      return NextResponse.json({ mode: "copies", lines: rows.slice(0, 60) });
    }

    const lines: string[] = [];
    $(".title-details, .record, .details, .content, h1, h2, h3, p, li").each((_, el) => {
      const t = $(el).text().replace(/\s+/g, " ").trim();
      if (t && t.length > 2 && !/SCROLL_TO_TOP|פרטים נוספים/i.test(t)) lines.push(t);
    });

    const unique = Array.from(new Set(lines));
    return NextResponse.json({ mode: "details", lines: unique.slice(0, 80) });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: "אירעה שגיאה זמנית בטעינת המידע." }, { status: 502 });
  }
}
