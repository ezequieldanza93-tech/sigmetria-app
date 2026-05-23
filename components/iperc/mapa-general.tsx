'use client'

import { useMemo } from 'react'
import dynamic from 'next/dynamic'
import L from 'leaflet'
import { useEstablecimientosParaMapa } from '@/lib/queries/iperc'
import { NIVEL_RIESGO_COLORS, type IpercNivelRiesgoNombre } from '@/lib/types'

const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false })
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false })
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false })
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false })

function getNivelColor(nombre: string | undefined): string {
  if (!nombre) return '#6b7280'
  const entry = Object.entries(NIVEL_RIESGO_COLORS).find(([k]) => k === nombre)
  return entry ? entry[1] : '#6b7280'
}

function createColoredIcon(color: string) {
  if (typeof window === 'undefined') return null
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="${color}" width="32" height="32"><path d="M12 0C7.8 0 4 3.8 4 8c0 5.3 7 13 7 13s1-1.2 1-1.3c0 .1 1 1.3 1 1.3s7-7.7 7-13c0-4.2-3.8-8-8-8zm0 11.5c-1.9 0-3.5-1.6-3.5-3.5S10.1 4.5 12 4.5s3.5 1.6 3.5 3.5S13.9 11.5 12 11.5z"/></svg>`
  const iconUrl = `data:image/svg+xml;base64,${btoa(svg)}`
  return L.icon({
    iconUrl,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32],
  })
}

function getHighestRiskLevel(sectores: any[]): string | undefined {
  const niveles: any[] = sectores?.filter(s => s.nivel_riesgo_maximo)?.map(s => s.nivel_riesgo_maximo) ?? []
  if (!niveles.length) return undefined
  const sorted = niveles.sort((a: any, b: any) => b.valor_min - a.valor_min)
  return sorted[0]?.nombre
}

export function MapaGeneral() {
  const { data: establecimientos, isLoading } = useEstablecimientosParaMapa()

  const center: [number, number] = [-38.4161, -63.6167]

  const markers = useMemo(() => {
    if (!establecimientos?.length) return []
    return establecimientos.filter((e: any) => e.latitud && e.longitud)
  }, [establecimientos])

  if (isLoading) return <div className="text-center py-8"><p className="text-gray-500">Cargando mapa...</p></div>

  return (
    <div className="h-[calc(100vh-10rem)] w-full rounded-lg overflow-hidden border">
      <MapContainer center={center} zoom={5} className="h-full w-full" scrollWheelZoom={true}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markers.map((e: any) => {
          const nivelNombre = getHighestRiskLevel(e.iperc_sectores)
          const color = getNivelColor(nivelNombre)
          const icon = createColoredIcon(color)
          if (!icon) return null
          return (
            <Marker key={e.id} position={[e.latitud, e.longitud]} icon={icon}>
              <Popup>
                <div className="text-sm">
                  <p className="font-semibold">{e.nombre}</p>
                  <p className="text-gray-500">{e.empresas?.razon_social}</p>
                  {nivelNombre && (
                    <p className="mt-1">
                      <span
                        className="inline-block px-2 py-0.5 text-xs font-bold rounded-full text-white"
                        style={{ backgroundColor: color }}
                      >
                        {nivelNombre}
                      </span>
                    </p>
                  )}
                </div>
              </Popup>
            </Marker>
          )
        })}
      </MapContainer>
    </div>
  )
}
