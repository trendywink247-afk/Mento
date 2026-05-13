import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mento/types', '@mento/validation', '@mento/api-client', '@mento/hooks'],
  experimental: { typedRoutes: false },
  // Enable standalone output only when building the Docker image.
  // Setting this in dev mode breaks `pnpm dev` (hot-reload stops working).
  // The Dockerfile sets BUILD_STANDALONE=1 before running `pnpm build`.
  ...(process.env.BUILD_STANDALONE === '1' && { output: 'standalone' }),
  // Fully suppress the "N" dev-tools badge.
  // Next 15 added `buildActivity` + `appIsrStatus` sub-keys; setting all
  // known knobs to false is the safest cross-version approach.
  devIndicators: { appIsrStatus: false, buildActivity: false },
  // Strong security headers in addition to the api's helmet config.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(self), geolocation=()' },
        ],
      },
    ]
  },
}

// Wrap with Sentry only when SENTRY_AUTH_TOKEN is provided (CI / production).
// Without it the build works normally — local dev stays fast and offline-safe.
let wrappedConfig = withNextIntl(nextConfig)

if (process.env.SENTRY_AUTH_TOKEN) {
  const { withSentryConfig } = await import('@sentry/nextjs')
  wrappedConfig = withSentryConfig(wrappedConfig, {
    silent: true,
    org: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
  })
}

export default wrappedConfig
