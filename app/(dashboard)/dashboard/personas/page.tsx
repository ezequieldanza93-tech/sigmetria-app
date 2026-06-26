'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Briefcase, Megaphone, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { createPersona, deletePersona } from '@/lib/actions/persona'
import { convertirProspectoEnCliente } from '@/lib/actions/persona-conversion'
import { crearUsuarioTrabajador } from '@/lib/actions/trabajador-usuario'
import { EntregaEppModal } from '@/components/entrega-epp-modal'
import { SectorPuestoSelectorConAlta } from '@/components/sector-puesto-selector-con-alta'
import { PersonaDetalleModal, type PersonaDetalle } from '@/components/persona-detalle-modal'
import { PhoneInput } from '@/components/forms/phone-input'
import { VoiceTextarea } from '@/components/ui/voice-textarea'
import { toast } from '@/lib/hooks/use-toast'
import type { TipoPersona, Empresa, Establecimiento, ActionResult } from '@/lib/types'

type DirectorioVista = 'operativo' | 'marketing'

// El listado trae más columnas que el listado base (foto/dni/user_id) para
// poder abrir el detalle sin un segundo fetch.
type PersonaFila = PersonaDetalle

function PersonaForm({
  tiposPersona,
  empresas,
  onSuccess,
}: {
  tiposPersona: TipoPersona[]
  empresas: Empresa[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(
    createPersona,
    null as ActionResult<{ duplicado?: string }> | null
  )
  const [step, setStep] = useState<1 | 2>(1)
  const [nombre, setNombre] = useState('')
  const [apellido, setApellido] = useState('')
  const [dni, setDni] = useState('')
  const [tipoId, setTipoId] = useState('')
  const [stepError, setStepError] = useState<string | null>(null)
  const [selectedEmpresaId, setSelectedEmpresaId] = useState<string>('')
  const [selectedEstablecimientoId, setSelectedEstablecimientoId] = useState<string>('')
  const [sectorSel, setSectorSel] = useState<string>('')
  const [puestoSel, setPuestoSel] = useState<string>('')
  const [notas, setNotas] = useState('')
  const [establecimientos, setEstablecimientos] = useState<Establecimiento[]>([])

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

  useEffect(() => {
    if (!selectedEmpresaId) {
      setEstablecimientos([])
      return
    }
    const supabase = createClient()
    supabase
      .from('establecimientos')
      .select('*')
      .eq('empresa_id', selectedEmpresaId)
      .neq('status', 'cancelled')
      .order('nombre')
      .then(({ data }) => setEstablecimientos((data as unknown as Establecimiento[]) ?? []))
  }, [selectedEmpresaId])

  const tipoNombre = tiposPersona.find(t => t.id === tipoId)?.nombre ?? ''
  const esTrabajador = tipoNombre === 'Trabajadores'
  const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm'

  function continuar() {
    if (!nombre.trim() || !apellido.trim() || !tipoId) {
      setStepError('Apellido, nombre y tipo de persona son obligatorios.')
      return
    }
    setStepError(null)
    setStep(2)
  }

  return (
    <form action={formAction} className="space-y-4">
      {/* Datos del paso 1 (siempre en el DOM para que viajen en el submit). */}
      <input type="hidden" name="nombre" value={nombre} />
      <input type="hidden" name="apellido" value={apellido} />
      <input type="hidden" name="dni" value={dni} />
      <input type="hidden" name="tipo_id" value={tipoId} />

      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">{state.error}</div>
      )}

      {step === 1 ? (
        <>
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Paso 1 de 2 · Identidad</p>
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">DNI</label>
            <input value={dni} onChange={e => setDni(e.target.value)} className={inputCls} placeholder="00.000.000" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Apellido *</label>
              <input value={apellido} onChange={e => setApellido(e.target.value)} className={inputCls} placeholder="Apellido" />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Nombre *</label>
              <input value={nombre} onChange={e => setNombre(e.target.value)} className={inputCls} placeholder="Nombre" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Tipo de persona *</label>
            <select value={tipoId} onChange={e => setTipoId(e.target.value)} className={`${inputCls} bg-surface-base`}>
              <option value="">Seleccioná un tipo…</option>
              {tiposPersona.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
            </select>
          </div>
          {stepError && <p className="text-xs text-danger">{stepError}</p>}
          <div className="flex justify-end">
            <Button type="button" onClick={continuar}>Continuar →</Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wide">Paso 2 de 2 · {tipoNombre || 'Datos'}</p>
            <button type="button" onClick={() => setStep(1)} className="text-xs text-sig-600 hover:underline">← Volver</button>
          </div>
          <div className="rounded-lg bg-surface-elevated px-3 py-2 text-sm text-text-secondary">
            {apellido}, {nombre}{dni ? ` · DNI ${dni}` : ''} · <span className="font-medium text-text-primary">{tipoNombre}</span>
          </div>

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Empresa *</label>
            <select
              value={selectedEmpresaId}
              onChange={e => { setSelectedEmpresaId(e.target.value); setSelectedEstablecimientoId(''); setSectorSel(''); setPuestoSel('') }}
              className={`${inputCls} bg-surface-base`}
            >
              <option value="">Seleccioná una empresa…</option>
              {empresas.map(e => <option key={e.id} value={e.id}>{e.razon_social}</option>)}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Establecimiento *</label>
            <select
              name="establecimiento_id"
              required
              disabled={!selectedEmpresaId}
              value={selectedEstablecimientoId}
              onChange={e => { setSelectedEstablecimientoId(e.target.value); setSectorSel(''); setPuestoSel('') }}
              className={`${inputCls} bg-surface-base disabled:opacity-50`}
            >
              <option value="">{selectedEmpresaId ? 'Seleccioná un establecimiento…' : 'Primero seleccioná una empresa'}</option>
              {establecimientos.map(e => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <PhoneInput name="telefono" label="Teléfono" placeholder="11 0000-0000" />
            </div>
            <div>
              <label className="text-sm font-medium text-text-secondary block mb-1">Email</label>
              <input name="email" type="email" className={inputCls} placeholder="correo@ejemplo.com" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Dirección</label>
            <input name="direccion" className={inputCls} placeholder="Calle, número, localidad" />
          </div>

          {esTrabajador && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-text-secondary block mb-1">Legajo</label>
                  <input name="legajo" className={inputCls} placeholder="Nro. de legajo" />
                </div>
                <div>
                  <label className="text-sm font-medium text-text-secondary block mb-1">Fecha de ingreso</label>
                  <input name="fecha_ingreso" type="date" className={inputCls} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-text-secondary block mb-1">Fecha de nacimiento</label>
                <input name="fecha_nacimiento" type="date" className={inputCls} />
              </div>
              {selectedEstablecimientoId ? (
                <div>
                  <label className="text-sm font-medium text-text-secondary block mb-1">Sector y puesto</label>
                  <SectorPuestoSelectorConAlta
                    establecimientoId={selectedEstablecimientoId}
                    sectorId={sectorSel}
                    puestoId={puestoSel}
                    onChange={sel => { setSectorSel(sel.sectorId); setPuestoSel(sel.puestoId) }}
                    namePuesto="puesto_id"
                  />
                  <p className="text-xs text-text-tertiary mt-1">Si el sector o el puesto no existen, los podés crear desde el mismo selector.</p>
                </div>
              ) : (
                <p className="text-xs text-text-tertiary">Elegí un establecimiento para asignar sector y puesto.</p>
              )}

              <details className="group">
                <summary className="text-sm font-medium text-text-secondary cursor-pointer hover:text-text-primary select-none py-1">
                  Talles
                </summary>
                <div className="grid grid-cols-3 gap-2 mt-2">
                  <div>
                    <label className="text-xs text-text-secondary block mb-0.5">Calzado</label>
                    <input name="talle_calzado" className="w-full border border-border-default rounded-lg px-2 py-1.5 text-sm" placeholder="Ej: 42" />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-0.5">Pantalón</label>
                    <input name="talle_pantalon" className="w-full border border-border-default rounded-lg px-2 py-1.5 text-sm" placeholder="Ej: 44" />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-0.5">Remera</label>
                    <input name="talle_remera" className="w-full border border-border-default rounded-lg px-2 py-1.5 text-sm" placeholder="Ej: L" />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-0.5">Camisa</label>
                    <input name="talle_camisa" className="w-full border border-border-default rounded-lg px-2 py-1.5 text-sm" placeholder="Ej: M" />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-0.5">Buzo</label>
                    <input name="talle_buzo" className="w-full border border-border-default rounded-lg px-2 py-1.5 text-sm" placeholder="Ej: XL" />
                  </div>
                  <div>
                    <label className="text-xs text-text-secondary block mb-0.5">Campera</label>
                    <input name="talle_campera" className="w-full border border-border-default rounded-lg px-2 py-1.5 text-sm" placeholder="Ej: 48" />
                  </div>
                </div>
              </details>

              <details className="group">
                <summary className="text-sm font-medium text-text-secondary cursor-pointer hover:text-text-primary select-none py-1">
                  Seguro
                </summary>
                <div className="mt-2">
                  <input name="beneficiario_seguro" className={inputCls} placeholder="Nombre del beneficiario / obra social" />
                </div>
              </details>

              <details className="group">
                <summary className="text-sm font-medium text-text-secondary cursor-pointer hover:text-text-primary select-none py-1">
                  Contacto de emergencia
                </summary>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  <div>
                    <label className="text-xs text-text-secondary block mb-0.5">Nombre</label>
                    <input name="contacto_emergencia_nombre" className="w-full border border-border-default rounded-lg px-2 py-1.5 text-sm" placeholder="Nombre completo" />
                  </div>
                  <div>
                    <PhoneInput name="contacto_emergencia_telefono" label="Teléfono" placeholder="11 0000-0000" />
                  </div>
                </div>
              </details>
            </>
          )}

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Notas</label>
            <VoiceTextarea name="notas" value={notas} onValueChange={setNotas} rows={2} className="w-full border border-border-default rounded-lg px-3 py-2 text-sm resize-none" placeholder="Opcional…" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </>
      )}
    </form>
  )
}

/**
 * Alta liviana de un prospecto (vista Marketing). Reusa createPersona con el
 * tipo "Prospectos" preseteado y bloqueado. Sin establecimiento: solo
 * nombre + apellido + email + teléfono + notas.
 */
function ProspectoForm({
  prospectosTipoId,
  onSuccess,
}: {
  prospectosTipoId: string
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(
    createPersona,
    null as ActionResult<{ duplicado?: string }> | null
  )
  const [notas, setNotas] = useState('')

  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

  const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm'

  return (
    <form action={formAction} className="space-y-4">
      {/* Tipo fijo: Prospectos. */}
      <input type="hidden" name="tipo_id" value={prospectosTipoId} />

      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">{state.error}</div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Apellido *</label>
          <input name="apellido" required className={inputCls} placeholder="Apellido o contacto" />
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Nombre *</label>
          <input name="nombre" required className={inputCls} placeholder="Nombre / empresa" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <PhoneInput name="telefono" label="Teléfono" placeholder="11 0000-0000" />
        </div>
        <div>
          <label className="text-sm font-medium text-text-secondary block mb-1">Email</label>
          <input name="email" type="email" className={inputCls} placeholder="correo@ejemplo.com" />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Notas</label>
        <VoiceTextarea name="notas" value={notas} onValueChange={setNotas} rows={3} className="w-full border border-border-default rounded-lg px-3 py-2 text-sm resize-none" placeholder="Qué pidió, por dónde llegó, presupuesto enviado…" />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar prospecto'}</Button>
      </div>
    </form>
  )
}

export default function PersonasPage() {
  const searchParams = useSearchParams()
  const [personas, setPersonas] = useState<PersonaFila[] | null>(null)
  const [tiposPersona, setTiposPersona] = useState<TipoPersona[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [activeTipo, setActiveTipo] = useState<string>('todos')
  const [vista, setVista] = useState<DirectorioVista>('operativo')
  const [showModal, setShowModal] = useState(false)
  const [showProspectoModal, setShowProspectoModal] = useState(false)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [selectedPersona, setSelectedPersona] = useState<PersonaFila | null>(null)
  const [creatingId, setCreatingId] = useState<string | null>(null)
  const [entregaPersona, setEntregaPersona] = useState<PersonaFila | null>(null)

  function load() {
    const supabase = createClient()
    supabase
      .from('personas_directorio')
      .select('id, nombre, apellido, dni, legajo, telefono, email, direccion, notas, fecha_nacimiento, fecha_ingreso, tipo_id, user_id, foto_url, dni_frente_url, dni_dorso_url, personas_tipos(nombre)')
      .eq('is_active', true)
      .range(0, 99)
      .order('apellido')
      .then(({ data }) => setPersonas((data as unknown as PersonaFila[]) ?? []))
  }

  // Las 3 queries del mount son independientes — Promise.all las dispara
  // en paralelo en vez de una a una (serial).
  useEffect(() => {
    load()
    const supabase = createClient()
    Promise.all([
      supabase.from('personas_tipos').select('id, nombre, solo_via_cuenta').order('nombre'),
      supabase.from('empresas').select('id, razon_social').eq('is_active', true).order('razon_social'),
    ]).then(([tiposRes, empresasRes]) => {
      const tipos = (tiposRes.data ?? []) as TipoPersona[]
      // "Profesional H y S" (y cualquier tipo con solo_via_cuenta) solo se crea
      // via cuenta de usuario — no aparece en la lista del formulario del directorio.
      setTiposPersona(tipos.filter(t => !t.solo_via_cuenta))
      setEmpresas((empresasRes.data as unknown as Empresa[]) ?? [])
      // Si la URL trae ?tipo=Nombre, aplicar ese filtro por tipo al entrar.
      // ?tipo=Prospectos abre directamente la vista Marketing.
      const tipoParam = searchParams.get('tipo')
      if (tipoParam) {
        const match = tipos.find(t => t.nombre.toLowerCase() === tipoParam.toLowerCase())
        if (match?.nombre === 'Prospectos') setVista('marketing')
        else if (match) setActiveTipo(match.id)
      }
    })
  }, [searchParams])

  // Tipo "Prospectos" resuelto por NOMBRE (sin UUIDs hardcodeados). Los
  // prospectos viven solo en la vista Marketing.
  const prospectosTipoId = tiposPersona.find(t => t.nombre === 'Prospectos')?.id ?? null

  // Tipos visibles en las tabs de Operativo: todos menos Prospectos.
  const tiposOperativos = tiposPersona.filter(t => t.id !== prospectosTipoId)

  // Listado base de Operativo: excluye prospectos (tabs, counts y filas).
  const personasOperativas = personas === null
    ? null
    : personas.filter(p => p.tipo_id !== prospectosTipoId)

  // Listado de Marketing: solo prospectos.
  const prospectos = personas === null
    ? null
    : prospectosTipoId
      ? personas.filter(p => p.tipo_id === prospectosTipoId)
      : []

  const filtered = personasOperativas === null
    ? null
    : activeTipo === 'todos'
      ? personasOperativas
      : personasOperativas.filter(p => p.tipo_id === activeTipo)

  async function handleDelete(id: string) {
    if (!confirm('¿Dar de baja a esta persona?')) return
    await deletePersona(id)
    setPersonas(prev => prev?.filter(p => p.id !== id) ?? null)
  }

  // Convierte un prospecto en cliente (cambia su tipo_id). Confirma, llama al
  // server action gateado y actualiza la lista en vivo.
  async function handleConvertir(p: PersonaFila) {
    if (!confirm(
      `Convertir a ${p.apellido}, ${p.nombre} en cliente.\n\n` +
      `Va a pasar de Prospectos a Clientes en el directorio. ¿Confirmás?`,
    )) return

    setConvertingId(p.id)
    const res = await convertirProspectoEnCliente(p.id)
    setConvertingId(null)

    if (res.success) {
      toast.success(`${p.apellido}, ${p.nombre} ahora es cliente.`)
      // Sale de Marketing (ya no es prospecto): lo refrescamos desde la DB.
      load()
    } else {
      toast.error(res.error)
    }
  }

  // Crea la cuenta del trabajador desde el directorio (password = DNI, cambio
  // obligatorio en el primer ingreso). Cualquier profesional puede hacerlo.
  async function handleCrearUsuario(p: PersonaFila) {
    if (!p.email) {
      alert('Esta persona no tiene email cargado. Editala y agregá el email antes de crear el usuario.')
      return
    }
    if (!p.dni) {
      alert('Esta persona no tiene DNI cargado. El DNI es la contraseña inicial — completalo primero.')
      return
    }
    if (!confirm(
      `Crear usuario para ${p.apellido}, ${p.nombre}\n\n` +
      `Ingreso: ${p.email}\n` +
      `Contraseña inicial: su DNI (${p.dni})\n` +
      `Deberá cambiarla en el primer ingreso.`,
    )) return

    setCreatingId(p.id)
    const res = await crearUsuarioTrabajador(p.id)
    setCreatingId(null)

    if (res.success) {
      alert(
        `✅ Usuario creado.\n\n` +
        `El trabajador ingresa con:\n` +
        `• Email: ${res.data.email}\n` +
        `• Contraseña: su DNI sin puntos\n\n` +
        `Se le pedirá cambiar la contraseña en el primer ingreso.`,
      )
      load()
    } else {
      alert(`No se pudo crear el usuario:\n${res.error}`)
    }
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Personas</h1>
          <p className="text-sm text-text-secondary mt-1">
            {vista === 'marketing'
              ? 'Prospectos y potenciales clientes de la consultora'
              : 'Directorio global de personas vinculadas a la consultora'}
          </p>
        </div>
        {vista === 'marketing' ? (
          <Button onClick={() => setShowProspectoModal(true)} disabled={!prospectosTipoId}>
            <UserPlus size={16} className="mr-1.5" /> Agregar prospecto
          </Button>
        ) : (
          <Button onClick={() => setShowModal(true)}>+ Nueva Persona</Button>
        )}
      </div>

      {/* Toggle de vista: Operativo (directorio) vs Marketing (prospectos) */}
      <div className="inline-flex items-center gap-1 mb-5 p-1 rounded-xl bg-surface-elevated border border-border-subtle">
        <button
          onClick={() => setVista('operativo')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${vista === 'operativo' ? 'bg-surface-base text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
        >
          <Briefcase size={15} /> Operativo
        </button>
        <button
          onClick={() => setVista('marketing')}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors ${vista === 'marketing' ? 'bg-surface-base text-text-primary shadow-sm' : 'text-text-secondary hover:text-text-primary'}`}
        >
          <Megaphone size={15} /> Marketing
          {prospectos !== null && prospectos.length > 0 && (
            <span className="ml-0.5 text-xs px-1.5 py-0.5 rounded-full bg-sig-50 text-sig-700">{prospectos.length}</span>
          )}
        </button>
      </div>

      {vista === 'operativo' ? (
        <>
          {/* Filter tabs */}
          <div className="flex gap-1 mb-5 flex-wrap">
            <button
              onClick={() => setActiveTipo('todos')}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
            >
              Todos {personasOperativas !== null && `(${personasOperativas.length})`}
            </button>
            {tiposOperativos.map(t => {
              const count = personasOperativas?.filter(p => p.tipo_id === t.id).length ?? 0
              if (personasOperativas !== null && count === 0) return null
              return (
                <button
                  key={t.id}
                  onClick={() => setActiveTipo(t.id)}
                  className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === t.id ? 'bg-sig-500 text-white border-sig-500' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
                >
                  {t.nombre} <span className="opacity-60">({count})</span>
                </button>
              )
            })}
          </div>

          {filtered === null ? (
            <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">Cargando…</div>
          ) : filtered.length === 0 ? (
            <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
              No hay personas registradas{activeTipo !== 'todos' ? ' de este tipo' : ''}.
            </div>
          ) : (
            <div className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-border-subtle bg-surface-base">
                  <tr className="text-left">
                    <th className="px-4 py-3 text-text-secondary font-medium">Apellido y nombre</th>
                    <th className="px-4 py-3 text-text-secondary font-medium hidden sm:table-cell">Tipo</th>
                    <th className="px-4 py-3 text-text-secondary font-medium hidden sm:table-cell">DNI</th>
                    <th className="px-4 py-3 text-text-secondary font-medium hidden md:table-cell">Legajo</th>
                    <th className="px-4 py-3 text-text-secondary font-medium hidden md:table-cell">Teléfono</th>
                    <th className="px-4 py-3 text-text-secondary font-medium hidden lg:table-cell">Acceso</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map(p => (
                    <tr
                      key={p.id}
                      onClick={() => setSelectedPersona(p)}
                      className="hover:bg-surface-base cursor-pointer"
                    >
                      <td className="px-4 py-2.5 sm:py-3 font-medium text-text-primary">{p.apellido}, {p.nombre}</td>
                      <td className="px-4 py-2.5 sm:py-3 hidden sm:table-cell">
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary">
                          {p.personas_tipos?.nombre ?? '—'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 sm:py-3 text-text-secondary hidden sm:table-cell">{p.dni ?? '—'}</td>
                      <td className="px-4 py-2.5 sm:py-3 text-text-secondary hidden md:table-cell">{p.legajo ?? '—'}</td>
                      <td className="px-4 py-2.5 sm:py-3 text-text-secondary hidden md:table-cell">{p.telefono ?? '—'}</td>
                      <td className="px-4 py-2.5 sm:py-3 hidden lg:table-cell">
                        {p.user_id ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sig-50 text-sig-700">Usuario</span>
                        ) : p.personas_tipos?.nombre === 'Trabajadores' ? (
                          <button
                            onClick={e => { e.stopPropagation(); handleCrearUsuario(p) }}
                            disabled={creatingId === p.id}
                            className="text-xs font-medium px-2 py-0.5 rounded-full border border-sig-300 text-sig-700 hover:bg-sig-50 disabled:opacity-50"
                          >
                            {creatingId === p.id ? 'Creando…' : '+ Crear usuario'}
                          </button>
                        ) : (
                          <span className="text-text-tertiary text-xs">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 sm:py-3 text-right whitespace-nowrap">
                        {p.personas_tipos?.nombre === 'Trabajadores' && (
                          <button
                            onClick={e => { e.stopPropagation(); setEntregaPersona(p) }}
                            className="text-xs text-sig-600 hover:text-sig-800 mr-3"
                          >
                            Entregar EPP
                          </button>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(p.id) }}
                          className="text-xs text-red-400 hover:text-danger"
                        >
                          Dar de baja
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        /* Vista Marketing: solo prospectos */
        prospectos === null ? (
          <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">Cargando…</div>
        ) : prospectos.length === 0 ? (
          <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center">
            <Megaphone size={28} strokeWidth={1.5} className="text-text-tertiary mx-auto mb-3" />
            <p className="text-sm text-text-secondary max-w-md mx-auto">
              Todavía no cargaste prospectos. Sumá a los potenciales clientes que te piden presupuesto o que conociste por marketing.
            </p>
            <div className="mt-4 flex justify-center">
              <Button onClick={() => setShowProspectoModal(true)} disabled={!prospectosTipoId}>
                <UserPlus size={16} className="mr-1.5" /> Agregar prospecto
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
            <table className="w-full text-sm">
              <thead className="border-b border-border-subtle bg-surface-base">
                <tr className="text-left">
                  <th className="px-4 py-3 text-text-secondary font-medium">Apellido y nombre</th>
                  <th className="px-4 py-3 text-text-secondary font-medium hidden sm:table-cell">Email</th>
                  <th className="px-4 py-3 text-text-secondary font-medium hidden md:table-cell">Teléfono</th>
                  <th className="px-4 py-3 text-text-secondary font-medium hidden lg:table-cell">Notas</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {prospectos.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => setSelectedPersona(p)}
                    className="hover:bg-surface-base cursor-pointer"
                  >
                    <td className="px-4 py-2.5 sm:py-3 font-medium text-text-primary">{p.apellido}, {p.nombre}</td>
                    <td className="px-4 py-2.5 sm:py-3 text-text-secondary hidden sm:table-cell">{p.email ?? '—'}</td>
                    <td className="px-4 py-2.5 sm:py-3 text-text-secondary hidden md:table-cell">{p.telefono ?? '—'}</td>
                    <td className="px-4 py-2.5 sm:py-3 text-text-tertiary hidden lg:table-cell max-w-xs truncate">{p.notas ?? '—'}</td>
                    <td className="px-4 py-2.5 sm:py-3 text-right whitespace-nowrap">
                      <button
                        onClick={e => { e.stopPropagation(); handleConvertir(p) }}
                        disabled={convertingId === p.id}
                        className="text-xs font-medium text-sig-600 hover:text-sig-800 mr-3 disabled:opacity-50"
                      >
                        {convertingId === p.id ? 'Convirtiendo…' : 'Convertir a cliente'}
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(p.id) }}
                        className="text-xs text-red-400 hover:text-danger"
                      >
                        Dar de baja
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva Persona">
        <PersonaForm
          tiposPersona={tiposOperativos}
          empresas={empresas}
          onSuccess={() => { setShowModal(false); load() }}
        />
      </Modal>

      {prospectosTipoId && (
        <Modal open={showProspectoModal} onClose={() => setShowProspectoModal(false)} title="Nuevo prospecto">
          <ProspectoForm
            prospectosTipoId={prospectosTipoId}
            onSuccess={() => { setShowProspectoModal(false); load() }}
          />
        </Modal>
      )}

      {selectedPersona && (
        <PersonaDetalleModal
          persona={selectedPersona}
          open={!!selectedPersona}
          onClose={() => { setSelectedPersona(null); load() }}
          canWrite
        />
      )}

      {entregaPersona && (
        <EntregaEppModal
          open={!!entregaPersona}
          onClose={() => setEntregaPersona(null)}
          persona={{ id: entregaPersona.id, nombre: entregaPersona.nombre, apellido: entregaPersona.apellido }}
          onDone={() => alert('✅ Entrega registrada. El trabajador la verá en su cuenta para confirmar u observar.')}
        />
      )}
    </div>
  )
}
