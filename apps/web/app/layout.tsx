import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages, getLocale } from 'next-intl/server'
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale()
  const messages = await getMessages()

  return (
    <html lang={locale} className={inter.variable}>
      {/*
       * Flash-of-incorrect-theme prevention.
       * This inline script runs synchronously before React hydrates, so the correct
       * dark/light class is on <html> before the first paint.
       * It intentionally lives outside <body> so Next.js does not defer it.
       */}
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('mento.theme');if(t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        {/* Skip-to-content link — visually hidden until focused, per WCAG 2.4.1 */}
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[9999] focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground focus:shadow-lg focus:outline-none"
        >
          Skip to content
        </a>
        <NextIntlClientProvider messages={messages} locale={locale}>
          <Providers>
            <AnalyticsRouteTracker />
            {children}
          </Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
