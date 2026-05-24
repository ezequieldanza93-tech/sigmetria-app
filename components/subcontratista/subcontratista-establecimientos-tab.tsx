'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { useConsultoraEstablecimientos } from '@/lib/queries/subcontratista'
import { linkSubcontratistaToEstablecimiento, unlinkSubcontratistaFromEstablecimiento } from '@/lib/actions/subcontratista'

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  establecimientos: any[]
  subcontratistaId: string
  organizacionId: string
  puedeEditar: boolean
}

export function SubcontratistaEstablecimientosTab({ establecimientos, subcontratistaId, puedeEditar }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [selectedEstId, setSelectedEstId] = useState('')
  const { data: allEstablecimientos = [] } = useConsultoraEstablecimientos(showModal)

  // Filter out already linked
  const linkedIds = new Set(establecimientos.map(e => e.id))
  const available = allEstablecimientos.filter(e => !linkedIds.has(e.id))

  async function handleLink() {
    if (!selectedEstId) return
    const formData = new FormData()
    formData.set('establecimiento_id', selectedEstId)
    const result = await linkSubcontratistaToEstablecimiento(subcontratistaId, null, formData)
    if (result.success) {
      setShowModal(false)
      setSelectedEstId('')
    } else {
      alert(result.error)
    }
  }

  async function handleUnlink(estId: string) {
    if (!confirm('¿Desvincular este establecimiento?')) return
    await unlinkSubcontratistaFromEstablecimiento(subcontratistaId, estId)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900 dark:text-white">
          Establecimientos donde trabaja
          <span className="ml-2 text-sm font-normal text-gray-500">({establecimientos.length})</span>
        </h3>
        {puedeEditar && (
          <Button size="sm" onClick={() => setShowModal(true)}>
            + Vincular establecimiento
          </Button>
        )}
      </div>

      {!establecimientos.length ? (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle p-10 text-center text-gray-400">
          No está vinculado a ningún establecimiento
        </div>
      ) : (
        <div className="bg-white dark:bg-surface-elevated rounded-xl border border-gray-200 dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 dark:border-border-subtle bg-gray-50 dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Establecimiento</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Empresa</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Actividad</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-border-subtle">
              {establecimientos.map((e: {
                id: string
                nombre: string
                actividad_principal: string | null
                empresas?: { razon_social: string } | null
                establecimientos_tipos?: { nombre: string } | null
              }) => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-surface-sunken">
                  <td className="px-5 py-3.5 font-medium text-gray-900 dark:text-white">{e.nombre}</td>
                  <td className="px-5 py-3.5 text-gray-500">{e.empresas?.razon_social ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                      {e.establecimientos_tipos?.nombre ?? e.actividad_principal ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {puedeEditar && (
                      <button
                        onClick={() => handleUnlink(e.id)}
                        className="text-xs text-red-400 hover:text-red-600 transition-colors"
                      >
                        Desvincular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title="Vincular a Establecimiento">
        <div className="space-y-4">
          <Select
            label="Establecimiento"
            value={selectedEstId}
            onChange={e => setSelectedEstId(e.target.value)}
            options={available.map(e => ({ value: e.id, label: `${e.nombre}${e.empresas ? ` (${e.empresas.razon_social})` : ''}` }))}
            placeholder={available.length ? 'Seleccionar establecimiento…' : 'No hay establecimientos disponibles'}
            disabled={available.length === 0}
          />
          <div className="flex gap-3 pt-2">
            <Button onClick={handleLink} disabled={!selectedEstId}>Vincular</Button>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
