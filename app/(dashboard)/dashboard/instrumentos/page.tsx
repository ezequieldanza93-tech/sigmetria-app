'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { createInstrumento, deleteInstrumento } from '@/lib/actions/instrumento'
import { InstrumentoModal } from '@/components/instrumento-modal'
import type { InstrumentoMedicion, TipoInstrumentoMedicion, Organizacion, ActionResult } from '@/lib/types'

function InstrumentoForm({
  tipos,
  marcas,
  onSuccess,
}: {
  tipos: TipoInstrumentoMedicion[]
  marcas: Organizacion[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(
    createInstrumento,
    null as ActionResult<null> | null
  )
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">{state.error}</div>
      )}
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Tipo *</label>
        <select name="tipo_id" required className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base">
          <option value="">Seleccioná un tipo…</option>
          {tipos.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Modelo *</label>
        <input name="modelo" required className="w-full border border-border-default rounded-lg px-3 py-2 text-sm" placeholder="Ej: Testo 440" />
      </div>
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Marca</label>
        <select name="marca_id" className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base">
          <option value="">Sin marca</option>
          {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
        </select>
      </div>
      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Número de serie</label>
        <input name="numero_serie" className="w-full border border-border-default rounded-lg px-3 py-2 text-sm" placeholder="Ej: SN-12345" />
      </div>
      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

export default function InstrumentosPage() {
  const [instrumentos, setInstrumentos] = useState<InstrumentoMedicion[] | null>(null)
  const [tipos, setTipos] = useState<TipoInstrumentoMedicion[]>([])
  const [marcas, setMarcas] = useState<Organizacion[]>([])
  const [activeTipo, setActiveTipo] = useState<string>('todos')
  const [showModal, setShowModal] = useState(false)
  const [selectedInstrumento, setSelectedInstrumento] = useState<InstrumentoMedicion | null>(null)

  function load() {
    const supabase = createClient()
    supabase
      .from('mediciones_instrumentos')
      .select('*, mediciones_instrumentos_tipos(nombre), organizaciones_externas(nombre)')
      .eq('is_active', true)
      .range(0, 99)
      .order('modelo')
      .then(({ data }) => setInstrumentos((data as unknown as InstrumentoMedicion[]) ?? []))
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase.from('mediciones_instrumentos_tipos').select('*').order('nombre')
      .then(({ data }) => setTipos(data ?? []))
    supabase
      .from('organizaciones_externas')
      .select('id, nombre, tipo_id, organizaciones_tipos(nombre)')
      .range(0, 99)
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => {
        const marcasOnly = ((data ?? []) as unknown as Organizacion[]).filter(o => o.organizaciones_tipos?.nombre === 'Marca')
        setMarcas(marcasOnly)
      })
  }, [])

  const filtered = instrumentos === null
    ? null
    : activeTipo === 'todos'
      ? instrumentos
      : instrumentos.filter(i => i.tipo_id === activeTipo)

  async function handleDelete(id: string) {
    if (!confirm('¿Dar de baja este instrumento?')) return
    await deleteInstrumento(id)
    setInstrumentos(prev => prev?.filter(i => i.id !== id) ?? null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Instrumentos de Medición</h1>
          <p className="text-sm text-text-secondary mt-1">Equipos de medición habilitados para uso en campo</p>
        </div>
        <Button onClick={() => setShowModal(true)}>+ Nuevo Instrumento</Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        <button
          onClick={() => setActiveTipo('todos')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
        >
          Todos {instrumentos !== null && `(${instrumentos.length})`}
        </button>
        {tipos.map(t => {
          const count = instrumentos?.filter(i => i.tipo_id === t.id).length ?? 0
          return (
            <button
              key={t.id}
              onClick={() => setActiveTipo(t.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === t.id ? 'bg-sig-500 text-white border-sig-500' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
            >
              {t.nombre} ({count})
            </button>
          )
        })}
      </div>

      {filtered === null ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
          No hay instrumentos registrados{activeTipo !== 'todos' ? ' de este tipo' : ''}.
        </div>
      ) : (
        <div className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle bg-surface-base">
              <tr className="text-left">
                <th className="px-5 py-3 text-text-secondary font-medium">Modelo</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Tipo</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Marca</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Nro. de serie</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(i => (
                <tr key={i.id} className="hover:bg-surface-base cursor-pointer" onClick={() => setSelectedInstrumento(i)}>
                  <td className="px-5 py-3.5 font-medium text-text-primary">{i.modelo}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sig-50 text-sig-700">
                      {i.mediciones_instrumentos_tipos?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">{i.organizaciones_externas?.nombre ?? '—'}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{i.numero_serie ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={e => { e.stopPropagation(); handleDelete(i.id) }}
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

      {selectedInstrumento && (
        <InstrumentoModal
          instrumento={selectedInstrumento}
          open={!!selectedInstrumento}
          onClose={() => setSelectedInstrumento(null)}
          canWrite={true}
        />
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo Instrumento">
        <InstrumentoForm
          tipos={tipos}
          marcas={marcas}
          onSuccess={() => { setShowModal(false); load() }}
        />
      </Modal>
    </div>
  )
}
