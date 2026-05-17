import { NextRequest, NextResponse } from "next/server";
import { getCopiesForTitle } from "@/lib/agron";

export async function GET(request: NextRequest) {
  const detailsUrl = (request.nextUrl.searchParams.get("detailsUrl") || "").trim();
  const copiesUrl = (request.nextUrl.searchParams.get("copiesUrl") || "").trim();

  if (!detailsUrl && !copiesUrl) {
    return NextResponse.json({ error: "חסר קישור לפרטי כותר." }, { status: 400 });
  }

  try {
    const data = await getCopiesForTitle({ detailsUrl: detailsUrl || undefined, copiesUrl: copiesUrl || undefined });
    return NextResponse.json(data);
  } catch (error) {
    console.error("Copies route failed", error);
    return NextResponse.json({ error: "לא ניתן לטעון נתוני עותקים כרגע." }, { status: 502 });
  }
}
