'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { registrarEntregaEpp } from '@/lib/actions/entrega-epp'

interface ItemDraft {
  producto_nombre: string
  talle: string
  cantidad: number
}

interface Props {
  open: boolean
  onClose: () => void
  persona: { id: string; nombre: string; apellido: string }
  onDone?: () => void
}

const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm'

export function EntregaEppModal({ open, onClose, persona, onDone }: Props) {
  const [items, setItems] = useState<ItemDraft[]>([{ producto_nombre: '', talle: '', cantidad: 1 }])
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10))
  const [observaciones, setObservaciones] = useState('')
  const [productos, setProductos] = useState<{ id: string; nombre: string }[]>([])
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Catálogo para autocompletar nombres (la RLS lo scopea a la consultora + genéricos).
  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase
      .from('productos')
      .select('id, nombre')
      .eq('is_active', true)
      .order('nombre')
      .limit(500)
      .then(({ data }) => setProductos((data as unknown as { id: string; nombre: string }[]) ?? []))
  }, [open])

  function setItem(idx: number, patch: Partial<ItemDraft>) {
    setItems(prev => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)))
  }
  function addItem() {
    setItems(prev => [...prev, { producto_nombre: '', talle: '', cantidad: 1 }])
  }
  function removeItem(idx: number) {
    setItems(prev => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)))
  }

  async function submit() {
    setError(null)
    const limpios = items.filter(i => i.producto_nombre.trim())
    if (limpios.length === 0) {
      setError('Agregá al menos un elemento.')
      return
    }
    setPending(true)
    const nameToId = new Map(productos.map(p => [p.nombre.toLowerCase(), p.id]))
    const res = await registrarEntregaEpp({
      personaId: persona.id,
      fechaEntrega: fecha,
      observaciones,
      items: limpios.map(i => ({
        producto_nombre: i.producto_nombre.trim(),
        producto_id: nameToId.get(i.producto_nombre.trim().toLowerCase()) ?? null,
        talle: i.talle,
        cantidad: i.cantidad,
      })),
    })
    setPending(false)
    if (res.success) {
      setItems([{ producto_nombre: '', talle: '', cantidad: 1 }])
      setObservaciones('')
      onDone?.()
      onClose()
    } else {
      setError(res.error)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Registrar entrega de EPP — ${persona.apellido}, ${persona.nombre}`}>
      <div className="space-y-4">
        {error && (
          <div className="bg-danger-bg border border-danger/20 text-danger text-sm rounded-lg px-4 py-3">{error}</div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Fecha de entrega</label>
            <input type="date" value={fecha} onChange={e => setFecha(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-text-secondary block">Elementos entregados</label>
          <datalist id="epp-productos">
            {productos.map(p => <option key={p.id} value={p.nombre} />)}
          </datalist>
          {items.map((it, idx) => (
            <div key={idx} className="flex gap-2 items-start">
              <input
                list="epp-productos"
                value={it.producto_nombre}
                onChange={e => setItem(idx, { producto_nombre: e.target.value })}
                placeholder="Elemento (ej: Casco, Guantes anticorte…)"
                className={`${inputCls} flex-1`}
              />
              <input
                value={it.talle}
                onChange={e => setItem(idx, { talle: e.target.value })}
                placeholder="Talle"
                className={`${inputCls} w-20`}
              />
              <input
                type="number"
                min={1}
                value={it.cantidad}
                onChange={e => setItem(idx, { cantidad: Math.max(1, Number(e.target.value) || 1) })}
                className={`${inputCls} w-16`}
              />
              <button
                type="button"
                onClick={() => removeItem(idx)}
                disabled={items.length === 1}
                className="p-2 text-text-tertiary hover:text-danger disabled:opacity-30"
                aria-label="Quitar elemento"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-primary hover:text-brand-hover"
          >
            <Plus className="h-4 w-4" aria-hidden="true" /> Agregar elemento
          </button>
        </div>

        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Observaciones (opcional)</label>
          <textarea
            value={observaciones}
            onChange={e => setObservaciones(e.target.value)}
            rows={2}
            placeholder="Notas de la entrega…"
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm resize-none"
          />
        </div>

        <p className="text-xs text-text-tertiary">
          El trabajador verá esta entrega en su cuenta y deberá confirmar u observar cada elemento. Queda registrado
          con sello de tiempo y cadena de custodia.
        </p>

        <div className="flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {pending ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5 inline" aria-hidden="true" />Registrando…</> : 'Registrar entrega'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
