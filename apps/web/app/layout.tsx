import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/components/providers'
import { AnalyticsRouteTracker } from '@/components/AnalyticsRouteTracker'
import './globals.css'

// Inter is the de-facto B2C font (Stripe, Linear, Notion).
// Subset to Latin; `swap` avoids FOIT; expose via CSS var for Tailwind.
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
})

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_WEB_BASE_URL ?? 'http://localhost:3030'),
  title: {
    default: 'Mento — Anonymous UPSC mentorship',
    template: '%s · Mento',
  },
  description:
    'Walk the UPSC path with someone who has been there. Anonymous, verified peer mentors. No coaching pitch.',
  applicationName: 'Mento',
  keywords: ['UPSC', 'mentorship', 'IAS', 'civil services', 'India', 'aspirant', 'mentor'],
  authors: [{ name: 'Mento' }],
  openGraph: {
    type: 'website',
    locale: 'en_IN',
    siteName: 'Mento',
    title: 'Mento — Anonymous UPSC mentorship',
    description: 'Walk the UPSC path with someone who has been there.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mento — Anonymous UPSC mentorship',
    description: 'Walk the UPSC path with someone who has been there.',
  },
  icons: {
    icon: '/icon.svg',
    apple: '/apple-icon.png',
  },
  robots: { index: true, follow: true },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>
          <AnalyticsRouteTracker />
          {children}
        </Providers>
      </body>
    </html>
  )
}
