/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mento/types', '@mento/validation', '@mento/api-client', '@mento/hooks'],
  experimental: { typedRoutes: false },
  // Hide the "N" dev-tools badge that was leaking into screenshots.
  devIndicators: { position: 'bottom-right', appIsrStatus: false },
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

export default nextConfig
