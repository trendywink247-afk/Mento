const FAQ_ITEMS = [
  {
    q: 'How does anonymity work?',
    a: 'You never see or share a real name or photo. Your profile is a single letter on a coloured tile, plus a randomly generated handle (e.g., Aspirant_8421). Mentors are the same. Our platform is built so that honesty is possible precisely because your identity is never at stake.',
  },
  {
    q: 'How are mentors verified?',
    a: 'Mentors submit their Mains hall ticket (required) and marks sheet (optional) plus an Aadhaar verification. Our team reviews each application manually before granting access. Verified mentors receive a purple tick on their avatar.',
  },
  {
    q: 'What does it cost?',
    a: 'Mento has four tiers: FREE (discovery only), BASIC (₹399/mo — open chat + personal journals), PRO (₹599/mo — priority in mentor feed + broadcast requests), and MAX (₹999/mo — 1:1 session credits + verified-mentor priority). Pricing is in validation; your first conversation is always free.',
  },
  {
    q: 'Is this a coaching institute?',
    a: 'No. Emphatically not. Mento is not coaching, not content, not a doubt-clearing service. We are one human who has walked a hard path turning around to hold a light for the person still walking it. No study material. No recorded lectures. No mock tests.',
  },
  {
    q: 'What happens if I share personal details?',
    a: 'Both parties are banned immediately, with no refund. This is a hard rule — not a guideline. The platform is anonymous because anonymity is the infrastructure that makes honest conversation possible. Breaking it breaks the platform for everyone.',
  },
  {
    q: 'Can I be a mentor and an aspirant at the same time?',
    a: 'Yes. If you have cleared Prelims at least once, you are eligible to mentor someone at an earlier stage while still preparing yourself. The platform will show you both a Mentees tab and a Mentors tab so you can operate in both roles.',
  },
]

export function FaqSection() {
  return (
    <section className="bg-slate-50 py-24">
      <div className="mx-auto max-w-3xl px-6">
        <div className="mb-12 text-center">
          <h2 className="text-display-lg font-semibold text-slate-900">
            Frequently asked questions
          </h2>
        </div>

        <div className="space-y-3">
          {FAQ_ITEMS.map((item) => (
            <details
              key={item.q}
              className="group rounded-xl border border-slate-200 bg-white px-6 py-5 transition-shadow open:shadow-sm"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-sm font-semibold text-slate-900 marker:hidden [&::-webkit-details-marker]:hidden">
                {item.q}
                {/* Chevron indicator */}
                <span className="flex-shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M4 6l4 4 4-4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-slate-500">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
