'use client'

import { useState } from 'react'
import { usePeligrosLibrary, useRiesgosLibrary, useConsecuencias, useProbabilidades, useNivelesRiesgo, useCreatePeligro, useDeletePeligro, useCreateRiesgoLib, useDeleteRiesgoLib, useCreateMedidaControl, useDeleteMedidaControl, useMedidasControlTop } from '@/lib/queries/iperc'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { IPERC_FACTORES, IPERC_RIESGO_TIPOS } from '@/lib/constants'
import { NIVEL_RIESGO_BADGE } from '@/lib/types'
import { useEffectiveRoleContext } from '@/lib/contexts/effective-role-context'

// Un ítem es genérico (base de Sigmetría) cuando consultora_id IS NULL.
// Los genéricos los administra solo el staff; el resto los ve como solo-lectura.
function useIsStaff() {
  return useEffectiveRoleContext()?.isSuperAdmin ?? false
}

function BaseBadge() {
  return (
    <Badge variant="info" className="shrink-0">Base</Badge>
  )
}

// Nota mostrada arriba de las escalas (genéricas únicas, solo lectura).
function EscalaNota() {
  return (
    <p className="text-xs text-text-tertiary mb-3">
      Escala estándar de Sigmetría — compartida por todas las consultoras (solo lectura).
    </p>
  )
}

type Tab = 'peligros' | 'riesgos' | 'medidas' | 'consecuencias' | 'probabilidades' | 'niveles'

const TABS: { id: Tab; label: string }[] = [
  { id: 'peligros', label: 'Peligros' },
  { id: 'riesgos', label: 'Riesgos' },
  { id: 'medidas', label: 'Medidas de Control' },
  { id: 'consecuencias', label: 'Consecuencias' },
  { id: 'probabilidades', label: 'Probabilidades' },
  { id: 'niveles', label: 'Niveles de Riesgo' },
]

export default function IpercConfigPage() {
  const [tab, setTab] = useState<Tab>('peligros')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Configuración IPERC</h1>
      <div className="border-b border-border-subtle mb-6">
        <div className="flex gap-1 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap rounded-t-lg transition-colors -mb-px border-b-2 ${
                t.id === tab
                  ? 'border-sig-500 text-sig-500'
                  : 'border-transparent text-text-secondary hover:text-text-secondary hover:border-border-default'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'peligros' && <PeligrosTab />}
      {tab === 'riesgos' && <RiesgosTab />}
      {tab === 'medidas' && <MedidasTab />}
      {tab === 'consecuencias' && <ConsecuenciasTab />}
      {tab === 'probabilidades' && <ProbabilidadesTab />}
      {tab === 'niveles' && <NivelesTab />}
    </div>
  )
}

function PeligrosTab() {
  const { data: peligros, isLoading } = usePeligrosLibrary()
  const createPeligro = useCreatePeligro()
  const deletePeligro = useDeletePeligro()
  const [modal, setModal] = useState(false)
  const isStaff = useIsStaff()

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-secondary">{peligros?.length ?? 0} peligros</p>
        <Button onClick={() => setModal(true)}>Nuevo Peligro</Button>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Peligro">
        <form onSubmit={async (e) => {
          e.preventDefault()
          const form = e.currentTarget
          await createPeligro.mutateAsync(new FormData(form))
          form.reset()
          setModal(false)
        }} className="flex flex-col gap-4">
          <Input name="nombre" label="Nombre" required />
          <Select name="factor" label="Factor" required options={IPERC_FACTORES.map(f => ({ value: f, label: f }))} placeholder="Seleccionar factor" />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </Modal>
      {isLoading ? <p>Cargando...</p> : (
        <div className="grid gap-2">
          {(peligros ?? []).map((p: any) => (
            <div key={p.id} className="flex items-center justify-between p-3 bg-surface-base border rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{p.nombre}</p>
                  {p.consultora_id === null && <BaseBadge />}
                </div>
                <Badge>{p.factor}</Badge>
              </div>
              {(p.consultora_id !== null || isStaff) && (
                <Button variant="ghost" size="sm" onClick={() => deletePeligro.mutate(p.id)}>Eliminar</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RiesgosTab() {
  const { data: riesgos, isLoading } = useRiesgosLibrary()
  const createRiesgo = useCreateRiesgoLib()
  const deleteRiesgo = useDeleteRiesgoLib()
  const [modal, setModal] = useState(false)
  const isStaff = useIsStaff()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    await createRiesgo.mutateAsync(formData)
    form.reset()
    setModal(false)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-secondary">{riesgos?.length ?? 0} riesgos</p>
        <Button onClick={() => setModal(true)}>Nuevo Riesgo</Button>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Riesgo">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input name="nombre" label="Nombre" required />
          <Select name="tipo" label="Tipo" required options={IPERC_RIESGO_TIPOS.map(t => ({ value: t, label: t }))} placeholder="Seleccionar tipo" />
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </Modal>
      {isLoading ? <p>Cargando...</p> : (
        <div className="grid gap-2">
          {(riesgos ?? []).map((r: any) => (
            <div key={r.id} className="flex items-center justify-between p-3 bg-surface-base border rounded-lg">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium">{r.nombre}</p>
                  {r.consultora_id === null && <BaseBadge />}
                </div>
                <Badge variant="info">{r.tipo}</Badge>
              </div>
              {(r.consultora_id !== null || isStaff) && (
                <Button variant="ghost" size="sm" onClick={() => deleteRiesgo.mutate(r.id)}>Eliminar</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MedidasTab() {
  const { data: medidas, isLoading } = useMedidasControlTop()
  const createMedida = useCreateMedidaControl()
  const deleteMedida = useDeleteMedidaControl()
  const [modal, setModal] = useState(false)
  const [texto, setTexto] = useState('')
  const isStaff = useIsStaff()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!texto.trim()) return
    await createMedida.mutateAsync(texto)
    setTexto('')
    setModal(false)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm text-text-secondary">{medidas?.length ?? 0} medidas (más usadas)</p>
        <Button onClick={() => setModal(true)}>Nueva Medida</Button>
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Nueva Medida de Control">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            name="texto"
            label="Texto (máx 150 caracteres)"
            required
            maxLength={150}
            value={texto}
            onChange={e => setTexto(e.target.value)}
          />
          <p className="text-xs text-text-tertiary">{texto.length}/150</p>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </Modal>
      {isLoading ? <p>Cargando...</p> : (
        <div className="grid gap-2">
          {(medidas ?? []).map((m: any) => (
            <div key={m.id} className="flex items-center justify-between p-3 bg-surface-base border rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium">{m.texto}</p>
                  {m.consultora_id === null && <BaseBadge />}
                </div>
                <p className="text-xs text-text-tertiary">Usada {m.veces_usada} veces</p>
              </div>
              {(m.consultora_id !== null || isStaff) && (
                <Button variant="ghost" size="sm" onClick={() => deleteMedida.mutate(m.id)}>Eliminar</Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ConsecuenciasTab() {
  const { data: consecuencias, isLoading } = useConsecuencias()

  if (isLoading) return <p>Cargando...</p>

  return (
    <div>
      <EscalaNota />
      <div className="grid gap-4">
      {(consecuencias ?? []).map((c: any) => (
        <div key={c.id} className="p-4 bg-surface-base border rounded-lg">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-semibold">{c.nivel}</h3>
            <Badge>Valor: {c.valor_numerico}</Badge>
          </div>
          <div className="flex flex-wrap gap-1">
            {(c.iperc_consecuencia_items ?? []).map((item: any) => (
              <span key={item.id} className="px-2 py-1 bg-surface-elevated text-xs rounded">{item.nombre}</span>
            ))}
          </div>
        </div>
      ))}
      </div>
    </div>
  )
}

function ProbabilidadesTab() {
  const { data: probabilidades, isLoading } = useProbabilidades()

  if (isLoading) return <p>Cargando...</p>

  return (
    <div>
      <EscalaNota />
      <div className="grid gap-3">
        {(probabilidades ?? []).map((p: any) => (
          <div key={p.id} className="flex items-center justify-between p-4 bg-surface-base border rounded-lg">
            <span className="font-medium">{p.nivel}</span>
            <Badge>Valor: {p.valor_numerico}</Badge>
          </div>
        ))}
      </div>
    </div>
  )
}

function NivelesTab() {
  const { data: niveles, isLoading } = useNivelesRiesgo()

  if (isLoading) return <p>Cargando...</p>

  return (
    <div>
      <EscalaNota />
      <div className="grid gap-4">
        {(niveles ?? []).map((n: any) => (
          <div key={n.id} className="p-4 bg-surface-base border rounded-lg" style={{ borderLeftColor: n.color, borderLeftWidth: 4 }}>
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-semibold">{n.nombre}</h3>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${NIVEL_RIESGO_BADGE[n.nombre as keyof typeof NIVEL_RIESGO_BADGE] || ''}`}>
                {n.valor_ref}
              </span>
            </div>
            <p className="text-xs text-text-secondary mb-1">Rango: {n.valor_min} - {n.valor_max} | Valor ref: {n.valor_ref}</p>
            <p className="text-sm text-text-secondary">{n.acciones_requeridas}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
