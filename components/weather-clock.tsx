'use client'

import { useEffect, useState } from 'react'

const TZ = 'America/Argentina/Buenos_Aires'

export function WeatherClock() {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  if (!now) return null

  const dateStr = now.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ,
  })
  const timeStr = now.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: TZ,
  })

  return (
    <div className="hidden lg:flex items-center shrink-0">
      <div className="text-right">
        <p className="text-xs capitalize text-text-tertiary leading-tight">{dateStr}</p>
        <p className="text-xs font-mono text-text-secondary leading-tight tabular-nums">{timeStr}</p>
      </div>
    </div>
  )
}
