import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");

  if (!url) {
    return new NextResponse("Missing URL parameter", { status: 400 });
  }

  try {
    const res = await fetch(url);
    if (!res.ok) {
      return new NextResponse(`Failed to fetch from upstream: ${res.status}`, { status: res.status });
    }

    // Stream the body back but overwrite the restrictive headers from Supabase
    return new NextResponse(res.body, {
      status: 200,
      headers: {
        "Content-Type": "text/html",
        // Setting aggressive cache to improve load speeds for 10MB simulations natively
        "Cache-Control": "public, max-age=31536000, immutable" 
      },
    });
  } catch (error: any) {
    return new NextResponse(`Error proxying simulation: ${error.message}`, { status: 500 });
  }
}
