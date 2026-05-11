export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";

function sanitizeExternalUrl(raw: string): string | null {
  const cleaned = raw.replace(/[\r\n\t ]+/g, "").trim();
  if (!cleaned) return null;

  if (!/^https?:\/\//i.test(cleaned)) return null;
  return cleaned;
}

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get("url") || "";
  const source = sanitizeExternalUrl(raw);

  if (!source) {
    return new NextResponse("invalid cover url", { status: 400 });
  }

  try {
    const upstream = await fetch(source, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LodCatalogProxy/1.0)",
        Referer: "https://lod.library.org.il/",
        Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
      cache: "no-store",
    });

    if (!upstream.ok) {
      return new NextResponse("upstream image fetch failed", { status: 502 });
    }

    const bytes = await upstream.arrayBuffer();
    const contentType = upstream.headers.get("content-type") || "image/jpeg";

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("cover proxy failed", error);
    return new NextResponse("cover proxy error", { status: 502 });
  }
}
