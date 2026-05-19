'use client'

import { useEffect, useState } from 'react'

const WMO: Record<number, string> = {
  0: 'Despejado',
  1: 'Principalmente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Niebla', 48: 'Niebla con escarcha',
  51: 'Llovizna leve', 53: 'Llovizna', 55: 'Llovizna intensa',
  61: 'Lluvia leve', 63: 'Lluvia', 65: 'Lluvia intensa',
  71: 'Nieve leve', 73: 'Nieve', 75: 'Nieve intensa', 77: 'Granizo',
  80: 'Chaparrón leve', 81: 'Chaparrón', 82: 'Chaparrón fuerte',
  85: 'Nevada leve', 86: 'Nevada fuerte',
  95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta fuerte',
}

function weatherEmoji(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 2) return '🌤️'
  if (code === 3) return '☁️'
  if (code <= 48) return '🌫️'
  if (code <= 55) return '🌦️'
  if (code <= 65) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌦️'
  return '⛈️'
}

interface Weather { temp: number; condition: string; wind: number; code: number }

const TZ = 'America/Argentina/Buenos_Aires'

export function WeatherClock() {
  const [now, setNow] = useState<Date | null>(null)
  const [weather, setWeather] = useState<Weather | null>(null)

  useEffect(() => {
    setNow(new Date())
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          'https://api.open-meteo.com/v1/forecast?latitude=-34.6037&longitude=-58.3816&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=kmh&timezone=America%2FArgentina%2FBuenos_Aires'
        )
        const json = await res.json()
        const c = json.current
        setWeather({
          temp: Math.round(c.temperature_2m * 10) / 10,
          condition: WMO[c.weather_code as number] ?? '—',
          wind: Math.round(c.wind_speed_10m * 10) / 10,
          code: c.weather_code as number,
        })
      } catch { /* silently ignore */ }
    }
    load()
    const refresh = setInterval(load, 30 * 60 * 1000)
    return () => clearInterval(refresh)
  }, [])

  if (!now) return null

  const dateStr = now.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ,
  })
  const timeStr = now.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: TZ,
  })

  return (
    <div className="hidden lg:flex items-center gap-3 shrink-0">
      {/* Fecha y hora */}
      <div className="text-right">
        <p className="text-xs capitalize text-gray-500 leading-tight">{dateStr}</p>
        <p className="text-xs font-mono text-gray-700 leading-tight tabular-nums">{timeStr}</p>
      </div>

      <div className="w-px h-7 bg-gray-200 shrink-0" />

      {/* Clima */}
      <div className="flex items-center gap-2">
        <span className="text-2xl leading-none select-none" aria-hidden="true">
          {weather ? weatherEmoji(weather.code) : '🌡️'}
        </span>
        <div>
          {weather ? (
            <p className="text-xs font-medium text-gray-700 leading-tight">
              {weather.temp}°C · {weather.condition} · 💨 {weather.wind} km/h
            </p>
          ) : (
            <p className="text-xs text-gray-300 leading-tight">Cargando…</p>
          )}
          <p className="text-[10px] text-gray-400 leading-tight">America/Argentina/Buenos Aires</p>
        </div>
      </div>
    </div>
  )
}
