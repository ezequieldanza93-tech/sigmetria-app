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
        <h3 className="font-semibold text-text-primary dark:text-white">
          Establecimientos donde trabaja
          <span className="ml-2 text-sm font-normal text-text-secondary">({establecimientos.length})</span>
        </h3>
        {puedeEditar && (
          <Button size="sm" onClick={() => setShowModal(true)}>
            + Vincular establecimiento
          </Button>
        )}
      </div>

      {!establecimientos.length ? (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle p-10 text-center text-text-tertiary">
          No está vinculado a ningún establecimiento
        </div>
      ) : (
        <div className="bg-surface-base dark:bg-surface-elevated rounded-xl border border-border-subtle dark:border-border-subtle overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-border-subtle dark:border-border-subtle bg-surface-base dark:bg-surface-sunken">
              <tr className="text-left">
                <th className="px-5 py-3 text-text-secondary font-medium">Establecimiento</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Empresa</th>
                <th className="px-5 py-3 text-text-secondary font-medium">Actividad</th>
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
                <tr key={e.id} className="hover:bg-surface-base dark:hover:bg-surface-sunken">
                  <td className="px-5 py-3.5 font-medium text-text-primary dark:text-white">{e.nombre}</td>
                  <td className="px-5 py-3.5 text-text-secondary">{e.empresas?.razon_social ?? '—'}</td>
                  <td className="px-5 py-3.5 text-text-secondary">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-surface-elevated text-text-secondary">
                      {e.establecimientos_tipos?.nombre ?? e.actividad_principal ?? '—'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {puedeEditar && (
                      <button
                        onClick={() => handleUnlink(e.id)}
                        className="text-xs text-red-400 hover:text-danger transition-colors"
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
