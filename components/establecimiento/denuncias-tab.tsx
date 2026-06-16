'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import { createDenuncia } from '@/lib/actions/establecimiento-info'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { PersonaSelectorConAlta } from '@/components/persona-selector-con-alta'
import { PersonaMultiSelectConSueltos, type PersonaMultiSelectValue } from '@/components/persona-multiselect'
import type { Denuncia, PersonaVinculo, ActionResult } from '@/lib/types'

const MAX_ARCHIVOS = 5
const EMPTY_VINCULOS: PersonaMultiSelectValue = { personaIds: [], sueltos: [] }

/** Nombres legibles de un set de vínculos N:M (directorio + sueltos). */
function vinculosLabel(vinculos?: PersonaVinculo[]): string {
  if (!vinculos || vinculos.length === 0) return ''
  return vinculos
    .map(v =>
      v.personas_directorio
        ? `${v.personas_directorio.apellido}, ${v.personas_directorio.nombre}`
        : v.nombre_suelto ?? '',
    )
    .filter(Boolean)
    .join(' · ')
}

// ─── DenunciaForm ─────────────────────────────────────────────────────────────

function DenunciaForm({
  action,
  establecimientoId,
  onSuccess,
}: {
  action: (prev: ActionResult<null> | null, formData: FormData) => Promise<ActionResult<null>>
  establecimientoId: string
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const [personaId, setPersonaId] = useState<string | null>(null)
  const [involucrados, setInvolucrados] = useState<PersonaMultiSelectValue>(EMPTY_VINCULOS)
  const [archivoCount, setArchivoCount] = useState(0)

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => {
    if (state?.success) {
      setPersonaId(null)
      setInvolucrados(EMPTY_VINCULOS)
      onSuccessRef.current()
    }
  }, [state])

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

      <PersonaSelectorConAlta
        label="Persona denunciante"
        name="persona_id"
        value={personaId}
        onChange={p => setPersonaId(p?.id ?? null)}
        establecimientoId={establecimientoId}
        placeholder="Seleccioná o creá la persona denunciante…"
      />

      <div>
        <label className="text-sm font-medium text-text-secondary dark:text-white block mb-1">Descripción *</label>
        <textarea name="descripcion" required rows={3} className={`${inputCls} resize-none`} />
      </div>

      <PersonaMultiSelectConSueltos
        label="Involucrados"
        value={involucrados}
        onChange={setInvolucrados}
        establecimientoId={establecimientoId}
        placeholder="Agregar involucrados…"
      />
      <input type="hidden" name="involucrados_persona_ids" value={JSON.stringify(involucrados.personaIds)} />
      <input type="hidden" name="involucrados_sueltos" value={JSON.stringify(involucrados.sueltos)} />

      <div>
        <label className="text-sm font-medium text-text-secondary dark:text-white block mb-1">
          Adjuntos {archivoCount > 0 && `(${archivoCount} archivo${archivoCount !== 1 ? 's' : ''} — máximo ${MAX_ARCHIVOS})`}
        </label>
        <input
          type="file"
          name="archivo"
          multiple
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

// ─── DenunciasTab ─────────────────────────────────────────────────────────────

interface DenunciasTabProps {
  denuncias: Denuncia[]
  establecimientoId: string
  canWrite: boolean
}

export function DenunciasTab({ denuncias, establecimientoId, canWrite }: DenunciasTabProps) {
  const [showModal, setShowModal] = useState(false)
  const denunciaAction = createDenuncia.bind(null, establecimientoId)
  const { getUrl } = useSignedUrls('documentos', denuncias.flatMap(d => (d.denuncias_fotos ?? []).map(f => f.url)))

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
                <th className="px-5 py-3 text-text-secondary font-medium">Involucrados</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Adjuntos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {denuncias.map(d => (
                <tr key={d.id} className="hover:bg-surface-base">
                  <td className="px-5 py-3.5 text-text-secondary whitespace-nowrap">{formatDate(d.fecha_denuncia)}</td>
                  <td className="px-5 py-3.5 text-text-primary dark:text-white">
                    {d.personas_directorio
                      ? `${d.personas_directorio.apellido}, ${d.personas_directorio.nombre}`
                      : <span className="text-text-tertiary">—</span>}
                  </td>
                  <td className="px-5 py-3.5 text-text-primary dark:text-white">{d.descripcion}</td>
                  <td className="px-5 py-3.5 text-text-secondary text-xs">
                    {vinculosLabel(d.denuncias_involucrados) || <span className="text-text-tertiary">—</span>}
                  </td>
                  <td className="px-5 py-3.5">
                    {d.denuncias_fotos && d.denuncias_fotos.length > 0 ? (
                      <div className="flex gap-1 flex-wrap">
                        {d.denuncias_fotos.map((foto, i) => (
                          <a
                            key={i}
                            href={getUrl(foto.url) ?? '#'}
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
          establecimientoId={establecimientoId}
          onSuccess={() => setShowModal(false)}
        />
      </Modal>
    </div>
  )
}
