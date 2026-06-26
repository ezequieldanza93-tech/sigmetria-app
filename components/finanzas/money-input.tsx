'use client'

import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import {
  FIN_LOCALE_DEFAULT,
  FIN_MONEDA_DEFAULT,
  formatMontoInput,
  parseMontoInput,
} from '@/lib/finanzas/format'

interface MoneyInputProps {
  /** Valor numérico actual; `null` = vacío. */
  value: number | null
  /** Devuelve el number parseado o `null` si el input quedó vacío. */
  onChange: (value: number | null) => void
  /** ISO 4217 — determina símbolo y decimales. Default 'ARS'. */
  moneda?: string
  /** BCP 47 — separadores de miles/decimales. Default 'es-AR'. */
  locale?: string
  placeholder?: string
  disabled?: boolean
  label?: string
  required?: boolean
  error?: string
  id?: string
  name?: string
}

/**
 * Input de monto controlado y currency-aware.
 *
 * Muestra el monto formateado en vivo ($ + separador de miles + decimales según
 * la moneda; ARS y cía. sin decimales) y emite un `number | null` por `onChange`.
 *
 * El truco para no pelear con el cursor: mientras el campo está enfocado se
 * muestra el texto crudo que el usuario tipea; al perder el foco (blur) se
 * normaliza al formato canónico. Así el tipeo fluye y el resultado queda prolijo.
 */
export function MoneyInput({
  value,
  onChange,
  moneda = FIN_MONEDA_DEFAULT,
  locale = FIN_LOCALE_DEFAULT,
  placeholder,
  disabled,
  label,
  required,
  error,
  id,
  name,
}: MoneyInputProps) {
  const [focused, setFocused] = useState(false)
  // Texto crudo mientras se edita (solo relevante con foco).
  const [draft, setDraft] = useState('')

  const formatted = value === null ? '' : formatMontoInput(value, moneda, locale)

  // Si el valor cambia desde afuera mientras NO se edita, el input refleja el
  // formateado. Mientras hay foco, no pisamos lo que el usuario está tipeando.
  useEffect(() => {
    if (!focused) setDraft(formatted)
  }, [formatted, focused])

  const display = focused ? draft : formatted

  function handleChange(raw: string) {
    setDraft(raw)
    const parsed = parseMontoInput(raw, moneda)
    onChange(Number.isFinite(parsed) ? parsed : null)
  }

  return (
    <Input
      id={id}
      name={name}
      label={label}
      required={required}
      error={error}
      disabled={disabled}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder ?? formatMontoInput(0, moneda, locale)}
      value={display}
      aria-label={label ? undefined : 'Monto'}
      onChange={(e) => handleChange(e.target.value)}
      onFocus={() => {
        setFocused(true)
        setDraft(formatted)
      }}
      onBlur={() => setFocused(false)}
    />
  )
}
