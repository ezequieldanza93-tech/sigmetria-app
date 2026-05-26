'use client'

import { useActionState, useState, useEffect } from 'react'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { FileUploadInput } from '@/components/ui/file-upload-input'
import { createClient } from '@/lib/supabase/client'
import { useLocalidades, useEstablecimientoTipos } from '@/lib/queries/establecimiento-form'
import type { Establecimiento, ActionResult, PreguntaRiesgo, EstablecimientoRespuesta } from '@/lib/types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type EstablecimientoFormAction = (prevState: any, formData: FormData) => Promise<ActionResult<unknown>>

interface EstablecimientoFormProps {
  action: EstablecimientoFormAction
  establecimiento?: Partial<Establecimiento>
  submitLabel?: string
}

type DiaConfig = { activo: boolean; inicio: string; fin: string }

const DIAS_SEMANA = [
  { dia: 1, label: 'Lunes' },
  { dia: 2, label: 'Martes' },
  { dia: 3, label: 'Miércoles' },
  { dia: 4, label: 'Jueves' },
  { dia: 5, label: 'Viernes' },
  { dia: 6, label: 'Sábado' },
  { dia: 0, label: 'Domingo' },
]

const HORARIO_DEFAULT: Record<number, DiaConfig> = {
  0: { activo: false, inicio: '', fin: '' },
  1: { activo: true,  inicio: '08:00', fin: '17:00' },
  2: { activo: true,  inicio: '08:00', fin: '17:00' },
  3: { activo: true,  inicio: '08:00', fin: '17:00' },
  4: { activo: true,  inicio: '08:00', fin: '17:00' },
  5: { activo: true,  inicio: '08:00', fin: '17:00' },
  6: { activo: false, inicio: '', fin: '' },
}

export function EstablecimientoForm({ action, establecimiento, submitLabel = 'Guardar' }: EstablecimientoFormProps) {
  const [state, formAction, isPending] = useActionState(action, null)
  const { data: localidades = [] } = useLocalidades()
  const { data: tipos = [] } = useEstablecimientoTipos()
  const [preguntas, setPreguntas] = useState<PreguntaRiesgo[]>([])
  const [respuestas, setRespuestas] = useState<Record<string, boolean>>({})
  const [selectedProvincia, setSelectedProvincia] = useState(establecimiento?.localidades?.provincia ?? '')
  const [selectedTipoId, setSelectedTipoId] = useState(establecimiento?.tipo_id ?? '')
  const [semana, setSemana] = useState<Record<number, DiaConfig>>(HORARIO_DEFAULT)

  // Load horarios for existing establishment
  useEffect(() => {
    if (!establecimiento?.id) return
    createClient()
      .from('establecimientos_horarios')
      .select('dia_semana, hora_inicio, hora_fin, activo')
      .eq('establecimiento_id', establecimiento.id)
      .then(({ data }) => {
        if (!data?.length) return
        setSemana(prev => {
          const next = { ...prev }
          data.forEach((h: { dia_semana: number; hora_inicio: string | null; hora_fin: string | null; activo: boolean }) => {
            next[h.dia_semana] = { activo: h.activo, inicio: h.hora_inicio ?? '', fin: h.hora_fin ?? '' }
          })
          return next
        })
      })
  }, [establecimiento?.id])

  // Load existing respuestas for edit mode
  useEffect(() => {
    if (!establecimiento?.id) return
    createClient()
      .from('establecimientos_respuestas')
      .select('pregunta_id, respuesta')
      .eq('establecimiento_id', establecimiento.id)
      .then(({ data }) => {
        if (!data) return
        const map: Record<string, boolean> = {}
        ;(data as EstablecimientoRespuesta[]).forEach(r => { map[r.pregunta_id] = r.respuesta })
        setRespuestas(map)
      })
  }, [establecimiento?.id])

  // Load preguntas when tipo changes
  useEffect(() => {
    if (!selectedTipoId) { setPreguntas([]); return }
    createClient()
      .from('preguntas_tipos')
      .select('pregunta_id, orden, riesgos_preguntas!pregunta_id(id, codigo, texto, orden, is_active)')
      .eq('tipo_id', selectedTipoId)
      .order('orden')
      .then(({ data }) => {
        if (!data) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ps = (data as any[])
          .map(row => row.riesgos_preguntas)
          .filter(Boolean)
          .sort((a: PreguntaRiesgo, b: PreguntaRiesgo) => a.orden - b.orden)
        setPreguntas(ps as PreguntaRiesgo[])
      })
  }, [selectedTipoId])

  const provincias = [...new Set(localidades.map(l => l.provincia))].sort()
  const localidadesFiltradas = localidades.filter(l => l.provincia === selectedProvincia)

  return (
    <form action={formAction} className="space-y-4">
      {state && !state.success && (
        <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-4 py-3">
          {state.error}
        </div>
      )}

      <Input
        label="Nombre del Establecimiento"
        name="nombre"
        defaultValue={establecimiento?.nombre}
        required
        placeholder="Planta Norte"
      />

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Tipo *</label>
        <select
          name="tipo_id"
          value={selectedTipoId}
          onChange={e => setSelectedTipoId(e.target.value)}
          className="w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
        >
          <option value="">Seleccionar tipo...</option>
          {tipos.map(t => (
            <option key={t.id} value={t.id}>{t.nombre}</option>
          ))}
        </select>
        {tipos.find(t => t.id === selectedTipoId)?.codigo === 'CONSTRUCCION' && (
          <p className="mt-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            Requiere aviso de inicio de obra según normativa vigente.
          </p>
        )}
      </div>

      <Input
        label="Domicilio"
        name="domicilio"
        defaultValue={establecimiento?.domicilio ?? ''}
        placeholder="Calle 123"
      />

      <div className="grid grid-cols-2 gap-4">
        <Select
          label="Provincia"
          value={selectedProvincia}
          onChange={e => setSelectedProvincia(e.target.value)}
          options={provincias.map(p => ({ value: p, label: p }))}
          placeholder="Seleccionar provincia..."
        />
        <Select
          label="Localidad"
          name="localidad_id"
          defaultValue={establecimiento?.localidad_id ?? ''}
          options={localidadesFiltradas.map(l => ({ value: l.id, label: l.nombre }))}
          placeholder={selectedProvincia ? 'Seleccionar localidad...' : 'Elegí provincia primero'}
          disabled={!selectedProvincia}
        />
      </div>

      <Input
        label="Código Postal"
        name="codigo_postal"
        defaultValue={establecimiento?.codigo_postal ?? ''}
        placeholder="2000"
      />

      <Input
        label="Actividad Principal"
        name="actividad_principal"
        defaultValue={establecimiento?.actividad_principal ?? ''}
        placeholder="Manufactura de piezas metálicas"
      />

      <Input
        label="Cantidad de trabajadores (manual)"
        name="cantidad_trabajadores"
        type="number"
        min="0"
        defaultValue={establecimiento?.cantidad_trabajadores != null ? String(establecimiento.cantidad_trabajadores) : ''}
        placeholder="Ej: 45"
      />

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-2">Horario por día</label>
        <div className="border border-border-subtle rounded-lg divide-y divide-gray-100">
          {DIAS_SEMANA.map(({ dia, label }) => {
            const cfg = semana[dia]
            return (
              <div key={dia} className="flex items-center gap-3 px-3 py-2.5">
                <input
                  type="checkbox"
                  id={`dia_${dia}_activo`}
                  checked={cfg.activo}
                  onChange={e => setSemana(prev => ({ ...prev, [dia]: { ...prev[dia], activo: e.target.checked } }))}
                  value="true"
                  name={`dia_${dia}_activo`}
                  className="w-4 h-4 rounded border-border-default text-sig-500 focus:ring-sig-400"
                />
                <label htmlFor={`dia_${dia}_activo`} className="w-24 text-sm text-text-secondary select-none cursor-pointer">{label}</label>
                {cfg.activo ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input
                      type="time"
                      name={`dia_${dia}_inicio`}
                      value={cfg.inicio}
                      onChange={e => setSemana(prev => ({ ...prev, [dia]: { ...prev[dia], inicio: e.target.value } }))}
                      required
                      className="border border-border-default rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-sig-400"
                    />
                    <span className="text-text-tertiary text-sm">a</span>
                    <input
                      type="time"
                      name={`dia_${dia}_fin`}
                      value={cfg.fin}
                      onChange={e => setSemana(prev => ({ ...prev, [dia]: { ...prev[dia], fin: e.target.value } }))}
                      required
                      className="border border-border-default rounded px-2 py-1 text-sm w-28 focus:outline-none focus:ring-2 focus:ring-sig-400"
                    />
                  </div>
                ) : (
                  <span className="text-sm text-text-tertiary">Sin actividad</span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-secondary block mb-1">Información del establecimiento</label>
        <textarea
          name="description"
          defaultValue={establecimiento?.description ?? ''}
          rows={3}
          className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500 focus:border-transparent resize-none"
          placeholder="Descripción, notas o información adicional del establecimiento…"
        />
      </div>

      {/* ── Preguntas de riesgo dinámicas ───────────────────── */}
      {preguntas.length > 0 && (
        <div className="border border-sig-200 rounded-xl p-4 space-y-3 bg-sig-50/30">
          <p className="text-xs font-semibold text-sig-700 uppercase tracking-wider">
            Condiciones del establecimiento
          </p>
          <p className="text-xs text-text-secondary">
            Respondé las siguientes preguntas para identificar qué requisitos legales aplican.
          </p>
          {/* Hidden inputs to tell the server action which pregunta_ids are active */}
          {preguntas.map(p => (
            <input key={`pid_${p.id}`} type="hidden" name="pregunta_ids" value={p.id} />
          ))}
          <div className="space-y-2.5">
            {preguntas.map(p => (
              <label key={p.id} className="flex items-start gap-3 cursor-pointer select-none group">
                <input
                  type="checkbox"
                  name={`resp_${p.id}`}
                  value="true"
                  checked={respuestas[p.id] ?? false}
                  onChange={e => setRespuestas(prev => ({ ...prev, [p.id]: e.target.checked }))}
                  className="w-4 h-4 mt-0.5 rounded border-border-default text-sig-500 focus:ring-sig-400 shrink-0"
                />
                <span className="text-sm text-text-secondary group-hover:text-text-primary">{p.texto}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Ubicación Google Maps</label>
        <input
          name="ubicacion_gmaps"
          type="text"
          defaultValue={
            establecimiento?.latitude != null && establecimiento?.longitude != null
              ? `${establecimiento.latitude}, ${establecimiento.longitude}`
              : ''
          }
          placeholder="Av. Corrientes 1234, Buenos Aires · o URL de Google Maps · o -34.6037, -58.3816"
          className="w-full border border-border-default rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sig-500"
        />
        <p className="text-xs text-text-tertiary mt-1">
          Podés escribir una dirección, pegar una URL de Google Maps, o ingresar coordenadas.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="aplica_iso_45001"
          name="aplica_iso_45001"
          type="checkbox"
          defaultChecked={establecimiento?.aplica_iso_45001 === true}
          className="w-4 h-4 rounded border-border-default text-sig-600 focus:ring-sig-500"
        />
        <label htmlFor="aplica_iso_45001" className="text-sm font-medium text-text-secondary cursor-pointer">
          Aplica ISO 45001
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-secondary mb-1">Foto del establecimiento</label>
        {establecimiento?.photo_site && (
          <div className="relative w-full h-40 mb-2">
            <Image
              src={establecimiento.photo_site}
              alt="Foto actual"
              fill
              className="object-cover rounded-lg border border-border-subtle"
              sizes="(max-width: 768px) 100vw, 50vw"
            />
          </div>
        )}
        <input
          name="foto"
          type="file"
          accept="image/*"
          className="w-full text-sm text-text-secondary file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-sig-50 file:text-sig-700 hover:file:bg-sig-100 cursor-pointer"
        />
        <p className="text-xs text-text-tertiary mt-1">JPG, PNG o WebP. Se reemplaza la existente al guardar.</p>
      </div>

      <div className="border-t border-border-subtle pt-4 space-y-3">
        <p className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Planos del establecimiento</p>
        <div className="grid grid-cols-2 gap-3">
          <FileUploadInput
            name="floor_plan_pdf"
            label="Plano (PDF)"
            accept="application/pdf,image/png,image/jpeg"
            maxSizeMB={20}
            currentUrl={establecimiento?.floor_plan_pdf_url}
            helpText="PDF (preferido) o imagen. Máx 20 MB."
            kind="document"
          />
          <FileUploadInput
            name="floor_plan_cad"
            label="Plano (CAD)"
            accept="application/pdf,image/png,image/jpeg"
            maxSizeMB={20}
            currentUrl={establecimiento?.floor_plan_cad_url}
            helpText="Si tenés versión editable. Máx 20 MB."
            kind="document"
          />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Guardando...' : submitLabel}
        </Button>
        <Button type="button" variant="secondary" onClick={() => history.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
