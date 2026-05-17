'use client'

import { useState, useEffect, useActionState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { upsertPerfilProfesional, addMatriculaProfesional } from '@/lib/actions/perfil-profesional'
import { formatDate } from '@/lib/utils'
import type { PerfilProfesional, MatriculaProfesional, ActionResult } from '@/lib/types'

const PROVINCIAS = [
  'Ciudad Autónoma de Buenos Aires',
  'Buenos Aires',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
]

function DatosForm({
  perfil,
  onSuccess,
}: {
  perfil: PerfilProfesional | null
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(upsertPerfilProfesional, null)
  useEffect(() => { if (state?.success) onSuccess() }, [state])

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Teléfono celular</label>
          <input
            name="telefono"
            defaultValue={perfil?.telefono ?? ''}
            placeholder="+54 11 1234-5678"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Fecha de nacimiento</label>
          <input
            name="fecha_nacimiento"
            type="date"
            defaultValue={perfil?.fecha_nacimiento ?? ''}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Provincia de residencia</label>
          <select
            name="provincia_residencia"
            defaultValue={perfil?.provincia_residencia ?? ''}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">Seleccioná una opción</option>
            {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Localidad</label>
          <input
            name="localidad"
            defaultValue={perfil?.localidad ?? ''}
            placeholder="Ej: Palermo, La Plata…"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">¿Dónde está matriculado?</label>
        <select
          name="provincia_matricula"
          defaultValue={perfil?.provincia_matricula ?? ''}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
        >
          <option value="">No estoy matriculado</option>
          {PROVINCIAS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Tipo de identidad impositiva</label>
          <select
            name="tipo_identidad_impositiva"
            defaultValue={perfil?.tipo_identidad_impositiva ?? ''}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">—</option>
            <option value="CUIT">CUIT</option>
            <option value="CUIL">CUIL</option>
            <option value="CDI">CDI</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Código único impositivo</label>
          <input
            name="cuit"
            defaultValue={perfil?.cuit ?? ''}
            placeholder="20-12345678-9"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">¿Cómo conociste Sigmetría?</label>
        <input
          name="canal_captacion"
          defaultValue={perfil?.canal_captacion ?? ''}
          placeholder="Ej: Instagram, Google, recomendación de un colega…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <div className="flex justify-end pt-1">
        <Button type="submit" disabled={pending}>{pending ? 'Guardando…' : 'Guardar'}</Button>
      </div>
    </form>
  )
}

function MatriculaForm({
  perfilId,
  onSuccess,
}: {
  perfilId: string
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(addMatriculaProfesional, null)
  useEffect(() => { if (state?.success) onSuccess() }, [state])

  return (
    <form action={formAction} className="bg-gray-50 rounded-lg p-4 mt-3 space-y-3">
      <input type="hidden" name="perfil_id" value={perfilId} />
      {state && !state.success && <p className="text-xs text-red-600">{state.error}</p>}

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Emisor *</label>
        <input
          name="emisor"
          required
          placeholder="Colegio o institución"
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-gray-600 block mb-1">Número *</label>
        <input
          name="numero"
          required
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Válido desde</label>
          <input name="fecha_emision" type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Vencimiento</label>
          <input name="fecha_vencimiento" type="date" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Foto frente (URL)</label>
          <input name="foto_frente_url" type="url" placeholder="https://…" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 block mb-1">Foto dorso (URL)</label>
          <input name="foto_dorso_url" type="url" placeholder="https://…" className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Agregar matrícula'}</Button>
      </div>
    </form>
  )
}

interface ProfesionalModalProps {
  userId: string
  fullName: string
  open: boolean
  onClose: () => void
  canEdit: boolean
}

export function ProfesionalModal({ userId, fullName, open, onClose, canEdit }: ProfesionalModalProps) {
  const [tab, setTab] = useState<'datos' | 'matriculas'>('datos')
  const [perfil, setPerfil] = useState<PerfilProfesional | null | undefined>(undefined)
  const [matriculas, setMatriculas] = useState<MatriculaProfesional[] | null>(null)
  const [showMatriculaForm, setShowMatriculaForm] = useState(false)
  const [editingDatos, setEditingDatos] = useState(false)

  useEffect(() => {
    if (!open) { setTab('datos'); setPerfil(undefined); setMatriculas(null); setShowMatriculaForm(false); setEditingDatos(false) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const supabase = createClient()
    supabase
      .from('perfiles_profesionales')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()
      .then(({ data }) => setPerfil((data as PerfilProfesional | null) ?? null))
  }, [open, userId])

  useEffect(() => {
    if (tab !== 'matriculas' || !open || perfil === undefined) return
    if (perfil === null) { setMatriculas([]); return }
    const supabase = createClient()
    supabase
      .from('matriculas_profesionales')
      .select('*')
      .eq('perfil_id', perfil.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMatriculas((data as MatriculaProfesional[]) ?? []))
  }, [tab, open, perfil])

  const vigentes = matriculas?.filter(m => m.activa) ?? []
  const historico = matriculas?.filter(m => !m.activa) ?? []

  return (
    <Modal open={open} onClose={onClose} title={fullName}>
      <div className="flex gap-1 border-b border-gray-200 mb-4 -mt-1">
        {(['datos', 'matriculas'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition-colors ${
              tab === t ? 'border-sig-500 text-sig-500' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'datos' ? 'Datos profesionales' : 'Matrículas'}
          </button>
        ))}
      </div>

      {tab === 'datos' && (
        <div>
          {perfil === undefined ? (
            <p className="text-sm text-gray-400 text-center py-4">Cargando…</p>
          ) : editingDatos ? (
            <DatosForm
              perfil={perfil}
              onSuccess={() => {
                setEditingDatos(false)
                const supabase = createClient()
                supabase.from('perfiles_profesionales').select('*').eq('user_id', userId).maybeSingle()
                  .then(({ data }) => setPerfil((data as PerfilProfesional | null) ?? null))
              }}
            />
          ) : (
            <div className="space-y-3 text-sm">
              {perfil === null ? (
                <p className="text-gray-400 text-center py-2">Sin datos profesionales cargados.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Teléfono', perfil.telefono],
                    ['Fecha de nac.', perfil.fecha_nacimiento ? formatDate(perfil.fecha_nacimiento) : null],
                    ['Provincia', perfil.provincia_residencia],
                    ['Localidad', perfil.localidad],
                    ['Matriculado en', perfil.provincia_matricula ?? 'Sin matrícula'],
                    ['Id. impositiva', perfil.tipo_identidad_impositiva ? `${perfil.tipo_identidad_impositiva} ${perfil.cuit ?? ''}`.trim() : null],
                    ['Canal captación', perfil.canal_captacion],
                  ].map(([label, value]) => value && (
                    <div key={label as string}>
                      <p className="text-xs text-gray-400 font-medium mb-0.5">{label}</p>
                      <p className="text-gray-900">{value}</p>
                    </div>
                  ))}
                </div>
              )}
              {canEdit && (
                <div className="flex justify-end pt-1">
                  <button onClick={() => setEditingDatos(true)} className="text-xs text-sig-500 hover:text-sig-700 font-medium">
                    {perfil === null ? 'Completar perfil' : 'Editar'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'matriculas' && (
        <div>
          {matriculas === null ? (
            <p className="text-sm text-gray-400 text-center py-4">Cargando…</p>
          ) : (
            <>
              {vigentes.length === 0 && historico.length === 0 && !showMatriculaForm && (
                <p className="text-sm text-gray-400 text-center py-4">Sin matrículas cargadas.</p>
              )}

              {vigentes.length > 0 && (
                <div className="space-y-2 mb-3">
                  {vigentes.map(m => <MatriculaCard key={m.id} m={m} />)}
                </div>
              )}

              {/* Sin vigente → mostrar la última vencida */}
              {vigentes.length === 0 && historico.length > 0 && (
                <MatriculaCard m={historico[0]} />
              )}

              {showMatriculaForm && perfil !== null && perfil !== undefined ? (
                <MatriculaForm
                  perfilId={perfil.id}
                  onSuccess={() => {
                    setShowMatriculaForm(false)
                    const supabase = createClient()
                    supabase.from('matriculas_profesionales').select('*').eq('perfil_id', perfil!.id).order('created_at', { ascending: false })
                      .then(({ data }) => setMatriculas((data as MatriculaProfesional[]) ?? []))
                  }}
                />
              ) : canEdit && perfil !== null && perfil !== undefined && (
                <button
                  onClick={() => setShowMatriculaForm(true)}
                  className="mt-3 text-sm text-sig-500 hover:text-sig-700 font-medium"
                >
                  {vigentes.length > 0 ? '+ Nueva matrícula' : '+ Cargar matrícula'}
                </button>
              )}

              {historico.length > 1 && (
                <details className="mt-3">
                  <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600">
                    Ver histórico ({historico.length - (vigentes.length === 0 ? 1 : 0)} registro{historico.length > 2 ? 's' : ''})
                  </summary>
                  <div className="mt-2 space-y-2 opacity-60">
                    {historico.slice(vigentes.length === 0 ? 1 : 0).map(m => <MatriculaCard key={m.id} m={m} />)}
                  </div>
                </details>
              )}
            </>
          )}
        </div>
      )}
    </Modal>
  )
}

function MatriculaCard({ m }: { m: MatriculaProfesional }) {
  const days = m.fecha_vencimiento
    ? Math.ceil((new Date(m.fecha_vencimiento).getTime() - Date.now()) / 86400000)
    : null
  const statusLabel = !m.activa ? 'Histórico' : days === null ? 'Sin vencimiento' : days < 0 ? 'Vencida' : days <= 30 ? 'Próx. a vencer' : 'Vigente'
  const statusClass = !m.activa ? 'bg-gray-100 text-gray-500' : days === null ? 'bg-sig-50 text-sig-700' : days < 0 ? 'bg-red-100 text-red-700' : days <= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-sig-50 text-sig-700'

  return (
    <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm flex items-start justify-between">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-gray-800">{m.emisor}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusClass}`}>{statusLabel}</span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">Nº {m.numero}</p>
        {m.fecha_emision && <p className="text-xs text-gray-400">Desde: {formatDate(m.fecha_emision)}</p>}
        {m.fecha_vencimiento && <p className="text-xs text-gray-400">Vence: {formatDate(m.fecha_vencimiento)}</p>}
      </div>
      <div className="flex gap-2 shrink-0 ml-2">
        {m.foto_frente_url && <a href={m.foto_frente_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sig-500 hover:underline">Frente</a>}
        {m.foto_dorso_url && <a href={m.foto_dorso_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sig-500 hover:underline">Dorso</a>}
      </div>
    </div>
  )
}
