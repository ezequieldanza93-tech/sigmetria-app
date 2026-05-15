'use client'

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'

interface EstWithCoords {
  id: string
  nombre: string
  latitude: number
  longitude: number
  localidad?: string | null
  provincia?: string | null
}

function BoundsAdjuster({ points }: { points: [number, number][] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 1) {
      map.setView(points[0], 14)
    } else if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [48, 48] })
    }
  }, [map, points])
  return null
}

interface Props {
  establecimientos: EstWithCoords[]
  empresaId: string
}

export function EmpresaEstablecimientosMap({ establecimientos, empresaId }: Props) {
  const router = useRouter()
  const center: [number, number] = [establecimientos[0].latitude, establecimientos[0].longitude]
  const points: [number, number][] = establecimientos.map(e => [e.latitude, e.longitude])

  const markerIcon = useMemo(() => L.divIcon({
    className: '',
    html: `<div style="width:14px;height:14px;background:#2563eb;border:2.5px solid white;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.35);cursor:pointer"></div>`,
    iconSize: [14, 14],
    iconAnchor: [7, 7],
  }), [])

  return (
    <MapContainer
      center={center}
      zoom={11}
      style={{ height: '100%', width: '100%' }}
      attributionControl={false}
      zoomControl={true}
    >
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <BoundsAdjuster points={points} />
      {establecimientos.map(est => (
        <Marker
          key={est.id}
          position={[est.latitude, est.longitude]}
          icon={markerIcon}
          eventHandlers={{
            click: () => router.push(`/dashboard/empresas/${empresaId}/establecimientos/${est.id}`),
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -10]} opacity={1}>
            <span className="text-xs font-medium">{est.nombre}</span>
          </Tooltip>
        </Marker>
      ))}
    </MapContainer>
  )
}
