/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mento/types', '@mento/validation', '@mento/api-client', '@mento/hooks'],
  experimental: {
    typedRoutes: false,
  },
}

export default nextConfig
