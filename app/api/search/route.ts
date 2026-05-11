export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { searchCatalog, type SearchColumn } from "../../../lib/agron";

const VALID_COLUMNS = new Set(["0", "1", "2"]);

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const column = (request.nextUrl.searchParams.get("column") || "0").trim() as SearchColumn;

  if (!q || q.length < 2) {
    return NextResponse.json({ error: "שאילתה קצרה מדי." }, { status: 400 });
  }

  if (!VALID_COLUMNS.has(column)) {
    return NextResponse.json({ error: "סוג חיפוש לא תקין." }, { status: 400 });
  }

  try {
    const results = await searchCatalog(q, column);
    return NextResponse.json({ results });
  } catch (error) {
    console.error("Search route failed", error);
    return NextResponse.json(
      { error: "אירעה שגיאה זמנית בחיפוש. נסו שוב בעוד רגע." },
      { status: 502 }
    );
  }
}
