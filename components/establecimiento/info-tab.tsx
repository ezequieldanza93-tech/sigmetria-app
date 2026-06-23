'use client'

import { useEffect, useState, useActionState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  MapPin, Building2, Users, Clock, FileText,
  CheckCircle2, XCircle, ExternalLink, Upload, Trash2, Pencil,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { uploadPlanoEstablecimiento, deletePlanoEstablecimiento } from '@/lib/actions/establecimiento'
import { useSignedUrls } from '@/lib/storage/sign-client'
import { WeatherPanel } from '@/components/weather-panel'
import type { Establecimiento, HorarioEstablecimiento } from '@/lib/types'
import { calcularEquivalentes, calcularHorasProfesionalHyS } from '@/lib/hys/calculo-1338'

const DIAS: Record<number, string> = {
  1: 'Lunes', 2: 'Martes', 3: 'Miércoles',
  4: 'Jueves', 5: 'Viernes', 6: 'Sábado', 0: 'Domingo',
}
const DIAS_ORDER = [1, 2, 3, 4, 5, 6, 0]

interface Props {
  establecimiento: Establecimiento
  canWrite: boolean
  empresaId: string
}

export function InfoTab({ establecimiento, canWrite, empresaId }: Props) {
  const [horarios, setHorarios] = useState<HorarioEstablecimiento[]>([])
  const [planoUrl, setPlanoUrl] = useState(establecimiento.plano_url)
  // Bucket privado `planos`: firmamos la URL del plano en el cliente.
  const { getUrl: getPlanoUrl } = useSignedUrls('planos', [planoUrl])
  // Bucket privado `establecimientos`: firmamos la URL de la foto del lugar.
  const { getUrl: getFotoUrl } = useSignedUrls('establecimientos', [establecimiento.photo_site])

  const uploadAction = uploadPlanoEstablecimiento.bind(null, establecimiento.id)
  const deleteAction = deletePlanoEstablecimiento.bind(null, establecimiento.id)

  const [uploadState, uploadFormAction, pendingUpload] = useActionState(uploadAction, null)
  const [deleteState, deleteFormAction, pendingDelete] = useActionState(deleteAction, null)

  useEffect(() => {
    createClient()
      .from('establecimientos_horarios')
      .select('*')
      .eq('establecimiento_id', establecimiento.id)
      .then(({ data }) => setHorarios((data ?? []) as HorarioEstablecimiento[]))
  }, [establecimiento.id])

  useEffect(() => {
    if (uploadState?.success && uploadState.data?.url) setPlanoUrl(uploadState.data.url)
  }, [uploadState])

  useEffect(() => {
    if (deleteState?.success) setPlanoUrl(null)
  }, [deleteState])

  const tipo = (establecimiento.establecimientos_tipos as { nombre: string; codigo?: string } | null)?.nombre
  const tipoCodigo = (establecimiento.establecimientos_tipos as { codigo?: string } | null)?.codigo
  const localidad = (establecimiento.localidades as { nombre: string; provincia: string } | null)
  const ubicacion = [establecimiento.domicilio, localidad?.nombre, localidad?.provincia, establecimiento.codigo_postal]
    .filter(Boolean).join(', ')

  const hasLocation = establecimiento.latitud != null && establecimiento.longitud != null

  return (
    <div className="space-y-5">

      {/* Foto del establecimiento */}
      {establecimiento.photo_site && getFotoUrl(establecimiento.photo_site) && (
        <section className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
          <div className="relative w-full h-52 sm:h-64">
            <Image
              src={getFotoUrl(establecimiento.photo_site)!}
              alt={`Foto de ${establecimiento.nombre}`}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 90vw, 800px"
            />
          </div>
        </section>
      )}

      {/* Hero: mapa · clima + hora local */}
      {hasLocation && (
        <section className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_220px]" style={{ minHeight: '200px' }}>

            {/* Mapa OpenStreetMap */}
            <div className="relative border-b sm:border-b-0 sm:border-r border-border-subtle min-h-[160px]">
              <iframe
                src={`https://www.openstreetmap.org/export/embed.html?bbox=${establecimiento.longitud! - 0.01},${establecimiento.latitud! - 0.01},${establecimiento.longitud! + 0.01},${establecimiento.latitud! + 0.01}&layer=mapnik&marker=${establecimiento.latitud},${establecimiento.longitud}`}
                width="100%"
                height="100%"
                style={{ border: 0, display: 'block', minHeight: '200px' }}
                allowFullScreen
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                title={`Mapa de ${establecimiento.nombre}`}
              />
              <a
                href={`https://www.openstreetmap.org/?mlat=${establecimiento.latitud}&mlon=${establecimiento.longitud}#map=15/${establecimiento.latitud}/${establecimiento.longitud}`}
                target="_blank"
                rel="noopener noreferrer"
                className="absolute bottom-2 right-2 bg-surface-base/90 backdrop-blur-sm text-xs text-brand-primary font-medium px-2.5 py-1 rounded-lg shadow border border-border-subtle hover:bg-surface-base transition-colors"
              >
                Abrir Maps ↗
              </a>
            </div>

            {/* Clima + Hora local */}
            <WeatherPanel lat={establecimiento.latitud!} lng={establecimiento.longitud!} />
          </div>
        </section>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">

        {/* Left: Datos generales + Trabajadores */}
        <div className="space-y-5">
          <section className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
            <SectionHeader icon={<Building2 size={14} />} title="Datos generales" />
            <div className="divide-y divide-border-subtle">
              <Row label="Tipo" value={tipo ?? '—'} />
              <Row
                label="Ubicación"
                value={ubicacion || '—'}
                icon={ubicacion ? <MapPin size={12} className="text-text-tertiary shrink-0 mt-0.5" /> : undefined}
              />
              <Row label="Actividad principal" value={establecimiento.actividad_principal ?? '—'} />
              {establecimiento.description && (
                <Row label="Notas" value={establecimiento.description} multiline />
              )}
            </div>
          </section>

          <section className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
            <SectionHeader icon={<Users size={14} />} title="Trabajadores" />
            <div className="divide-y divide-border-subtle">
              <Row
                label="Operativos (producción)"
                hint="Dec. 1338/96"
                value={establecimiento.cantidad_trabajadores_operativos != null
                  ? String(establecimiento.cantidad_trabajadores_operativos)
                  : '—'}
              />
              <Row
                label="Administrativos"
                hint="Dec. 1338/96"
                value={establecimiento.cantidad_trabajadores_administrativos != null
                  ? String(establecimiento.cantidad_trabajadores_administrativos)
                  : '—'}
              />
              {(establecimiento.cantidad_trabajadores_operativos != null || establecimiento.cantidad_trabajadores_administrativos != null) && (
                <Row
                  label="Trabajadores equivalentes"
                  hint="Art. 4"
                  value={(() => {
                    const eq = calcularEquivalentes(
                      establecimiento.cantidad_trabajadores_operativos ?? 0,
                      establecimiento.cantidad_trabajadores_administrativos ?? 0,
                    )
                    return eq % 1 === 0 ? String(eq) : eq.toFixed(1)
                  })()}
                />
              )}
              <Row
                label="Horas HyS mensuales"
                hint="Art. 12"
                value={(() => {
                  if (tipoCodigo === 'CONSTRUCCION') {
                    return <span className="text-amber-700 text-xs font-medium">Se calcula según Res. SRT 231/96</span>
                  }
                  if (establecimiento.cantidad_trabajadores_operativos == null && establecimiento.cantidad_trabajadores_administrativos == null) {
                    return '—'
                  }
                  if (!establecimiento.categoria_hys) {
                    return <span className="text-text-tertiary text-xs">Definí la categoría A/B/C</span>
                  }
                  const eq = calcularEquivalentes(
                    establecimiento.cantidad_trabajadores_operativos ?? 0,
                    establecimiento.cantidad_trabajadores_administrativos ?? 0,
                  )
                  const horas = calcularHorasProfesionalHyS(eq, establecimiento.categoria_hys)
                  return <span className="font-semibold">{horas} hs/mes <span className="font-normal text-text-tertiary text-xs">(cat. {establecimiento.categoria_hys})</span></span>
                })()}
              />
              <Row
                label="ISO 45001"
                value={establecimiento.aplica_iso_45001
                  ? <span className="inline-flex items-center gap-1 text-success text-xs font-medium"><CheckCircle2 size={12} /> Aplica</span>
                  : <span className="inline-flex items-center gap-1 text-text-tertiary text-xs"><XCircle size={12} /> No aplica</span>}
              />
            </div>
          </section>
        </div>

        {/* Right: Horarios + Plano */}
        <div className="space-y-5">
          {horarios.length > 0 && (
            <section className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
              <SectionHeader icon={<Clock size={14} />} title="Horarios de actividad" />
              <div className="divide-y divide-border-subtle">
                {DIAS_ORDER.map(dia => {
                  const h = horarios.find(x => x.dia_semana === dia)
                  if (!h) return null
                  return (
                    <div key={dia} className="flex items-center px-5 py-2.5 gap-4">
                      <span className="w-24 text-sm text-text-secondary shrink-0">{DIAS[dia]}</span>
                      {h.activo && h.hora_inicio && h.hora_fin ? (
                        <span className="text-sm text-text-primary font-mono">
                          {h.hora_inicio.slice(0, 5)} — {h.hora_fin.slice(0, 5)}
                        </span>
                      ) : (
                        <span className="text-sm text-text-tertiary">Sin actividad</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          <section className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden">
            <SectionHeader icon={<FileText size={14} />} title="Plano del establecimiento" />
            <div className="px-5 py-4 space-y-3">

              {/* Plano existente */}
              {planoUrl ? (
                <div className="flex items-center justify-between gap-3 p-3 bg-surface-sunken rounded-lg border border-border-subtle">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-surface-elevated border border-border-subtle flex items-center justify-center shrink-0">
                      <FileText size={16} className="text-text-tertiary" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-text-primary">Plano cargado</p>
                      <a
                        href={getPlanoUrl(planoUrl) ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-brand-primary hover:text-brand-primary/80 inline-flex items-center gap-1"
                      >
                        Ver plano <ExternalLink size={11} />
                      </a>
                    </div>
                  </div>
                  {canWrite && (
                    <form action={deleteFormAction}>
                      <input type="hidden" name="plano_url" value={planoUrl} />
                      <button
                        type="submit"
                        disabled={pendingDelete}
                        className="p-1.5 rounded-lg text-text-tertiary hover:text-danger hover:bg-danger-bg transition-colors disabled:opacity-50"
                        title="Eliminar plano"
                      >
                        <Trash2 size={14} />
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                <p className="text-sm text-text-tertiary">No hay plano cargado.</p>
              )}

              {/* Error de delete */}
              {deleteState && !deleteState.success && (
                <p className="text-xs text-danger">{deleteState.error}</p>
              )}

              {/* Upload form */}
              {canWrite && (
                <form action={uploadFormAction} className="space-y-2">
                  <label className="text-xs font-medium text-text-secondary block">
                    {planoUrl ? 'Reemplazar plano' : 'Subir plano'}{' '}
                    <span className="font-normal text-text-tertiary">(PDF, PNG o JPG · máx 20 MB)</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer px-3 py-2 text-sm bg-surface-elevated border border-border-default rounded-lg hover:bg-surface-sunken transition-colors text-text-primary">
                      <Upload size={14} />
                      Seleccionar archivo
                      <input
                        type="file"
                        name="plano"
                        accept="application/pdf,image/png,image/jpeg"
                        className="sr-only"
                        onChange={e => {
                          if (e.target.form && e.target.files?.length) e.target.form.requestSubmit()
                        }}
                      />
                    </label>
                    {pendingUpload && <span className="text-xs text-text-tertiary">Subiendo…</span>}
                  </div>
                  {uploadState && !uploadState.success && (
                    <p className="text-xs text-danger">{uploadState.error}</p>
                  )}
                  {uploadState?.success && (
                    <p className="text-xs text-success">Plano guardado correctamente.</p>
                  )}
                </form>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Editar */}
      {canWrite && (
        <div className="flex justify-end pt-1">
          <Link
            href={`/dashboard/empresas/${empresaId}/establecimientos/${establecimiento.id}/editar`}
            className="inline-flex items-center gap-2 text-sm text-brand-primary hover:text-brand-primary/80 font-medium border border-brand-primary/30 hover:border-brand-primary/60 px-4 py-2 rounded-lg transition-colors"
          >
            <Pencil size={13} />
            Editar información
          </Link>
        </div>
      )}
    </div>
  )
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="px-5 py-3 border-b border-border-subtle bg-surface-sunken/50 flex items-center gap-2">
      <span className="text-text-tertiary">{icon}</span>
      <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
    </div>
  )
}

function Row({
  label, value, hint, multiline, icon,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  multiline?: boolean
  icon?: React.ReactNode
}) {
  return (
    <div className={`px-5 py-3 flex ${multiline ? 'flex-col gap-1' : 'items-start justify-between gap-4'}`}>
      <span className="text-sm text-text-secondary shrink-0">
        {label}
        {hint && <span className="ml-1 text-xs text-text-tertiary">({hint})</span>}
      </span>
      <span className={`text-sm text-text-primary flex items-start gap-1 ${multiline ? '' : 'text-right max-w-xs'}`}>
        {icon}{value}
      </span>
    </div>
  )
}
