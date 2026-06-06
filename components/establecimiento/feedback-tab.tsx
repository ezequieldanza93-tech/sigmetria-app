'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { createFeedbackCliente } from '@/lib/actions/establecimiento-info'
import { useSignedUrls } from '@/lib/storage/sign-client'
import type { FeedbackCliente, FeedbackTipo, DirectorioPersona, ActionResult } from '@/lib/types'

interface FeedbackTabProps {
  feedbackClientes: FeedbackCliente[]
  establecimientoId: string
  canWrite: boolean
}

const FEEDBACK_TIPO_LABELS: Record<FeedbackTipo, string> = {
  positivo: 'Positivo',
  negativo: 'Negativo',
  sugerencia: 'Sugerencia',
}

const FEEDBACK_TIPO_COLORS: Record<FeedbackTipo, string> = {
  positivo: 'bg-success-bg text-success',
  negativo: 'bg-danger-bg text-danger',
  sugerencia: 'bg-info-bg text-info',
}

const MAX_ARCHIVOS = 5

function FeedbackForm({
  action,
  onSuccess,
}: {
  action: (prev: ActionResult<null> | null, formData: FormData) => Promise<ActionResult<null>>
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const [personas, setPersonas] = useState<Pick<DirectorioPersona, 'id' | 'nombre' | 'apellido'>[]>([])
  const [archivoCount, setArchivoCount] = useState(0)

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => {
    if (state?.success) onSuccessRef.current()
  }, [state])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('personas_directorio')
      .select('id, nombre, apellido')
      .eq('is_active', true)
      .order('apellido')
      .order('nombre')
      .then(({ data }) => setPersonas((data ?? []) as Pick<DirectorioPersona, 'id' | 'nombre' | 'apellido'>[]))
  }, [])

  const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500'

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{state.error}</div>
      )}

      <div>
        <label className="text-sm font-medium text-text-secondary dark:text-white block mb-1">Fecha *</label>
        <input type="date" name="fecha" required defaultValue={new Date().toISOString().split('T')[0]} className={inputCls} />
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary dark:text-white block mb-1">Cliente *</label>
        <input type="text" name="cliente" required placeholder="Nombre del cliente" className={inputCls} />
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary dark:text-white block mb-1">Tipo *</label>
        <select name="tipo" required className={inputCls}>
          <option value="positivo">Positivo</option>
          <option value="negativo">Negativo</option>
          <option value="sugerencia">Sugerencia</option>
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary dark:text-white block mb-1">Persona responsable</label>
        <select name="persona_id" className={inputCls}>
          <option value="">Seleccioná una persona…</option>
          {personas.map(p => (
            <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary dark:text-white block mb-1">Descripción *</label>
        <textarea name="descripcion" required rows={3} className={`${inputCls} resize-none`} />
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary dark:text-white block mb-1">
          Adjuntos {archivoCount > 0 && `(${archivoCount} archivo${archivoCount !== 1 ? 's' : ''} — máximo ${MAX_ARCHIVOS})`}
        </label>
        <input
          type="file"
          multiple
          name="archivo"
          accept="image/*,application/pdf"
          className="w-full text-sm text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sig-50 file:text-sig-700 hover:file:bg-sig-100"
          onChange={e => setArchivoCount(e.target.files?.length ?? 0)}
        />
        <p className="text-xs text-text-tertiary mt-1">Podés subir hasta {MAX_ARCHIVOS} archivos (imágenes o PDF)</p>
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

export function FeedbackTab({ feedbackClientes, establecimientoId, canWrite }: FeedbackTabProps) {
  const [showModal, setShowModal] = useState(false)
  const feedbackAction = createFeedbackCliente.bind(null, establecimientoId)
  // Bucket privado `documentos`: firmamos todos los adjuntos en el cliente (batch).
  const { getUrl } = useSignedUrls('documentos', feedbackClientes.flatMap(f => f.adjuntos_urls ?? []))

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary dark:text-white">Feedback de Clientes</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Nuevo Feedback</Button>
        )}
      </div>

      {!feedbackClientes.length ? (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle p-8 text-center text-text-tertiary">
          No hay feedback registrado
        </div>
      ) : (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle dark:border-border-subtle bg-surface-base dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-text-secondary font-medium">Fecha</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Cliente</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Tipo</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Persona</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Descripción</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Adjuntos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {feedbackClientes.map(f => (
                <tr key={f.id} className="hover:bg-surface-base">
                  <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap">{formatDate(f.fecha)}</td>
                  <td className="px-5 py-3.5 font-medium text-text-primary dark:text-white">{f.cliente}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${FEEDBACK_TIPO_COLORS[f.tipo]}`}>
                      {FEEDBACK_TIPO_LABELS[f.tipo]}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-text-primary dark:text-white">
                    {f.personas_directorio
                      ? `${f.personas_directorio.apellido}, ${f.personas_directorio.nombre}`
                      : <span className="text-text-tertiary">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-text-primary dark:text-white">{f.descripcion}</td>
                  <td className="px-5 py-3.5">
                    {f.adjuntos_urls && f.adjuntos_urls.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {f.adjuntos_urls.map((url, i) => (
                          <a
                            key={i}
                            href={getUrl(url) ?? '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-sig-600 hover:text-sig-800 underline"
                          >
                            Archivo {i + 1}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Feedback">
        <FeedbackForm
          action={feedbackAction}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}
