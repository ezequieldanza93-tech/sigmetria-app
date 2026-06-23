'use client'

import { useEffect, useRef, useState } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { buscarDirecciones, type SugerenciaDireccion } from '@/lib/actions/buscar-direccion'

/**
 * Campo ÚNICO de dirección con autocompletado tipo Google Maps (Nominatim/OSM, sin
 * API key). El usuario escribe la dirección y elige una sugerencia → se llena el texto
 * y las coordenadas exactas, sin pedir lat/long aparte ni la dirección dos veces.
 *
 * Submit nativo (<form action>): renderiza el input visible con `name` (la dirección)
 * + hidden inputs con las coordenadas (lat/lon separados y/o un campo "lat, lon").
 * Si el usuario escribe libre y no elige sugerencia, las coords quedan vacías y el
 * server geocodifica el texto (empresa.ts / establecimiento.ts ya lo hacen).
 */
interface Props {
  name: string
  label?: string
  placeholder?: string
  required?: boolean
  defaultValue?: string
  /** Hidden de latitud (ej "latitude"). */
  latName?: string
  /** Hidden de longitud (ej "longitude"). */
  lonName?: string
  /** Hidden único con "lat, lon" (ej "ubicacion_gmaps" para parseUbicacion). */
  gmapsName?: string
  defaultLat?: number | string | null
  defaultLon?: number | string | null
  /** Punto de referencia para ordenar sugerencias por proximidad. */
  nearLat?: number | null
  nearLon?: number | null
  /**
   * Se llama con el código postal si Nominatim lo devuelve al elegir una
   * sugerencia. Útil para autocompletar el campo Código Postal.
   */
  onPostcode?: (cp: string) => void
  helpText?: string
}

export function DireccionAutocomplete({
  name,
  label = 'Dirección',
  placeholder = 'Empezá a escribir la dirección…',
  required,
  defaultValue = '',
  latName,
  lonName,
  gmapsName,
  defaultLat = null,
  defaultLon = null,
  nearLat,
  nearLon,
  onPostcode,
  helpText,
}: Props) {
  const [query, setQuery] = useState(defaultValue)
  const [lat, setLat] = useState<number | null>(defaultLat != null && defaultLat !== '' ? Number(defaultLat) : null)
  const [lon, setLon] = useState<number | null>(defaultLon != null && defaultLon !== '' ? Number(defaultLon) : null)
  const [sugerencias, setSugerencias] = useState<SugerenciaDireccion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  // Evita re-buscar inmediatamente después de elegir una sugerencia.
  const skipNextRef = useRef(false)
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (skipNextRef.current) {
      skipNextRef.current = false
      return
    }
    const q = query.trim()
    if (q.length < 4) {
      setSugerencias([])
      setLoading(false)
      return
    }
    setLoading(true)
    const t = setTimeout(async () => {
      const res = await buscarDirecciones(q, nearLat, nearLon)
      setSugerencias(res)
      setOpen(res.length > 0)
      setLoading(false)
    }, 450)
    return () => clearTimeout(t)
  }, [query])

  function elegir(s: SugerenciaDireccion) {
    skipNextRef.current = true
    setQuery(s.label)
    setLat(s.lat)
    setLon(s.lon)
    if (s.postcode && onPostcode) onPostcode(s.postcode)
    setSugerencias([])
    setOpen(false)
  }

  const coordsListas = lat != null && lon != null

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-text-secondary mb-1">
        {label}{required && <span className="text-danger ml-0.5">*</span>}
      </label>
      <div className="relative">
        <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        <input
          name={name}
          type="text"
          required={required}
          value={query}
          autoComplete="off"
          onChange={(e) => {
            setQuery(e.target.value)
            // Si edita el texto a mano, invalidamos las coords elegidas.
            setLat(null)
            setLon(null)
          }}
          onFocus={() => { if (sugerencias.length > 0) setOpen(true) }}
          onBlur={() => { blurTimer.current = setTimeout(() => setOpen(false), 150) }}
          placeholder={placeholder}
          className="w-full border border-border-default rounded-lg pl-9 pr-9 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
        {loading && <Loader2 size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary animate-spin" />}
      </div>

      {open && sugerencias.length > 0 && (
        <ul
          className="absolute z-30 mt-1 w-full bg-surface-base border border-border-default rounded-lg shadow-lg max-h-64 overflow-auto"
          onMouseDown={() => { if (blurTimer.current) clearTimeout(blurTimer.current) }}
        >
          {sugerencias.map((s, i) => (
            <li key={`${s.lat}-${s.lon}-${i}`}>
              <button
                type="button"
                onClick={() => elegir(s)}
                className="w-full text-left px-3 py-2 text-sm hover:bg-sig-50 flex items-start gap-2"
              >
                <MapPin size={14} className="text-text-tertiary mt-0.5 shrink-0" />
                <span className="text-text-primary">{s.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* Hidden inputs con las coordenadas para el submit nativo. */}
      {latName && <input type="hidden" name={latName} value={lat != null ? String(lat) : ''} />}
      {lonName && <input type="hidden" name={lonName} value={lon != null ? String(lon) : ''} />}
      {gmapsName && <input type="hidden" name={gmapsName} value={coordsListas ? `${lat}, ${lon}` : ''} />}

      <p className="text-xs text-text-tertiary mt-1">
        {helpText ?? 'Escribí la dirección y elegí la sugerencia para fijar la ubicación exacta. Si no aparece, dejá el texto y la ubicamos al guardar.'}
        {coordsListas && <span className="text-sig-600 ml-1">· Ubicación fijada ✓</span>}
      </p>
    </div>
  )
}
