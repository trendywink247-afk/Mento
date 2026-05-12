import Link from 'next/link'

export function LandingNav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-slate-900">
          Mento
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
        >
          Sign in
        </Link>
      </div>
    </header>
  )
}
