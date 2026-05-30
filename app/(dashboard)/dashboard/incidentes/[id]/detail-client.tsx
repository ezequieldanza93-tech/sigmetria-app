'use client'

import { useState } from 'react'
import Link from 'next/link'
import NextImage from 'next/image'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Textarea } from '@/components/ui/textarea'
import {
  ArrowLeft, AlertTriangle, CheckCircle2,
  Clock, Building2, MapPin, Calendar,
  Upload, X, ChevronRight, Image as ImageIcon
} from 'lucide-react'
import {
  INCIDENTE_TIPO_LABELS, SEVERIDAD_LABELS, SEVERIDAD_BADGE,
  SEGUIMIENTO_ESTADO_LABELS, SEGUIMIENTO_ESTADO_BADGE,
} from '@/lib/constants'
import { SEGUIMIENTO_ESTADOS_ORDER, estadoSiguiente } from '@/lib/types'
import { formatDate, formatDateTime } from '@/lib/utils'
import { useUpdateEstadoIncidente, useSubirFotosIncidente, useEliminarFotoIncidente } from '@/lib/queries/incidente'
import { useQueryClient } from '@tanstack/react-query'
import type { Incidente } from '@/lib/types'

interface Props {
  incidente: Incidente
}

export function IncidenteDetailClient({ incidente }: Props) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const [avanzarOpen, setAvanzarOpen] = useState(false)
  const [fotosOpen, setFotosOpen] = useState(false)
  const [accionesTomadas, setAccionesTomadas] = useState('')
  const [conclusion, setConclusion] = useState('')
  const [nuevasFotos, setNuevasFotos] = useState<File[]>([])
  const [fotoAmpliada, setFotoAmpliada] = useState<string | null>(null)

  const updateEstado = useUpdateEstadoIncidente()
  const subirFotos = useSubirFotosIncidente()
  const eliminarFoto = useEliminarFotoIncidente()

  const siguienteEstado = estadoSiguiente(incidente.estado)
  const esCerrada = incidente.estado === 'cerrada'

  const historial = (incidente.historial_estados || []) as Array<{
    estado: string
    fecha: string
    usuario_id: string
    usuario_nombre?: string
  }>

  async function handleAvanzarEstado() {
    const fd = new FormData()
    if (accionesTomadas.trim()) fd.set('acciones_tomadas', accionesTomadas)
    if (conclusion.trim()) fd.set('conclusion', conclusion)

    try {
      await updateEstado.mutateAsync({ incidenteId: incidente.id, formData: fd })
      queryClient.invalidateQueries({ queryKey: ['incidente', incidente.id] })
      queryClient.invalidateQueries({ queryKey: ['incidentes'] })
      setAvanzarOpen(false)
      setAccionesTomadas('')
      setConclusion('')
      router.refresh()
    } catch {
      // error handled by mutation
    }
  }

  async function handleSubirFotos() {
    if (nuevasFotos.length === 0) return
    const fd = new FormData()
    nuevasFotos.forEach((f, i) => fd.append(`foto_${i}`, f))

    try {
      await subirFotos.mutateAsync({ incidenteId: incidente.id, formData: fd })
      queryClient.invalidateQueries({ queryKey: ['incidente', incidente.id] })
      queryClient.invalidateQueries({ queryKey: ['incidente-fotos', incidente.id] })
      setNuevasFotos([])
      setFotosOpen(false)
    } catch {
      // error
    }
  }

  async function handleEliminarFoto(fotoId: string) {
    try {
      await eliminarFoto.mutateAsync(fotoId)
      queryClient.invalidateQueries({ queryKey: ['incidente', incidente.id] })
      queryClient.invalidateQueries({ queryKey: ['incidente-fotos', incidente.id] })
    } catch {
      // error
    }
  }

  function handleFotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    setNuevasFotos(prev => [...prev, ...files])
    e.target.value = ''
  }

  function getEstadoIndex(estado: string): number {
    return SEGUIMIENTO_ESTADOS_ORDER.indexOf(estado as typeof SEGUIMIENTO_ESTADOS_ORDER[number])
  }

  const currentIndex = getEstadoIndex(incidente.estado)

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-4xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard/incidentes"
        className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
      >
        <ArrowLeft size={16} />
        Volver a incidentes
      </Link>

      {/* Header card */}
      <Card>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <AlertTriangle size={20} className="text-text-tertiary" />
              <h1 className="text-xl font-semibold text-text-primary">{incidente.titulo}</h1>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SEGUIMIENTO_ESTADO_BADGE[incidente.estado]}`}>
                {SEGUIMIENTO_ESTADO_LABELS[incidente.estado]}
              </span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SEVERIDAD_BADGE[incidente.severidad]}`}>
                {SEVERIDAD_LABELS[incidente.severidad]}
              </span>
            </div>
            <div className="flex items-center gap-4 text-sm text-text-secondary flex-wrap">
              <span className="flex items-center gap-1">
                <Building2 size={14} />
                {incidente.empresas?.razon_social ?? '—'}
              </span>
              {incidente.establecimientos?.nombre && (
                <span className="flex items-center gap-1">
                  <MapPin size={14} />
                  {incidente.establecimientos.nombre}
                </span>
              )}
              <span className="flex items-center gap-1">
                <Calendar size={14} />
                {formatDate(incidente.fecha_incidente)}
              </span>
            </div>
          </div>

          {siguienteEstado && (
            <Button onClick={() => setAvanzarOpen(true)}>
              Avanzar a &ldquo;{SEGUIMIENTO_ESTADO_LABELS[siguienteEstado]}&rdquo;
              <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </Card>

      {/* Main grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Timeline + Details */}
        <div className="lg:col-span-2 space-y-6">

          {/* Timeline */}
          <Card>
            <h2 className="text-sm font-semibold text-text-primary mb-4 flex items-center gap-2">
              <Clock size={16} className="text-text-tertiary" />
              Timeline de Estados
            </h2>
            <div className="space-y-0">
              {SEGUIMIENTO_ESTADOS_ORDER.map((estado, i) => {
                const idx = getEstadoIndex(estado)
                const isCompletado = idx <= currentIndex
                const isCurrent = idx === currentIndex
                const historicoEntry = historial.find(h => h.estado === estado)

                return (
                  <div key={estado} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2 ${
                        isCompletado
                          ? 'bg-brand-primary border-brand-primary text-white'
                          : 'bg-surface-base border-border-default text-text-tertiary'
                      }`}>
                        {isCompletado ? <CheckCircle2 size={16} /> : i + 1}
                      </div>
                      {i < SEGUIMIENTO_ESTADOS_ORDER.length - 1 && (
                        <div className={`w-0.5 h-full min-h-[24px] ${
                          idx < currentIndex ? 'bg-brand-primary' : 'bg-border-subtle'
                        }`} />
                      )}
                    </div>
                    <div className="pb-6 flex-1">
                      <p className={`text-sm font-medium ${isCurrent ? 'text-text-primary' : isCompletado ? 'text-text-secondary' : 'text-text-tertiary'}`}>
                        {SEGUIMIENTO_ESTADO_LABELS[estado]}
                      </p>
                      {historicoEntry && (
                        <div className="text-xs text-text-tertiary mt-0.5 space-y-0.5">
                          <p>{formatDateTime(historicoEntry.fecha)}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          {/* Description */}
          <Card>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Descripción</h2>
            <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
              {incidente.descripcion}
            </p>
          </Card>

          {/* Actions taken */}
          {incidente.acciones_tomadas && (
            <Card>
              <h2 className="text-sm font-semibold text-text-primary mb-3">Acciones Tomadas</h2>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {incidente.acciones_tomadas}
              </p>
            </Card>
          )}

          {/* Conclusion */}
          {incidente.conclusion && (
            <Card>
              <h2 className="text-sm font-semibold text-text-primary mb-3">Conclusión</h2>
              <p className="text-sm text-text-secondary leading-relaxed whitespace-pre-wrap">
                {incidente.conclusion}
              </p>
            </Card>
          )}
        </div>

        {/* Right column: Details sidebar */}
        <div className="space-y-6">
          <Card>
            <h2 className="text-sm font-semibold text-text-primary mb-3">Detalles</h2>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-text-tertiary text-xs uppercase tracking-wider">Tipo</dt>
                <dd className="text-text-secondary mt-0.5">{INCIDENTE_TIPO_LABELS[incidente.tipo_incidente]}</dd>
              </div>
              <div>
                <dt className="text-text-tertiary text-xs uppercase tracking-wider">Severidad</dt>
                <dd className="mt-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${SEVERIDAD_BADGE[incidente.severidad]}`}>
                    {SEVERIDAD_LABELS[incidente.severidad]}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-text-tertiary text-xs uppercase tracking-wider">Fecha del incidente</dt>
                <dd className="text-text-secondary mt-0.5">{formatDate(incidente.fecha_incidente)}{incidente.hora_incidente ? ` a las ${incidente.hora_incidente.slice(0, 5)}` : ''}</dd>
              </div>
              {incidente.lugar_especifico && (
                <div>
                  <dt className="text-text-tertiary text-xs uppercase tracking-wider">Lugar específico</dt>
                  <dd className="text-text-secondary mt-0.5">{incidente.lugar_especifico}</dd>
                </div>
              )}
              {incidente.involucrados && (
                <div>
                  <dt className="text-text-tertiary text-xs uppercase tracking-wider">Involucrados</dt>
                  <dd className="text-text-secondary mt-0.5 whitespace-pre-wrap">{incidente.involucrados}</dd>
                </div>
              )}
              {incidente.testigos && (
                <div>
                  <dt className="text-text-tertiary text-xs uppercase tracking-wider">Testigos</dt>
                  <dd className="text-text-secondary mt-0.5 whitespace-pre-wrap">{incidente.testigos}</dd>
                </div>
              )}
              {incidente.fecha_cierre && (
                <div>
                  <dt className="text-text-tertiary text-xs uppercase tracking-wider">Fecha de cierre</dt>
                  <dd className="text-text-secondary mt-0.5">{formatDateTime(incidente.fecha_cierre)}</dd>
                </div>
              )}
              <div>
                <dt className="text-text-tertiary text-xs uppercase tracking-wider">Creado</dt>
                <dd className="text-text-secondary mt-0.5">{formatDateTime(incidente.created_at)}</dd>
              </div>
            </dl>
          </Card>

          {/* Photos */}
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <ImageIcon size={16} className="text-text-tertiary" />
                Fotos ({incidente.incidentes_fotos?.length ?? 0})
              </h2>
              {!esCerrada && siguienteEstado && (
                <button
                  onClick={() => setFotosOpen(true)}
                  className="text-xs text-brand-primary hover:text-brand-hover font-medium"
                >
                  + Agregar
                </button>
              )}
            </div>
            {incidente.incidentes_fotos && incidente.incidentes_fotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-2">
                {incidente.incidentes_fotos.map(foto => (
                  <div key={foto.id} className="relative group aspect-square rounded-lg overflow-hidden border border-border-default bg-surface-elevated">
                    <img
                      src={foto.url}
                      alt={foto.filename}
                      className="w-full h-full object-cover cursor-pointer"
                      onClick={() => setFotoAmpliada(foto.url)}
                    />
                    <button
                      onClick={() => handleEliminarFoto(foto.id)}
                      className="absolute top-1.5 right-1.5 w-6 h-6 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-text-tertiary text-center py-4">Sin fotos</p>
            )}
          </Card>
        </div>
      </div>

      {/* Modal: Avanzar estado */}
      <Modal open={avanzarOpen} onClose={() => setAvanzarOpen(false)} title={`Avanzar a "${SEGUIMIENTO_ESTADO_LABELS[siguienteEstado ?? 'cerrada']}"`}>
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            {siguienteEstado === 'cerrada'
              ? 'Al cerrar el incidente se registrará la fecha de cierre y no podrá modificarse.'
              : 'Registrá las acciones tomadas durante esta etapa.'}
          </p>

          {siguienteEstado && (
            <div className="flex items-center gap-3 p-3 bg-surface-elevated rounded-lg border border-border-subtle">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${SEGUIMIENTO_ESTADO_BADGE[siguienteEstado]}`}>
                {SEGUIMIENTO_ESTADO_LABELS[siguienteEstado]}
              </span>
              <ChevronRight size={14} className="text-text-tertiary" />
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium opacity-50 ${SEGUIMIENTO_ESTADO_BADGE[siguienteEstado]}`}>
                {SEGUIMIENTO_ESTADO_LABELS[incidente.estado]}
              </span>
            </div>
          )}

          <Textarea
            label="Acciones tomadas"
            name="acciones_tomadas"
            placeholder="Describí las acciones realizadas..."
            value={accionesTomadas}
            onChange={e => setAccionesTomadas(e.target.value)}
            rows={3}
          />

          {siguienteEstado === 'cerrada' && (
            <Textarea
              label="Conclusión"
              name="conclusion"
              placeholder="Conclusión final del incidente..."
              value={conclusion}
              onChange={e => setConclusion(e.target.value)}
              rows={3}
            />
          )}

          <div className="flex gap-3 pt-2">
            <Button
              onClick={handleAvanzarEstado}
              disabled={updateEstado.isPending}
            >
              {updateEstado.isPending ? 'Avanzando...' : `Avanzar a "${SEGUIMIENTO_ESTADO_LABELS[siguienteEstado ?? 'cerrada']}"`}
            </Button>
            <Button variant="secondary" onClick={() => setAvanzarOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Subir fotos */}
      <Modal open={fotosOpen} onClose={() => setFotosOpen(false)} title="Agregar fotos">
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {nuevasFotos.map((foto, i) => (
              <div key={i} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border-default">
                <img src={URL.createObjectURL(foto)} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => setNuevasFotos(prev => prev.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center"
                >
                  <X size={12} />
                </button>
              </div>
            ))}
          </div>

          <label className="inline-flex items-center gap-2 px-4 py-2 bg-surface-base border border-border-default rounded-lg text-sm text-text-secondary hover:bg-surface-elevated cursor-pointer transition-colors">
            <Upload size={16} />
            Seleccionar fotos
            <input type="file" accept="image/*" multiple onChange={handleFotoChange} className="sr-only" />
          </label>

          <div className="flex gap-3 pt-2">
            <Button onClick={handleSubirFotos} disabled={nuevasFotos.length === 0 || subirFotos.isPending}>
              {subirFotos.isPending ? 'Subiendo...' : `Subir ${nuevasFotos.length} foto(s)`}
            </Button>
            <Button variant="secondary" onClick={() => setFotosOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal: Foto ampliada */}
      <Modal open={!!fotoAmpliada} onClose={() => setFotoAmpliada(null)} title="" size="full">
        {fotoAmpliada && (
          <div className="relative flex items-center justify-center w-full" style={{ height: '70vh' }}>
            <NextImage src={fotoAmpliada} alt="Foto" fill sizes="100vw" className="object-contain rounded-lg" />
          </div>
        )}
      </Modal>
    </div>
  )
}
