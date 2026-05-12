import { getTranslations } from 'next-intl/server'

export async function ManifestoStrip() {
  const t = await getTranslations('landing.manifesto')

  return (
    <div className="w-full bg-muted py-8">
      <p className="mx-auto max-w-4xl px-6 text-center text-lg font-medium italic leading-relaxed text-muted-foreground lg:text-xl">
        {t('quote')}
      </p>
    </div>
  )
}
