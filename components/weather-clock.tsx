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

const WMO_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️',
  80: '🌦️', 81: '🌦️', 82: '🌧️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
const MONTH_NAMES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']

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

function wmoIcon(code: number) { return WMO_ICONS[code] ?? '🌡️' }

function formatDay(dateStr: string, index: number) {
  const d = new Date(dateStr + 'T12:00:00')
  if (index === 0) return 'Hoy'
  if (index === 1) return 'Mañana'
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

interface Weather { temp: number; condition: string; wind: number; code: number }

interface DayForecast {
  date: string
  weathercode: number
  max: number
  min: number
  rain: number
}

const TZ = 'America/Argentina/Buenos_Aires'

interface WeatherClockProps {
  forecastLat?: number
  forecastLng?: number
}

export function WeatherClock({ forecastLat, forecastLng }: WeatherClockProps = {}) {
  const [now, setNow] = useState<Date | null>(null)
  const [weather, setWeather] = useState<Weather | null>(null)
  const [forecast, setForecast] = useState<DayForecast[]>([])

  useEffect(() => {
    setNow(new Date())
    const tick = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    async function load() {
      try {
        const lat = forecastLat ?? -34.6037
        const lng = forecastLng ?? -58.3816
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=kmh&timezone=America%2FArgentina%2FBuenos_Aires`
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
  }, [forecastLat, forecastLng])

  useEffect(() => {
    if (forecastLat == null || forecastLng == null) {
      setForecast([])
      return
    }
    const lat = forecastLat ?? -34.6037
    const lng = forecastLng ?? -58.3816
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum` +
      `&timezone=auto&forecast_days=14`
    )
      .then(r => r.json())
      .then(d => {
        setForecast(d.daily.time.map((date: string, i: number) => ({
          date,
          weathercode: d.daily.weathercode[i],
          max: d.daily.temperature_2m_max[i],
          min: d.daily.temperature_2m_min[i],
          rain: d.daily.precipitation_sum[i] ?? 0,
        })))
      })
      .catch(() => {})
  }, [forecastLat, forecastLng])

  if (!now) return null

  const dateStr = now.toLocaleDateString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: TZ,
  })
  const timeStr = now.toLocaleTimeString('es-AR', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: TZ,
  })

  return (
    <div className="hidden lg:flex items-center gap-3 shrink-0 relative group/wx">
      <div className="text-right">
        <p className="text-xs capitalize text-text-tertiary leading-tight">{dateStr}</p>
        <p className="text-xs font-mono text-text-secondary leading-tight tabular-nums">{timeStr}</p>
      </div>

      <div className="w-px h-7 bg-border-subtle shrink-0" />

      <div className={`flex items-center gap-2 ${forecast.length > 0 ? 'cursor-default' : ''}`}>
        <span className="text-2xl leading-none select-none" aria-hidden="true">
          {weather ? weatherEmoji(weather.code) : '🌡️'}
        </span>
        <div>
          {weather ? (
            <p className="text-xs font-medium text-text-primary leading-tight">
              {weather.temp}°C · {weather.condition} · 💨 {weather.wind} km/h
              {forecast.length > 0 && <span className="text-text-tertiary ml-1">▾</span>}
            </p>
          ) : (
            <p className="text-xs text-text-tertiary leading-tight">Cargando…</p>
          )}
          <p className="text-[10px] text-text-tertiary leading-tight">America/Argentina/Buenos Aires</p>
        </div>
      </div>

      {forecast.length > 0 && (
        <div className="fixed top-12 left-1/2 -translate-x-1/2 z-50 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden opacity-0 invisible group-hover/wx:opacity-100 group-hover/wx:visible transition-all duration-200 max-w-[90vw]">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider px-3.5 pt-2 pb-1.5 whitespace-nowrap">
            Pronóstico — próximas 2 semanas
          </p>
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-1.5 px-3 pb-3" style={{ minWidth: 'max-content' }}>
              {forecast.map((day, i) => (
                <div
                  key={day.date}
                  className={`flex flex-col items-center rounded-lg px-2 py-1.5 min-w-[56px] ${
                    i === 0 ? 'bg-sig-50 border border-sig-100' : 'bg-gray-50 border border-gray-100'
                  }`}
                >
                  <p className={`text-[10px] font-medium mb-0.5 ${i === 0 ? 'text-sig-500' : 'text-gray-500'}`}>
                    {formatDay(day.date, i)}
                  </p>
                  <span className="text-base mb-0.5">{wmoIcon(day.weathercode)}</span>
                  <p className="text-xs font-bold text-gray-900">{Math.round(day.max)}°</p>
                  <p className="text-[10px] text-gray-400">{Math.round(day.min)}°</p>
                  {day.rain > 0 && (
                    <p className="text-[10px] text-blue-500 mt-0.5">💧{day.rain.toFixed(1)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
