'use client'

import { useEffect, useState } from 'react'

interface WeatherData {
  temperature: number
  windspeed: number
  weathercode: number
  timezone: string
}

const WMO_ICONS: Record<number, string> = {
  0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌦️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️',
  80: '🌦️', 81: '🌦️', 82: '🌦️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
}

const WMO_LABELS: Record<number, string> = {
  0: 'Despejado', 1: 'Mayormente despejado', 2: 'Parcialmente nublado', 3: 'Nublado',
  45: 'Niebla', 48: 'Niebla con escarcha',
  51: 'Llovizna ligera', 53: 'Llovizna moderada', 55: 'Llovizna densa',
  61: 'Lluvia ligera', 63: 'Lluvia moderada', 65: 'Lluvia intensa',
  71: 'Nieve ligera', 73: 'Nieve moderada', 75: 'Nieve intensa',
  80: 'Chubascos ligeros', 81: 'Chubascos moderados', 82: 'Chubascos violentos',
  95: 'Tormenta', 96: 'Tormenta con granizo', 99: 'Tormenta con granizo fuerte',
}

function wmoIcon(code: number) {
  return WMO_ICONS[code] ?? '🌡️'
}
function wmoLabel(code: number) {
  return WMO_LABELS[code] ?? 'Desconocido'
}

interface Props {
  lat: number
  lng: number
  nombre: string
}

export function EstablecimientoLocation({ lat, lng, nombre }: Props) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [time, setTime] = useState('')
  const [weatherError, setWeatherError] = useState(false)

  useEffect(() => {
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&timezone=auto`
    )
      .then(r => r.json())
      .then(d => {
        setWeather({
          temperature: d.current_weather.temperature,
          windspeed: d.current_weather.windspeed,
          weathercode: d.current_weather.weathercode,
          timezone: d.timezone,
        })
      })
      .catch(() => setWeatherError(true))
  }, [lat, lng])

  useEffect(() => {
    if (!weather?.timezone) return
    const tz = weather.timezone
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString('es-AR', {
          timeZone: tz,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      )
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [weather?.timezone])

  const mapsEmbedUrl = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`
  const mapsOpenUrl = `https://www.google.com/maps/@${lat},${lng},15z`

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
      {/* Map */}
      <div className="relative">
        <iframe
          src={mapsEmbedUrl}
          width="100%"
          height="280"
          style={{ border: 0, display: 'block' }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          title={`Mapa de ${nombre}`}
        />
        <a
          href={mapsOpenUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-3 right-3 bg-white text-xs text-blue-600 font-medium px-3 py-1.5 rounded-lg shadow-md hover:shadow-lg transition-shadow border border-gray-200"
        >
          Ver en Google Maps ↗
        </a>
      </div>

      {/* Weather + Time bar */}
      <div className="flex items-center gap-6 px-5 py-3.5 border-t border-gray-100 bg-gray-50 flex-wrap">
        {!weatherError && weather ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-2xl">{wmoIcon(weather.weathercode)}</span>
              <div>
                <p className="text-lg font-bold text-gray-900 leading-tight">{weather.temperature}°C</p>
                <p className="text-xs text-gray-500">{wmoLabel(weather.weathercode)}</p>
              </div>
            </div>
            <div className="text-sm text-gray-500">
              💨 {weather.windspeed} km/h
            </div>
            <div className="flex items-center gap-2 ml-auto">
              <span className="text-gray-400 text-sm">🕐</span>
              <div className="text-right">
                <p className="text-base font-mono font-semibold text-gray-900">{time}</p>
                <p className="text-xs text-gray-400">{weather.timezone.replace('_', ' ')}</p>
              </div>
            </div>
          </>
        ) : !weatherError ? (
          <p className="text-sm text-gray-400 animate-pulse">Cargando datos meteorológicos...</p>
        ) : (
          <p className="text-sm text-gray-400">No se pudo cargar el clima</p>
        )}

        <div className="text-xs text-gray-400 ml-auto">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </div>
      </div>
    </div>
  )
}
