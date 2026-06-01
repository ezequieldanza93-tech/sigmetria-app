'use server'

import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'
import { LOCALE_COOKIE, isLocale } from '@/i18n/request'

// Cambia el idioma de la app guardándolo en cookie (sin routing por URL).
// 1 año de vigencia. Revalida para que el nuevo locale se aplique.
export async function setLocale(locale: string) {
  if (!isLocale(locale)) return
  const cookieStore = await cookies()
  cookieStore.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
  revalidatePath('/', 'layout')
}
