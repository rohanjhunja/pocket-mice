import { NextRequest, NextResponse } from 'next/server'

/**
 * Server-side HEAD request to check if a URL can be embedded in an iframe.
 * Checks X-Frame-Options and Content-Security-Policy frame-ancestors headers.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ embeddable: false, reason: 'No URL provided' })
  }

  try {
    // Upgrade http to https
    const targetUrl = url.startsWith('http://') ? url.replace('http://', 'https://') : url

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000)

    const response = await fetch(targetUrl, {
      method: 'HEAD',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EmbedCheck/1.0)',
      },
    })

    clearTimeout(timeout)

    // Check X-Frame-Options
    const xFrameOptions = response.headers.get('x-frame-options')?.toLowerCase()
    if (xFrameOptions === 'deny' || xFrameOptions === 'sameorigin') {
      return NextResponse.json({
        embeddable: false,
        reason: `X-Frame-Options: ${xFrameOptions}`,
        finalUrl: response.url,
      })
    }

    // Check Content-Security-Policy frame-ancestors
    const csp = response.headers.get('content-security-policy')?.toLowerCase()
    if (csp) {
      const frameAncestorsMatch = csp.match(/frame-ancestors\s+([^;]+)/)
      if (frameAncestorsMatch) {
        const ancestors = frameAncestorsMatch[1].trim()
        // If frame-ancestors is 'none' or 'self' only, not embeddable
        if (ancestors === "'none'" || ancestors === "'self'") {
          return NextResponse.json({
            embeddable: false,
            reason: `CSP frame-ancestors: ${ancestors}`,
            finalUrl: response.url,
          })
        }
      }
    }

    // Check if the response indicates an error
    if (!response.ok) {
      return NextResponse.json({
        embeddable: false,
        reason: `HTTP ${response.status}`,
        finalUrl: response.url,
      })
    }

    return NextResponse.json({
      embeddable: true,
      finalUrl: response.url,
    })
  } catch (error: any) {
    return NextResponse.json({
      embeddable: false,
      reason: error.name === 'AbortError' ? 'Timeout' : (error.message || 'Network error'),
    })
  }
}
