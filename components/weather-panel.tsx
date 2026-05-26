'use client'

import { useEffect, useState } from 'react'
import { LocalClock } from './local-clock'

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

function shortDay(dateStr: string, index: number) {
  if (index === 0) return 'Hoy'
  const d = new Date(dateStr + 'T12:00:00')
  return DAY_NAMES[d.getDay()]
}

interface Weather { temp: number; condition: string; wind: number; code: number }

interface DayForecast {
  date: string
  weathercode: number
  max: number
  min: number
}

interface Props {
  lat: number
  lng: number
}

export function WeatherPanel({ lat, lng }: Props) {
  const [weather, setWeather] = useState<Weather | null>(null)
  const [forecast, setForecast] = useState<DayForecast[]>([])
  const [timezone, setTimezone] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,wind_speed_10m&wind_speed_unit=kmh&timezone=auto`
        )
        const json = await res.json()
        const c = json.current
        setWeather({
          temp: Math.round(c.temperature_2m * 10) / 10,
          condition: WMO[c.weather_code as number] ?? '—',
          wind: Math.round(c.wind_speed_10m * 10) / 10,
          code: c.weather_code as number,
        })
      } catch { console.error('[weather-panel] Error al obtener clima actual') }
    }
    load()
    const refresh = setInterval(load, 30 * 60 * 1000)
    return () => clearInterval(refresh)
  }, [lat, lng])

  useEffect(() => {
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}` +
      `&daily=weathercode,temperature_2m_max,temperature_2m_min` +
      `&timezone=auto&forecast_days=7`
    )
      .then(r => r.json())
      .then(d => {
        if (d.timezone) setTimezone(d.timezone as string)
        setForecast(d.daily.time.map((date: string, i: number) => ({
          date,
          weathercode: d.daily.weathercode[i],
          max: d.daily.temperature_2m_max[i],
          min: d.daily.temperature_2m_min[i],
        })))
      })
      .catch(() => { console.error('[weather-panel] Error al obtener pronóstico') })
  }, [lat, lng])

  return (
    <div className="bg-gradient-to-br from-sky-50 to-sky-100 p-4 flex flex-col justify-between gap-3 h-full">

      {/* Hora local */}
      {timezone && (
        <div className="border-b border-sky-200 pb-3 mb-1">
          <LocalClock timezone={timezone} className="text-sky-900" />
        </div>
      )}

      <div>
        <p className="text-[10px] font-medium text-sky-700/70 uppercase tracking-wider mb-2">
          Clima ahora
        </p>
        {weather ? (
          <>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-4xl leading-none select-none" aria-hidden="true">
                {weatherEmoji(weather.code)}
              </span>
              <div>
                <p className="text-2xl font-bold text-sky-900 leading-none tabular-nums">
                  {Math.round(weather.temp)}°
                </p>
                <p className="text-[10px] text-sky-700/70 leading-tight">C</p>
              </div>
            </div>
            <p className="text-xs font-medium text-sky-800 leading-tight">{weather.condition}</p>
            <p className="text-[11px] text-sky-700/70 leading-tight mt-0.5">
              💨 Viento {weather.wind} km/h
            </p>
          </>
        ) : (
          <p className="text-xs text-sky-700/60">Cargando…</p>
        )}
      </div>

      {forecast.length > 0 && (
        <div className="border-t border-sky-200 pt-2.5">
          <p className="text-[10px] font-medium text-sky-700/70 uppercase tracking-wider mb-1.5">
            Próximos días
          </p>
          <div className="grid grid-cols-7 gap-0.5">
            {forecast.map((day, i) => (
              <div
                key={day.date}
                className={`flex flex-col items-center rounded-md py-1 ${
                  i === 0 ? 'bg-sky-200/70' : ''
                }`}
              >
                <p className={`text-[9px] font-medium leading-none mb-0.5 ${
                  i === 0 ? 'text-sky-900' : 'text-sky-700/80'
                }`}>
                  {shortDay(day.date, i)}
                </p>
                <span className="text-sm leading-none" aria-hidden="true">
                  {wmoIcon(day.weathercode)}
                </span>
                <p className="text-[10px] font-bold text-sky-900 leading-none mt-0.5 tabular-nums">
                  {Math.round(day.max)}°
                </p>
                <p className="text-[9px] text-sky-700/60 leading-none tabular-nums">
                  {Math.round(day.min)}°
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
