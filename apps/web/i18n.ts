import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

export default getRequestConfig(async () => {
  // Read locale from NEXT_LOCALE cookie; fall back to English.
  const cookieStore = await cookies()
  const locale = cookieStore.get('NEXT_LOCALE')?.value ?? 'en'

  // For now only 'en' is translated — any other value falls through to English.
  const resolvedLocale = locale === 'en' ? 'en' : 'en'

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const messages = (await import(`./i18n/messages/${resolvedLocale}.json`)).default as any

  return {
    locale: resolvedLocale,
    messages,
  }
})
