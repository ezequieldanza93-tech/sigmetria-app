'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { createDenuncia } from '@/lib/actions/establecimiento-info'
import type { EstablecimientoDenuncia, DirectorioPersona, ActionResult } from '@/lib/types'

interface DenunciasTabProps {
  denuncias: EstablecimientoDenuncia[]
  establecimientoId: string
  canWrite: boolean
}

function DenunciaForm({
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
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

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
        <label className="text-sm font-medium text-text-secondary dark:text-white block mb-1">Persona denunciante</label>
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
          Adjuntos {archivoCount > 0 && `(${archivoCount} archivo${archivoCount !== 1 ? 's' : ''} — máximo ${5})`}
        </label>
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="w-full text-sm text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sig-50 file:text-sig-700 hover:file:bg-sig-100"
          onChange={e => setArchivoCount(e.target.files?.length ?? 0)}
        />
        <p className="text-xs text-text-tertiary mt-1">Podés subir hasta {MAX_ARCHIVOS} archivos (imágenes o PDF)</p>
        <div id="archivos-ocultos">
          {/* Los archivos se asignan por índice en el submit mediante JS */}
        </div>
      </div>

      <div className="flex gap-3 pt-1">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

const MAX_ARCHIVOS = 5

export function DenunciasTab({ denuncias, establecimientoId, canWrite }: DenunciasTabProps) {
  const [showModal, setShowModal] = useState(false)
  const denunciaAction = createDenuncia.bind(null, establecimientoId)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-text-primary dark:text-white">Denuncias</h3>
        {canWrite && (
          <Button size="sm" onClick={() => setShowModal(true)}>+ Nueva Denuncia</Button>
        )}
      </div>

      {!denuncias.length ? (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle p-8 text-center text-text-tertiary">
          No hay denuncias registradas
        </div>
      ) : (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle dark:border-border-subtle bg-surface-base dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-text-secondary font-medium">Fecha</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Persona</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Descripción</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Adjuntos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {denuncias.map(d => (
                <tr key={d.id} className="hover:bg-surface-base">
                  <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap">{formatDate(d.fecha)}</td>
                  <td className="px-5 py-3.5 text-text-primary dark:text-white">
                    {d.personas_directorio
                      ? `${d.personas_directorio.apellido}, ${d.personas_directorio.nombre}`
                      : <span className="text-text-tertiary">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-text-primary dark:text-white">{d.descripcion}</td>
                  <td className="px-5 py-3.5">
                    {d.adjuntos_urls && d.adjuntos_urls.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {d.adjuntos_urls.map((url, i) => (
                          <a
                            key={i}
                            href={url}
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Registrar Denuncia">
        <DenunciaForm
          action={denunciaAction}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}
