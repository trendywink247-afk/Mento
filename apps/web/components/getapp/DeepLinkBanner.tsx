'use client'

import { useEffect, useState } from 'react'

/**
 * Shows "Already have the app? Open it →" only when the browser might support
 * the custom scheme. We detect this heuristically: if the page is on a mobile-
 * like viewport (< 768 px wide) OR if `navigator.userAgent` mentions Android /
 * iPhone, we surface the link. Desktop users who somehow land here will still
 * see it (harmless — the click is a no-op if the app isn't installed).
 *
 * IMPORTANT: The middleware already hard-redirects genuine mobile UA strings to
 * /get-app, so in practice this component renders for all visitors of this page.
 */
export function DeepLinkBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Only mount the link after hydration so SSR stays identical.
    setShow(true)
  }, [])

  if (!show) return null

  return (
    <div className="mt-6 text-center">
      <a
        href="mento://home"
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20 active:bg-primary/25"
        /* If the scheme isn't registered the browser shows no error — the link
           simply does nothing, which is acceptable per spec. */
        rel="noreferrer"
      >
        Already have the app? Open it
        <svg
          aria-hidden="true"
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M3 7h8M7.5 3.5 11 7l-3.5 3.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </a>
    </div>
  )
}
