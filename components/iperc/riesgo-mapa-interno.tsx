'use client'

import { useState } from 'react'
import { useIpercCompleto } from '@/lib/queries/iperc'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { NIVEL_RIESGO_BADGE, NIVEL_RIESGO_COLORS, type IpercNivelRiesgoNombre } from '@/lib/types'
import { useSignedUrls } from '@/lib/storage/sign-client'

const getBgColor = (nombre: string | undefined, opacity = 0.3): string => {
  const entry = Object.entries(NIVEL_RIESGO_COLORS).find(([k]) => k === nombre)
  if (!entry) return `rgba(107, 114, 128, ${opacity})`
  return entry[1] + Math.round(opacity * 255).toString(16).padStart(2, '0')
}

interface Props {
  establecimientoId: string
  planoUrl: string | null
  canWrite: boolean
}

export function RiesgoMapaInterno({ establecimientoId, planoUrl, canWrite }: Props) {
  const { data: completo } = useIpercCompleto(establecimientoId)
  const [selectedSector, setSelectedSector] = useState<any>(null)
  const [planoModal, setPlanoModal] = useState(false)
  // El bucket `planos` es privado: plano_url guarda el PATH y se firma on-read.
  const { getUrl } = useSignedUrls('planos', planoUrl ? [planoUrl] : [])

  if (!completo?.length && !planoUrl) {
    return (
      <div className="text-center py-8 text-text-tertiary border-2 border-dashed rounded-lg">
        <p>No hay sectores IPERC cargados.</p>
        <p className="text-sm mt-1">Primero cargá la matriz IPERC para ver el mapa de riesgo.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Mapa de Riesgo Interno</h2>
        {canWrite && <Button size="sm" onClick={() => setPlanoModal(true)}>Subir Plano</Button>}
      </div>

      <Modal open={planoModal} onClose={() => setPlanoModal(false)} title="Subir Plano del Establecimiento">
        <form
          action={`/api/upload-plano?estId=${establecimientoId}`}
          method="POST"
          encType="multipart/form-data"
          className="flex flex-col gap-4"
        >
          <Input name="plano" type="file" accept="image/*,.pdf" required />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setPlanoModal(false)}>Cancelar</Button>
            <Button type="submit">Subir</Button>
          </div>
        </form>
      </Modal>

      {/* Plano y sectores */}
      {planoUrl && (
        <div className="relative border rounded-lg overflow-hidden bg-surface-elevated" style={{ minHeight: 400 }}>
          <img
            src={getUrl(planoUrl) ?? ''}
            alt="Plano del establecimiento"
            className="w-full h-auto"
            style={{ maxHeight: 600, objectFit: 'contain' }}
          />
          {/* Sector overlays - positioned absolutely based on poligono_coords */}
          {completo?.map((sector: any) => {
            if (!sector.poligono_coords?.length) return null
            // poligono_coords are relative (0-100% of image width/height)
            const maxRiesgo = sector.nivel_riesgo_maximo
            return (
              <div
                key={sector.id}
                className="absolute cursor-pointer hover:opacity-80 transition-opacity"
                style={{
                  left: `${sector.poligono_coords[0]?.x ?? 0}%`,
                  top: `${sector.poligono_coords[0]?.y ?? 0}%`,
                  width: `${Math.abs((sector.poligono_coords[2]?.x ?? 50) - (sector.poligono_coords[0]?.x ?? 0))}%`,
                  height: `${Math.abs((sector.poligono_coords[2]?.y ?? 50) - (sector.poligono_coords[0]?.y ?? 0))}%`,
                  backgroundColor: getBgColor(maxRiesgo?.nombre, 0.25),
                  border: `2px solid ${maxRiesgo ? NIVEL_RIESGO_COLORS[maxRiesgo.nombre as IpercNivelRiesgoNombre] : '#6b7280'}`,
                  borderRadius: 4,
                }}
                onClick={() => setSelectedSector(selectedSector?.id === sector.id ? null : sector)}
                title={sector.nombre}
              >
                <span className="text-xs font-bold bg-white/80 px-1 rounded">{sector.nombre}</span>
              </div>
            )
          })}
        </div>
      )}

      {!planoUrl && (
        <div className="text-center py-12 border-2 border-dashed rounded-lg text-text-tertiary">
          <p>Sin plano cargado. Subí un plano para visualizar los sectores.</p>
        </div>
      )}

      {/* Risk list by sector */}
      <div className="space-y-4">
        <h3 className="font-medium">Riesgos por Sector</h3>
        {completo?.map((sector: any) => (
          <div key={sector.id} className="border rounded-lg overflow-hidden">
            <button
              onClick={() => setSelectedSector(selectedSector?.id === sector.id ? null : sector)}
              className="w-full flex items-center justify-between p-3 bg-surface-base hover:bg-surface-elevated"
            >
              <div className="flex items-center gap-2">
                <span className="font-medium">{sector.nombre}</span>
                {sector.nivel_riesgo_maximo && (
                  <span className={`text-xs px-2 py-0.5 rounded-full ${NIVEL_RIESGO_BADGE[sector.nivel_riesgo_maximo.nombre as keyof typeof NIVEL_RIESGO_BADGE] || ''}`}>
                    {sector.nivel_riesgo_maximo.nombre}
                  </span>
                )}
              </div>
              <span>{selectedSector?.id === sector.id ? '▼' : '▶'}</span>
            </button>

            {selectedSector?.id === sector.id && (
              <div className="p-3 space-y-2">
                {sector.iperc_procesos?.flatMap((p: any) =>
                  p.iperc_tareas?.flatMap((t: any) =>
                    t.iperc_matriz_peligros?.flatMap((mp: any) =>
                      mp.iperc_matriz_riesgos?.map((mr: any) => (
                        <div key={mr.id} className="flex items-center justify-between p-2 bg-surface-base border rounded text-sm">
                          <div className="flex-1">
                            <span className="font-medium">{mr.riesgo?.nombre}</span>
                            <span className="text-text-tertiary mx-2">|</span>
                            <span className="text-text-secondary">Tarea: {t.nombre}</span>
                          </div>
                          {mr.nivel_riesgo && (
                            <span className={`text-xs px-2 py-0.5 rounded-full ${NIVEL_RIESGO_BADGE[mr.nivel_riesgo.nombre as keyof typeof NIVEL_RIESGO_BADGE] || ''}`}>
                              {mr.nivel_riesgo.nombre} ({mr.valor_calculado})
                            </span>
                          )}
                        </div>
                      ))
                    )
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
