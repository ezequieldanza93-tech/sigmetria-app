'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useTransition } from 'react'
import { Globe } from 'lucide-react'
import { setLocale } from '@/lib/actions/locale'

const LOCALES: { code: 'es' | 'en'; label: string }[] = [
  { code: 'es', label: 'ES' },
  { code: 'en', label: 'EN' },
]

// Toggle de idioma ES/EN. Persiste en cookie vía server action y refresca.
export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useTranslations('common')
  const [isPending, startTransition] = useTransition()

  function change(code: 'es' | 'en') {
    if (code === locale || isPending) return
    startTransition(() => {
      void setLocale(code)
    })
  }

  return (
    <div className="flex items-center gap-2 px-4 py-2.5">
      <Globe size={16} strokeWidth={1.75} className="text-text-tertiary shrink-0" aria-hidden="true" />
      <span className="text-sm text-text-secondary flex-1">{t('language')}</span>
      <div className="inline-flex rounded-lg border border-border-subtle overflow-hidden" role="group" aria-label={t('language')}>
        {LOCALES.map(l => (
          <button
            key={l.code}
            type="button"
            onClick={() => change(l.code)}
            disabled={isPending}
            aria-pressed={locale === l.code}
            className={`px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
              locale === l.code
                ? 'bg-brand-primary text-white'
                : 'bg-surface-base text-text-secondary hover:bg-surface-elevated'
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>
    </div>
  )
}
