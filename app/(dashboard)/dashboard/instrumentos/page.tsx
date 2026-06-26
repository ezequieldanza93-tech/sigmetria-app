'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { createClient } from '@/lib/supabase/client'
import { deleteInstrumento } from '@/lib/actions/instrumento'
import { InstrumentoModal } from '@/components/instrumento-modal'
import { InstrumentoCreateForm, type Subcategoria } from '@/components/instrumento-create-form'
import type { InstrumentoMedicion } from '@/lib/types'

// Categoría del catálogo (clase EPC) de la que sale el modelo del instrumento.
// Sus subcategorías (componentes) SON los tipos de medición.
const CAT_MEDICIONES_HYS = '318ea652-2295-4d3f-8ffb-f8f047f84fe6'

export default function InstrumentosPage() {
  const [instrumentos, setInstrumentos] = useState<InstrumentoMedicion[] | null>(null)
  const [subcategorias, setSubcategorias] = useState<Subcategoria[]>([])
  const [activeSubcat, setActiveSubcat] = useState<string>('todos')
  const [showModal, setShowModal] = useState(false)
  const [selectedInstrumento, setSelectedInstrumento] = useState<InstrumentoMedicion | null>(null)

  function load() {
    const supabase = createClient()
    supabase
      .from('mediciones_instrumentos')
      .select('*, productos_componentes(nombre), organizaciones_externas(nombre), personas_directorio(nombre, apellido)')
      .eq('is_active', true)
      .range(0, 99)
      .order('modelo')
      .then(({ data }) => setInstrumentos((data as unknown as InstrumentoMedicion[]) ?? []))
  }

  useEffect(() => {
    load()
    const supabase = createClient()
    supabase
      .from('productos_componentes')
      .select('id, nombre')
      .eq('categoria_id', CAT_MEDICIONES_HYS)
      .order('nombre')
      .then(({ data }) => setSubcategorias((data ?? []) as Subcategoria[]))
  }, [])

  const filtered = instrumentos === null
    ? null
    : activeSubcat === 'todos'
      ? instrumentos
      : instrumentos.filter(i => i.subcategoria_id === activeSubcat)

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

      {/* Filtro por tipo de medición (subcategoría del catálogo) */}
      <div className="flex gap-1 mb-5 flex-wrap">
        <button
          onClick={() => setActiveSubcat('todos')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSubcat === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
        >
          Todos {instrumentos !== null && `(${instrumentos.length})`}
        </button>
        {subcategorias.map(s => {
          const count = instrumentos?.filter(i => i.subcategoria_id === s.id).length ?? 0
          return (
            <button
              key={s.id}
              onClick={() => setActiveSubcat(s.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSubcat === s.id ? 'bg-sig-500 text-white border-sig-500' : 'border-border-default text-text-secondary hover:bg-surface-base'}`}
            >
              {s.nombre} ({count})
            </button>
          )
        })}
      </div>

      {filtered === null ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-base rounded-xl border border-border-subtle p-8 text-center text-text-tertiary">
          No hay instrumentos registrados{activeSubcat !== 'todos' ? ' de este tipo' : ''}.
        </div>
      ) : (
        <div className="bg-surface-base rounded-xl border border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle bg-surface-base">
              <tr className="text-left">
                <th className="px-5 py-3 text-text-secondary font-medium">Modelo</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Tipo de medición</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Marca</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Nro. de serie</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Dueño</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(i => (
                <tr key={i.id} className="hover:bg-surface-base cursor-pointer" onClick={() => setSelectedInstrumento(i)}>
                  <td className="px-5 py-3.5 font-medium text-text-primary">{i.modelo ?? '—'}</td>
                  <td className="px-5 py-3.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-sig-50 text-sig-700">
                      {i.productos_componentes?.nombre ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-text-secondary">{i.organizaciones_externas?.nombre ?? '—'}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{i.numero_serie ?? '—'}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{i.personas_directorio ? `${i.personas_directorio.apellido}, ${i.personas_directorio.nombre}` : '—'}</td>
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
        <InstrumentoCreateForm
          subcategorias={subcategorias}
          onCreated={() => { setShowModal(false); load() }}
        />
      </Modal>
    </div>
  )
}
