'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useToast } from '@/lib/hooks/use-toast'
import {
  createRequisito,
  updateRequisito,
  type NormativaRequisito,
} from '@/lib/actions/normativa-legal'

interface Props {
  open: boolean
  onClose: () => void
  /** Norma a la que pertenece el requisito. */
  normaId: string
  /** Requisito a editar; null = crear nuevo. */
  requisito: NormativaRequisito | null
  onSaved: (requisito: NormativaRequisito) => void
}

export function NormativaRequisitoFormModal({ open, onClose, normaId, requisito, onSaved }: Props) {
  const { success, error } = useToast()
  const [saving, setSaving] = useState(false)
  const editando = Boolean(requisito)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const formData = new FormData(e.currentTarget)

    const res = requisito
      ? await updateRequisito(requisito.id, formData)
      : await createRequisito(normaId, formData)

    setSaving(false)

    if (res.success) {
      success(editando ? 'Requisito actualizado' : 'Requisito creado')
      onSaved(res.data)
      onClose()
    } else {
      error(res.error)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editando ? 'Editar requisito' : 'Agregar requisito'}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_96px] gap-4 items-end">
          <Input
            name="articulo"
            label="Artículo / referencia"
            defaultValue={requisito?.articulo ?? ''}
            placeholder="Ej. Art. 42, Anexo I, § 3.2"
          />
          <Input
            name="orden"
            label="Orden"
            type="number"
            defaultValue={requisito?.orden?.toString() ?? ''}
            placeholder="0"
          />
        </div>

        <Input
          name="descripcion_corta"
          label="Descripción corta"
          defaultValue={requisito?.descripcion_corta ?? ''}
          placeholder="Resumen del requisito (visible en el encabezado)"
        />

        <Textarea
          name="descripcion_oficial"
          label="Texto oficial"
          defaultValue={requisito?.descripcion_oficial ?? ''}
          placeholder="Transcripción o paráfrasis del texto legal…"
          rows={5}
        />

        <Input
          name="code"
          label="Código interno"
          defaultValue={requisito?.code ?? ''}
          placeholder="Ej. SRT-084-42 (opcional)"
        />

        <div className="flex gap-2 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? 'Guardando…' : editando ? 'Guardar cambios' : 'Crear requisito'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
