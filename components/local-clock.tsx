'use client'

import { useEffect, useState } from 'react'

interface Props {
  timezone: string
  className?: string
}

export function LocalClock({ timezone, className = '' }: Props) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  if (!now) return null

  const timeStr = now.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false, timeZone: timezone,
  })
  const dateStr = now.toLocaleDateString('es-AR', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: timezone,
  })
  const tzLabel = new Intl.DateTimeFormat('es-AR', { timeZone: timezone, timeZoneName: 'short' })
    .formatToParts(now).find(p => p.type === 'timeZoneName')?.value ?? ''

  return (
    <div className={className}>
      <p className="text-[10px] font-medium uppercase tracking-wider opacity-60 mb-1">Hora local</p>
      <p className="text-xl font-bold font-mono tabular-nums leading-none">{timeStr}</p>
      <p className="text-xs opacity-70 mt-1 capitalize">{dateStr}</p>
      {tzLabel && <p className="text-[10px] opacity-40 mt-0.5">{tzLabel}</p>}
    </div>
  )
}
