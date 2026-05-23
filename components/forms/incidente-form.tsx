'use client'

import { useActionState, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { INCIDENTE_TIPO_OPTIONS, SEVERIDAD_OPTIONS } from '@/lib/constants'
import { Upload, X, Camera } from 'lucide-react'
import type { ActionResult } from '@/lib/types'

type FormAction = (
  prevState: ActionResult<null> | null,
  formData: FormData
) => Promise<ActionResult<null>>

interface IncidenteFormProps {
  action: FormAction
  empresas: { id: string; razon_social: string }[]
  establecimientos: { id: string; nombre: string; empresa_id: string }[]
}

export function IncidenteForm({ action, empresas, establecimientos }: IncidenteFormProps) {
  const router = useRouter()
  const [fotos, setFotos] = useState<File[]>([])
  const [empresaId, setEmpresaId] = useState('')

  const [state, formAction, isPending] = useActionState(
    async (prev: ActionResult<null> | null, fd: FormData) => {
      fotos.forEach((f, i) => fd.append(`foto_${i}`, f))
      const result = await action(prev, fd)
      return result
    },
    null
  )

  const establecimientosFiltrados = establecimientos.filter(e => e.empresa_id === empresaId)

  function handleAddFoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setFotos(prev => [...prev, ...files])
    e.target.value = ''
  }

  function handleRemoveFoto(i: number) {
    setFotos(prev => prev.filter((_, idx) => idx !== i))
  }

  return (
    <form action={formAction} className="space-y-6">
      {state && !state.success && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Empresa"
          name="empresa_id"
          required
          options={empresas.map(e => ({ value: e.id, label: e.razon_social }))}
          placeholder="Seleccionar empresa..."
          value={empresaId}
          onChange={e => setEmpresaId(e.target.value)}
        />

        <Select
          label="Establecimiento"
          name="establecimiento_id"
          options={establecimientosFiltrados.map(e => ({ value: e.id, label: e.nombre }))}
          placeholder={empresaId ? 'Seleccionar establecimiento...' : 'Primero seleccioná una empresa'}
        />
      </div>

      <Input
        label="Título"
        name="titulo"
        required
        placeholder="Describí brevemente el incidente..."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Select
          label="Tipo de Incidente"
          name="tipo_incidente"
          required
          options={INCIDENTE_TIPO_OPTIONS}
          placeholder="Seleccionar..."
        />

        <Select
          label="Severidad"
          name="severidad"
          required
          options={SEVERIDAD_OPTIONS}
          placeholder="Seleccionar..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label="Fecha del Incidente"
          name="fecha_incidente"
          type="date"
          required
          defaultValue={new Date().toISOString().split('T')[0]}
        />

        <Input
          label="Hora"
          name="hora_incidente"
          type="time"
        />
      </div>

      <Input
        label="Lugar Específico"
        name="lugar_especifico"
        placeholder="Ej: Sector de producción, línea 3, galpón norte..."
      />

      <Textarea
        label="Descripción"
        name="descripcion"
        required
        placeholder="Describí detalladamente lo ocurrido..."
        rows={4}
      />

      <Textarea
        label="Involucrados"
        name="involucrados"
        placeholder="Personas involucradas en el incidente..."
        rows={2}
      />

      <Textarea
        label="Testigos"
        name="testigos"
        placeholder="Nombre y contacto de testigos..."
        rows={2}
      />

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-2">
          Fotos
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {fotos.map((foto, i) => (
            <div key={i} className="relative w-24 h-24 rounded-lg overflow-hidden border border-border-default bg-surface-elevated group">
              <img
                src={URL.createObjectURL(foto)}
                alt={`Foto ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemoveFoto(i)}
                className="absolute top-1 right-1 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X size={14} />
              </button>
              <span className="absolute bottom-1 left-1 text-[10px] bg-black/50 text-white px-1 rounded truncate max-w-[88px]">
                {foto.name.length > 15 ? foto.name.slice(0, 12) + '...' : foto.name}
              </span>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-surface-base border border-border-default rounded-lg text-sm text-text-secondary hover:bg-surface-elevated cursor-pointer transition-colors">
            <Upload size={16} />
            {fotos.length > 0 ? 'Agregar más fotos' : 'Seleccionar fotos'}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleAddFoto}
              className="sr-only"
            />
          </label>
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-surface-base border border-border-default rounded-lg text-sm text-text-secondary hover:bg-surface-elevated cursor-pointer transition-colors">
            <Camera size={16} />
            Cámara
            <input
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleAddFoto}
              className="sr-only"
            />
          </label>
        </div>
        <p className="text-xs text-text-tertiary mt-1">
          Formatos: JPG, PNG, WEBP. Máximo 10MB por foto.
        </p>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : 'Registrar Incidente'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
