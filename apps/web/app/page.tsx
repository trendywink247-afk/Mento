import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-10 py-12">
      <div className="space-y-4 text-center">
        <h1 className="text-5xl font-semibold tracking-tight">Mento</h1>
        <p className="max-w-xl text-lg leading-relaxed text-muted-foreground">
          Anonymous, peer-led mentorship for the UPSC journey. Built on the principle
          that the person who almost cleared carries the same wisdom as the person who did.
        </p>
      </div>

      <div className="flex flex-col items-center gap-3">
        <Link
          className="rounded-md bg-primary px-8 py-3 text-base font-medium text-primary-foreground hover:opacity-90"
          href="/onboarding/role"
        >
          Get started
        </Link>
        <Link className="text-sm text-muted-foreground hover:underline" href="/login">
          Already a member? Sign in
        </Link>
      </div>

      <p className="absolute bottom-8 text-xs text-muted-foreground">We honour the struggle.</p>
    </main>
  )
}
