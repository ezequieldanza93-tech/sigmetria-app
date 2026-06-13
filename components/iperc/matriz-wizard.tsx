'use client'

import { useState } from 'react'
import { usePeligrosLibrary, useRiesgosLibrary, useMedidasControlTop, useCreateIpercSector, useCreateIpercProceso, useCreateIpercTarea, useAddPeligroATarea, useAddRiesgoAPeligro, useAddMedidaARiesgo, useRemovePeligroDeTarea, useRemoveRiesgoDePeligro, useCalcularNivelRiesgo, useProbabilidades, useConsecuencias } from '@/lib/queries/iperc'
import { useIpercCompleto } from '@/lib/queries/iperc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { NIVEL_RIESGO_BADGE, NIVEL_RIESGO_COLORS } from '@/lib/types'

interface Props {
  establecimientoId: string
  canWrite: boolean
}

export function IpercMatrizWizard({ establecimientoId, canWrite }: Props) {
  const { data: completo, isLoading } = useIpercCompleto(establecimientoId)
  const { data: peligrosLib } = usePeligrosLibrary()
  const { data: riesgosLib } = useRiesgosLibrary()
  const { data: medidasTop } = useMedidasControlTop()
  const { data: probabilidades } = useProbabilidades()
  const { data: consecuencias } = useConsecuencias()

  const createSector = useCreateIpercSector(establecimientoId)
  const createProceso = useCreateIpercProceso(establecimientoId)
  const createTarea = useCreateIpercTarea(establecimientoId)
  const addPeligro = useAddPeligroATarea(establecimientoId)
  const removePeligro = useRemovePeligroDeTarea(establecimientoId)
  const addRiesgo = useAddRiesgoAPeligro(establecimientoId)
  const removeRiesgo = useRemoveRiesgoDePeligro(establecimientoId)
  const addMedida = useAddMedidaARiesgo(establecimientoId)
  const calcularNivel = useCalcularNivelRiesgo(establecimientoId)

  // Modals state
  const [sectorModal, setSectorModal] = useState(false)
  const [procesoModal, setProcesoModal] = useState<string | null>(null)
  const [tareaModal, setTareaModal] = useState<string | null>(null)
  const [peligroModal, setPeligroModal] = useState<string | null>(null)
  const [riesgoModal, setRiesgoModal] = useState<string | null>(null)
  const [medidaModal, setMedidaModal] = useState<string | null>(null)
  const [selectedPeligroId, setSelectedPeligroId] = useState('')
  const [selectedRiesgoId, setSelectedRiesgoId] = useState('')
  const [selectedMedidaId, setSelectedMedidaId] = useState('')
  const [newMedidaTexto, setNewMedidaTexto] = useState('')

  const [expandedSector, setExpandedSector] = useState<string | null>(null)
  const [expandedProceso, setExpandedProceso] = useState<string | null>(null)
  const [expandedTarea, setExpandedTarea] = useState<string | null>(null)

  const getNivelColor = (nombre: string) => {
    const entry = Object.entries(NIVEL_RIESGO_COLORS).find(([k]) => k === nombre)
    return entry ? entry[1] : '#6b7280'
  }

  if (isLoading) return <div className="text-center py-8"><p className="text-text-secondary">Cargando matriz IPERC...</p></div>

  return (
    <div className="space-y-4">
      {/* Sectores */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Sectores</h2>
        {canWrite && <Button size="sm" onClick={() => setSectorModal(true)}>+ Sector</Button>}
      </div>

      {/* Add Sector Modal */}
      <Modal open={sectorModal} onClose={() => setSectorModal(false)} title="Nuevo Sector">
        <form onSubmit={async (e) => {
          e.preventDefault()
          const form = e.currentTarget
          await createSector.mutateAsync(new FormData(form))
          form.reset()
          setSectorModal(false)
        }} className="flex flex-col gap-4">
          <Input name="nombre" label="Nombre del Sector" required />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setSectorModal(false)}>Cancelar</Button>
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </Modal>

      {!completo?.length && (
        <div className="text-center py-8 text-text-tertiary border-2 border-dashed rounded-lg">
          No hay sectores IPERC. Creá uno para empezar.
        </div>
      )}

      {/* Tree */}
      {completo?.map(sector => (
        <div key={sector.id} className="border rounded-lg overflow-hidden">
          <button
            onClick={() => setExpandedSector(expandedSector === sector.id ? null : sector.id)}
            className="w-full flex items-center justify-between p-3 bg-surface-base hover:bg-surface-elevated"
          >
            <div className="flex items-center gap-2">
              <span className="font-medium">{sector.nombre}</span>
              {sector.nivel_riesgo_maximo && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${NIVEL_RIESGO_BADGE[sector.nivel_riesgo_maximo.nombre as keyof typeof NIVEL_RIESGO_BADGE] || ''}`}>
                  {sector.nivel_riesgo_maximo.nombre}
                </span>
              )}
            </div>
            <span className="text-text-tertiary">{expandedSector === sector.id ? '▼' : '▶'}</span>
          </button>

          {expandedSector === sector.id && (
            <div className="p-3 pl-6 space-y-3">
              {/* Procesos */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-text-secondary">Procesos / Actividades</h3>
                {canWrite && <Button size="sm" variant="ghost" onClick={() => setProcesoModal(sector.id)}>+ Proceso</Button>}
              </div>

              <Modal open={procesoModal === sector.id} onClose={() => setProcesoModal(null)} title="Nuevo Proceso">
                <form onSubmit={async (e) => {
                  e.preventDefault()
                  const form = e.currentTarget
                  await createProceso.mutateAsync({ sectorId: sector.id, formData: new FormData(form) })
                  form.reset()
                  setProcesoModal(null)
                }} className="flex flex-col gap-4">
                  <Input name="nombre" label="Nombre del Proceso" required />
                  <Input name="descripcion" label="Descripción" />
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="secondary" onClick={() => setProcesoModal(null)}>Cancelar</Button>
                    <Button type="submit">Crear</Button>
                  </div>
                </form>
              </Modal>

              {(sector.iperc_procesos ?? []).map((proceso: any) => (
                <div key={proceso.id} className="border-l-2 border-border-subtle pl-3 space-y-2">
                  <button
                    onClick={() => setExpandedProceso(expandedProceso === proceso.id ? null : proceso.id)}
                    className="flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text-primary"
                  >
                    <span>{expandedProceso === proceso.id ? '▼' : '▶'}</span>
                    {proceso.nombre}
                  </button>

                  {expandedProceso === proceso.id && (
                    <div className="pl-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-text-tertiary">Tareas</span>
                        {canWrite && <Button size="sm" variant="ghost" onClick={() => setTareaModal(proceso.id)}>+ Tarea</Button>}
                      </div>

                      <Modal open={tareaModal === proceso.id} onClose={() => setTareaModal(null)} title="Nueva Tarea">
                        <form onSubmit={async (e) => {
                          e.preventDefault()
                          const form = e.currentTarget
                          await createTarea.mutateAsync({ procesoId: proceso.id, formData: new FormData(form) })
                          form.reset()
                          setTareaModal(null)
                        }} className="flex flex-col gap-4">
                          <Input name="nombre" label="Nombre de la Tarea" required />
                          <Input name="task_number" label="N° de Orden" type="number" defaultValue="0" />
                          <Input name="descripcion" label="Descripción" />
                          <div className="flex gap-2 justify-end">
                            <Button type="button" variant="secondary" onClick={() => setTareaModal(null)}>Cancelar</Button>
                            <Button type="submit">Crear</Button>
                          </div>
                        </form>
                      </Modal>

                      {(proceso.iperc_tareas ?? []).sort((a: any, b: any) => a.task_number - b.task_number).map((tarea: any) => (
                        <div key={tarea.id} className="border rounded p-2 bg-surface-base">
                          <button
                            onClick={() => setExpandedTarea(expandedTarea === tarea.id ? null : tarea.id)}
                            className="w-full flex items-center justify-between text-sm"
                          >
                            <span><strong>#{tarea.task_number}</strong> {tarea.nombre}</span>
                            <span className="text-text-tertiary">{expandedTarea === tarea.id ? '▼' : '▶'}</span>
                          </button>

                          {expandedTarea === tarea.id && (
                            <div className="mt-2 pl-2 space-y-3">
                              {/* Peligros */}
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-text-secondary">Peligros</span>
                                {canWrite && <Button size="sm" variant="ghost" onClick={() => { setPeligroModal(tarea.id); setSelectedPeligroId('') }}>+ Peligro</Button>}
                              </div>

                              <Modal open={peligroModal === tarea.id} onClose={() => setPeligroModal(null)} title="Agregar Peligro">
                                <form onSubmit={async (e) => {
                                  e.preventDefault()
                                  if (!selectedPeligroId) return
                                  await addPeligro.mutateAsync({ tareaId: tarea.id, peligroId: selectedPeligroId })
                                  setPeligroModal(null)
                                }} className="flex flex-col gap-4">
                                  <Select
                                    name="peligro_id"
                                    label="Peligro"
                                    options={(peligrosLib ?? []).map((p: any) => ({ value: p.id, label: `${p.nombre} (${p.factor})` }))}
                                    placeholder="Buscar peligro..."
                                    value={selectedPeligroId}
                                    onChange={e => setSelectedPeligroId(e.target.value)}
                                  />
                                  <div className="flex gap-2 justify-end">
                                    <Button type="button" variant="secondary" onClick={() => setPeligroModal(null)}>Cancelar</Button>
                                    <Button type="submit">Agregar</Button>
                                  </div>
                                </form>
                              </Modal>

                              {(tarea.iperc_matriz_peligros ?? []).map((mp: any) => (
                                <div key={mp.id} className="border-l-2 border-orange-300 pl-2 py-1">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <span className="text-sm font-medium">{mp.peligro?.nombre}</span>
                                      {mp.peligro?.factor && <Badge className="ml-2">{mp.peligro.factor}</Badge>}
                                    </div>
                                    {canWrite && <Button variant="ghost" size="sm" onClick={() => removePeligro.mutate(mp.id)}>✕</Button>}
                                  </div>

                                  {/* Riesgos */}
                                  <div className="mt-2 pl-2 space-y-2">
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs text-text-tertiary">Riesgos asociados</span>
                                      {canWrite && <Button size="sm" variant="ghost" onClick={() => { setRiesgoModal(mp.id); setSelectedRiesgoId('') }}>+ Riesgo</Button>}
                                    </div>

                                    <Modal open={riesgoModal === mp.id} onClose={() => setRiesgoModal(null)} title="Agregar Riesgo" size="full">
                                      <form onSubmit={async (e) => {
                                        e.preventDefault()
                                        if (!selectedRiesgoId) return
                                        await addRiesgo.mutateAsync({ peligroMatrizId: mp.id, riesgoId: selectedRiesgoId })
                                        setRiesgoModal(null)
                                      }} className="flex flex-col gap-4">
                                        <Select
                                          name="riesgo_id"
                                          label="Riesgo"
                                          options={(riesgosLib ?? []).map((r: any) => ({ value: r.id, label: `${r.nombre} (${r.tipo})` }))}
                                          placeholder="Buscar riesgo..."
                                          value={selectedRiesgoId}
                                          onChange={e => setSelectedRiesgoId(e.target.value)}
                                        />
                                        <div className="flex gap-2 justify-end">
                                          <Button type="button" variant="secondary" onClick={() => setRiesgoModal(null)}>Cancelar</Button>
                                          <Button type="submit">Agregar</Button>
                                        </div>
                                      </form>
                                    </Modal>

                                    {(mp.iperc_matriz_riesgos ?? []).map((mr: any) => (
                                      <div key={mr.id} className="border rounded p-2 bg-surface-base">
                                        <div className="flex items-start justify-between">
                                          <div className="space-y-1 flex-1">
                                            <div className="flex items-center gap-2">
                                              <span className="text-sm font-medium">{mr.riesgo?.nombre}</span>
                                              {canWrite && (
                                                <Button variant="ghost" size="sm" onClick={() => removeRiesgo.mutate(mr.id)}>✕</Button>
                                              )}
                                            </div>
                                            {mr.riesgo?.tipo && <Badge variant="info">{mr.riesgo.tipo}</Badge>}

                                            {/* Nivel de Riesgo */}
                                            <div className="flex items-center gap-2 mt-2">
                                              <select
                                                className="text-xs border rounded px-2 py-1"
                                                value={mr.probabilidad_id || ''}
                                                onChange={async (e) => {
                                                  if (e.target.value && mr.consecuencia_id) {
                                                    await calcularNivel.mutateAsync({
                                                      riesgoMatrizId: mr.id,
                                                      probabilidadId: e.target.value,
                                                      consecuenciaId: mr.consecuencia_id,
                                                    })
                                                  }
                                                }}
                                              >
                                                <option value="">Probabilidad</option>
                                                {(probabilidades ?? []).map((p: any) => (
                                                  <option key={p.id} value={p.id}>{p.nivel} ({p.valor_numerico})</option>
                                                ))}
                                              </select>
                                              <span className="text-text-tertiary">×</span>
                                              <select
                                                className="text-xs border rounded px-2 py-1"
                                                value={mr.consecuencia_id || ''}
                                                onChange={async (e) => {
                                                  if (e.target.value && mr.probabilidad_id) {
                                                    await calcularNivel.mutateAsync({
                                                      riesgoMatrizId: mr.id,
                                                      probabilidadId: mr.probabilidad_id,
                                                      consecuenciaId: e.target.value,
                                                    })
                                                  }
                                                }}
                                              >
                                                <option value="">Consecuencia</option>
                                                {(consecuencias ?? []).map((c: any) => (
                                                  <option key={c.id} value={c.id}>{c.nivel} ({c.valor_numerico})</option>
                                                ))}
                                              </select>

                                              {mr.nivel_riesgo && (
                                                <span
                                                  className="text-xs font-bold px-2 py-0.5 rounded-full text-white"
                                                  style={{ backgroundColor: getNivelColor(mr.nivel_riesgo.nombre) }}
                                                >
                                                  {mr.nivel_riesgo.nombre} ({mr.valor_calculado})
                                                </span>
                                              )}
                                            </div>

                                            {/* Medidas de Control */}
                                            <div className="mt-2">
                                              <div className="flex items-center justify-between">
                                                <span className="text-xs text-text-tertiary">Medidas de Control</span>
                                                {canWrite && <Button size="sm" variant="ghost" onClick={() => { setMedidaModal(mr.id); setSelectedMedidaId('') }}>+ Medida</Button>}
                                              </div>

                                              <Modal open={medidaModal === mr.id} onClose={() => setMedidaModal(null)} title="Agregar Medida de Control" size="full">
                                                <div className="flex flex-col gap-4">
                                                  <Select
                                                    name="medida_id"
                                                    label="Medida existente"
                                                    options={(medidasTop ?? []).map((m: any) => ({ value: m.id, label: m.texto }))}
                                                    placeholder="Seleccionar medida..."
                                                    value={selectedMedidaId}
                                                    onChange={e => setSelectedMedidaId(e.target.value)}
                                                  />
                                                  <Button
                                                    variant="secondary"
                                                    onClick={async () => {
                                                      if (!selectedMedidaId) return
                                                      await addMedida.mutateAsync({ riesgoMatrizId: mr.id, medidaId: selectedMedidaId })
                                                      setMedidaModal(null)
                                                    }}
                                                  >
                                                    Agregar existente
                                                  </Button>
                                                  <hr />
                                                  <Input
                                                    label="O crear nueva (máx 150 caracteres)"
                                                    maxLength={150}
                                                    value={newMedidaTexto}
                                                    onChange={e => setNewMedidaTexto(e.target.value)}
                                                  />
                                                  <p className="text-xs text-text-tertiary">{newMedidaTexto.length}/150</p>
                                                  <div className="flex gap-2 justify-end">
                                                    <Button type="button" variant="secondary" onClick={() => setMedidaModal(null)}>Cancelar</Button>
                                                  </div>
                                                </div>
                                              </Modal>

                                              <div className="flex flex-wrap gap-1 mt-1">
                                                {(mr.iperc_riesgos_medidas ?? []).map((rm: any) => (
                                                  <span key={rm.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-info-bg text-info text-xs rounded-full">
                                                    {rm.medida?.texto}
                                                    {canWrite && (
                                                      <button onClick={() => { /* remove */ }} className="text-blue-400 hover:text-info">×</button>
                                                    )}
                                                  </span>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
