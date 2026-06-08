'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { toast } from '@/lib/hooks/use-toast'
import {
  crearSesionDesdeGestion,
  agregarParticipantes,
  enviarLinksParticipantes,
  getPersonasDeEstablecimiento,
  getRegistroGeneral,
} from '@/lib/actions/capacitacion'
import type {
  CapacitacionModalidad,
  ParticipanteInput,
  PersonaEstablecimiento,
  RegistroGeneral,
  RegistroParticipante,
} from '@/lib/actions/capacitacion'
import {
  GraduationCap,
  Mail,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
} from 'lucide-react'

type CursoLite = { id: string; titulo: string }
type PersonaLite = { id: string; nombre: string; apellido: string }

interface EjecutarCapacitacionModalProps {
  establecimientoId: string
  empresaId?: string
  /** Nombre de la gestión, para prellenar el título de la sesión. */
  gestionNombre?: string
  /** Responsable de la gestión (preselecciona el instructor si es persona). */
  instructorPersonaIdDefault?: string
  /** Vínculo con la gestión planificada (gestiones_establecimientos). */
  gestionEstablecimientoId?: string
  /** Id del registro de gestión que dispara esta capacitación (suelto, sin FK). */
  registroGestionId?: string
  /** fecha_planificada del registro (parte de la PK compuesta particionada). */
  rgFechaPlanificada?: string
  onClose: () => void
  onSuccess?: () => void
}

const inputCls =
  'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base text-text-primary focus:outline-none focus:ring-2 focus:ring-sig-500'

// ─── Participante editable (en memoria, previo a confirmar) ──────────────────
interface ParticipanteDraft {
  key: string
  personaId: string | null
  nombre: string
  email: string
}

function nombreCompleto(p: PersonaEstablecimiento): string {
  return `${p.apellido}, ${p.nombre}`.trim()
}

// ─── Vista del acta / registro general post-creación ─────────────────────────
const ESTADO_META: Record<
  RegistroParticipante['estado'],
  { label: string; icon: typeof Clock; cls: string }
> = {
  pendiente: { label: 'Pendiente', icon: Clock, cls: 'text-text-tertiary' },
  en_progreso: { label: 'En progreso', icon: Clock, cls: 'text-info' },
  aprobado: { label: 'Aprobado', icon: CheckCircle2, cls: 'text-success' },
  reprobado: { label: 'Reprobado', icon: XCircle, cls: 'text-danger' },
}

function ActaView({
  registro,
  sesionId,
  appUrl,
  onReenviar,
  reenviando,
}: {
  registro: RegistroGeneral
  sesionId: string
  appUrl: string
  onReenviar: () => void
  reenviando: boolean
}) {
  return (
    <div className="space-y-4">
      <div className="bg-success-bg border border-success/30 text-success text-sm rounded-lg px-3 py-2 flex items-center gap-2">
        <CheckCircle2 size={16} />
        Capacitación creada. {registro.participantes.length} participante
        {registro.participantes.length === 1 ? '' : 's'} cargado
        {registro.participantes.length === 1 ? '' : 's'}.
      </div>

      <div className="bg-surface-base rounded-lg border border-border-subtle px-3 py-2.5 text-sm">
        <div className="font-medium text-text-primary">{registro.curso.titulo}</div>
        <div className="text-text-secondary text-xs mt-0.5">
          {registro.sesion.titulo ?? '—'}
          {registro.sesion.fecha ? ` · ${registro.sesion.fecha}` : ''}
          {' · '}
          {registro.sesion.modalidad === 'presencial' ? 'Presencial' : 'E-learning'}
        </div>
        {(registro.instructor.nombre || registro.instructor.externo) && (
          <div className="text-text-tertiary text-xs mt-0.5">
            Instructor: {registro.instructor.nombre ?? registro.instructor.externo}
          </div>
        )}
      </div>

      <div className="border border-border-subtle rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-base text-left text-xs text-text-secondary">
              <th className="px-3 py-2 font-medium">Participante</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium text-center">Puntaje</th>
              <th className="px-3 py-2 font-medium text-center">Certif.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-subtle">
            {registro.participantes.map((p) => {
              const meta = ESTADO_META[p.estado]
              const Icon = meta.icon
              return (
                <tr key={p.id}>
                  <td className="px-3 py-2">
                    <div className="text-text-primary">{p.nombre ?? '—'}</div>
                    {p.email && <div className="text-xs text-text-tertiary">{p.email}</div>}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 text-xs ${meta.cls}`}>
                      <Icon size={13} />
                      {meta.label}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center tabular-nums text-text-secondary">
                    {p.puntaje != null ? `${p.puntaje}%` : '—'}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {p.certificado_pdf_url ? (
                      <a
                        href={p.certificado_pdf_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Ver certificado"
                        className="inline-flex text-sig-600 hover:text-sig-800"
                      >
                        <ExternalLink size={14} />
                      </a>
                    ) : (
                      <span className="text-text-tertiary">—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        <Button type="button" variant="secondary" onClick={onReenviar} disabled={reenviando}>
          <Mail size={14} />
          {reenviando ? 'Reenviando…' : 'Reenviar enlaces por email'}
        </Button>
        <a
          href={`${appUrl}/capacitacion/registro/${sesionId}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors px-4 py-2 text-sm bg-surface-base border border-border-default text-text-primary hover:bg-surface-elevated"
        >
          <ExternalLink size={14} />
          Ver registro general
        </a>
      </div>
    </div>
  )
}

export function EjecutarCapacitacionModal({
  establecimientoId,
  empresaId,
  gestionNombre,
  instructorPersonaIdDefault,
  gestionEstablecimientoId,
  registroGestionId,
  rgFechaPlanificada,
  onClose,
  onSuccess,
}: EjecutarCapacitacionModalProps) {
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Datos de formulario
  const [cursos, setCursos] = useState<CursoLite[]>([])
  const [cursoId, setCursoId] = useState('')
  const [titulo, setTitulo] = useState(gestionNombre ?? '')
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0])
  const [modalidad, setModalidad] = useState<CapacitacionModalidad>('elearning')

  // Instructor: persona del directorio o externo (texto libre)
  const [personas, setPersonas] = useState<PersonaLite[]>([])
  const [instructorPersonaId, setInstructorPersonaId] = useState(instructorPersonaIdDefault ?? '')
  const [instructorExterno, setInstructorExterno] = useState('')

  // Participantes (preseleccionados desde el establecimiento, editables)
  const [participantes, setParticipantes] = useState<ParticipanteDraft[]>([])
  const [cargandoPersonas, setCargandoPersonas] = useState(true)
  const [reenviando, setReenviando] = useState(false)

  // Resultado: una vez creado, mostramos el acta
  const [acta, setActa] = useState<{ sesionId: string; registro: RegistroGeneral } | null>(null)

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '')

  // Cargar cursos publicados (cliente, RLS) + personas del establecimiento
  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('cursos')
      .select('id, titulo')
      .eq('estado', 'publicado')
      .order('titulo', { ascending: true })
      .then(({ data }) => setCursos((data ?? []) as CursoLite[]))

    supabase
      .from('personas_establecimientos')
      .select('personas_directorio!persona_id(id, nombre, apellido)')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        const ps = ((data ?? []) as unknown as {
          personas_directorio: PersonaLite | null
        }[])
          .map((pe) => pe.personas_directorio)
          .filter((p): p is PersonaLite => !!p)
          .sort((a, b) => a.apellido.localeCompare(b.apellido))
        setPersonas(ps)
      })
  }, [establecimientoId])

  // Preseleccionar participantes vía server action (incluye email + legajo, filtra inactivos)
  useEffect(() => {
    let cancelled = false
    setCargandoPersonas(true)
    getPersonasDeEstablecimiento(establecimientoId).then((res) => {
      if (cancelled) return
      if (res.success) {
        setParticipantes(
          res.data.map((p) => ({
            key: p.persona_id,
            personaId: p.persona_id,
            nombre: nombreCompleto(p),
            email: p.email ?? '',
          })),
        )
      }
      setCargandoPersonas(false)
    })
    return () => {
      cancelled = true
    }
  }, [establecimientoId])

  const personasDisponibles = useMemo(() => {
    const usados = new Set(participantes.map((p) => p.personaId).filter(Boolean))
    return personas.filter((p) => !usados.has(p.id))
  }, [personas, participantes])

  function agregarPersona(personaId: string) {
    const p = personas.find((x) => x.id === personaId)
    if (!p) return
    setParticipantes((prev) => [
      ...prev,
      { key: p.id, personaId: p.id, nombre: `${p.apellido}, ${p.nombre}`, email: '' },
    ])
  }

  function agregarExterno() {
    setParticipantes((prev) => [
      ...prev,
      { key: `ext-${crypto.randomUUID()}`, personaId: null, nombre: '', email: '' },
    ])
  }

  function quitar(key: string) {
    setParticipantes((prev) => prev.filter((p) => p.key !== key))
  }

  function actualizar(key: string, campo: 'nombre' | 'email', valor: string) {
    setParticipantes((prev) => prev.map((p) => (p.key === key ? { ...p, [campo]: valor } : p)))
  }

  function handleConfirmar() {
    setError(null)
    if (!cursoId) {
      setError('Seleccioná un curso.')
      return
    }
    const validos = participantes.filter((p) => p.personaId || p.nombre.trim() || p.email.trim())
    if (validos.length === 0) {
      setError('Agregá al menos un participante.')
      return
    }

    startTransition(async () => {
      const crear = await crearSesionDesdeGestion({
        cursoId,
        establecimientoId,
        empresaId,
        gestionEstablecimientoId,
        registroGestionId,
        rgFechaPlanificada,
        instructorPersonaId: instructorPersonaId || undefined,
        instructorExterno: instructorExterno.trim() || undefined,
        fecha: fecha || undefined,
        titulo: titulo.trim() || undefined,
        modalidad,
      })
      if (!crear.success) {
        setError(crear.error)
        return
      }
      const sesionId = crear.data.sesionId

      const items: ParticipanteInput[] = validos.map((p) => ({
        personaId: p.personaId ?? undefined,
        nombre: p.personaId ? undefined : p.nombre.trim() || undefined,
        email: p.email.trim() || undefined,
      }))

      const agregar = await agregarParticipantes(sesionId, items)
      if (!agregar.success) {
        setError(agregar.error)
        return
      }

      // Envío de links best-effort (no bloquea el éxito)
      const envio = await enviarLinksParticipantes(sesionId)
      if (envio.success) {
        const enviados = envio.data.filter((r) => r.enviado).length
        const sinEmail = envio.data.filter((r) => !r.enviado && r.error === 'Sin email').length
        if (enviados > 0) toast.success(`${enviados} enlace${enviados === 1 ? '' : 's'} enviado${enviados === 1 ? '' : 's'} por email`)
        if (sinEmail > 0) toast.info(`${sinEmail} participante${sinEmail === 1 ? '' : 's'} sin email: copiá el enlace manualmente`)
      }

      const reg = await getRegistroGeneral(sesionId)
      if (reg.success) {
        setActa({ sesionId, registro: reg.data })
        onSuccess?.()
      } else {
        // La sesión se creó igual; cerramos con éxito.
        toast.success('Capacitación creada')
        onSuccess?.()
        onClose()
      }
    })
  }

  function handleReenviar() {
    if (!acta) return
    setReenviando(true)
    enviarLinksParticipantes(acta.sesionId)
      .then((res) => {
        if (res.success) {
          const enviados = res.data.filter((r) => r.enviado).length
          toast.success(`${enviados} enlace${enviados === 1 ? '' : 's'} reenviado${enviados === 1 ? '' : 's'}`)
        } else {
          toast.error(res.error)
        }
      })
      .finally(() => setReenviando(false))
  }

  const tituloModal = acta ? 'Capacitación creada' : 'Ejecutar capacitación'

  return (
    <Modal open title={tituloModal} onClose={onClose} size="full">
      {acta ? (
        <ActaView
          registro={acta.registro}
          sesionId={acta.sesionId}
          appUrl={appUrl}
          onReenviar={handleReenviar}
          reenviando={reenviando}
        />
      ) : (
        <div className="space-y-4">
          {error && (
            <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {/* Curso */}
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1 flex items-center gap-1.5">
              <GraduationCap size={14} /> Curso *
            </label>
            <select value={cursoId} onChange={(e) => setCursoId(e.target.value)} className={inputCls}>
              <option value="">Seleccionar curso…</option>
              {cursos.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.titulo}
                </option>
              ))}
            </select>
            {cursos.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                No hay cursos publicados. Publicá un curso en el Campus Virtual primero.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Título</label>
              <input
                type="text"
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Opcional (usa el del curso si se deja vacío)"
                className={inputCls}
              />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Fecha</label>
              <input
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Modalidad</label>
              <select
                value={modalidad}
                onChange={(e) => setModalidad(e.target.value as CapacitacionModalidad)}
                className={inputCls}
              >
                <option value="elearning">E-learning</option>
                <option value="presencial">Presencial</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Instructor</label>
              <select
                value={instructorPersonaId}
                onChange={(e) => setInstructorPersonaId(e.target.value)}
                className={inputCls}
              >
                <option value="">— Sin asignar / externo —</option>
                {personas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.apellido}, {p.nombre}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {!instructorPersonaId && (
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">
                Instructor externo
              </label>
              <input
                type="text"
                value={instructorExterno}
                onChange={(e) => setInstructorExterno(e.target.value)}
                placeholder="Nombre del instructor externo (opcional)"
                className={inputCls}
              />
            </div>
          )}

          {/* Participantes */}
          <div className="border-t border-border-subtle pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold text-text-secondary">
                Participantes
                {participantes.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-text-tertiary">
                    ({participantes.length})
                  </span>
                )}
              </h3>
              <div className="flex items-center gap-3">
                {personasDisponibles.length > 0 && (
                  <select
                    value=""
                    onChange={(e) => {
                      if (e.target.value) agregarPersona(e.target.value)
                    }}
                    className="text-xs border border-border-default rounded-lg px-2 py-1.5 bg-surface-base text-text-secondary focus:outline-none focus:ring-2 focus:ring-sig-500"
                  >
                    <option value="">+ Agregar persona…</option>
                    {personasDisponibles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.apellido}, {p.nombre}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={agregarExterno}
                  className="text-xs text-sig-600 hover:text-sig-700 font-medium flex items-center gap-1"
                >
                  <Plus size={13} /> Externo
                </button>
              </div>
            </div>

            {cargandoPersonas ? (
              <p className="text-xs text-text-tertiary text-center py-3">Cargando personas…</p>
            ) : participantes.length === 0 ? (
              <p className="text-xs text-text-tertiary text-center py-3 border border-dashed border-border-subtle rounded-lg">
                Sin participantes. Agregá personas del establecimiento o externos.
              </p>
            ) : (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                {participantes.map((p) => (
                  <div
                    key={p.key}
                    className="flex items-start gap-2 border border-border-subtle rounded-lg p-2 bg-gray-50/50"
                  >
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={p.nombre}
                        onChange={(e) => actualizar(p.key, 'nombre', e.target.value)}
                        readOnly={!!p.personaId}
                        placeholder="Nombre"
                        className={`border border-border-default rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sig-500 ${
                          p.personaId ? 'bg-surface-base text-text-secondary' : 'bg-white'
                        }`}
                      />
                      <input
                        type="email"
                        value={p.email}
                        onChange={(e) => actualizar(p.key, 'email', e.target.value)}
                        placeholder="email@ejemplo.com"
                        className="border border-border-default rounded-lg px-2 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-sig-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => quitar(p.key)}
                      title="Quitar participante"
                      className="text-text-tertiary hover:text-red-500 mt-1.5 shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-text-tertiary mt-2">
              Cada participante recibe un enlace personal para hacer la capacitación sin usuario ni
              contraseña. Si no tiene email, vas a poder copiar el enlace luego.
            </p>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <Button type="button" onClick={handleConfirmar} disabled={isPending || cursos.length === 0}>
              {isPending ? 'Creando…' : 'Crear y enviar enlaces'}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
          </div>
        </div>
      )}
    </Modal>
  )
}
