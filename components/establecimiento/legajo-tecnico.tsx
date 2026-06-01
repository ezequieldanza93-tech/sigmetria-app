import { formatDate } from '@/lib/utils'
import type {
  Inspeccion, Documento, Capacitacion, Riesgo, Medicion, Incidente,
  RiesgoNivel, IncidenteTipo, MedicionTipo,
} from '@/lib/types'

interface LegajoEstablecimiento {
  nombre: string
  domicilio: string | null
  actividad_principal: string | null
  cantidad_trabajadores: number | null
  localidades?: { nombre: string; provincia: string } | null
}

export interface LegajoTecnicoProps {
  establecimiento: LegajoEstablecimiento
  empresa: { razon_social: string }
  ultimaInspeccion: Inspeccion | null
  totalInspecciones12m: number
  documentos: Documento[]
  capacitaciones: (Capacitacion & { _asistentes?: number })[]
  riesgos: Riesgo[]
  medicionesPorTipo: Record<string, Medicion[]>
  incidentes: Incidente[]
  ahora: Date
}

const NIVEL_ORDER: Record<RiesgoNivel, number> = { critico: 0, alto: 1, medio: 2, bajo: 3 }
const NIVEL_LABEL: Record<RiesgoNivel, string> = { critico: 'Crítico', alto: 'Alto', medio: 'Medio', bajo: 'Bajo' }
const NIVEL_CLASS: Record<RiesgoNivel, string> = {
  critico: 'bg-red-100 text-red-800',
  alto: 'bg-orange-100 text-orange-800',
  medio: 'bg-yellow-100 text-yellow-800',
  bajo: 'bg-green-100 text-green-800',
}

const TIPO_INCIDENTE: Record<IncidenteTipo, string> = {
  incidente: 'Incidente',
  accidente_leve: 'Accidente leve',
  accidente_moderado: 'Accidente moderado',
  accidente_grave: 'Accidente grave',
}

const TIPO_MEDICION: Record<MedicionTipo, string> = {
  ruido: 'Ruido',
  iluminacion: 'Iluminación',
  temperatura: 'Temperatura',
  humedad: 'Humedad',
  vibraciones: 'Vibraciones',
  gases: 'Gases',
  polvo: 'Polvo',
  otro: 'Otro',
}

function SeccionLT({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="bg-surface-elevated border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-border-subtle bg-surface-base">
        <h3 className="text-sm font-semibold text-text-primary">{titulo}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-sm text-text-tertiary flex items-center gap-1.5">
      <span className="text-success">✓</span> {text}
    </p>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-3 text-sm">
      <span className="text-text-tertiary w-44 shrink-0">{label}</span>
      <span className="text-text-primary font-medium">{value ?? '—'}</span>
    </div>
  )
}

export function LegajoTecnico({
  establecimiento, empresa, ultimaInspeccion, totalInspecciones12m,
  documentos, capacitaciones, riesgos, medicionesPorTipo, incidentes, ahora,
}: LegajoTecnicoProps) {
  const riesgosOrdenados = [...riesgos].sort((a, b) => NIVEL_ORDER[a.nivel] - NIVEL_ORDER[b.nivel])

  const isVigente = (fecha: string | null) => !fecha || new Date(fecha) >= ahora

  const diasSinCerrar = (fechaOcurrencia: string) =>
    Math.floor((ahora.getTime() - new Date(fechaOcurrencia).getTime()) / 86400000)

  const localidad = establecimiento.localidades
    ? `${establecimiento.localidades.nombre}, ${establecimiento.localidades.provincia}`
    : null

  return (
    <div className="space-y-5 max-w-4xl">
      {/* Encabezado */}
      <section className="bg-surface-elevated border border-border-subtle rounded-xl p-5 space-y-2.5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">{establecimiento.nombre}</h2>
            <p className="text-sm text-text-secondary">{empresa.razon_social}</p>
          </div>
          <span className="text-xs text-text-tertiary shrink-0 pt-1">
            Generado: {formatDate(ahora.toISOString())}
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
          <InfoRow label="Domicilio" value={establecimiento.domicilio} />
          <InfoRow label="Localidad" value={localidad} />
          <InfoRow label="Actividad principal" value={establecimiento.actividad_principal} />
          <InfoRow label="Trabajadores" value={establecimiento.cantidad_trabajadores} />
        </div>
      </section>

      {/* Inspecciones */}
      <SeccionLT titulo="Inspecciones">
        {!ultimaInspeccion ? (
          <p className="text-sm text-text-tertiary">Sin inspecciones registradas.</p>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5">
              <InfoRow label="Última inspección"
                value={ultimaInspeccion.fecha_realizada ? formatDate(ultimaInspeccion.fecha_realizada) : '—'} />
              <InfoRow label="Puntaje" value={ultimaInspeccion.puntaje != null ? `${ultimaInspeccion.puntaje}` : '—'} />
              <InfoRow label="Últimos 12 meses" value={`${totalInspecciones12m} inspección${totalInspecciones12m !== 1 ? 'es' : ''}`} />
            </div>
            {ultimaInspeccion.observaciones && (
              <p className="text-sm text-text-secondary bg-surface-base rounded-lg px-3 py-2">
                {ultimaInspeccion.observaciones}
              </p>
            )}
          </div>
        )}
      </SeccionLT>

      {/* Documentación */}
      <SeccionLT titulo="Documentación vigente">
        {documentos.length === 0 ? (
          <p className="text-sm text-text-tertiary">Sin documentos cargados en el legajo.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border-subtle">
                <th className="pb-2 text-xs text-text-tertiary font-medium">Tipo</th>
                <th className="pb-2 text-xs text-text-tertiary font-medium">Vencimiento</th>
                <th className="pb-2 text-xs text-text-tertiary font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {documentos.map(doc => {
                const vigente = isVigente(doc.fecha_vencimiento)
                return (
                  <tr key={doc.id}>
                    <td className="py-2.5 pr-4 font-medium text-text-primary">
                      {doc.documentos_tipos?.nombre ?? '—'}
                    </td>
                    <td className="py-2.5 pr-4 text-text-secondary">
                      {doc.fecha_vencimiento ? formatDate(doc.fecha_vencimiento) : 'Sin vencimiento'}
                    </td>
                    <td className="py-2.5">
                      {vigente ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Vigente
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Vencido
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </SeccionLT>

      {/* Capacitaciones */}
      <SeccionLT titulo="Capacitaciones (últimos 12 meses)">
        {capacitaciones.length === 0 ? (
          <p className="text-sm text-text-tertiary">Sin capacitaciones realizadas en el período.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border-subtle">
                <th className="pb-2 text-xs text-text-tertiary font-medium">Título</th>
                <th className="pb-2 text-xs text-text-tertiary font-medium">Fecha</th>
                <th className="pb-2 text-xs text-text-tertiary font-medium">Asistentes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {capacitaciones.map(cap => (
                <tr key={cap.id}>
                  <td className="py-2.5 pr-4 font-medium text-text-primary">{cap.titulo}</td>
                  <td className="py-2.5 pr-4 text-text-secondary">
                    {cap.fecha_realizada ? formatDate(cap.fecha_realizada) : '—'}
                  </td>
                  <td className="py-2.5 text-text-secondary">
                    {cap._asistentes != null ? cap._asistentes : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SeccionLT>

      {/* Riesgos activos */}
      <SeccionLT titulo="Riesgos activos">
        {riesgosOrdenados.length === 0 ? (
          <EmptyState text="Sin riesgos activos identificados." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border-subtle">
                <th className="pb-2 text-xs text-text-tertiary font-medium">Nivel</th>
                <th className="pb-2 text-xs text-text-tertiary font-medium">Descripción</th>
                <th className="pb-2 text-xs text-text-tertiary font-medium">Identificado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {riesgosOrdenados.map(r => (
                <tr key={r.id}>
                  <td className="py-2.5 pr-4">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${NIVEL_CLASS[r.nivel]}`}>
                      {NIVEL_LABEL[r.nivel]}
                    </span>
                  </td>
                  <td className="py-2.5 pr-4 text-text-primary">{r.descripcion}</td>
                  <td className="py-2.5 text-text-secondary">{formatDate(r.fecha_identificacion)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SeccionLT>

      {/* Mediciones */}
      <SeccionLT titulo="Mediciones (últimas 3 por tipo)">
        {Object.keys(medicionesPorTipo).length === 0 ? (
          <p className="text-sm text-text-tertiary">Sin mediciones registradas.</p>
        ) : (
          <div className="space-y-4">
            {Object.entries(medicionesPorTipo).map(([tipo, meds]) => (
              <div key={tipo}>
                <p className="text-xs font-semibold text-text-secondary mb-2 uppercase tracking-wide">
                  {TIPO_MEDICION[tipo as MedicionTipo] ?? tipo}
                </p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-border-subtle">
                      <th className="pb-1.5 text-xs text-text-tertiary font-medium">Valor</th>
                      <th className="pb-1.5 text-xs text-text-tertiary font-medium">Fecha</th>
                      <th className="pb-1.5 text-xs text-text-tertiary font-medium">Normativa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-subtle">
                    {meds.map(m => (
                      <tr key={m.id}>
                        <td className="py-2 pr-4 font-medium text-text-primary">
                          {m.valor} {m.unidades?.simbolo ?? ''}
                        </td>
                        <td className="py-2 pr-4 text-text-secondary">{formatDate(m.fecha)}</td>
                        <td className="py-2">
                          {m.cumple_normativa ? (
                            <span className="text-success font-medium">✓</span>
                          ) : (
                            <span className="text-danger font-medium">✗</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </SeccionLT>

      {/* Incidentes abiertos */}
      <SeccionLT titulo="Incidentes abiertos">
        {incidentes.length === 0 ? (
          <EmptyState text="Sin incidentes abiertos." />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border-subtle">
                <th className="pb-2 text-xs text-text-tertiary font-medium">Tipo</th>
                <th className="pb-2 text-xs text-text-tertiary font-medium">Ocurrencia</th>
                <th className="pb-2 text-xs text-text-tertiary font-medium">Días sin cerrar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {incidentes.map(s => (
                <tr key={s.id}>
                  <td className="py-2.5 pr-4 font-medium text-text-primary">
                    {TIPO_INCIDENTE[s.tipo]}
                  </td>
                  <td className="py-2.5 pr-4 text-text-secondary">
                    {formatDate(s.fecha_ocurrencia)}
                  </td>
                  <td className="py-2.5">
                    <span className="text-warning font-medium">
                      {diasSinCerrar(s.fecha_ocurrencia)}d
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </SeccionLT>

      {/* Pie del legajo */}
      <footer className="border-t border-border-subtle pt-4 text-center space-y-1">
        <p className="text-xs text-text-tertiary">
          Este legajo fue generado automáticamente por <strong className="text-text-secondary">Sigmetría HyS</strong>
        </p>
        <p className="text-xs text-text-tertiary">
          Los datos corresponden al momento de acceso
        </p>
        <a
          href="https://sigmetria.com.ar"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-xs text-brand-primary hover:underline mt-1"
        >
          sigmetria.com.ar
        </a>
      </footer>
    </div>
  )
}
