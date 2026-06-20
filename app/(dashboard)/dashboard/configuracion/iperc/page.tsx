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
import { OrigenFilter, pasaOrigen, OrigenBadge, type OrigenFiltro } from '@/components/ui/origen-filter'
import { MultiSelectFilter, type MultiSelectOption } from '@/components/ui/multi-select-filter'

// Un ítem es genérico (base de Sigmetría) cuando consultora_id IS NULL.
// Los genéricos los administra solo quien puede gestionar librerías base
// (super-admin O el flag acotado gestiona_librerias_base); el resto los ve
// como solo-lectura. Esto debe quedar alineado con la RLS / puede_gestionar_librerias().
function usePuedeGestionar() {
  return useEffectiveRoleContext()?.puedeGestionarLibrerias ?? false
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

// Opciones de los filtros por categoría (value === label en enums de texto).
const FACTOR_OPTIONS: MultiSelectOption[] = IPERC_FACTORES.map(f => ({ value: f, label: f }))
const RIESGO_TIPO_OPTIONS: MultiSelectOption[] = IPERC_RIESGO_TIPOS.map(t => ({ value: t, label: t }))

// Agrupa una lista por categoría (string), respetando el orden canónico dado y
// dejando al final cualquier categoría no contemplada (legacy), en orden alfabético.
function agruparPorCategoria<T>(
  items: T[],
  getCat: (x: T) => string,
  orden: readonly string[],
): { categoria: string; items: T[] }[] {
  const mapa = new Map<string, T[]>()
  for (const it of items) {
    const c = getCat(it) || 'Sin categoría'
    const arr = mapa.get(c)
    if (arr) arr.push(it)
    else mapa.set(c, [it])
  }
  const grupos: { categoria: string; items: T[] }[] = []
  for (const c of orden) {
    const arr = mapa.get(c)
    if (arr) {
      grupos.push({ categoria: c, items: arr })
      mapa.delete(c)
    }
  }
  for (const c of [...mapa.keys()].sort((a, b) => a.localeCompare(b))) {
    grupos.push({ categoria: c, items: mapa.get(c)! })
  }
  return grupos
}

export default function IpercConfigPage() {
  const [tab, setTab] = useState<Tab>('peligros')

  return (
    <div className="p-4 sm:p-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Configuración IPERC</h1>
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
  const [asBase, setAsBase] = useState(false)
  const [origen, setOrigen] = useState<OrigenFiltro>('todos')
  // Por defecto: todos los factores tildados (= sin filtrar por categoría).
  const [factorSel, setFactorSel] = useState<Set<string>>(() => new Set(IPERC_FACTORES))
  const puedeGestionar = usePuedeGestionar()
  const lista = (peligros ?? []).filter(
    (p: any) => pasaOrigen(p.consultora_id, origen) && factorSel.has(p.factor),
  )
  const grupos = agruparPorCategoria(lista, (p: any) => p.factor, IPERC_FACTORES)

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <OrigenFilter value={origen} onChange={setOrigen} />
          <MultiSelectFilter
            label="Factor"
            options={FACTOR_OPTIONS}
            selected={factorSel}
            onChange={setFactorSel}
          />
          <p className="text-sm text-text-secondary">{lista.length} peligros</p>
        </div>
        {puedeGestionar && (
          <Button className="w-full sm:w-auto" onClick={() => { setAsBase(false); setModal(true) }}>Nuevo Peligro</Button>
        )}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Peligro">
        <form onSubmit={async (e) => {
          e.preventDefault()
          const form = e.currentTarget
          const fd = new FormData(form)
          fd.set('as_base', asBase ? 'true' : 'false')
          await createPeligro.mutateAsync(fd)
          form.reset()
          setModal(false)
        }} className="flex flex-col gap-4">
          <Input name="nombre" label="Nombre" required />
          <Select name="factor" label="Factor" required options={IPERC_FACTORES.map(f => ({ value: f, label: f }))} placeholder="Seleccionar factor" />
          {puedeGestionar && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">Alcance</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="alcance_peligro"
                    checked={!asBase}
                    onChange={() => setAsBase(false)}
                  />
                  De mi consultora
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="alcance_peligro"
                    checked={asBase}
                    onChange={() => setAsBase(true)}
                  />
                  Base Sigmetría
                </label>
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </Modal>
      {isLoading ? (
        <p>Cargando...</p>
      ) : grupos.length === 0 ? (
        <p className="text-sm text-text-tertiary py-8 text-center">No hay peligros que coincidan con los filtros.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {grupos.map(g => (
            <div key={g.categoria}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-text-primary">{g.categoria}</h3>
                <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-semibold text-text-tertiary">{g.items.length}</span>
              </div>
              <div className="grid gap-2">
                {g.items.map((p: any) => (
                  <div key={p.id} className="flex items-start justify-between gap-2 p-3 bg-surface-base border rounded-lg">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium break-words">{p.nombre}</p>
                        <OrigenBadge consultoraId={p.consultora_id} />
                      </div>
                    </div>
                    {(p.consultora_id !== null || puedeGestionar) && (
                      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => deletePeligro.mutate(p.id)}>Eliminar</Button>
                    )}
                  </div>
                ))}
              </div>
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
  const [asBase, setAsBase] = useState(false)
  const [origen, setOrigen] = useState<OrigenFiltro>('todos')
  // Por defecto: todos los tipos tildados (= sin filtrar por categoría).
  const [tipoSel, setTipoSel] = useState<Set<string>>(() => new Set(IPERC_RIESGO_TIPOS))
  const puedeGestionar = usePuedeGestionar()
  const lista = (riesgos ?? []).filter(
    (r: any) => pasaOrigen(r.consultora_id, origen) && tipoSel.has(r.tipo),
  )
  const grupos = agruparPorCategoria(lista, (r: any) => r.tipo, IPERC_RIESGO_TIPOS)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = e.currentTarget
    const formData = new FormData(form)
    formData.set('as_base', asBase ? 'true' : 'false')
    await createRiesgo.mutateAsync(formData)
    form.reset()
    setModal(false)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <OrigenFilter value={origen} onChange={setOrigen} />
          <MultiSelectFilter
            label="Tipo"
            options={RIESGO_TIPO_OPTIONS}
            selected={tipoSel}
            onChange={setTipoSel}
          />
          <p className="text-sm text-text-secondary">{lista.length} riesgos</p>
        </div>
        {puedeGestionar && (
          <Button className="w-full sm:w-auto" onClick={() => { setAsBase(false); setModal(true) }}>Nuevo Riesgo</Button>
        )}
      </div>
      <Modal open={modal} onClose={() => setModal(false)} title="Nuevo Riesgo">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input name="nombre" label="Nombre" required />
          <Select name="tipo" label="Tipo" required options={IPERC_RIESGO_TIPOS.map(t => ({ value: t, label: t }))} placeholder="Seleccionar tipo" />
          {puedeGestionar && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">Alcance</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="alcance_riesgo"
                    checked={!asBase}
                    onChange={() => setAsBase(false)}
                  />
                  De mi consultora
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="alcance_riesgo"
                    checked={asBase}
                    onChange={() => setAsBase(true)}
                  />
                  Base Sigmetría
                </label>
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </Modal>
      {isLoading ? (
        <p>Cargando...</p>
      ) : grupos.length === 0 ? (
        <p className="text-sm text-text-tertiary py-8 text-center">No hay riesgos que coincidan con los filtros.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {grupos.map(g => (
            <div key={g.categoria}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-text-primary">{g.categoria}</h3>
                <span className="rounded-full bg-surface-elevated px-2 py-0.5 text-[10px] font-semibold text-text-tertiary">{g.items.length}</span>
              </div>
              <div className="grid gap-2">
                {g.items.map((r: any) => (
                  <div key={r.id} className="flex items-start justify-between gap-2 p-3 bg-surface-base border rounded-lg">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium break-words">{r.nombre}</p>
                        <OrigenBadge consultoraId={r.consultora_id} />
                      </div>
                    </div>
                    {(r.consultora_id !== null || puedeGestionar) && (
                      <Button variant="ghost" size="sm" className="shrink-0" onClick={() => deleteRiesgo.mutate(r.id)}>Eliminar</Button>
                    )}
                  </div>
                ))}
              </div>
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
  const [asBase, setAsBase] = useState(false)
  const [origen, setOrigen] = useState<OrigenFiltro>('todos')
  const puedeGestionar = usePuedeGestionar()
  const lista = (medidas ?? []).filter((m: any) => pasaOrigen(m.consultora_id, origen))

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!texto.trim()) return
    await createMedida.mutateAsync({ texto, asBase })
    setTexto('')
    setAsBase(false)
    setModal(false)
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <OrigenFilter value={origen} onChange={setOrigen} />
          <p className="text-sm text-text-secondary">{lista.length} medidas (más usadas)</p>
        </div>
        {puedeGestionar && (
          <Button className="w-full sm:w-auto" onClick={() => { setAsBase(false); setModal(true) }}>Nueva Medida</Button>
        )}
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
          {puedeGestionar && (
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-text-primary">Alcance</label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="alcance_medida"
                    checked={!asBase}
                    onChange={() => setAsBase(false)}
                  />
                  De mi consultora
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="alcance_medida"
                    checked={asBase}
                    onChange={() => setAsBase(true)}
                  />
                  Base Sigmetría
                </label>
              </div>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModal(false)}>Cancelar</Button>
            <Button type="submit">Crear</Button>
          </div>
        </form>
      </Modal>
      {isLoading ? <p>Cargando...</p> : (
        <div className="grid gap-2">
          {lista.map((m: any) => (
            <div key={m.id} className="flex items-start justify-between gap-2 p-3 bg-surface-base border rounded-lg">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium break-words">{m.texto}</p>
                  <OrigenBadge consultoraId={m.consultora_id} />
                </div>
                <p className="text-xs text-text-tertiary">Usada {m.veces_usada} veces</p>
              </div>
              {(m.consultora_id !== null || puedeGestionar) && (
                <Button variant="ghost" size="sm" className="shrink-0" onClick={() => deleteMedida.mutate(m.id)}>Eliminar</Button>
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
          <div key={p.id} className="flex items-center justify-between gap-2 p-4 bg-surface-base border rounded-lg">
            <span className="font-medium break-words min-w-0">{p.nivel}</span>
            <Badge className="shrink-0">Valor: {p.valor_numerico}</Badge>
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
