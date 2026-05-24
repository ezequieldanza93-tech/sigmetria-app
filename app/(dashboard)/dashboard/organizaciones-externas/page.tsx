'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { deleteOrganizacion } from '@/lib/actions/organizacion'
import type { Organizacion, TipoOrganizacion } from '@/lib/types'

type SubcontratistaInfo = Record<string, { rubro: string | null; hasVencidos: boolean }>

export default function OrganizacionesExternasPage() {
  const [organizaciones, setOrganizaciones] = useState<Organizacion[] | null>(null)
  const [tiposOrg, setTiposOrg] = useState<TipoOrganizacion[]>([])
  const [activeTipo, setActiveTipo] = useState<string>('todos')
  const [search, setSearch] = useState('')
  const router = useRouter()
  const [subcontratistaInfo, setSubcontratistaInfo] = useState<SubcontratistaInfo>({})

  function load() {
    const supabase = createClient()
    supabase
      .from('organizaciones_externas')
      .select('*, organizaciones_tipos(nombre)')
      .eq('is_active', true)
      .range(0, 99)
      .order('nombre')
      .then(({ data }) => {
        const orgs = (data as unknown as Organizacion[]) ?? []
        setOrganizaciones(orgs)

        // Fetch subcontratista info for those that are subcontratistas
        const subTipoId = tiposOrg.find(t => t.nombre === 'Subcontratista')?.id
        if (subTipoId) {
          const subOrgIds = orgs.filter(o => o.tipo_id === subTipoId).map(o => o.id)
          if (subOrgIds.length > 0) {
            supabase
              .from('subcontratistas')
              .select('id, organizacion_id, subcontratistas_rubros!rubro_id(nombre)')
              .in('organizacion_id', subOrgIds)
              .then(async ({ data: subs }) => {
                const info: SubcontratistaInfo = {}
                const subIds: string[] = []
                for (const s of (subs ?? [])) {
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const sAny = s as any
                  info[sAny.organizacion_id] = {
                    rubro: sAny.subcontratistas_rubros?.nombre ?? null,
                    hasVencidos: false,
                  }
                  subIds.push(s.id)
                }

                // Check for vencidos
                if (subIds.length > 0) {
                  const hoy = new Date().toISOString().split('T')[0]
                  const { data: docs } = await supabase
                    .from('subcontratistas_documentos')
                    .select('subcontratista_id')
                    .in('subcontratista_id', subIds)
                    .lt('fecha_vencimiento', hoy)

                  const vencidosSubIds = new Set((docs ?? []).map(d => d.subcontratista_id))
                  for (const s of (subs ?? [])) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const sAny = s as any
                    if (vencidosSubIds.has(sAny.id)) {
                      info[sAny.organizacion_id].hasVencidos = true
                    }
                  }
                }

                setSubcontratistaInfo(info)
              })
          }
        }
      })
  }

  useEffect(() => {
    load()
    createClient().from('organizaciones_tipos').select('*').order('nombre')
      .then(({ data }) => setTiposOrg(data ?? []))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const isSubTipo = (tipoId: string) => {
    const tipo = tiposOrg.find(t => t.id === tipoId)
    return tipo?.nombre === 'Subcontratista'
  }

  const filtered = organizaciones === null
    ? null
    : (activeTipo === 'todos' ? organizaciones : organizaciones.filter(o => o.tipo_id === activeTipo))
        .filter(o => {
          if (!search) return true
          const q = search.toLowerCase()
          return o.nombre.toLowerCase().includes(q) || (o.email ?? '').toLowerCase().includes(q)
        })

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta organización?')) return
    await deleteOrganizacion(id)
    setOrganizaciones(prev => prev?.filter(o => o.id !== id) ?? null)
  }

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Organizaciones Externas</h1>
          <p className="text-sm text-gray-500 mt-1">Proveedores, subcontratistas, marcas y organismos externos</p>
        </div>
        <Link href="/dashboard/organizaciones-externas/nueva">
          <Button>+ Nueva Organización</Button>
        </Link>
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Buscar por nombre o email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full max-w-md border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-5 flex-wrap">
        <button
          onClick={() => setActiveTipo('todos')}
          className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === 'todos' ? 'bg-gray-900 text-white border-gray-900' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
        >
          Todos {organizaciones !== null && `(${organizaciones.length})`}
        </button>
        {tiposOrg.map(t => {
          const count = organizaciones?.filter(o => o.tipo_id === t.id).length ?? 0
          return (
            <button
              key={t.id}
              onClick={() => setActiveTipo(t.id)}
              className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeTipo === t.id ? 'bg-sig-500 text-white border-sig-500' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              {t.nombre} ({count})
            </button>
          )
        })}
      </div>

      {filtered === null ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
          No hay organizaciones registradas{activeTipo !== 'todos' ? ' de este tipo' : ''}.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-gray-100 bg-gray-50">
              <tr className="text-left">
                <th className="px-5 py-3 text-gray-500 font-medium">Nombre</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Tipo</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Rubro</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Email</th>
                <th className="px-5 py-3 text-gray-500 font-medium">Teléfono</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map(o => {
                const isSub = isSubTipo(o.tipo_id)
                const subInfo = subcontratistaInfo[o.id]
                const linkHref = isSub
                  ? `/dashboard/organizaciones-externas/${o.id}`
                  : `#`

                return (
                  <tr
                    key={o.id}
                    className={`hover:bg-gray-50 ${isSub ? 'cursor-pointer' : ''}`}
                    onClick={isSub ? () => router.push(linkHref) : undefined}
                  >
                    <td className="px-5 py-3.5 font-medium text-gray-900">
                      <div className="flex items-center gap-2">
                        <span>{o.nombre}</span>
                        {isSub && (
                          <span className="text-xs font-medium px-1.5 py-0.5 rounded bg-sig-100 text-sig-700">
                            Sub
                          </span>
                        )}
                        {subInfo?.hasVencidos && (
                          <span className="text-xs text-red-500" title="Documentos vencidos">⚠</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                        isSub
                          ? 'bg-sig-100 text-sig-700'
                          : 'bg-gray-100 text-gray-700'
                      }`}>
                        {o.organizaciones_tipos?.nombre ?? '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">
                      {subInfo?.rubro ?? '—'}
                    </td>
                    <td className="px-5 py-3.5 text-gray-500">{o.email ?? '—'}</td>
                    <td className="px-5 py-3.5 text-gray-500">{o.telefono ?? '—'}</td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex gap-2 justify-end">
                        {isSub && (
                          <Link
                            href={`/dashboard/organizaciones-externas/${o.id}`}
                            className="text-xs text-sig-500 hover:text-sig-700"
                            onClick={e => e.stopPropagation()}
                          >
                            Ver
                          </Link>
                        )}
                        <button
                          onClick={e => { e.stopPropagation(); handleDelete(o.id) }}
                          className="text-xs text-red-400 hover:text-red-600"
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
