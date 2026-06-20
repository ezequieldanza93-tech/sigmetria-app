'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { createPersona, deletePersona } from '@/lib/actions/persona'
import { SectorPuestoSelectorConAlta } from '@/components/sector-puesto-selector-con-alta'
import type { DirectorioPersona, TipoPersona, Empresa, Establecimiento, ActionResult } from '@/lib/types'

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
              <label className="text-sm font-medium text-text-secondary block mb-1">Teléfono</label>
              <input name="telefono" className={inputCls} placeholder="+54 11 0000-0000" />
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
                    <label className="text-xs text-text-secondary block mb-0.5">Teléfono</label>
                    <input name="contacto_emergencia_telefono" className="w-full border border-border-default rounded-lg px-2 py-1.5 text-sm" placeholder="+54 11 0000-0000" />
                  </div>
                </div>
              </details>
            </>
          )}

          <div>
            <label className="text-sm font-medium text-text-secondary block mb-1">Notas</label>
            <textarea name="notas" rows={2} className="w-full border border-border-default rounded-lg px-3 py-2 text-sm resize-none" placeholder="Opcional…" />
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
          </div>
        </>
      )}
    </form>
  )
}

export default function PersonasPage() {
  const searchParams = useSearchParams()
  const [personas, setPersonas] = useState<DirectorioPersona[] | null>(null)
  const [tiposPersona, setTiposPersona] = useState<TipoPersona[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [activeTipo, setActiveTipo] = useState<string>('todos')
  const [showModal, setShowModal] = useState(false)

  function load() {
    const supabase = createClient()
    supabase
      .from('personas_directorio')
      .select('id, nombre, apellido, dni, legajo, telefono, tipo_id, personas_tipos(nombre)')
      .eq('is_active', true)
      .range(0, 99)
      .order('apellido')
      .then(({ data }) => setPersonas((data as unknown as DirectorioPersona[]) ?? []))
  }

  // Las 3 queries del mount son independientes — Promise.all las dispara
  // en paralelo en vez de una a una (serial).
  useEffect(() => {
    load()
    const supabase = createClient()
    Promise.all([
      supabase.from('personas_tipos').select('id, nombre').order('nombre'),
      supabase.from('empresas').select('id, razon_social').eq('is_active', true).order('razon_social'),
    ]).then(([tiposRes, empresasRes]) => {
      const tipos = (tiposRes.data ?? []) as TipoPersona[]
      setTiposPersona(tipos)
      setEmpresas((empresasRes.data as unknown as Empresa[]) ?? [])
      // Si la URL trae ?tipo=Nombre, aplicar ese filtro por tipo al entrar
      const tipoParam = searchParams.get('tipo')
      if (tipoParam) {
        const match = tipos.find(t => t.nombre.toLowerCase() === tipoParam.toLowerCase())
        if (match) setActiveTipo(match.id)
      }
    })
  }, [searchParams])

  const filtered = personas === null
    ? null
    : activeTipo === 'todos'
      ? personas
      : personas.filter(p => p.tipo_id === activeTipo)

  async function handleDelete(id: string) {
    if (!confirm('¿Dar de baja a esta persona?')) return
    await deletePersona(id)
    setPersonas(prev => prev?.filter(p => p.id !== id) ?? null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Personas</h1>
          <p className="text-sm text-text-secondary mt-1">Directorio global de personas vinculadas a la consultora</p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ Nueva Persona</Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        <button
          onClick={() => setActiveTipo('todos')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
        >
          Todos {personas !== null && `(${personas.length})`}
        </button>
        {tiposPersona.map(t => {
          const count = personas?.filter(p => p.tipo_id === t.id).length ?? 0
          if (personas !== null && count === 0) return null
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
                <th className="px-5 py-3 text-text-secondary font-medium">Apellido y nombre</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Tipo</th>
                <th className="px-5 py-3 text-text-secondary font-medium">DNI</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Legajo</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Teléfono</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-surface-base">
                  <td className="px-5 py-3.5 font-medium text-text-primary">{p.apellido}, {p.nombre}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary">
                      {p.personas_tipos?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">{p.dni ?? '—'}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{p.legajo ?? '—'}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{p.telefono ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => handleDelete(p.id)}
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

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva Persona">
        <PersonaForm
          tiposPersona={tiposPersona}
          empresas={empresas}
          onSuccess={() => { setShowModal(false); load() }}
        />
      </Modal>
    </div>
  )
}
