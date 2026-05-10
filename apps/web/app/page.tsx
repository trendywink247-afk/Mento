import Link from 'next/link'
import { ApiStatus } from '@/components/ApiStatus'

export default function HomePage() {
  return (
    <main className="container mx-auto flex min-h-screen flex-col items-center justify-center gap-8 py-12">
      <div className="space-y-4 text-center">
        <h1 className="text-5xl font-bold tracking-tight">Mento</h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Personalised UPSC mentorship — connect with toppers, get a daily guidance routine,
          chat in real time.
        </p>
      </div>

      <div className="flex gap-4">
        <Link
          className="rounded-md bg-primary px-6 py-3 text-primary-foreground hover:opacity-90"
          href="/login"
        >
          Get started
        </Link>
        <Link className="rounded-md border px-6 py-3 hover:bg-accent" href="/mentors">
          Browse mentors
        </Link>
      </div>

      <ApiStatus />
    </main>
  )
}
