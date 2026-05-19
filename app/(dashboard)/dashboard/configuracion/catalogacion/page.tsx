'use client'

import { useEffect, useState, useCallback, useMemo, type Dispatch, type SetStateAction } from 'react'
import {
  getTiposEstablecimiento,
  getGestionesConTipos,
  toggleGestionTipo,
  toggleGestionAplicaPorIso,
  getAspectos,
  getSeccionesConAspectos,
  toggleSeccionAspecto,
  toggleSeccionAplicaPorIso,
  getDocumentoTiposConTipos,
  toggleDocumentoTipo,
  toggleDocTipoAplicaPorIso,
  getRubrosEmpresa,
  getDocTiposConRubros,
  toggleDocumentoRubro,
  toggleDocRubroAplicaPorIso,
} from '@/lib/actions/catalogacion'
import type { GestionRow, SeccionRow, DocumentoRow, DocumentoRubroRow } from '@/lib/actions/catalogacion'
import type { ActionResult } from '@/lib/types'

type TabName = 'gestiones' | 'secciones' | 'documentacion' | 'documentacion_rubros'

interface TipoItem {
  id: string
  nombre: string
  codigo?: string | null
}

function useAsync<T>(fn: () => Promise<T>): [T | null, boolean, string | null] {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fn().then(setData).catch(e => setError(e.message)).finally(() => setLoading(false))
  }, [])

  return [data, loading, error]
}

function Buscador({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      placeholder="Buscar..."
      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm mb-4"
      value={value}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function CheckboxGrid({
  tipos,
  asignados,
  onToggle,
  loading,
  onSelectAll,
}: {
  tipos: TipoItem[]
  asignados: string[]
  onToggle: (tipoId: string, active: boolean) => void
  loading: boolean
  onSelectAll?: (asignar: boolean) => void
}) {
  const todosAsignados = tipos.length > 0 && asignados.length === tipos.length
  const ningunoAsignado = asignados.length === 0
  return (
    <div>
      {tipos.length > 0 && onSelectAll && (
        <div className="flex gap-2 mb-2">
          {!todosAsignados && (
            <button onClick={() => onSelectAll(true)} disabled={loading} className="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50">
              + Seleccionar todos
            </button>
          )}
          {!ningunoAsignado && (
            <button onClick={() => onSelectAll(false)} disabled={loading} className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50">
              - Deseleccionar todos
            </button>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1.5">
        {tipos.map(t => {
          const active = asignados.includes(t.id)
          return (
            <div key={t.id} className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input type="checkbox" className="sr-only" checked={active} disabled={loading} onChange={() => onToggle(t.id, !active)} />
                <span className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-bold transition-colors ${active ? 'bg-blue-500 border-blue-500 text-white' : 'border-gray-300 bg-white'}`}>
                  {active && '✓'}
                </span>
                <span className={`text-sm ${active ? 'text-gray-800 font-medium' : 'text-gray-500'}`}>{t.nombre}</span>
              </label>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function IsoToggle({ value, onChange, loading }: { value: boolean; onChange: (v: boolean) => void; loading: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      disabled={loading}
      className={`text-[10px] font-bold px-2 py-0.5 rounded transition-colors ${
        value
          ? 'bg-green-200 text-green-800 hover:bg-green-300 cursor-pointer'
          : 'bg-gray-200 text-gray-500 hover:bg-gray-300 cursor-pointer'
      }`}
      title={value ? 'Aplica por ISO 45001' : 'No aplica por ISO 45001'}
    >
      ISO
    </button>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
    >
      {label}
    </button>
  )
}

export default function CatalogacionPage() {
  const [tab, setTab] = useState<TabName>('gestiones')
  const [searchGestion, setSearchGestion] = useState('')
  const [searchDoc, setSearchDoc] = useState('')
  const [gestionFilter, setGestionFilter] = useState('')
  const [saving, setSaving] = useState<Set<string>>(new Set())

  const [tipos] = useAsync(getTiposEstablecimiento)
  const [gestiones, loadingGes, errGes] = useAsync(getGestionesConTipos)
  const [aspectos] = useAsync(getAspectos)
  const [secciones, loadingSec, errSec] = useAsync(getSeccionesConAspectos)
  const [documentos, loadingDoc, errDoc] = useAsync(getDocumentoTiposConTipos)
  const [rubros] = useAsync(getRubrosEmpresa)
  const [docRubros, loadingDocRubros, errDocRubros] = useAsync(getDocTiposConRubros)

  const [localGes, setLocalGes] = useState<GestionRow[]>([])
  const [localSec, setLocalSec] = useState<SeccionRow[]>([])
  const [localDoc, setLocalDoc] = useState<DocumentoRow[]>([])
  const [localDocRubros, setLocalDocRubros] = useState<DocumentoRubroRow[]>([])

  useEffect(() => { if (gestiones) setLocalGes(gestiones) }, [gestiones])
  useEffect(() => { if (secciones) setLocalSec(secciones) }, [secciones])
  useEffect(() => { if (documentos) setLocalDoc(documentos) }, [documentos])
  useEffect(() => { if (docRubros) setLocalDocRubros(docRubros) }, [docRubros])

  const handleSelectAll = useCallback(
    async (
      id: string,
      asignar: boolean,
      items: TipoItem[],
      asignadosActuales: string[],
      toggleFn: (id: string, tipoId: string, active: boolean) => Promise<ActionResult<null>>,
      setLocal: Dispatch<SetStateAction<any[]>>,
      field: string,
    ) => {
      const targets = asignar
        ? items.filter(t => !asignadosActuales.includes(t.id)).map(t => t.id)
        : asignadosActuales
      if (targets.length === 0) return
      const keys = targets.map(t => `${id}:${t}`)
      setSaving(prev => { const n = new Set(prev); keys.forEach(k => n.add(k)); return n })
      setLocal(prev => prev.map(item =>
        item.id === id ? { ...item, [field]: asignar ? [...item[field], ...targets] : [] } : item,
      ))
      await Promise.all(targets.map(t => toggleFn(id, t, asignar)))
      setSaving(prev => { const n = new Set(prev); keys.forEach(k => n.delete(k)); return n })
    },
    [],
  )

  const handleToggle = useCallback(
    async (
      id: string,
      tipoId: string,
      active: boolean,
      toggleFn: (id: string, tipoId: string, active: boolean) => Promise<ActionResult<null>>,
      setLocal: Dispatch<SetStateAction<any[]>>,
      field: string,
    ) => {
      const key = `${id}:${tipoId}`
      setSaving(prev => new Set(prev).add(key))
      const res = await toggleFn(id, tipoId, active)
      setSaving(prev => { const next = new Set(prev); next.delete(key); return next })
      if (res.success) {
        setLocal(prev => prev.map((item: any) =>
          item.id === id
            ? { ...item, [field]: active ? [...item[field], tipoId] : item[field].filter((x: string) => x !== tipoId) }
            : item,
        ))
      }
    },
    [],
  )

  const handleAplicaPorIso = useCallback(
    async (
      id: string,
      value: boolean,
      toggleFn: (id: string, value: boolean) => Promise<ActionResult<null>>,
      setLocal: Dispatch<SetStateAction<any[]>>,
    ) => {
      const key = `iso:${id}`
      setSaving(prev => new Set(prev).add(key))
      setLocal(prev => prev.map(item => item.id === id ? { ...item, aplicaPorIso: value } : item))
      const res = await toggleFn(id, value)
      if (!res.success) {
        setLocal(prev => prev.map(item => item.id === id ? { ...item, aplicaPorIso: !value } : item))
      }
      setSaving(prev => { const next = new Set(prev); next.delete(key); return next })
    },
    [],
  )

  const filteredGestiones = useMemo(() => {
    if (!searchGestion) return localGes
    const q = searchGestion.toLowerCase()
    return localGes.filter(g => g.nombre.toLowerCase().includes(q))
  }, [localGes, searchGestion])

  const gestionesUnicas = useMemo(() => {
    const map = new Map<string, string>()
    for (const s of localSec) {
      if (!map.has(s.gestion_id)) map.set(s.gestion_id, s.gestion_id)
    }
    const names = new Map(localGes.map(g => [g.id, g.nombre]))
    return Array.from(map.keys()).sort((a, b) => (names.get(a) ?? '').localeCompare(names.get(b) ?? ''))
  }, [localSec, localGes])

  const filteredSecciones = useMemo(() => {
    let items = localSec
    if (gestionFilter) items = items.filter(s => s.gestion_id === gestionFilter)
    return items
  }, [localSec, gestionFilter])

  const filteredDocumentos = useMemo(() => {
    if (!searchDoc) return localDoc
    const q = searchDoc.toLowerCase()
    return localDoc.filter(d => d.nombre.toLowerCase().includes(q))
  }, [localDoc, searchDoc])

  return (
    <div className="max-w-7xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-1">Catalogación</h1>
      <p className="text-sm text-gray-500 mb-6">Asigná qué aplica a cada elemento</p>

      <div className="flex gap-2 mb-6">
        <TabButton active={tab === 'gestiones'} onClick={() => setTab('gestiones')} label="Gestión → Tipo Est." />
        <TabButton active={tab === 'secciones'} onClick={() => setTab('secciones')} label="Secciones → Aspectos" />
        <TabButton active={tab === 'documentacion'} onClick={() => setTab('documentacion')} label="Documentación → Tipo Est." />
        <TabButton active={tab === 'documentacion_rubros'} onClick={() => setTab('documentacion_rubros')} label="Documentación → Rubro" />
      </div>

      {tab === 'gestiones' && (
        <div>
          {errGes && <p className="text-red-500 text-sm mb-2">{errGes}</p>}
          <Buscador value={searchGestion} onChange={setSearchGestion} />
          {loadingGes ? (
            <p className="text-gray-400 text-sm">Cargando...</p>
          ) : (
            <div className="space-y-3">
              {filteredGestiones.map(g => (
                <div key={g.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-800">{g.nombre}</p>
                    <IsoToggle value={g.aplicaPorIso} onChange={v => handleAplicaPorIso(g.id, v, toggleGestionAplicaPorIso, setLocalGes)} loading={saving.has(`iso:${g.id}`)} />
                  </div>
                  <CheckboxGrid
                    tipos={tipos ?? []}
                    asignados={g.tipos}
                    onToggle={(tipoId, active) => handleToggle(g.id, tipoId, active, toggleGestionTipo, setLocalGes, 'tipos')}
                    onSelectAll={(asignar) => handleSelectAll(g.id, asignar, tipos ?? [], g.tipos, toggleGestionTipo, setLocalGes, 'tipos')}
                    loading={saving.size > 0}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'secciones' && (
        <div>
          {errSec && <p className="text-red-500 text-sm mb-2">{errSec}</p>}
          <div className="mb-4">
            <label className="text-xs font-medium text-gray-500 block mb-1">Filtrar por gestión</label>
            <select
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg text-sm"
              value={gestionFilter}
              onChange={e => setGestionFilter(e.target.value)}
            >
              <option value="">Todas las gestiones</option>
              {gestionesUnicas.map(gId => {
                const g = localGes.find(x => x.id === gId)
                return <option key={gId} value={gId}>{g?.nombre ?? gId}</option>
              })}
            </select>
          </div>
          {loadingSec ? (
            <p className="text-gray-400 text-sm">Cargando...</p>
          ) : (
            <div className="space-y-3">
              {filteredSecciones.map(s => (
                <div key={s.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-semibold text-gray-800">{s.title}</p>
                    <IsoToggle value={s.aplicaPorIso} onChange={v => handleAplicaPorIso(s.id, v, toggleSeccionAplicaPorIso, setLocalSec)} loading={saving.has(`iso:${s.id}`)} />
                  </div>
                  <p className="text-xs text-gray-400 mb-3">{localGes.find(g => g.id === s.gestion_id)?.nombre ?? '?'}</p>
                  <CheckboxGrid
                    tipos={aspectos ?? []}
                    asignados={s.aspectos}
                    onToggle={(aspectoId, active) => handleToggle(s.id, aspectoId, active, toggleSeccionAspecto, setLocalSec, 'aspectos')}
                    onSelectAll={(asignar) => handleSelectAll(s.id, asignar, aspectos ?? [], s.aspectos, toggleSeccionAspecto, setLocalSec, 'aspectos')}
                    loading={saving.size > 0}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'documentacion' && (
        <div>
          {errDoc && <p className="text-red-500 text-sm mb-2">{errDoc}</p>}
          <Buscador value={searchDoc} onChange={setSearchDoc} />
          {loadingDoc ? (
            <p className="text-gray-400 text-sm">Cargando...</p>
          ) : (
            <div className="space-y-3">
              {filteredDocumentos.map(d => (
                <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-800">{d.nombre}</p>
                    <IsoToggle value={d.aplicaPorIso} onChange={v => handleAplicaPorIso(d.id, v, toggleDocTipoAplicaPorIso, setLocalDoc)} loading={saving.has(`iso:${d.id}`)} />
                  </div>
                  <CheckboxGrid
                    tipos={tipos ?? []}
                    asignados={d.tipos}
                    onToggle={(tipoId, active) => handleToggle(d.id, tipoId, active, toggleDocumentoTipo, setLocalDoc, 'tipos')}
                    onSelectAll={(asignar) => handleSelectAll(d.id, asignar, tipos ?? [], d.tipos, toggleDocumentoTipo, setLocalDoc, 'tipos')}
                    loading={saving.size > 0}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'documentacion_rubros' && (
        <div>
          {errDocRubros && <p className="text-red-500 text-sm mb-2">{errDocRubros}</p>}
          {loadingDocRubros ? (
            <p className="text-gray-400 text-sm">Cargando...</p>
          ) : (
            <div className="space-y-3">
              {localDocRubros.map(d => (
                <div key={d.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold text-gray-800">{d.nombre}</p>
                    <IsoToggle value={d.aplicaPorIso} onChange={v => handleAplicaPorIso(d.id, v, toggleDocRubroAplicaPorIso, setLocalDocRubros)} loading={saving.has(`iso:${d.id}`)} />
                  </div>
                  <CheckboxGrid
                    tipos={rubros ?? []}
                    asignados={d.rubros}
                    onToggle={(rubroId, active) => handleToggle(d.id, rubroId, active, toggleDocumentoRubro, setLocalDocRubros, 'rubros')}
                    onSelectAll={(asignar) => handleSelectAll(d.id, asignar, rubros ?? [], d.rubros, toggleDocumentoRubro, setLocalDocRubros, 'rubros')}
                    loading={saving.size > 0}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
