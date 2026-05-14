import type { MetadataRoute } from 'next'

const base = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? 'https://ai.geekspace.space'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: [
          '/',
          '/pricing',
          '/get-app',
          '/onboarding/role',
          '/privacy',
          '/terms',
          '/refund-policy',
        ],
        disallow: [
          // Admin shell + its tools
          '/admin',
          '/admin/',
          // Internal API
          '/api',
          // Auth pages (real URLs — (auth) is a Next.js route group, not a path segment)
          '/login',
          '/otp',
          // Authenticated app shell — every (app) route under here
          '/dashboard',
          '/chat',
          '/mentors',
          '/mentees',
          '/journals',
          '/calls',
          '/wallet',
          '/availability',
          '/upgrade',
          // Mid-flow onboarding steps that shouldn't be indexed
          '/onboarding/welcome',
          '/onboarding/mirror',
          '/onboarding/mentor',
          '/onboarding/credentials',
          '/onboarding/submitted',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
