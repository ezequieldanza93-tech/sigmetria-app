'use client'

import { useState, useEffect, useActionState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { FileUploadInput } from '@/components/ui/file-upload-input'
import { upsertPerfilProfesional, addMatriculaProfesional } from '@/lib/actions/perfil-profesional'
import { usePerfil, useProvincias, useMatriculas } from '@/lib/queries/profesional'
import { formatDate } from '@/lib/utils'
import type { PerfilProfesional, MatriculaProfesional } from '@/lib/types'

type Provincia = { id: string; nombre: string }

function DatosForm({
  perfil,
  provincias,
  onSuccess,
}: {
  perfil: PerfilProfesional | null
  provincias: Provincia[]
  onSuccess: () => void
}) {
  const [state, formAction, pending] = useActionState(upsertPerfilProfesional, null)
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <p className="text-xs text-danger bg-danger-bg rounded-lg px-3 py-2">{state.error}</p>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Teléfono celular</label>
          <input
            name="telefono"
            defaultValue={perfil?.telefono ?? ''}
            placeholder="+54 11 1234-5678"
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Fecha de nacimiento</label>
          <input
            name="fecha_nacimiento"
            type="date"
            defaultValue={perfil?.fecha_nacimiento ?? ''}
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Provincia de residencia</label>
          <select
            name="provincia_residencia_id"
            defaultValue={perfil?.provincia_residencia_id ?? ''}
            className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base"
          >
            <option value="">Seleccioná una opción</option>
            {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">¿Dónde está matriculado?</label>
          <select
            name="provincia_matricula_id"
            defaultValue={perfil?.provincia_matricula_id ?? ''}
            className="w-full border border-border-default rounded px-3 py-2 text-sm bg-surface-base"
          >
            <option value="">No estoy matriculado</option>
            {provincias.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Tipo de identidad impositiva</label>
          <select
            name="tipo_identidad_impositiva"
            defaultValue={perfil?.tipo_identidad_impositiva ?? ''}
            className="w-full border border-border-default rounded px-3 py-2 text-sm bg-surface-base"
          >
            <option value="">—</option>
            <option value="CUIT">CUIT</option>
            <option value="CUIL">CUIL</option>
            <option value="CDI">CDI</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Código único impositivo</label>
          <input
            name="cuit"
            defaultValue={perfil?.cuit ?? ''}
            placeholder="20-12345678-9"
            className="w-full border border-border-default rounded px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1">¿Cómo conociste Sigmetría?</label>
        <input
          name="canal_captacion"
          defaultValue={perfil?.canal_captacion ?? ''}
          placeholder="Ej: Instagram, Google, recomendación de un colega…"
          className="w-full border border-border-default rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="border-t border-border-subtle pt-4 space-y-3">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Imagen profesional</p>
        <FileUploadInput
          name="firma"
          label="Firma digital"
          accept="image/png,image/jpeg,image/svg+xml"
          maxSizeMB={1}
          currentUrl={perfil?.firma_url}
          helpText="PNG, JPG o SVG. Máx 1 MB. Se usa en certificados e informes firmados."
          kind="image"
        />
        <div className="grid grid-cols-2 gap-3">
          <FileUploadInput
            name="logo_small_prof"
            label="Logo pequeño"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            maxSizeMB={2}
            currentUrl={perfil?.logo_small_url}
            helpText="Máx 2 MB."
            kind="image"
          />
          <FileUploadInput
            name="logo_destacado_prof"
            label="Logo destacado"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            maxSizeMB={2}
            currentUrl={perfil?.logo_destacado_url}
            helpText="Máx 2 MB."
            kind="image"
          />
        </div>
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
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  useEffect(() => { if (state?.success) onSuccessRef.current() }, [state])

  return (
    <form action={formAction} className="bg-surface-base rounded-lg p-4 mt-3 space-y-3">
      <input type="hidden" name="perfil_id" value={perfilId} />
      {state && !state.success && <p className="text-xs text-danger">{state.error}</p>}

      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1">Emisor *</label>
        <input
          name="emisor"
          required
          placeholder="Colegio o institución"
          className="w-full border border-border-default rounded px-2 py-1.5 text-sm"
        />
      </div>

      <div>
        <label className="text-xs font-medium text-text-secondary block mb-1">Número *</label>
        <input
          name="numero"
          required
          className="w-full border border-border-default rounded px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Válido desde</label>
          <input name="fecha_emision" type="date" className="w-full border border-border-default rounded px-2 py-1.5 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary block mb-1">Vencimiento</label>
          <input name="fecha_vencimiento" type="date" className="w-full border border-border-default rounded px-2 py-1.5 text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <FileUploadInput
          name="foto_frente"
          label="Foto frente"
          accept="image/jpeg,image/png,application/pdf"
          maxSizeMB={5}
          helpText="JPG, PNG o PDF. Máx 5 MB."
          kind="image"
        />
        <FileUploadInput
          name="foto_dorso"
          label="Foto dorso"
          accept="image/jpeg,image/png,application/pdf"
          maxSizeMB={5}
          helpText="JPG, PNG o PDF. Máx 5 MB."
          kind="image"
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={pending}>{pending ? 'Guardando…' : 'Agregar matrícula'}</Button>
      </div>
    </form>
  )
}

function MatriculaCard({ m }: { m: MatriculaProfesional }) {
  const days = m.fecha_vencimiento
    ? Math.ceil((new Date(m.fecha_vencimiento).getTime() - Date.now()) / 86400000)
    : null
  const statusLabel = !m.activa ? 'Histórico' : days === null ? 'Sin vencimiento' : days < 0 ? 'Vencida' : days <= 30 ? 'Próx. a vencer' : 'Vigente'
  const statusClass = !m.activa ? 'bg-surface-elevated text-text-secondary' : days === null ? 'bg-sig-50 text-sig-700' : days < 0 ? 'bg-danger-bg text-danger' : days <= 30 ? 'bg-warning-bg text-warning' : 'bg-sig-50 text-sig-700'

  return (
    <div className="bg-surface-base rounded-lg px-3 py-2.5 text-sm flex items-start justify-between">
      <div>
        <div className="flex items-center gap-2">
          <p className="font-medium text-text-primary">{m.emisor}</p>
          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusClass}`}>{statusLabel}</span>
        </div>
        <p className="text-xs text-text-secondary mt-0.5">Nº {m.numero}</p>
        {m.fecha_emision && <p className="text-xs text-text-tertiary">Desde: {formatDate(m.fecha_emision)}</p>}
        {m.fecha_vencimiento && <p className="text-xs text-text-tertiary">Vence: {formatDate(m.fecha_vencimiento)}</p>}
      </div>
      <div className="flex gap-2 shrink-0 ml-2">
        {m.foto_frente_url && <a href={m.foto_frente_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sig-500 hover:underline">Frente</a>}
        {m.foto_dorso_url && <a href={m.foto_dorso_url} target="_blank" rel="noopener noreferrer" className="text-xs text-sig-500 hover:underline">Dorso</a>}
      </div>
    </div>
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
  const queryClient = useQueryClient()
  const [tab, setTab] = useState<'datos' | 'matriculas'>('datos')
  const [editingDatos, setEditingDatos] = useState(false)
  const [showMatriculaForm, setShowMatriculaForm] = useState(false)

  const { data: perfil, isLoading: perfilLoading } = usePerfil(open ? userId : undefined)
  const { data: provincias = [] } = useProvincias()
  const { data: matriculas = null } = useMatriculas(open && tab === 'matriculas' ? perfil?.id ?? null : null)

  useEffect(() => {
    if (!open) { setTab('datos'); setEditingDatos(false); setShowMatriculaForm(false) }
  }, [open])

  const vigentes = (matriculas ?? [])?.filter(m => m.activa) ?? []
  const historico = (matriculas ?? [])?.filter(m => !m.activa) ?? []

  return (
    <Modal open={open} onClose={onClose} title={fullName}>
      <div className="flex gap-1 border-b border-border-subtle mb-4 -mt-1">
        {(['datos', 'matriculas'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize -mb-px border-b-2 transition-colors ${
              tab === t ? 'border-sig-500 text-sig-500' : 'border-transparent text-text-secondary hover:text-text-secondary'
            }`}
          >
            {t === 'datos' ? 'Datos profesionales' : 'Matrículas'}
          </button>
        ))}
      </div>

      {tab === 'datos' && (
        <div>
          {perfilLoading ? (
            <p className="text-sm text-text-tertiary text-center py-4">Cargando…</p>
          ) : editingDatos ? (
            <DatosForm
              perfil={perfil ?? null}
              provincias={provincias}
              onSuccess={() => {
                setEditingDatos(false)
                queryClient.invalidateQueries({ queryKey: ['perfil', userId] })
              }}
            />
          ) : (
            <div className="space-y-3 text-sm">
              {!perfil ? (
                <p className="text-text-tertiary text-center py-2">Sin datos profesionales cargados.</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {[
                    ['Teléfono', perfil.telefono],
                    ['Fecha de nac.', perfil.fecha_nacimiento ? formatDate(perfil.fecha_nacimiento) : null],
                    ['Provincia', provincias.find(p => p.id === perfil.provincia_residencia_id)?.nombre ?? null],
                    ['Matriculado en', provincias.find(p => p.id === perfil.provincia_matricula_id)?.nombre ?? 'Sin matrícula'],
                    ['Id. impositiva', perfil.tipo_identidad_impositiva ? `${perfil.tipo_identidad_impositiva} ${perfil.cuit ?? ''}`.trim() : null],
                    ['Canal captación', perfil.canal_captacion],
                  ].map(([label, value]) => value && (
                    <div key={label as string}>
                      <p className="text-xs text-text-tertiary font-medium mb-0.5">{label}</p>
                      <p className="text-text-primary">{value}</p>
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
            <p className="text-sm text-text-tertiary text-center py-4">Cargando…</p>
          ) : (
            <>
              {vigentes.length === 0 && historico.length === 0 && !showMatriculaForm && (
                <p className="text-sm text-text-tertiary text-center py-4">Sin matrículas cargadas.</p>
              )}

              {vigentes.length > 0 && (
                <div className="space-y-2 mb-3">
                  {vigentes.map(m => <MatriculaCard key={m.id} m={m} />)}
                </div>
              )}

              {vigentes.length === 0 && historico.length > 0 && (
                <MatriculaCard m={historico[0]} />
              )}

              {showMatriculaForm && perfil ? (
                <MatriculaForm
                  perfilId={perfil.id}
                  onSuccess={() => {
                    setShowMatriculaForm(false)
                    queryClient.invalidateQueries({ queryKey: ['matriculas', perfil.id] })
                  }}
                />
              ) : canEdit && perfil && (
                <button
                  onClick={() => setShowMatriculaForm(true)}
                  className="mt-3 text-sm text-sig-500 hover:text-sig-700 font-medium"
                >
                  {vigentes.length > 0 ? '+ Nueva matrícula' : '+ Cargar matrícula'}
                </button>
              )}

              {historico.length > 1 && (
                <details className="mt-3">
                  <summary className="text-xs text-text-tertiary cursor-pointer hover:text-text-secondary">
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
