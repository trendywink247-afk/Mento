import Link from 'next/link'

const FOOTER_COLS = [
  {
    heading: 'Product',
    links: [
      { label: 'Mentors', href: '/onboarding/role' },
      { label: 'Pricing', href: '/onboarding/role' },
      { label: 'For Mentors', href: '/onboarding/role' },
      { label: 'Get the app', href: '/get-app' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '#' },
      { label: 'Press', href: '#' },
      { label: 'Contact', href: '#' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy', href: '#' },
      { label: 'Terms', href: '#' },
      { label: 'Refunds', href: '#' },
      { label: 'Anonymity policy', href: '#' },
    ],
  },
]

export function LandingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid grid-cols-2 gap-8 lg:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 lg:col-span-1">
            <span className="text-lg font-bold tracking-tight text-slate-900">Mento</span>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
              Anonymous, peer-led mentorship for the UPSC journey. One human, sitting with another.
            </p>
          </div>

          {/* Link columns */}
          {FOOTER_COLS.map((col) => (
            <div key={col.heading}>
              <p className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-400">
                {col.heading}
              </p>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-slate-600 transition-colors hover:text-slate-900"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom row */}
        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 pt-8">
          <div className="flex items-center gap-3">
            {/* Wordmark M */}
            <span className="flex h-6 w-6 items-center justify-center rounded bg-blue-600 text-xs font-bold text-white">
              M
            </span>
            <p className="text-xs text-slate-400">Mento &copy; 2026</p>
          </div>
          <p className="text-xs text-slate-400">Made with care, in India.</p>
        </div>
      </div>
    </footer>
  )
}
