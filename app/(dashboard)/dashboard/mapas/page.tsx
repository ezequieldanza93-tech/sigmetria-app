'use client'

import dynamic from 'next/dynamic'

const MapaGeneral = dynamic(
  () => import('@/components/iperc/mapa-general').then(m => m.MapaGeneral),
  { ssr: false, loading: () => <div className="text-center py-8"><p className="text-text-secondary">Cargando mapa...</p></div> }
)

export default function MapasPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Mapa General de Riesgos</h1>
        <p className="text-sm text-text-secondary mt-1">
          Establecimientos georreferenciados con nivel de riesgo máximo.
        </p>
      </div>
      <MapaGeneral />
    </div>
  )
}
