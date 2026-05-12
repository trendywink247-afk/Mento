const NOT_LABELS = [
  'Not a coaching institute',
  'Not a content platform',
  'Not a doubt service',
  'Not therapy',
  'Not a social network',
  'Not a leaderboard',
]

export function WhatMentoIsNot() {
  return (
    <section className="bg-white py-24">
      <div className="mx-auto max-w-6xl px-6 text-center">
        <h2 className="text-display-lg font-semibold text-slate-900">What Mento is NOT</h2>
        <p className="mx-auto mt-3 max-w-lg text-base text-slate-500">
          Every feature decision passes this filter. We are one human, anonymously, sitting with
          another.
        </p>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          {NOT_LABELS.map((label) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-5 py-2.5 text-sm font-medium text-slate-600"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
