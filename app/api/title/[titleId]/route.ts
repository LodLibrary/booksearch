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

    const fields: Array<{ label: string; value: string }> = [];
    const pushField = (label: string, value: string) => {
      const l = label.replace(/\s+/g, " ").trim();
      const v = value.replace(/\s+/g, " ").trim();
      if (!l || !v) return;
      if (!fields.find((f) => f.label === l && f.value === v)) fields.push({ label: l, value: v });
    };

    // 1) Parse semantic label/value rows if they exist.
    $("dt, .field-label, th").each((_, el) => {
      const label = $(el).text().replace(/:$/, "").trim();
      const value =
        $(el).next("dd").text().trim() ||
        $(el).closest("tr").find("td").last().text().trim() ||
        $(el).parent().find(".field-value").first().text().trim();
      if (label && value) pushField(label, value);
    });

    // 2) Parse free text blocks with line-based "Label: Value".
    $(".title-details, .record, .details, .content, .item-page").find("br").replaceWith("\n");
    const blockText = $(".title-details, .record, .details, .content, .item-page")
      .map((_, el) => $(el).text())
      .get()
      .join("\n");
    blockText
      .split("\n")
      .map((x) => x.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .forEach((line) => {
        const m = line.match(/^([^:]{2,40})\s*:\s*(.+)$/);
        if (m) pushField(m[1], m[2]);
      });

    let description = "";
    const descriptionNode = $(".summary, .description, .abstract, .item-introtext, .notes, .title-details")
      .filter((_, el) => /תיאור|תקציר|תוכן|Summary|Description/i.test($(el).text()))
      .first();
    if (descriptionNode.length) {
      description = descriptionNode.text().replace(/\s+/g, " ").trim();
    }

    const copies: string[] = [];
    const copiesStructured: Array<{
      status?: string;
      location?: string;
      classification?: string;
      shelfMark?: string;
      volume?: string;
    }> = [];
    $("#copies tr, .copies tr, table tr").each((_, tr) => {
      const cells = $(tr)
        .find("th,td")
        .map((__, c) => $(c).text().replace(/\s+/g, " ").trim())
        .get()
        .filter(Boolean);
      const t = cells.length > 0 ? cells.join(" | ") : $(tr).text().replace(/\s+/g, " ").trim();
      if (t && !/SCROLL_TO_TOP|פרטים נוספים/i.test(t)) copies.push(t);

      if (cells.length >= 4 && !/מספר|סטטוס|מיקום|ימי השאלה/.test(cells.join(" "))) {
        copiesStructured.push({
          status: cells[1],
          location: cells[2],
          classification: cells[3],
          shelfMark: cells[4],
          volume: cells[5],
        });
      }
    });

    const availableCount = copiesStructured.filter((c) => c.status && !/מושאל|לא זמין|חסר/i.test(c.status)).length;
    return NextResponse.json({
      title: title || "פרטי כותר",
      image,
      fields,
      description,
      copies,
      copiesStructured,
      availableCount,
      detailsUrl,
    });
  } catch {
    return NextResponse.json({ error: "אירעה שגיאה זמנית בטעינת העמוד." }, { status: 502 });
  }
}
