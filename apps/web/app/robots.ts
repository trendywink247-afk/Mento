import type { MetadataRoute } from 'next'

const base = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? 'https://mento.in'

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
          '/admin',
          '/api',
          '/(auth)',
          '/(app)',
          '/onboarding/welcome',
          '/onboarding/mirror',
          '/onboarding/mentor',
          '/onboarding/submitted',
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  }
}
