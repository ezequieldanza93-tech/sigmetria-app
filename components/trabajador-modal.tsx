'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { createTrabajadorDocumento } from '@/lib/actions/trabajador-documento'
import { createMatricula } from '@/lib/actions/matricula'
import { FileUploadInput } from '@/components/ui/file-upload-input'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { formatDate } from '@/lib/utils'
import type { DirectorioPersona, ActionResult, Matricula } from '@/lib/types'

interface DocumentoTipo {
  id: string
  nombre: string
}

interface PersonaDoc {
  id: string
  tipo_id: string
  archivo_url: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  created_at: string
  documentos_tipos: { nombre: string } | null
}

interface TrabajadorModalProps {
  persona: DirectorioPersona
  open: boolean
  onClose: () => void
  establecimientoId: string
  empresaId: string
  canWrite: boolean
}

function vencimientoClass(fecha: string | null): string {
  if (!fecha) return 'text-text-tertiary'
  const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'text-danger font-medium'
  if (days <= 30) return 'text-warning font-medium'
  return 'text-text-secondary'
}

function DocumentoForm({
  action,
  tiposDoc,
  onSuccess,
}: {
  action: (prev: ActionResult<null> | null, fd: FormData) => Promise<ActionResult<null>>
  tiposDoc: DocumentoTipo[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(action, null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

  return (
    <form action={formAction} className="space-y-3 bg-surface-base rounded-lg p-3 mt-3">
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1">Tipo de documento *</label>
        <select name="tipo_id" required className="w-full border border-border-default rounded px-2 py-1.5 text-sm bg-surface-base">
          <option value="">Seleccioná un tipo…</option>
          {tiposDoc.map(t => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Fecha emisión</label>
          <input name="fecha_emision" type="date" className="w-full border border-border-default rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Fecha vencimiento</label>
          <input name="fecha_vencimiento" type="date" className="w-full border border-border-default rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1">Archivo</label>
        <input name="archivo" type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="w-full text-sm text-text-secondary file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-sig-50 file:text-sig-700 hover:file:bg-sig-100" />
      </div>
      {state && !state.success && <p className="text-xs text-danger">{state.error}</p>}
      <div className="flex justify-end">
        <Button size="sm" type="submit" disabled={pending}>
          {pending ? 'Guardando…' : 'Guardar documento'}
        </Button>
      </div>
    </form>
  )
}

function MatriculaForm({ personaId, onSuccess }: { personaId: string; onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState(createMatricula, null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

  return (
    <form action={formAction} className="space-y-3 bg-surface-base rounded-lg p-3 mt-3">
      <input type="hidden" name="persona_id" value={personaId} />
      {state && !state.success && (
        <p className="text-xs text-danger">{state.error}</p>
      )}
      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1">Número de matrícula *</label>
        <input name="numero" required className="w-full border border-border-default rounded px-2 py-1.5 text-sm" placeholder="Nº de matrícula" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Fecha emisión *</label>
          <input name="fecha_emision" type="date" required className="w-full border border-border-default rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Fecha vencimiento *</label>
          <input name="fecha_vencimiento" type="date" required className="w-full border border-border-default rounded px-2 py-1.5 text-sm" />
        </div>
      </div>
      <FileUploadInput
        name="certificado"
        label="Certificado / constancia"
        accept="application/pdf,image/png,image/jpeg"
        maxSizeMB={5}
        helpText="PDF, PNG o JPG. Máx 5 MB. Opcional."
        kind="document"
      />
      <div className="flex gap-2 justify-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

export function TrabajadorModal({
  persona,
  open,
  onClose,
  establecimientoId,
  empresaId,
  canWrite,
}: TrabajadorModalProps) {
  const [tab, setTab] = useState<'datos' | 'documentos' | 'matriculas'>('datos')
  const [documentos, setDocumentos] = useState<PersonaDoc[] | null>(null)
  const [tiposDoc, setTiposDoc] = useState<DocumentoTipo[] | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [matriculas, setMatriculas] = useState<Matricula[] | null>(null)
  const [showMatriculaForm, setShowMatriculaForm] = useState(false)

  useEffect(() => {
    if (!open) { setTab('datos'); setShowForm(false); setShowMatriculaForm(false) }
  }, [open])

  useEffect(() => {
    if (!open) return

    if (tab === 'documentos') {
      const supabase = createClient()

      if (documentos === null) {
        supabase
          .from('personas_documentos')
          .select('id, tipo_id, archivo_url, fecha_emision, fecha_vencimiento, created_at, documentos_tipos(nombre)')
          .eq('persona_id', persona.id)
          .order('created_at', { ascending: false })
          .then(({ data }) => setDocumentos((data as unknown as PersonaDoc[]) ?? []))
      }

      if (tiposDoc === null) {
        supabase
          .from('documentos_tipos')
          .select('id, nombre')
          .eq('aplica_empleado', true)
          .eq('is_active', true)
          .order('nombre')
          .then(({ data }) => setTiposDoc((data as DocumentoTipo[]) ?? []))
      }
    }

    if (tab === 'matriculas') {
      const supabase = createClient()
      supabase
        .from('matriculas')
        .select('*, organizaciones_externas(nombre)')
        .eq('persona_id', persona.id)
        .order('fecha_emision', { ascending: false })
        .then(({ data }) => setMatriculas((data as unknown as Matricula[]) ?? []))
    }
  }, [tab, open, persona.id, documentos, tiposDoc])

  const docAction = createTrabajadorDocumento.bind(null, persona.id, establecimientoId, empresaId)
  // Buckets privados: firmamos las URLs en el cliente (batch, una llamada por bucket).
  const { getUrl: getDocUrl } = useSignedUrls('documentos', (documentos ?? []).map(d => d.archivo_url))
  const { getUrl: getCertUrl } = useSignedUrls('certificados', (matriculas ?? []).map(m => m.certificado_url))

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${persona.apellido}, ${persona.nombre}`}
    >
      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-subtle mb-4 -mt-1">
        {(['datos', 'documentos', 'matriculas'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition-colors ${
              tab === t
                ? 'border-sig-500 text-sig-500'
                : 'border-transparent text-text-secondary hover:text-text-secondary'
            }`}
          >
            {t === 'datos' ? 'Datos' : t === 'documentos' ? 'Documentos' : 'Matrículas'}
          </button>
        ))}
      </div>

      {/* Datos tab */}
      {tab === 'datos' && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-text-tertiary font-medium mb-0.5">Nombre</p>
              <p className="text-text-primary">{persona.nombre}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary font-medium mb-0.5">Apellido</p>
              <p className="text-text-primary">{persona.apellido}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary font-medium mb-0.5">DNI</p>
              <p className="text-text-primary">{persona.dni ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs text-text-tertiary font-medium mb-0.5">Fecha de ingreso</p>
              <p className="text-text-primary">{persona.fecha_ingreso ? formatDate(persona.fecha_ingreso) : '—'}</p>
            </div>
            {persona.legajo && (
              <div>
                <p className="text-xs text-text-tertiary font-medium mb-0.5">Legajo</p>
                <p className="text-text-primary">{persona.legajo}</p>
              </div>
            )}
            {persona.telefono && (
              <div>
                <p className="text-xs text-text-tertiary font-medium mb-0.5">Teléfono</p>
                <p className="text-text-primary">{persona.telefono}</p>
              </div>
            )}
            {persona.email && (
              <div className="col-span-2">
                <p className="text-xs text-text-tertiary font-medium mb-0.5">Email</p>
                <p className="text-text-primary">{persona.email}</p>
              </div>
            )}
            {persona.personas_tipos && (
              <div>
                <p className="text-xs text-text-tertiary font-medium mb-0.5">Tipo</p>
                <p className="text-text-primary">{persona.personas_tipos.nombre}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Documentos tab */}
      {tab === 'documentos' && (
        <div>
          {documentos === null ? (
            <p className="text-sm text-text-tertiary text-center py-4">Cargando…</p>
          ) : documentos.length === 0 && !showForm ? (
            <p className="text-sm text-text-tertiary text-center py-4">Sin documentos cargados.</p>
          ) : (
            <div className="space-y-1.5">
              {documentos.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-surface-base rounded-lg px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium text-text-primary">{d.documentos_tipos?.nombre ?? '—'}</p>
                    {d.fecha_vencimiento && (
                      <p className={`text-xs ${vencimientoClass(d.fecha_vencimiento)}`}>
                        Vence: {formatDate(d.fecha_vencimiento)}
                      </p>
                    )}
                  </div>
                  {d.archivo_url && getDocUrl(d.archivo_url) && (
                    <a
                      href={getDocUrl(d.archivo_url) ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-sig-500 hover:underline ml-3 shrink-0"
                    >
                      Ver archivo
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {canWrite && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="mt-3 text-sm text-sig-500 hover:text-sig-700 font-medium"
            >
              + Agregar documento
            </button>
          )}

          {showForm && tiposDoc && (
            <DocumentoForm
              action={docAction}
              tiposDoc={tiposDoc}
              onSuccess={() => {
                setShowForm(false)
                setDocumentos(null)
              }}
            />
          )}
        </div>
      )}

      {/* Matrículas tab */}
      {tab === 'matriculas' && (
        <div>
          {matriculas === null ? (
            <p className="text-sm text-text-tertiary text-center py-4">Cargando…</p>
          ) : (
            <>
              {matriculas.length === 0 && !showMatriculaForm && (
                <p className="text-sm text-text-tertiary text-center py-4">Sin matrículas cargadas.</p>
              )}
              <div className="space-y-2">
                {matriculas.map(m => {
                  const days = Math.ceil((new Date(m.fecha_vencimiento).getTime() - Date.now()) / 86400000)
                  const statusLabel = !m.activa ? 'Histórica' : days < 0 ? 'Vencida' : days <= 30 ? 'Próx. a vencer' : 'Vigente'
                  const statusClass = !m.activa ? 'bg-surface-elevated text-text-secondary' : days < 0 ? 'bg-danger-bg text-danger' : days <= 30 ? 'bg-warning-bg text-warning' : 'bg-sig-50 text-sig-700'
                  return (
                    <div key={m.id} className="flex items-start justify-between bg-surface-base rounded-lg px-3 py-2.5 text-sm">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-text-primary">Nº {m.numero}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusClass}`}>{statusLabel}</span>
                        </div>
                        {m.organizaciones_externas && (
                          <p className="text-xs text-text-tertiary mt-0.5">{m.organizaciones_externas.nombre}</p>
                        )}
                        <p className="text-xs text-text-tertiary">
                          {formatDate(m.fecha_emision)} → {formatDate(m.fecha_vencimiento)}
                        </p>
                      </div>
                      {m.certificado_url && getCertUrl(m.certificado_url) && (
                        <a href={getCertUrl(m.certificado_url) ?? '#'} target="_blank" rel="noopener noreferrer" className="text-xs text-sig-500 hover:underline ml-2 shrink-0">Ver</a>
                      )}
                    </div>
                  )
                })}
              </div>

              {showMatriculaForm ? (
                <MatriculaForm
                  personaId={persona.id}
                  onSuccess={() => {
                    setShowMatriculaForm(false)
                    const supabase = createClient()
                    supabase.from('matriculas').select('*, organizaciones_externas(nombre)').eq('persona_id', persona.id).order('fecha_emision', { ascending: false })
                      .then(({ data }) => setMatriculas((data as unknown as Matricula[]) ?? []))
                  }}
                />
              ) : canWrite && (
                <button
                  onClick={() => setShowMatriculaForm(true)}
                  className="mt-3 text-sm text-sig-500 hover:text-sig-700 font-medium"
                >
                  + {matriculas.length > 0 ? 'Renovar matrícula' : 'Cargar matrícula'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
