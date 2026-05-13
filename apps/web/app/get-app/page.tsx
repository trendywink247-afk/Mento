import type { Metadata } from 'next'
import { DeepLinkBanner } from '@/components/getapp/DeepLinkBanner'

const base = process.env.NEXT_PUBLIC_WEB_BASE_URL ?? 'https://mento.in'

export const metadata: Metadata = {
  title: 'Get Mento on your phone',
  description:
    'Real-time chat with your mentor. Push notifications when they reply. Offline access to your journals.',
  openGraph: {
    title: 'Mento — Get the mobile app',
    description:
      'Real-time chat with your mentor. Push notifications when they reply. Offline access to your journals.',
    type: 'website',
    url: `${base}/get-app`,
    images: [{ url: `${base}/get-app/opengraph-image` }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Mento — Get the mobile app',
    description:
      'Real-time chat with your mentor. Push notifications when they reply. Offline access to your journals.',
    images: [`${base}/get-app/opengraph-image`],
  },
}

/* ─── App-store badge SVGs ───────────────────────────────────────────────────
   These are simplified but accurate representations of the official badges.
   Apple "Download on the App Store" and Google "Get it on Google Play" are
   free to use for app-distribution marketing per Apple HIG and Google brand
   guidelines respectively.
   Replace with official hi-res assets before launch.
──────────────────────────────────────────────────────────────────────────────*/

function AppStoreBadge() {
  return (
    <a
      href="https://apps.apple.com/in/app/mento/id000000000"
      aria-label="Download Mento on the App Store"
      className="inline-block transition-opacity hover:opacity-90 active:opacity-75"
    >
      {/* Apple "Download on the App Store" badge — inline SVG approximation.
          Replace with the official localized badge PNG before launch. */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="160"
        height="54"
        viewBox="0 0 160 54"
        role="img"
        aria-label="Download on the App Store"
      >
        <rect width="160" height="54" rx="10" fill="#000" />
        <rect
          x="0.5"
          y="0.5"
          width="159"
          height="53"
          rx="9.5"
          stroke="#A6A6A6"
          strokeWidth="1"
          fill="none"
        />
        {/* Apple logo mark */}
        <path
          d="M22 17.5c1.6-2 2.7-4.7 2.4-7.5-2.4.1-5.3 1.6-7 3.6-1.5 1.8-2.8 4.6-2.5 7.3 2.7.2 5.5-1.4 7.1-3.4z"
          fill="#fff"
        />
        <path
          d="M24.4 21.3c-3.9-.2-7.3 2.2-9.1 2.2-1.9 0-4.7-2.1-7.8-2-4 .1-7.7 2.3-9.8 5.9-4.2 7.2-1.1 17.9 3 23.8 2 2.9 4.4 6.1 7.6 6 3-.1 4.2-2 7.8-2 3.7 0 4.7 2 7.9 1.9 3.3-.1 5.4-3 7.4-5.9 2.3-3.3 3.3-6.5 3.3-6.7-.1 0-6.4-2.5-6.4-9.7-.1-6.1 5-9 5.2-9.1-2.8-4.1-7.2-4.4-8.1-4.4z"
          fill="#fff"
          transform="translate(-5 -14) scale(0.68)"
        />
        {/* Text labels */}
        <text
          x="54"
          y="22"
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Text', sans-serif"
          fontSize="10"
          fill="#fff"
          letterSpacing="0.2"
        >
          Download on the
        </text>
        <text
          x="54"
          y="38"
          fontFamily="-apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif"
          fontSize="18"
          fontWeight="600"
          fill="#fff"
          letterSpacing="-0.3"
        >
          App Store
        </text>
      </svg>
    </a>
  )
}

function PlayStoreBadge() {
  return (
    <a
      href="https://play.google.com/store/apps/details?id=app.mento"
      aria-label="Get Mento on Google Play"
      className="inline-block transition-opacity hover:opacity-90 active:opacity-75"
    >
      {/* Google "Get it on Google Play" badge — inline SVG approximation.
          Replace with official localized badge PNG before launch. */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="160"
        height="54"
        viewBox="0 0 160 54"
        role="img"
        aria-label="Get it on Google Play"
      >
        <rect width="160" height="54" rx="10" fill="#1a1a2e" />
        <rect
          x="0.5"
          y="0.5"
          width="159"
          height="53"
          rx="9.5"
          stroke="#404060"
          strokeWidth="1"
          fill="none"
        />
        {/* Play triangle — multicolor */}
        <path d="M14 14 l0 26 l13-13z" fill="#4ADE80" />
        <path d="M14 14 l13 13 l9-9 -16-9z" fill="#60A5FA" />
        <path d="M14 40 l13-13 l9 9 -16 9z" fill="#F87171" />
        <path d="M27 27 l9-9 l5 3.5 -5 3.5 -9 2z" fill="#FBBF24" />
        {/* Text labels */}
        <text
          x="50"
          y="22"
          fontFamily="'Google Sans', 'Roboto', sans-serif"
          fontSize="10"
          fill="#ccc"
          letterSpacing="0.2"
        >
          GET IT ON
        </text>
        <text
          x="50"
          y="38"
          fontFamily="'Google Sans', 'Roboto', sans-serif"
          fontSize="17"
          fontWeight="500"
          fill="#fff"
          letterSpacing="-0.2"
        >
          Google Play
        </text>
      </svg>
    </a>
  )
}

/* ─── Screenshot mock carousel ───────────────────────────────────────────────
   Three simplified device-frame SVGs (280×580) with a notch and inline UI
   mockups. No external assets, no Framer Motion — just CSS scroll-snap.
──────────────────────────────────────────────────────────────────────────────*/

function ChatMockup() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="220"
      height="456"
      viewBox="0 0 220 456"
      role="img"
      aria-label="Chat screen mockup"
    >
      {/* Device frame */}
      <rect width="220" height="456" rx="32" fill="#1e293b" />
      {/* Screen */}
      <rect x="6" y="6" width="208" height="444" rx="28" fill="#f8fafc" />
      {/* Notch */}
      <rect x="72" y="6" width="76" height="22" rx="11" fill="#1e293b" />
      {/* Status bar — tiny dots */}
      <circle cx="186" cy="16" r="3" fill="#1e293b" opacity="0.4" />
      <circle cx="176" cy="16" r="3" fill="#1e293b" opacity="0.4" />
      {/* Header bar */}
      <rect x="6" y="28" width="208" height="48" fill="#fff" />
      <circle cx="38" cy="52" r="14" fill="#2563eb" opacity="0.15" />
      <text x="38" y="57" textAnchor="middle" fontSize="12" fontWeight="700" fill="#2563eb">
        M
      </text>
      <text x="62" y="49" fontSize="11" fontWeight="600" fill="#0f172a">
        M_stargazer
      </text>
      <text x="62" y="63" fontSize="9" fill="#64748b">
        Mentor · IFS 2021
      </text>
      {/* Chat bubbles — mentor */}
      <rect x="18" y="92" width="130" height="36" rx="14" fill="#e2e8f0" />
      <text x="28" y="108" fontSize="9" fill="#0f172a">
        How is your optional going?
      </text>
      <text x="28" y="121" fontSize="9" fill="#0f172a">
        Focus on answer writing daily.
      </text>
      {/* Chat bubble — user */}
      <rect x="70" y="138" width="134" height="28" rx="14" fill="#2563eb" />
      <text x="82" y="150" fontSize="9" fill="#fff">
        Trying, but consistency is hard.
      </text>
      <text x="82" y="161" fontSize="9" fill="#fff">
        Any tips?
      </text>
      {/* Mentor response */}
      <rect x="18" y="178" width="120" height="44" rx="14" fill="#e2e8f0" />
      <text x="28" y="194" fontSize="9" fill="#0f172a">
        Start with 1 answer/day.
      </text>
      <text x="28" y="207" fontSize="9" fill="#0f172a">
        Timer: 7 mins. No re-reads.
      </text>
      <text x="28" y="217" fontSize="9" fill="#64748b">
        I did this for 6 months.
      </text>
      {/* Input bar */}
      <rect x="6" y="404" width="208" height="46" fill="#fff" />
      <rect x="14" y="414" width="156" height="26" rx="13" fill="#f1f5f9" />
      <text x="32" y="431" fontSize="9" fill="#94a3b8">
        Reply...
      </text>
      <circle cx="196" cy="427" r="12" fill="#2563eb" />
      <path
        d="M190 427 l8 0 M194 423 l4 4 -4 4"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}

function MentorMockup() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="220"
      height="456"
      viewBox="0 0 220 456"
      role="img"
      aria-label="Mentor profile screen mockup"
    >
      {/* Device frame */}
      <rect width="220" height="456" rx="32" fill="#1e293b" />
      {/* Screen */}
      <rect x="6" y="6" width="208" height="444" rx="28" fill="#f8fafc" />
      {/* Notch */}
      <rect x="72" y="6" width="76" height="22" rx="11" fill="#1e293b" />
      {/* Hero gradient top */}
      <rect x="6" y="28" width="208" height="100" fill="#2563eb" opacity="0.08" />
      {/* Big avatar */}
      <circle cx="110" cy="88" r="34" fill="#2563eb" opacity="0.15" />
      <circle cx="110" cy="88" r="30" fill="#dbeafe" />
      <text x="110" y="95" textAnchor="middle" fontSize="22" fontWeight="700" fill="#2563eb">
        S
      </text>
      {/* Purple tick */}
      <circle cx="134" cy="68" r="8" fill="#7c3aed" />
      <path
        d="M130 68 l3 3 5-5"
        stroke="#fff"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Handle + tag */}
      <text x="110" y="142" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0f172a">
        S_sunflower42
      </text>
      <text x="110" y="158" textAnchor="middle" fontSize="10" fill="#64748b">
        IAS 2019 · Geography optional
      </text>
      {/* Stats row */}
      <rect x="18" y="170" width="56" height="40" rx="8" fill="#fff" />
      <text x="46" y="188" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">
        4.2k
      </text>
      <text x="46" y="202" textAnchor="middle" fontSize="8" fill="#64748b">
        sessions
      </text>
      <rect x="82" y="170" width="56" height="40" rx="8" fill="#fff" />
      <text x="110" y="188" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">
        97%
      </text>
      <text x="110" y="202" textAnchor="middle" fontSize="8" fill="#64748b">
        helpful
      </text>
      <rect x="146" y="170" width="56" height="40" rx="8" fill="#fff" />
      <text x="174" y="188" textAnchor="middle" fontSize="14" fontWeight="700" fill="#0f172a">
        3 yrs
      </text>
      <text x="174" y="202" textAnchor="middle" fontSize="8" fill="#64748b">
        mentoring
      </text>
      {/* Bio */}
      <text x="18" y="230" fontSize="10" fontWeight="600" fill="#0f172a">
        About
      </text>
      <text x="18" y="246" fontSize="9" fill="#475569">
        Cleared Mains twice before cracking it. I know
      </text>
      <text x="18" y="259" fontSize="9" fill="#475569">
        the grind. DM me about optionals, essay, or
      </text>
      <text x="18" y="272" fontSize="9" fill="#475569">
        just staying sane during prep.
      </text>
      {/* Request button */}
      <rect x="18" y="390" width="184" height="40" rx="10" fill="#2563eb" />
      <text x="110" y="415" textAnchor="middle" fontSize="12" fontWeight="600" fill="#fff">
        Send mentorship request
      </text>
    </svg>
  )
}

function JournalMockup() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="220"
      height="456"
      viewBox="0 0 220 456"
      role="img"
      aria-label="Journal entry screen mockup"
    >
      {/* Device frame */}
      <rect width="220" height="456" rx="32" fill="#1e293b" />
      {/* Screen */}
      <rect x="6" y="6" width="208" height="444" rx="28" fill="#f8fafc" />
      {/* Notch */}
      <rect x="72" y="6" width="76" height="22" rx="11" fill="#1e293b" />
      {/* Header */}
      <rect x="6" y="28" width="208" height="44" fill="#fff" />
      <text x="26" y="55" fontSize="16" fontWeight="700" fill="#0f172a">
        My Journal
      </text>
      <rect x="174" y="36" width="28" height="28" rx="8" fill="#f1f5f9" />
      <text x="188" y="55" textAnchor="middle" fontSize="16" fill="#2563eb">
        +
      </text>
      {/* Entry card 1 — today */}
      <rect x="14" y="86" width="192" height="90" rx="12" fill="#fff" />
      <rect x="14" y="86" width="4" height="90" rx="2" fill="#2563eb" />
      <text x="28" y="106" fontSize="10" fontWeight="600" fill="#0f172a">
        Day 142 — Polity revision
      </text>
      <text x="28" y="120" fontSize="8" fill="#64748b">
        Today · Private
      </text>
      <text x="28" y="138" fontSize="9" fill="#475569">
        Finished Laxmikanth Ch 22-25. The Centre-State
      </text>
      <text x="28" y="151" fontSize="9" fill="#475569">
        relations section finally clicked. Wrote 3 PYQs
      </text>
      <text x="28" y="164" fontSize="9" fill="#475569">
        on federalism — mentor said structure looks good.
      </text>
      {/* Entry card 2 */}
      <rect x="14" y="188" width="192" height="78" rx="12" fill="#fff" />
      <rect x="14" y="188" width="4" height="78" rx="2" fill="#7c3aed" />
      <text x="28" y="208" fontSize="10" fontWeight="600" fill="#0f172a">
        Day 138 — Mock test analysis
      </text>
      <text x="28" y="222" fontSize="8" fill="#64748b">
        4 days ago · Shared with mentor
      </text>
      <text x="28" y="240" fontSize="9" fill="#475569">
        Scored 112/200. Lost marks in Environment and
      </text>
      <text x="28" y="253" fontSize="9" fill="#475569">
        Economy. Targeting 130+ next attempt.
      </text>
      {/* Entry card 3 */}
      <rect x="14" y="278" width="192" height="66" rx="12" fill="#fff" />
      <rect x="14" y="278" width="4" height="66" rx="2" fill="#0891b2" />
      <text x="28" y="298" fontSize="10" fontWeight="600" fill="#0f172a">
        Day 130 — Why I chose UPSC
      </text>
      <text x="28" y="312" fontSize="8" fill="#64748b">
        12 days ago · Private
      </text>
      <text x="28" y="328" fontSize="9" fill="#475569">
        A reflection on my motivation. Re-reading this on
      </text>
      <text x="28" y="339" fontSize="9" fill="#475569">
        hard days helps me stay grounded.
      </text>
      {/* Bottom nav stub */}
      <rect x="6" y="418" width="208" height="32" rx="0" fill="#fff" />
      <rect x="6" y="418" width="208" height="1" fill="#e2e8f0" />
      <circle cx="62" cy="434" r="6" fill="#f1f5f9" />
      <circle cx="110" cy="434" r="6" fill="#2563eb" opacity="0.2" />
      <circle cx="110" cy="434" r="3" fill="#2563eb" />
      <circle cx="158" cy="434" r="6" fill="#f1f5f9" />
    </svg>
  )
}

/* ─── Page ────────────────────────────────────────────────────────────────── */

export default function GetAppPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* ── Brand band ──────────────────────────────────────────────────── */}
      <header className="flex h-16 items-center justify-between border-b border-border px-6">
        <div className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-foreground">Mento</span>
        </div>
        <p className="hidden text-sm text-muted-foreground sm:block">We honour the struggle.</p>
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main id="main" className="mx-auto max-w-6xl px-6 py-12 md:py-20">
        <div className="flex flex-col gap-12 md:flex-row md:items-center md:gap-16">
          {/* Hero — left on md+ */}
          <section className="flex-1 text-center md:text-left">
            <h1 className="text-display-lg font-bold tracking-tight text-foreground">
              Get Mento on your phone.
            </h1>

            <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
              Real-time chat with your mentor. Push notifications when they reply. Offline access to
              your journals.
            </p>

            {/* Store badges */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 md:justify-start">
              <AppStoreBadge />
              <PlayStoreBadge />
            </div>

            {/* QR code — for desktop visitors */}
            <div className="mt-10 hidden md:block">
              <p className="mb-3 text-sm font-medium text-muted-foreground">Scan to install</p>
              {/* QR code via free QR Server API — no external dependency, just an img */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https%3A%2F%2Fmento.app%2Finstall&color=1e293b&bgcolor=ffffff&margin=10"
                alt="QR code — scan with your phone camera to install Mento"
                width={160}
                height={160}
                className="rounded-xl border border-border shadow-card"
                loading="lazy"
                decoding="async"
              />
            </div>

            {/* Deep-link — client component to avoid SSR mismatch */}
            <DeepLinkBanner />
          </section>

          {/* Screenshot carousel — right on md+, below on mobile */}
          <section aria-label="App screenshots" className="w-full overflow-hidden md:w-auto">
            <div
              className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 md:overflow-x-visible md:pb-0"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}
            >
              {/* Card 1 — Chat */}
              <div className="flex-none snap-center">
                <div className="flex flex-col items-center gap-3">
                  <ChatMockup />
                  <p className="text-xs font-medium text-muted-foreground">Real-time chat</p>
                </div>
              </div>
              {/* Card 2 — Mentor profile */}
              <div className="flex-none snap-center">
                <div className="flex flex-col items-center gap-3">
                  <MentorMockup />
                  <p className="text-xs font-medium text-muted-foreground">Verified mentors</p>
                </div>
              </div>
              {/* Card 3 — Journal */}
              <div className="flex-none snap-center">
                <div className="flex flex-col items-center gap-3">
                  <JournalMockup />
                  <p className="text-xs font-medium text-muted-foreground">Private journals</p>
                </div>
              </div>
            </div>

            {/* Scroll hint on mobile */}
            {/* TODO(badges): replace inline-SVG approximations with official PNGs before app-store submission */}
            <p className="mt-2 text-center text-xs text-muted-foreground md:hidden">
              Swipe to see more screens
            </p>
          </section>
        </div>

        {/* QR code repeated on mobile (below fold) */}
        <div className="mt-12 flex flex-col items-center gap-3 md:hidden">
          <p className="text-sm font-medium text-muted-foreground">Scan to install</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=https%3A%2F%2Fmento.app%2Finstall&color=1e293b&bgcolor=ffffff&margin=10"
            alt="QR code — scan with your phone camera to install Mento"
            width={160}
            height={160}
            className="rounded-xl border border-border shadow-card"
            loading="lazy"
            decoding="async"
          />
        </div>
      </main>

      {/* ── Slim footer ─────────────────────────────────────────────────── */}
      <footer className="border-t border-border px-6 py-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Mento Technologies Pvt. Ltd.</span>
          <nav className="flex gap-4">
            <a href="/privacy" className="transition-colors hover:text-foreground">
              Privacy
            </a>
            <a href="/terms" className="transition-colors hover:text-foreground">
              Terms
            </a>
            <a href="mailto:hello@mento.app" className="transition-colors hover:text-foreground">
              Contact
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
