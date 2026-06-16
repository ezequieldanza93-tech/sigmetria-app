'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import {
  createNormativa,
  updateNormativa,
  type NormativaCategoriaConConteo,
  type NormativaNormaConConteo,
} from '@/lib/actions/normativa-legal'
import { NORMATIVA_AMBITOS, NORMATIVA_ESTADOS, NORMATIVA_TIPOS } from './normativa-constants'

interface Props {
  open: boolean
  onClose: () => void
  /** Norma a editar; null = crear nueva. */
  norma: NormativaNormaConConteo | null
  /**
   * Categorías ofrecidas. Para usuarios normales, solo propias; para quien
   * gestiona la librería base, también las base.
   */
  categorias: NormativaCategoriaConConteo[]
  /** true cuando el usuario puede gestionar la librería base (admin.main / developer). */
  puedeGestionarBase?: boolean
  onSaved: () => void
}

export function NormativaFormModal({ open, onClose, norma, categorias, puedeGestionarBase = false, onSaved }: Props) {
  const { success, error } = useToast()
  const [saving, setSaving] = useState(false)
  const editando = Boolean(norma)
  // Al crear, los que gestionan librerías eligen el alcance (base / propia).
  // Al editar, el alcance lo determina la fila existente.
  const esBaseExistente = editando && norma?.consultora_id === null
  const [alcance, setAlcance] = useState<'propia' | 'base'>('propia')

  // Al (re)abrir para crear, arrancamos siempre en "propia".
  useEffect(() => {
    if (open && !editando) setAlcance('propia')
  }, [open, editando])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)
    // Solo al crear: marcamos la norma como base si el usuario lo eligió.
    if (!norma && puedeGestionarBase && alcance === 'base') {
      formData.set('as_base', 'true')
    }
    const res = norma
      ? await updateNormativa(norma.id, formData)
      : await createNormativa(formData)
    setSaving(false)

    if (res.success) {
      success(editando ? 'Normativa actualizada' : 'Normativa creada')
      onSaved()
      onClose()
    } else {
      error(res.error)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar normativa' : 'Agregar normativa'}
      size="full"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Alcance — solo al crear y solo para quien gestiona la librería base. */}
        {!editando && puedeGestionarBase && (
          <Select
            label="Alcance"
            value={alcance}
            onChange={(e) => setAlcance(e.target.value as 'propia' | 'base')}
            options={[
              { value: 'propia', label: 'De mi consultora' },
              { value: 'base', label: 'Librería base (Sigmetría)' },
            ]}
          />
        )}
        {esBaseExistente && (
          <p className="rounded-lg bg-surface-sunken px-3 py-2 text-xs text-text-secondary">
            Estás editando una norma de la <span className="font-medium">librería base</span> de
            Sigmetría. Los cambios aplican para todas las consultoras.
          </p>
        )}

        <Input
          name="titulo"
          label="Título"
          required
          defaultValue={norma?.titulo ?? ''}
          placeholder="Ej. Ley de Higiene y Seguridad en el Trabajo"
        />
        <Input
          name="nombre_completo"
          label="Nombre completo"
          defaultValue={norma?.nombre_completo ?? ''}
          placeholder="Denominación oficial completa (opcional)"
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            name="tipo"
            label="Tipo"
            required
            defaultValue={norma?.tipo ?? ''}
            placeholder="Seleccionar"
            options={NORMATIVA_TIPOS.map((t) => ({ value: t, label: t }))}
          />
          <Input name="numero" label="Número" defaultValue={norma?.numero ?? ''} placeholder="Ej. 19587" />
          <Input
            name="anio"
            label="Año"
            type="number"
            defaultValue={norma?.anio?.toString() ?? ''}
            placeholder="Ej. 1972"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Select
            name="ambito"
            label="Ámbito"
            required
            defaultValue={norma?.ambito ?? ''}
            placeholder="Seleccionar"
            options={NORMATIVA_AMBITOS.map((a) => ({ value: a, label: a }))}
          />
          <Select
            name="estado"
            label="Estado"
            defaultValue={norma?.estado ?? 'Vigente'}
            options={NORMATIVA_ESTADOS.map((e) => ({ value: e, label: e }))}
          />
          <Select
            name="categoria_id"
            label="Categoría"
            defaultValue={norma?.categoria_id ?? ''}
            placeholder="Sin categoría"
            options={categorias.map((c) => ({ value: c.id, label: c.nombre }))}
          />
        </div>

        <Input
          name="organismo"
          label="Organismo emisor"
          defaultValue={norma?.organismo ?? ''}
          placeholder="Ej. SRT, Ministerio de Trabajo"
        />
        <Input
          name="url_oficial"
          label="URL del texto oficial"
          type="url"
          defaultValue={norma?.url_oficial ?? ''}
          placeholder="https://..."
        />
        <Textarea
          name="modificaciones"
          label="Modificaciones"
          defaultValue={norma?.modificaciones ?? ''}
          placeholder="Ej. Modificada por Res. SRT 1830/2005"
          rows={2}
        />

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear normativa'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
