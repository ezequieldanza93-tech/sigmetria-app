'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import L from 'leaflet'
import { Map as MapIcon } from 'lucide-react'
import { Modal } from '@/components/ui/modal'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })
const FitBounds = dynamic(() => import('react-leaflet').then(m => {
  const { useMap } = m
  return function FitBoundsInner({ positions }: { positions: [number, number][] }) {
    const map = useMap()
    if (positions.length === 1) {
      map.setView(positions[0], 14)
    } else if (positions.length > 1) {
      map.fitBounds(L.latLngBounds(positions), { padding: [40, 40] })
    }
    return null
  }
}), { ssr: false })

const EMPRESA_COLOR = '#2563eb' // azul — domicilio legal
const ESTABLECIMIENTO_COLOR = '#16a34a' // verde — establecimientos

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
              <MapContainer center={center} zoom={11} className="h-full w-full" scrollWheelZoom={true}>
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
                {establecimientosConCoords.map(e => (
                  <Marker
                    key={e.id}
                    position={[e.latitud as number, e.longitud as number]}
                    icon={createColoredIcon(ESTABLECIMIENTO_COLOR)}
                  >
                    <Popup>
                      <div className="text-sm">
                        <p className="font-semibold">{e.nombre}</p>
                        {e.domicilio && <p className="text-text-secondary">{e.domicilio}</p>}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            <div className="flex items-center gap-4 text-xs text-text-secondary">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: EMPRESA_COLOR }} />
                Empresa (domicilio legal)
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: ESTABLECIMIENTO_COLOR }} />
                Establecimientos
              </span>
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
