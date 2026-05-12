import Link from 'next/link'
import { getTranslations } from 'next-intl/server'

export async function LandingNav() {
  const t = await getTranslations('landing.nav')

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-foreground">
          Mento
        </Link>
        <Link
          href="/login"
          className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          {t('signIn')}
        </Link>
      </div>
    </header>
  )
}
