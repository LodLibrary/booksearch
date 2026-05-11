export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") || "").trim();
  const column = (request.nextUrl.searchParams.get("column") || "0").trim();

  // TODO: Inspect legacy Agron checkKeyPress() implementation and wire to real endpoint if discovered.
  // Keeping shape stable so UI autocomplete can be enabled without breaking changes.
  if (q.length < 2) {
    return NextResponse.json({ suggestions: [] });
  }

  return NextResponse.json({ suggestions: [], meta: { column, source: "not-configured" } });
}
