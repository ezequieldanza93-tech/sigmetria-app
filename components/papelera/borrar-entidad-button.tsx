'use client'

/**
 * Botón + modal de borrado (papelera) reusable para empresa / establecimiento /
 * sector / puesto. Pide MOTIVO, muestra el CONTEO de dependencias que se ocultan
 * y exige CONFIRMACIÓN. El borrado es soft (recuperable 90 días). Solo lo ve el
 * admin principal (el caller decide si renderizarlo).
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Trash2, Loader2, AlertTriangle } from 'lucide-react'
import {
  moverAPapelera,
  contarDependencias,
  type EntidadPapelera,
  type ConteoDependencias,
} from '@/lib/actions/papelera'

export function BorrarEntidadButton({
  tabla,
  id,
  nombre,
  label = 'Eliminar',
  redirectTo,
}: {
  tabla: EntidadPapelera
  id: string
  nombre: string
  label?: string
  /** A dónde ir tras borrar (ej. la lista). Si no se pasa, refresca la ruta actual. */
  redirectTo?: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [conteo, setConteo] = useState<ConteoDependencias | null>(null)
  const [cargandoConteo, setCargandoConteo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function abrir() {
    setOpen(true)
    setError(null)
    setMotivo('')
    setConteo(null)
    setCargandoConteo(true)
    const res = await contarDependencias(tabla, id)
    setCargandoConteo(false)
    if (res.success) setConteo(res.data)
    else setError(res.error)
  }

  async function confirmar() {
    if (!motivo.trim()) { setError('Indicá el motivo del borrado.'); return }
    setEnviando(true)
    setError(null)
    const res = await moverAPapelera(tabla, id, motivo.trim())
    if (!res.success) { setError(res.error); setEnviando(false); return }
    setOpen(false)
    setEnviando(false)
    if (redirectTo) router.push(redirectTo)
    else router.refresh()
  }

  const items: { label: string; n: number }[] = conteo
    ? [
        { label: 'establecimientos', n: conteo.establecimientos },
        { label: 'sectores', n: conteo.sectores },
        { label: 'puestos', n: conteo.puestos },
        { label: 'gestiones', n: conteo.gestiones },
        { label: 'registros/recorridas', n: conteo.registros },
      ].filter(x => x.n > 0)
    : []

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="inline-flex items-center gap-1.5 border border-red-200 text-danger hover:bg-danger-bg text-xs font-medium px-3 py-2 rounded-lg transition-colors"
      >
        <Trash2 size={14} />
        {label}
      </button>

      {open && (
        <Modal open title="Mover a la papelera" onClose={() => !enviando && setOpen(false)}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-danger-bg border border-red-200 rounded-lg p-3">
              <AlertTriangle size={18} className="text-danger shrink-0 mt-0.5" />
              <div className="text-sm text-text-secondary">
                Vas a mover <strong className="text-text-primary">{nombre}</strong> a la papelera.
                Deja de verse en la app pero <strong>no se borra</strong>: queda recuperable por 90 días
                y la auditoría se conserva.
              </div>
            </div>

            {cargandoConteo ? (
              <p className="text-xs text-text-tertiary inline-flex items-center gap-1.5">
                <Loader2 size={14} className="animate-spin" /> Calculando lo que se va a ocultar…
              </p>
            ) : items.length > 0 ? (
              <div className="text-sm text-text-secondary">
                <p className="font-medium mb-1">También se ocultará lo asociado:</p>
                <ul className="list-disc pl-5 space-y-0.5">
                  {items.map(x => (
                    <li key={x.label}><strong>{x.n}</strong> {x.label}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">
                Motivo del borrado <span className="text-danger">*</span>
              </label>
              <textarea
                value={motivo}
                onChange={e => setMotivo(e.target.value)}
                rows={3}
                placeholder="Ej.: empresa creada por error / duplicada…"
                className="w-full border border-border-default rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>

            {error && <p className="text-sm text-danger">{error}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setOpen(false)} disabled={enviando}>
                Cancelar
              </Button>
              <Button type="button" onClick={confirmar} disabled={enviando || !motivo.trim()}>
                {enviando
                  ? <><Loader2 size={14} className="inline mr-1.5 animate-spin" /> Moviendo…</>
                  : <><Trash2 size={14} className="inline mr-1.5" /> Sí, mover a papelera</>}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
