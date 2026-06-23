'use client'

import { useState, useEffect, useActionState, useRef, useTransition } from 'react'
import { FileText, Trash2, Upload, User } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FileUploadInput } from '@/components/ui/file-upload-input'
import { createClient } from '@/lib/supabase/client'
import { updatePersona } from '@/lib/actions/persona'
import { createMatricula } from '@/lib/actions/matricula'
import { subirImagenPersona, quitarImagenPersona } from '@/lib/actions/persona-imagenes'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { formatDate } from '@/lib/utils'
import type { ActionResult, Matricula } from '@/lib/types'

// El detalle necesita más campos que los que trae la tabla DirectorioPersona del
// listado (foto/dni/user_id), por eso usamos un tipo local en vez de tocar lib/types.
export interface PersonaDetalle {
  id: string
  tipo_id: string | null
  nombre: string
  apellido: string
  dni: string | null
  fecha_nacimiento: string | null
  fecha_ingreso: string | null
  legajo: string | null
  telefono: string | null
  email: string | null
  direccion: string | null
  user_id: string | null
  foto_url: string | null
  dni_frente_url: string | null
  dni_dorso_url: string | null
  personas_tipos?: { nombre: string } | null
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

interface PersonaDetalleModalProps {
  persona: PersonaDetalle
  open: boolean
  onClose: () => void
  canWrite: boolean
}

type Tab = 'datos' | 'dni' | 'documentos' | 'matriculas'

function vencimientoClass(fecha: string | null): string {
  if (!fecha) return 'text-text-tertiary'
  const days = Math.ceil((new Date(fecha).getTime() - Date.now()) / 86400000)
  if (days < 0) return 'text-danger font-medium'
  if (days <= 30) return 'text-warning font-medium'
  return 'text-text-secondary'
}

const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm'
const fileBtnCls =
  'w-full text-sm text-text-secondary file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-sig-50 file:text-sig-700 hover:file:bg-sig-100 file:cursor-pointer'

/** Foto de perfil: muestra la imagen firmada + subir/reemplazar/quitar. */
function FotoPerfil({
  persona,
  canWrite,
  onChanged,
}: {
  persona: PersonaDetalle
  canWrite: boolean
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { getUrl } = useSignedUrls('documentos', [persona.foto_url])
  const url = getUrl(persona.foto_url)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      const res = await subirImagenPersona(persona.id, 'foto', fd)
      if (!res.success) setError(res.error)
      else onChanged()
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  function quitar() {
    setError(null)
    startTransition(async () => {
      const res = await quitarImagenPersona(persona.id, 'foto')
      if (!res.success) setError(res.error)
      else onChanged()
    })
  }

  return (
    <div className="flex items-center gap-4">
      <div className="size-20 shrink-0 rounded-full overflow-hidden bg-surface-elevated border border-border-subtle grid place-items-center">
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="Foto de perfil" className="size-full object-cover" />
        ) : (
          <User size={32} strokeWidth={1.5} className="text-text-tertiary" />
        )}
      </div>
      {canWrite && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={onFile}
              disabled={pending}
              className={fileBtnCls}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-tertiary">PNG, JPG o WEBP. Máx 5 MB.</span>
            {persona.foto_url && (
              <button
                type="button"
                onClick={quitar}
                disabled={pending}
                className="text-xs text-red-400 hover:text-danger inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 size={12} /> Quitar
              </button>
            )}
          </div>
          {pending && <p className="text-xs text-text-tertiary">Subiendo…</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </div>
  )
}

/** Imagen del DNI (frente o dorso): subir/ver/quitar. Acepta PDF o imagen. */
function DniImagen({
  persona,
  kind,
  label,
  canWrite,
  onChanged,
}: {
  persona: PersonaDetalle
  kind: 'dni_frente' | 'dni_dorso'
  label: string
  canWrite: boolean
  onChanged: () => void
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const path = kind === 'dni_frente' ? persona.dni_frente_url : persona.dni_dorso_url
  const { getUrl } = useSignedUrls('documentos', [path])
  const url = getUrl(path)

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    const fd = new FormData()
    fd.append('file', file)
    startTransition(async () => {
      const res = await subirImagenPersona(persona.id, kind, fd)
      if (!res.success) setError(res.error)
      else onChanged()
      if (inputRef.current) inputRef.current.value = ''
    })
  }

  function quitar() {
    setError(null)
    startTransition(async () => {
      const res = await quitarImagenPersona(persona.id, kind)
      if (!res.success) setError(res.error)
      else onChanged()
    })
  }

  return (
    <div className="rounded-lg border border-border-subtle p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-text-secondary">{label}</p>
        {path && url && (
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-sig-500 hover:underline inline-flex items-center gap-1">
            <FileText size={12} /> Ver
          </a>
        )}
      </div>
      {path ? (
        <p className="text-xs text-text-tertiary">Archivo cargado.</p>
      ) : (
        <p className="text-xs text-text-tertiary">Sin archivo.</p>
      )}
      {canWrite && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/png,image/jpeg,image/webp"
            onChange={onFile}
            disabled={pending}
            className={fileBtnCls}
          />
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-tertiary">PDF o imagen. Máx 5 MB.</span>
            {path && (
              <button
                type="button"
                onClick={quitar}
                disabled={pending}
                className="text-xs text-red-400 hover:text-danger inline-flex items-center gap-1 disabled:opacity-50"
              >
                <Trash2 size={12} /> Quitar
              </button>
            )}
          </div>
          {pending && <p className="text-xs text-text-tertiary">Subiendo…</p>}
          {error && <p className="text-xs text-danger">{error}</p>}
        </>
      )}
    </div>
  )
}

/** Form de edición de los datos de la persona (useActionState con updatePersona). */
function DatosForm({
  persona,
  canWrite,
  onSaved,
}: {
  persona: PersonaDetalle
  canWrite: boolean
  onSaved: () => void
}) {
  const action = updatePersona.bind(null, persona.id)
  const [state, formAction, pending] = useActionState(
    action,
    null as ActionResult<{ duplicado?: string }> | null,
  )
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  useEffect(() => { if (state?.success) onSavedRef.current() }, [state])

  const disabled = !canWrite

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">{state.error}</div>
      )}
      {state && state.success && (
        <div className="bg-sig-50 border border-sig-100 text-sig-700 text-sm rounded-lg px-4 py-3">Datos guardados.</div>
      )}

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">DNI</label>
        <input name="dni" defaultValue={persona.dni ?? ''} disabled={disabled} className={inputCls} placeholder="00.000.000" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Apellido *</label>
          <input name="apellido" required defaultValue={persona.apellido} disabled={disabled} className={inputCls} />
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Nombre *</label>
          <input name="nombre" required defaultValue={persona.nombre} disabled={disabled} className={inputCls} />
        </div>
      </div>

      {/* tipo_id es obligatorio en el schema de updatePersona → lo mandamos como hidden. */}
      <input type="hidden" name="tipo_id" value={persona.tipo_id ?? ''} />

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Teléfono</label>
          <input name="telefono" defaultValue={persona.telefono ?? ''} disabled={disabled} className={inputCls} placeholder="+54 11 0000-0000" />
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Email</label>
          <input name="email" type="email" defaultValue={persona.email ?? ''} disabled={disabled} className={inputCls} placeholder="correo@ejemplo.com" />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Dirección</label>
        <input name="direccion" defaultValue={persona.direccion ?? ''} disabled={disabled} className={inputCls} placeholder="Calle, número, localidad" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Fecha de nacimiento</label>
          <input name="fecha_nacimiento" type="date" defaultValue={persona.fecha_nacimiento ?? ''} disabled={disabled} className={inputCls} />
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Fecha de ingreso</label>
          <input name="fecha_ingreso" type="date" defaultValue={persona.fecha_ingreso ?? ''} disabled={disabled} className={inputCls} />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Legajo</label>
        <input name="legajo" defaultValue={persona.legajo ?? ''} disabled={disabled} className={inputCls} placeholder="Nro. de legajo" />
      </div>

      {canWrite && (
        <div className="flex justify-end">
          <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar cambios'}</Button>
        </div>
      )}
    </form>
  )
}

/** Form para cargar una matrícula — mismo patrón que trabajador-modal.tsx. */
function MatriculaForm({ personaId, onSuccess }: { personaId: string; onSuccess: () => void }) {
  const [state, formAction, pending] = useActionState(createMatricula, null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

  const [colegios, setColegios] = useState<{ id: string; sigla: string; nombre: string; provincia: string }[]>([])
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('colegios_profesionales')
      .select('id, sigla, nombre, provincia')
      .eq('is_active', true)
      .order('provincia')
      .order('sigla')
      .then(({ data }) => setColegios(data ?? []))
  }, [])

  return (
    <form action={formAction} className="space-y-3 bg-surface-base rounded-lg p-3 mt-3 border border-border-subtle">
      <input type="hidden" name="persona_id" value={personaId} />
      {state && !state.success && <p className="text-xs text-danger">{state.error}</p>}
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
      {colegios.length > 0 && (
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Colegio / consejo profesional</label>
          <select name="colegio_profesional_id" className="w-full border border-border-default rounded px-2 py-1.5 text-sm bg-surface-base text-text-primary">
            <option value="">Sin especificar</option>
            {colegios.map(c => (
              <option key={c.id} value={c.id}>{c.sigla} — {c.provincia}</option>
            ))}
          </select>
        </div>
      )}
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

export function PersonaDetalleModal({ persona, open, onClose, canWrite }: PersonaDetalleModalProps) {
  const [tab, setTab] = useState<Tab>('datos')
  const [documentos, setDocumentos] = useState<PersonaDoc[] | null>(null)
  const [matriculas, setMatriculas] = useState<Matricula[] | null>(null)
  const [showMatriculaForm, setShowMatriculaForm] = useState(false)
  // Bump local para re-firmar/re-leer la persona tras subir/quitar imágenes
  // sin necesidad de recargar el listado padre. Mantenemos una copia local de
  // los paths de imágenes para reflejar los cambios al instante.
  const [fotoUrl, setFotoUrl] = useState(persona.foto_url)
  const [dniFrenteUrl, setDniFrenteUrl] = useState(persona.dni_frente_url)
  const [dniDorsoUrl, setDniDorsoUrl] = useState(persona.dni_dorso_url)

  useEffect(() => {
    if (!open) {
      setTab('datos')
      setShowMatriculaForm(false)
    } else {
      setFotoUrl(persona.foto_url)
      setDniFrenteUrl(persona.dni_frente_url)
      setDniDorsoUrl(persona.dni_dorso_url)
    }
  }, [open, persona.foto_url, persona.dni_frente_url, persona.dni_dorso_url])

  useEffect(() => {
    if (!open) return
    const supabase = createClient()

    if (tab === 'documentos' && documentos === null) {
      supabase
        .from('personas_documentos')
        .select('id, tipo_id, archivo_url, fecha_emision, fecha_vencimiento, created_at, documentos_tipos(nombre)')
        .eq('persona_id', persona.id)
        .order('created_at', { ascending: false })
        .then(({ data }) => setDocumentos((data as unknown as PersonaDoc[]) ?? []))
    }

    if (tab === 'matriculas' && matriculas === null) {
      supabase
        .from('matriculas')
        .select('*, organizaciones_externas(nombre), colegios_profesionales(sigla, nombre, provincia)')
        .eq('persona_id', persona.id)
        .order('fecha_emision', { ascending: false })
        .then(({ data }) => setMatriculas((data as unknown as Matricula[]) ?? []))
    }
  }, [tab, open, persona.id, documentos, matriculas])

  function reloadMatriculas() {
    const supabase = createClient()
    supabase
      .from('matriculas')
      .select('*, organizaciones_externas(nombre), colegios_profesionales(sigla, nombre, provincia)')
      .eq('persona_id', persona.id)
      .order('fecha_emision', { ascending: false })
      .then(({ data }) => setMatriculas((data as unknown as Matricula[]) ?? []))
  }

  // Persona "en vivo" para los componentes de imagen (reflejan el estado local).
  const personaLive: PersonaDetalle = {
    ...persona,
    foto_url: fotoUrl,
    dni_frente_url: dniFrenteUrl,
    dni_dorso_url: dniDorsoUrl,
  }

  const { getUrl: getDocUrl } = useSignedUrls('documentos', (documentos ?? []).map(d => d.archivo_url))
  const { getUrl: getCertUrl } = useSignedUrls('certificados', (matriculas ?? []).map(m => m.certificado_url))

  // Re-leemos los paths de imágenes de la DB para reflejar subida/quita.
  function refetchImagenes() {
    const supabase = createClient()
    supabase
      .from('personas_directorio')
      .select('foto_url, dni_frente_url, dni_dorso_url')
      .eq('id', persona.id)
      .single()
      .then(({ data }) => {
        const row = data as { foto_url: string | null; dni_frente_url: string | null; dni_dorso_url: string | null } | null
        if (row) {
          setFotoUrl(row.foto_url)
          setDniFrenteUrl(row.dni_frente_url)
          setDniDorsoUrl(row.dni_dorso_url)
        }
      })
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'datos', label: 'Datos' },
    { key: 'dni', label: 'DNI' },
    { key: 'documentos', label: 'Documentos' },
    { key: 'matriculas', label: 'Matrículas' },
  ]

  return (
    <Modal open={open} onClose={onClose} title={`${persona.apellido}, ${persona.nombre}`} size="full">
      {/* Cabecera con foto + tipo + badge usuario */}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex items-center gap-2 flex-wrap">
          {persona.personas_tipos?.nombre && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary">
              {persona.personas_tipos.nombre}
            </span>
          )}
          {persona.user_id && (
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sig-50 text-sig-700 inline-flex items-center gap-1">
              <User size={11} /> Usuario
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border-subtle mb-4 -mt-1 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium -mb-px border-b-2 transition-colors ${
              tab === t.key
                ? 'border-sig-500 text-sig-500'
                : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Datos */}
      {tab === 'datos' && (
        <div className="space-y-5">
          <FotoPerfil persona={personaLive} canWrite={canWrite} onChanged={refetchImagenes} />
          <DatosForm persona={persona} canWrite={canWrite} onSaved={() => {}} />
        </div>
      )}

      {/* DNI (imágenes) */}
      {tab === 'dni' && (
        <div className="space-y-3">
          <p className="text-sm text-text-secondary">
            El número de DNI se edita en la pestaña <span className="font-medium">Datos</span>. Acá se cargan las imágenes del documento.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <DniImagen persona={personaLive} kind="dni_frente" label="DNI — Frente" canWrite={canWrite} onChanged={refetchImagenes} />
            <DniImagen persona={personaLive} kind="dni_dorso" label="DNI — Dorso" canWrite={canWrite} onChanged={refetchImagenes} />
          </div>
        </div>
      )}

      {/* Documentos (read-only) */}
      {tab === 'documentos' && (
        <div>
          {documentos === null ? (
            <p className="text-sm text-text-tertiary text-center py-4">Cargando…</p>
          ) : documentos.length === 0 ? (
            <p className="text-sm text-text-tertiary text-center py-4">Sin documentos cargados.</p>
          ) : (
            <div className="space-y-1.5">
              {documentos.map(d => (
                <div key={d.id} className="flex items-center justify-between bg-surface-base rounded-lg px-3 py-2 text-sm border border-border-subtle">
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
                      className="text-xs text-sig-500 hover:underline ml-3 shrink-0 inline-flex items-center gap-1"
                    >
                      <FileText size={12} /> Ver archivo
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
          <p className="text-xs text-text-tertiary mt-3">La carga de documentos se hace desde el establecimiento.</p>
        </div>
      )}

      {/* Matrículas */}
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
                    <div key={m.id} className="flex items-start justify-between bg-surface-base rounded-lg px-3 py-2.5 text-sm border border-border-subtle">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-text-primary">Nº {m.numero}</p>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusClass}`}>{statusLabel}</span>
                        </div>
                        {m.colegios_profesionales && (
                          <p className="text-xs text-text-tertiary mt-0.5">{m.colegios_profesionales.sigla} — {m.colegios_profesionales.provincia}</p>
                        )}
                        {!m.colegios_profesionales && m.organizaciones_externas && (
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
                    reloadMatriculas()
                  }}
                />
              ) : canWrite && (
                <button
                  onClick={() => setShowMatriculaForm(true)}
                  className="mt-3 text-sm text-sig-500 hover:text-sig-700 font-medium inline-flex items-center gap-1"
                >
                  <Upload size={14} /> {matriculas.length > 0 ? 'Renovar matrícula' : 'Cargar matrícula'}
                </button>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}
