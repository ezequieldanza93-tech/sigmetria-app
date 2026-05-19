'use client'

import { useEffect, useState } from 'react'

interface DayForecast {
  date: string
  weathercode: number
  max: number
  min: number
  rain: number
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

function wmoIcon(code: number) { return WMO_ICONS[code] ?? '🌡️' }

function formatDay(dateStr: string, index: number) {
  const d = new Date(dateStr + 'T12:00:00')
  if (index === 0) return 'Hoy'
  if (index === 1) return 'Mañana'
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

interface Props {
  lat: number
  lng: number
  nombre: string
  fotoUrl?: string | null
}

export function EstablecimientoLocation({ lat, lng, nombre, fotoUrl }: Props) {
  const [forecast, setForecast] = useState<DayForecast[]>([])

  useEffect(() => {
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
      .catch(() => { /* silently ignore */ })
  }, [lat, lng])

  const mapsEmbedUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`
  const mapsOpenUrl = `https://www.google.com/maps/@${lat},${lng},15z`

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
      {/* Top: foto left + map right */}
      <div className="grid grid-cols-2" style={{ minHeight: '260px' }}>

        {/* Left: foto */}
        <div className="relative border-r border-gray-100 bg-gray-50">
          {fotoUrl ? (
            <img
              src={fotoUrl}
              alt={`Foto de ${nombre}`}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
              <span className="text-3xl mb-1">🏭</span>
              <p className="text-xs">Sin foto</p>
            </div>
          )}
        </div>

        {/* Right: Map */}
        <div className="relative">
          <iframe
            src={mapsEmbedUrl}
            width="100%"
            height="100%"
            style={{ border: 0, display: 'block', minHeight: '320px' }}
            allowFullScreen
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            title={`Mapa de ${nombre}`}
          />
          <a
            href={mapsOpenUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="absolute bottom-3 right-3 bg-white text-xs text-sig-500 font-medium px-3 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
          >
            Abrir en Google Maps ↗
          </a>
        </div>
      </div>

      {/* Bottom: 14-day forecast */}
      {forecast.length > 0 && (
        <div className="border-t border-gray-100">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-5 pt-3 pb-2">
            Pronóstico — próximas 2 semanas
          </p>
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-2 px-4 pb-4" style={{ minWidth: 'max-content' }}>
              {forecast.map((day, i) => (
                <div
                  key={day.date}
                  className={`flex flex-col items-center rounded-xl px-3 py-2.5 min-w-[80px] ${
                    i === 0 ? 'bg-sig-50 border border-sig-100' : 'bg-gray-50 border border-gray-100'
                  }`}
                >
                  <p className={`text-xs font-medium mb-1 ${i === 0 ? 'text-sig-500' : 'text-gray-500'}`}>
                    {formatDay(day.date, i)}
                  </p>
                  <span className="text-xl mb-1">{wmoIcon(day.weathercode)}</span>
                  <p className="text-sm font-bold text-gray-900">{Math.round(day.max)}°</p>
                  <p className="text-xs text-gray-400">{Math.round(day.min)}°</p>
                  {day.rain > 0 && (
                    <p className="text-xs text-blue-500 mt-1">💧{day.rain.toFixed(1)}mm</p>
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
