import Link from 'next/link'

export function FinalCta() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-2xl px-6 text-center">
        <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50 px-8 py-14 ring-1 ring-slate-200/60">
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-blue-600">
            Ready to begin?
          </p>
          <h2 className="text-display-lg font-semibold text-slate-900">
            Find the mentor you needed.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base leading-relaxed text-slate-500">
            Someone out there is exactly where you were. You can be the person you needed then.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/onboarding/role"
              className="inline-flex h-12 items-center rounded-lg bg-blue-600 px-10 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              Get started — it&apos;s free
            </Link>
          </div>

          <p className="mt-8 text-xs text-slate-400 italic">We honour the struggle.</p>
        </div>
      </div>
    </section>
  )
}
