'use client'

import { useMemo, useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import L from 'leaflet'
import { Map as MapIcon } from 'lucide-react'
import { Modal } from '@/components/ui/modal'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })
const Tooltip = dynamic(() => import('react-leaflet').then(m => m.Tooltip), { ssr: false })
const FitBounds = dynamic(() => import('react-leaflet').then(m => {
  const { useMap } = m
  return function FitBoundsInner({ positions }: { positions: [number, number][] }) {
    const map = useMap()
    useEffect(() => {
      // El mapa se monta dentro de un <dialog> (showModal): cuando Leaflet mide
      // el contenedor, éste todavía no tiene su tamaño final → renderiza solo una
      // porción (resto gris). Un setTimeout fijo es frágil. Usamos ResizeObserver
      // para reaccionar EN CUANTO el contenedor toma tamaño real, llamando
      // invalidateSize() y reencuadrando los puntos. A prueba de timing.
      const container = map.getContainer()

      const refit = () => {
        map.invalidateSize()
        if (positions.length === 1) {
          map.setView(positions[0], 14)
        } else if (positions.length > 1) {
          map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] })
        }
      }

      // Primer intento en el próximo frame (cubre el caso normal).
      const raf = requestAnimationFrame(refit)
      // Respaldo por si el layout del dialog tarda más.
      const t1 = setTimeout(refit, 150)
      const t2 = setTimeout(refit, 400)

      // Y observamos cambios de tamaño del contenedor (cubre la apertura del modal).
      const ro = new ResizeObserver(() => refit())
      ro.observe(container)

      return () => {
        cancelAnimationFrame(raf)
        clearTimeout(t1)
        clearTimeout(t2)
        ro.disconnect()
      }
    }, [map, positions])
    return null
  }
}), { ssr: false })

const EMPRESA_COLOR = '#2563eb' // azul — domicilio legal

// Configuración por tipo de establecimiento: color distintivo + abreviatura
// (letra dentro del pin). Cada uno de los 9 tipos tiene su propio color.
const TIPO_CONFIG: Record<string, { color: string; abbr: string; label: string }> = {
  AGRO: { color: '#65a30d', abbr: 'AG', label: 'Agropecuario' },
  CENTRO_SALUD: { color: '#dc2626', abbr: 'CS', label: 'Centro de Salud' },
  COMERCIO: { color: '#f59e0b', abbr: 'CO', label: 'Comercio/Retail' },
  CONSTRUCCION: { color: '#ea580c', abbr: 'CN', label: 'Construcción' },
  INDUSTRIA: { color: '#7c3aed', abbr: 'IN', label: 'Industria/Manufactura' },
  LOGISTICA: { color: '#0891b2', abbr: 'LO', label: 'Logística/Depósito' },
  MINERIA: { color: '#854d0e', abbr: 'MI', label: 'Minería' },
  OFICINA: { color: '#0d9488', abbr: 'OF', label: 'Oficinas/Administrativo' },
  OTRO: { color: '#16a34a', abbr: 'OT', label: 'Otro' },
}

const TIPO_FALLBACK = { color: '#16a34a', abbr: 'ES', label: 'Establecimiento' }

function tipoConfig(codigo: string | null | undefined) {
  if (codigo && TIPO_CONFIG[codigo]) return TIPO_CONFIG[codigo]
  return TIPO_FALLBACK
}

// Pin SVG simple coloreado (usado para el marcador de la empresa).
function createColoredIcon(color: string) {
  if (typeof window === 'undefined') return undefined
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32"><path d="M12 0C7.8 0 4 3.8 4 8c0 5.3 7 13 7 13s1-1.2 1-1.3c0 .1 1 1.3 1 1.3s7-7.7 7-13c0-4.2-3.8-8-8-8zm0 11.5c-1.9 0-3.5-1.6-3.5-3.5S10.1 4.5 12 4.5s3.5 1.6 3.5 3.5S13.9 11.5 12 11.5z"/></svg>`
  const iconUrl = `data:image/svg+xml;base64,${btoa(svg)}`
  return L.icon({
    iconUrl,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

// Pin coloreado por tipo de establecimiento con la abreviatura del tipo dentro.
// Usa L.divIcon (HTML inline) — NO lucide, por el allowlist de iconos.
function createTipoIcon(codigo: string | null | undefined) {
  if (typeof window === 'undefined') return undefined
  const { color, abbr } = tipoConfig(codigo)
  const html = `
    <div style="position:relative;width:32px;height:32px;">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32" style="position:absolute;top:0;left:0;filter:drop-shadow(0 1px 1px rgba(0,0,0,.4));">
        <path d="M12 0C7.8 0 4 3.8 4 8c0 5.3 7 13 7 13s1-1.2 1-1.3c0 .1 1 1.3 1 1.3s7-7.7 7-13c0-4.2-3.8-8-8-8z"/>
      </svg>
      <span style="position:absolute;top:3px;left:0;width:32px;text-align:center;font-size:10px;font-weight:700;color:#fff;font-family:system-ui,sans-serif;line-height:1;">${abbr}</span>
    </div>`
  return L.divIcon({
    html,
    className: '',
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

interface EmpresaInput {
  razon_social: string
  latitude: number | null
  longitude: number | null
  domicilio?: string | null
}

interface EstablecimientoInput {
  id: string
  nombre: string
  latitud: number | null
  longitud: number | null
  domicilio?: string | null
  tipo?: { codigo: string; nombre: string } | null
}

interface Props {
  empresa: EmpresaInput
  establecimientos: EstablecimientoInput[]
}

export function EmpresaMapaEstablecimientos({ empresa, establecimientos }: Props) {
  const [open, setOpen] = useState(false)

  const empresaPos = useMemo<[number, number] | null>(() => {
    if (empresa.latitude != null && empresa.longitude != null) {
      return [empresa.latitude, empresa.longitude]
    }
    return null
  }, [empresa.latitude, empresa.longitude])

  const establecimientosConCoords = useMemo(
    () => establecimientos.filter(e => e.latitud != null && e.longitud != null),
    [establecimientos],
  )

  const allPositions = useMemo<[number, number][]>(() => {
    const positions: [number, number][] = []
    if (empresaPos) positions.push(empresaPos)
    for (const e of establecimientosConCoords) {
      positions.push([e.latitud as number, e.longitud as number])
    }
    return positions
  }, [empresaPos, establecimientosConCoords])

  const tiposPresentes = useMemo(() => {
    const seen = new Map<string, { color: string; abbr: string; label: string }>()
    for (const e of establecimientosConCoords) {
      const cfg = tipoConfig(e.tipo?.codigo)
      if (!seen.has(cfg.label)) seen.set(cfg.label, cfg)
    }
    return Array.from(seen.values())
  }, [establecimientosConCoords])

  const hasLocations = allPositions.length > 0
  const center: [number, number] = allPositions[0] ?? [-38.4161, -63.6167]

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 border border-border-default text-text-tertiary hover:bg-surface-elevated hover:text-text-primary text-xs font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <MapIcon className="h-3.5 w-3.5" />
        Ver mapa de establecimientos
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Mapa de establecimientos" size="full">
        {hasLocations ? (
          <div className="space-y-3">
            <div className="h-[500px] w-full rounded-lg overflow-hidden border border-border-subtle">
              <MapContainer center={center} zoom={11} className="h-full w-full" style={{ height: 500, width: '100%' }} scrollWheelZoom={true}>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <FitBounds positions={allPositions} />
                {empresaPos && (
                  <Marker position={empresaPos} icon={createColoredIcon(EMPRESA_COLOR)}>
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">{empresa.razon_social}</p>
                        <p className="text-text-secondary">Domicilio legal</p>
                        {empresa.domicilio && <p className="text-text-secondary">{empresa.domicilio}</p>}
                      </div>
                    </Popup>
                  </Marker>
                )}
                {establecimientosConCoords.map(e => {
                  const cfg = tipoConfig(e.tipo?.codigo)
                  const tipoNombre = e.tipo?.nombre ?? cfg.label
                  return (
                    <Marker
                      key={e.id}
                      position={[e.latitud as number, e.longitud as number]}
                      icon={createTipoIcon(e.tipo?.codigo)}
                    >
                      <Tooltip>{e.nombre} — {tipoNombre}</Tooltip>
                      <Popup>
                        <div className="text-sm">
                          <p className="font-semibold">{e.nombre}</p>
                          <p className="text-text-secondary">{tipoNombre}</p>
                          {e.domicilio && <p className="text-text-secondary">{e.domicilio}</p>}
                        </div>
                      </Popup>
                    </Marker>
                  )
                })}
              </MapContainer>
            </div>

            <div className="space-y-2 text-xs text-text-secondary">
              <div className="flex items-center gap-4">
                <span className="inline-flex items-center gap-1.5">
                  <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: EMPRESA_COLOR }} />
                  Empresa (domicilio legal)
                </span>
              </div>
              <p className="text-text-tertiary">
                El color y las iniciales del pin indican el tipo de establecimiento:
              </p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                {tiposPresentes.map(cfg => (
                  <span key={cfg.label} className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white"
                      style={{ backgroundColor: cfg.color }}
                    >
                      {cfg.abbr}
                    </span>
                    {cfg.label}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-text-secondary py-8 text-center">
            No hay ubicaciones geolocalizadas para mostrar en el mapa.
          </p>
        )}
      </Modal>
    </>
  )
}
