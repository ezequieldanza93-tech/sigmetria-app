'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FirmaCanvas } from '@/components/firmas/firma-canvas'
import { useFirmarRegistroTrabajador } from '@/lib/queries/firmas'
import { PenLine, Loader2 } from 'lucide-react'

interface FirmaTrabajadorModalProps {
  open: boolean
  onClose: () => void
  entidadTipo: 'gestion' | 'capacitacion' | 'permiso_trabajo' | 'entrega_epp'
  entidadId: string
  entidadNombre: string
  onSuccess: () => void
}

export function FirmaTrabajadorModal({
  open,
  onClose,
  entidadTipo,
  entidadId,
  entidadNombre,
  onSuccess,
}: FirmaTrabajadorModalProps) {
  const [nombre, setNombre] = useState('')
  const [dni, setDni] = useState('')
  const [rol, setRol] = useState('')
  const [firmaSvgData, setFirmaSvgData] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const firmarMutation = useFirmarRegistroTrabajador()

  const isValid = nombre.trim().length > 0 && dni.trim().length > 0 && firmaSvgData !== null

  async function handleConfirmar() {
    if (!isValid) return
    setError(null)
    try {
      await firmarMutation.mutateAsync({
        entidad_tipo: entidadTipo,
        entidad_id: entidadId,
        nombre_completo: nombre.trim(),
        dni: dni.trim(),
        rol: rol.trim() || null,
        firma_svg_data: firmaSvgData,
      })
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al registrar firma')
    }
  }

  const entidadLabel = ({ gestion: 'Gestión', capacitacion: 'Capacitación', permiso_trabajo: 'Permiso de Trabajo', entrega_epp: 'Entrega de EPP' } as Record<string, string>)[entidadTipo] ?? entidadTipo

  return (
    <Modal open={open} onClose={onClose} title={`Firma de Trabajador — ${entidadLabel}`} size="full">
      <div className="space-y-4">
        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div className="bg-surface-base rounded-lg px-3 py-2 text-sm text-text-secondary">
          {entidadNombre}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Nombre completo del trabajador"
            placeholder="Ej: Juan Pérez"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            required
          />
          <Input
            label="DNI"
            placeholder="Ej: 12345678"
            value={dni}
            onChange={e => setDni(e.target.value)}
            required
          />
          <Input
            label="Rol / Puesto"
            placeholder="Ej: Operario"
            value={rol}
            onChange={e => setRol(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1.5">
            Firma manuscrita <span className="text-[var(--danger)]">*</span>
          </label>
          <FirmaCanvas onDataChange={setFirmaSvgData} />
          {firmaSvgData === null && (
            <p className="text-xs text-text-tertiary mt-1">Dibujá tu firma en el recuadro de arriba</p>
          )}
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-700">
          La firma quedará registrada con fecha y hora. El profesional a cargo asiste este acto de firma.
        </div>

        <div className="flex gap-3 pt-1">
          <Button
            onClick={handleConfirmar}
            disabled={!isValid || firmarMutation.isPending}
          >
            {firmarMutation.isPending ? (
              <><Loader2 size={16} className="animate-spin" /> Registrando…</>
            ) : (
              <><PenLine size={16} /> Confirmar Firma</>
            )}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} disabled={firmarMutation.isPending}>
            Cancelar
          </Button>
        </div>
      </div>
    </Modal>
  )
}
