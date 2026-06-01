import { getRequestConfig } from 'next-intl/server'
import { cookies } from 'next/headers'

// Idiomas soportados. 'es' es el default (la app está en español).
export const LOCALES = ['es', 'en'] as const
export type Locale = (typeof LOCALES)[number]
export const DEFAULT_LOCALE: Locale = 'es'
export const LOCALE_COOKIE = 'NEXT_LOCALE'

export function isLocale(value: string | undefined | null): value is Locale {
  return value === 'es' || value === 'en'
}

// Configuración i18n basada en COOKIE (sin routing por URL).
// No reestructura rutas ni toca el matcher del middleware.
export default getRequestConfig(async () => {
  const cookieStore = await cookies()
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value
  const locale: Locale = isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  }
})
