export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen bg-muted/30">
      {/* Left panel — visible on md+ only */}
      <div className="hidden md:flex md:flex-1 flex-col justify-center px-16 bg-gradient-to-br from-primary/5 via-primary/3 to-transparent border-r border-border">
        <div className="max-w-sm">
          <div className="mb-8">
            <span className="text-2xl font-bold tracking-tight text-foreground">Mento</span>
          </div>
          <h2 className="text-display-lg font-semibold text-foreground leading-tight mb-4">
            We honour<br />the struggle.
          </h2>
          <p className="text-base text-muted-foreground leading-relaxed mb-8">
            Anonymous, peer-led UPSC mentorship.<br />
            Walk with someone who&apos;s been there.
          </p>
          <div className="flex flex-col gap-3">
            <Stat value="10,000+" label="aspirants supported" />
            <Stat value="500+" label="verified mentors" />
            <Stat value="100%" label="anonymous by design" />
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px] rounded-xl border bg-background p-8 shadow-elevated">
          {/* Mobile-only header */}
          <div className="mb-6 text-center md:hidden">
            <h1 className="text-2xl font-semibold tracking-tight">Mento</h1>
            <p className="mt-1 text-sm text-muted-foreground">UPSC mentorship</p>
          </div>
          {/* Desktop header — smaller since panel has the big text */}
          <div className="mb-6 hidden md:block">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="mt-1 text-sm text-muted-foreground">We&apos;ll send a 6-digit code by SMS.</p>
          </div>
          {children}
        </div>
      </div>
    </main>
  )
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-semibold text-primary">{value}</span>
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  )
}
