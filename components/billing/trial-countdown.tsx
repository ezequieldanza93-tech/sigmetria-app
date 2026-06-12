'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

function remaining(endsAt: string) {
  const end = new Date(endsAt).getTime()
  let ms = end - Date.now()
  const expired = ms <= 0
  if (ms < 0) ms = 0
  const d = Math.floor(ms / 86_400_000); ms -= d * 86_400_000
  const h = Math.floor(ms / 3_600_000); ms -= h * 3_600_000
  const m = Math.floor(ms / 60_000); ms -= m * 60_000
  const s = Math.floor(ms / 1_000)
  return { d, h, m, s, expired }
}

const pad = (n: number) => String(n).padStart(2, '0')

export function TrialCountdown({ endsAt }: { endsAt: string }) {
  // Se inicializa null para evitar mismatch de hidratación (server vs client time).
  const [t, setT] = useState<ReturnType<typeof remaining> | null>(null)

  useEffect(() => {
    setT(remaining(endsAt))
    const id = setInterval(() => setT(remaining(endsAt)), 1000)
    return () => clearInterval(id)
  }, [endsAt])

  if (!t) return null

  if (t.expired) {
    return (
      <div className="flex items-center justify-center gap-3 bg-red-50 border-b border-red-200 text-red-700 text-sm px-4 py-2">
        <span>⏳ Tu prueba gratis venció.</span>
        <Link href="/dashboard/billing/cambiar-plan" className="font-semibold underline underline-offset-2 hover:text-red-800">
          Activá un plan
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-center gap-2 bg-amber-50 border-b border-amber-200 text-amber-800 text-sm px-4 py-2">
      <span>⏳ Prueba gratis — vence en</span>
      <span className="font-mono font-semibold tabular-nums">
        {t.d}d {pad(t.h)}:{pad(t.m)}:{pad(t.s)}
      </span>
      <Link href="/dashboard/billing/cambiar-plan" className="font-semibold underline underline-offset-2 hover:text-amber-900 ml-1">
        Activar un plan
      </Link>
    </div>
  )
}
