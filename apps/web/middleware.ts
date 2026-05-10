import { NextResponse, type NextRequest } from 'next/server'

const MOBILE_UA = /Android|iPhone|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i

// Paths that mobile UAs may access (well-known + the redirect destination itself).
const MOBILE_ALLOWED = ['/get-app', '/.well-known', '/_next', '/favicon.ico']

// Allow search-engine crawlers through so SEO still works.
const CRAWLER_UA = /Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|facebot|ia_archiver/i

export function middleware(req: NextRequest) {
  const ua = req.headers.get('user-agent') ?? ''
  const path = req.nextUrl.pathname

  if (CRAWLER_UA.test(ua)) return NextResponse.next()
  if (!MOBILE_UA.test(ua)) return NextResponse.next()
  if (MOBILE_ALLOWED.some((p) => path.startsWith(p))) return NextResponse.next()

  const url = req.nextUrl.clone()
  url.pathname = '/get-app'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    // Apply to everything except static assets and the well-known endpoints.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
