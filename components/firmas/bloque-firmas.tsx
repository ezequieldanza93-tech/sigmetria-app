'use client'

import { useFirmasEntidad } from '@/lib/queries/firmas'
import type { FirmaEntidadTipo } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { useEntidadFirmada } from '@/lib/queries/firmas'
import { FileSignature, Clock, CreditCard, Briefcase, Loader2 } from 'lucide-react'

interface BloqueFirmasProps {
  entidadTipo: FirmaEntidadTipo
  entidadId: string
}

export function BloqueFirmas({ entidadTipo, entidadId }: BloqueFirmasProps) {
  const { data: firmas = [], isLoading } = useFirmasEntidad(entidadTipo, entidadId)
  const { data: firmada } = useEntidadFirmada(entidadTipo, entidadId)

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-tertiary py-4">
        <Loader2 size={16} className="animate-spin" />
        Cargando firmas…
      </div>
    )
  }

  if (firmas.length === 0) {
    return (
      <div className="border border-dashed border-border-subtle rounded-lg p-4 text-center text-sm text-text-tertiary">
        <FileSignature size={24} className="mx-auto mb-2 text-text-tertiary" />
        Sin firmas registradas
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text-secondary flex items-center gap-1.5">
          <FileSignature size={16} />
          Registro de Firmas ({firmas.length})
        </h3>
        {firmada && <Badge variant="success">Completo</Badge>}
      </div>

      <div className="space-y-2">
        {firmas.map((firma, idx) => (
          <div
            key={firma.id}
            className="border border-border-subtle rounded-lg p-3 bg-surface-base hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="space-y-1.5 flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-tertiary font-mono">#{idx + 1}</span>
                  <span className="font-medium text-sm text-text-primary truncate">
                    {firma.nombre_completo}
                  </span>
                  <Badge variant={firma.firmante_tipo === 'usuario_interno' ? 'info' : 'default'} className="text-[10px]">
                    {firma.firmante_tipo === 'usuario_interno' ? 'Interno' : 'Trabajador'}
                  </Badge>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-text-secondary">
                  <span className="flex items-center gap-1">
                    <CreditCard size={12} />
                    DNI: {firma.dni}
                  </span>
                  {firma.rol && (
                    <span className="flex items-center gap-1">
                      <Briefcase size={12} />
                      {firma.rol}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Clock size={12} />
                    {new Date(firma.created_at).toLocaleDateString('es-AR', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>

                {firma.firma_svg_data && (
                  <div className="mt-2 border border-border-subtle rounded bg-surface-base inline-block">
                    <img
                      src={firma.firma_svg_data}
                      alt="Firma"
                      className="h-10 w-auto"
                      style={{ imageRendering: 'pixelated' }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="text-[10px] text-text-tertiary text-center pt-1">
        Documento generado por Sigmetría HyS
      </div>
    </div>
  )
}
