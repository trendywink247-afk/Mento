import { NextResponse, type NextRequest } from 'next/server'

const MOBILE_UA = /Android|iPhone|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i

// Paths that mobile UAs may access (well-known + the redirect destination itself).
const MOBILE_ALLOWED = [
  '/get-app',
  '/.well-known',
  '/_next',
  '/favicon.ico',
  '/api',
]

// Allow search-engine crawlers through so SEO still works.
const CRAWLER_UA = /Googlebot|Bingbot|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|facebot|ia_archiver/i

// TEMPORARY: NEXT_PUBLIC_DISABLE_MOBILE_REDIRECT=1 bypasses the redirect so
// the web app is reachable from mobile UAs (for preview / smoke testing).
// The spec mandates a desktop-only web; re-enable for production launch.
const DISABLE_MOBILE_REDIRECT =
  process.env.NEXT_PUBLIC_DISABLE_MOBILE_REDIRECT === '1'

export function middleware(req: NextRequest) {
  if (DISABLE_MOBILE_REDIRECT) return NextResponse.next()

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
