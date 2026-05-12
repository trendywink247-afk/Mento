import { Compass, Handshake, MapPin } from 'lucide-react'

const steps = [
  {
    icon: MapPin,
    title: 'Tell us where you are',
    description:
      'Answer an honest self-assessment. The Mirror helps you see your preparation as it truly is — not as you wish it were.',
  },
  {
    icon: Handshake,
    title: 'Match anonymously',
    description:
      'We connect you with a verified mentor who has lived your exact stage of the journey. No photos. No real names.',
  },
  {
    icon: Compass,
    title: 'Walk together',
    description:
      'Open, honest conversations through shared journals and anonymous chat. One human, sitting with another.',
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 bg-white py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-14 text-center">
          <h2 className="text-display-lg font-semibold text-slate-900">How it works</h2>
          <p className="mt-3 text-base text-slate-500">
            Three steps. Honest from the first moment.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {steps.map((step, idx) => {
            const Icon = step.icon
            return (
              <div
                key={step.title}
                className="relative rounded-2xl border border-slate-100 bg-slate-50 p-8 transition-shadow hover:shadow-md"
              >
                {/* Step number */}
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm">
                    <Icon size={18} strokeWidth={2} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    Step {idx + 1}
                  </span>
                </div>
                <h3 className="mb-2 text-lg font-semibold text-slate-900">{step.title}</h3>
                <p className="text-sm leading-relaxed text-slate-500">{step.description}</p>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
