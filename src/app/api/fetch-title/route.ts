import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const urlParam = searchParams.get('url');

  if (!urlParam) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  try {
    const url = new URL(urlParam);
    
    // Fetch the HTML content
    const response = await fetch(url.toString(), {
      headers: {
        'User-Agent': 'LearnTube-Bot/1.0',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      // 5 second timeout to prevent hanging
      signal: AbortSignal.timeout(5000)
    });

    if (!response.ok) {
      return NextResponse.json({ title: null, error: `HTTP ${response.status}` });
    }

    const html = await response.text();
    
    // Extract the <title> tag using regex
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    let title = null;
    
    if (titleMatch && titleMatch[1]) {
      // Decode HTML entities (basic)
      title = titleMatch[1]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();
    }

    return NextResponse.json({ title });
  } catch (err: any) {
    console.error('[FETCH_TITLE] Error fetching title for', urlParam, err);
    return NextResponse.json({ title: null, error: err.message });
  }
}
