import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing URL parameter", { status: 400 });
  }

  // Forward conditional headers to Supabase Storage
  const headers: Record<string, string> = {};
  const ifNoneMatch = request.headers.get("if-none-match");
  const ifModifiedSince = request.headers.get("if-modified-since");

  if (ifNoneMatch) headers["if-none-match"] = ifNoneMatch;
  if (ifModifiedSince) headers["if-modified-since"] = ifModifiedSince;

  try {
    const res = await fetch(url, { headers });

    // Handle 304 Not Modified from upstream
    if (res.status === 304) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          "Cache-Control": "public, max-age=3600, must-revalidate",
          ...(res.headers.get("etag") ? { "ETag": res.headers.get("etag")! } : {}),
          ...(res.headers.get("last-modified") ? { "Last-Modified": res.headers.get("last-modified")! } : {}),
        },
      });
    }

    if (!res.ok) {
      return new NextResponse(`Failed to fetch from upstream: ${res.status}`, { status: res.status });
    }

    // Read headers from upstream
    const etag = res.headers.get("etag");
    const lastModified = res.headers.get("last-modified");

    const responseHeaders: Record<string, string> = {
      "Content-Type": "text/html",
      "Cache-Control": "public, max-age=3600, must-revalidate",
    };

    if (etag) responseHeaders["ETag"] = etag;
    if (lastModified) responseHeaders["Last-Modified"] = lastModified;

    // Stream the body back
    return new NextResponse(res.body, {
      status: 200,
      headers: responseHeaders,
    });
  } catch (error: any) {
    return new NextResponse(`Error proxying simulation: ${error.message}`, { status: 500 });
  }
}
