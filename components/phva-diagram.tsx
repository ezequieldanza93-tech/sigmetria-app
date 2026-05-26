'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface PHVADiagramProps {
  empresaId?: string
  establecimientoId?: string
}

const CX = 280, CY = 255, OUTER_R = 190, SAT_D = 130, SAT_R = 55, CTR_R = 70

const SATELLITE_CIRCLES = [
  {
    key: 'P',
    x: CX,
    y: CY - SAT_D,
    lines: ['Planificación'],
    sub: '6',
    tab: 'riesgos',
    phva: 'Planificar',
  },
  {
    key: 'H',
    x: CX + SAT_D,
    y: CY,
    lines: ['Apoyo y', 'Operación'],
    sub: '7-8',
    tab: 'inspecciones',
    phva: 'Hacer',
  },
  {
    key: 'V',
    x: CX,
    y: CY + SAT_D,
    lines: ['Evaluación', 'desempeño'],
    sub: '9',
    tab: 'siniestros',
    phva: 'Verificar',
  },
  {
    key: 'A',
    x: CX - SAT_D,
    y: CY,
    lines: ['Mejora'],
    sub: '10',
    tab: 'documentos',
    phva: 'Actuar',
  },
]

interface PhaseModule {
  label: string
  tab: string
}

const PHASE_MODULES: Record<string, PhaseModule[]> = {
  context: [
    { label: 'Feedback Clientes', tab: '' },
    { label: 'Matrices Contexto', tab: '' },
  ],
  P: [
    { label: 'Matrices de Riesgos', tab: 'riesgos' },
    { label: 'Objetivos', tab: 'riesgos' },
    { label: 'Planificaciones', tab: 'riesgos' },
  ],
  H: [
    { label: 'Matriz de Comunicación', tab: 'inspecciones' },
    { label: 'Controles Operativos', tab: 'inspecciones' },
    { label: 'Formaciones', tab: 'inspecciones' },
    { label: 'Reportes Semanales', tab: 'inspecciones' },
  ],
  V: [
    { label: 'Auditorías', tab: 'siniestros' },
    { label: 'Inspecciones y Denuncias', tab: 'siniestros' },
    { label: 'Informes Periódicos', tab: 'siniestros' },
  ],
  A: [
    { label: 'Seguimiento de Hallazgos', tab: 'documentos' },
  ],
  center: [
    { label: 'Reuniones', tab: '' },
  ],
}

const PHASE_LABELS: Record<string, { title: string; iso: string }> = {
  context: { title: 'Contexto de la Organización', iso: '4' },
  P: { title: 'Planificación', iso: '6' },
  H: { title: 'Apoyo y Operación', iso: '7-8' },
  V: { title: 'Evaluación del Desempeño', iso: '9' },
  A: { title: 'Mejora', iso: '10' },
  center: { title: 'Liderazgo y Participación', iso: '5' },
}

const ARROW_MARKERS = [
  { x: 414, y: 121, rotate: 45 },
  { x: 414, y: 389, rotate: 135 },
  { x: 146, y: 389, rotate: 225 },
  { x: 146, y: 121, rotate: 315 },
]

function TextInCircle({
  x,
  y,
  lines,
  sub,
  isActive,
}: {
  x: number
  y: number
  lines: string[]
  sub: string
  isActive: boolean
}) {
  const lineHeight = 13
  const totalTextH = lines.length * lineHeight
  const startY = y - totalTextH / 2 + 1
  const fill = isActive ? '#2E7D32' : '#374151'
  const subFill = isActive ? '#4CAF50' : '#9CA3AF'

  return (
    <>
      {lines.map((line, i) => (
        <text
          key={i}
          x={x}
          y={startY + i * lineHeight}
          textAnchor="middle"
          fontSize="10.5"
          fontWeight="700"
          fill={fill}
          fontFamily="Montserrat, system-ui, sans-serif"
          style={{ transition: 'fill 200ms ease' }}
        >
          {line}
        </text>
      ))}
      <text
        x={x}
        y={startY + lines.length * lineHeight + 3}
        textAnchor="middle"
        fontSize="8.5"
        fill={subFill}
        fontFamily="Poppins, system-ui, sans-serif"
        style={{ transition: 'fill 200ms ease' }}
      >
        ISO {sub}
      </text>
    </>
  )
}

export function PHVADiagram({ empresaId, establecimientoId }: PHVADiagramProps) {
  const router = useRouter()
  const [hovered, setHovered] = useState<string | null>(null)
  const [selectedPhase, setSelectedPhase] = useState<string | null>(null)

  function getUrl(tab: string) {
    if (establecimientoId && empresaId) {
      return `/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}?tab=${tab}`
    }
    if (empresaId) return `/dashboard/empresas/${empresaId}`
    return '/dashboard/empresas'
  }

  function getCenterUrl() {
    if (establecimientoId && empresaId) {
      return `/dashboard/empresas/${empresaId}/establecimientos/${establecimientoId}`
    }
    if (empresaId) return `/dashboard/empresas/${empresaId}`
    return '/dashboard/empresas'
  }

  function handleModuleClick(mod: PhaseModule) {
    if (mod.tab) {
      router.push(getUrl(mod.tab))
    } else {
      router.push(getCenterUrl())
    }
  }

  const isHovered = (key: string) => hovered === key
  const modules = selectedPhase ? PHASE_MODULES[selectedPhase] : null
  const phaseLabel = selectedPhase ? PHASE_LABELS[selectedPhase] : null

  return (
    <div className="w-full flex justify-center select-none">
      <div className="w-full max-w-xl">
        <svg
          viewBox="0 0 560 520"
          className="w-full h-auto"
          role="img"
          aria-label="Diagrama PHVA ISO 45001"
        >
          <defs>
            <filter id="glow-green">
              <feGaussianBlur stdDeviation="3" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Outer context dashed rectangle */}
          <rect
            x="18" y="18" width="524" height="484"
            fill="none"
            stroke="#D1D5DB"
            strokeWidth="1.5"
            strokeDasharray="7 4"
            rx="6"
          />

          {/* Context labels */}
          <g
            onClick={() => setSelectedPhase('context')}
            onMouseEnter={() => setHovered('context')}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label="Contexto de la Organización ISO 4"
          >
            <rect
              x="140" y="22" width="280" height="20"
              rx="4"
              fill={isHovered('context') ? '#E8F5E9' : 'transparent'}
              style={{ transition: 'fill 200ms ease' }}
            />
            <text
              x="280" y="36"
              textAnchor="middle"
              fontSize="9"
              fontWeight="600"
              fill={isHovered('context') ? '#2E7D32' : '#9CA3AF'}
              fontFamily="Poppins, system-ui, sans-serif"
              letterSpacing="0.06em"
              style={{ transition: 'fill 200ms ease' }}
            >
              CONTEXTO DE LA ORGANIZACIÓN · ISO 4
            </text>
          </g>

          <text
            x="42" y="255"
            textAnchor="middle"
            fontSize="8"
            fill="#C4C9D4"
            fontFamily="Poppins, system-ui, sans-serif"
            transform="rotate(-90, 42, 255)"
          >
            Cuestiones internas y externas (4.1)
          </text>

          <text
            x="518" y="255"
            textAnchor="middle"
            fontSize="8"
            fill="#C4C9D4"
            fontFamily="Poppins, system-ui, sans-serif"
            transform="rotate(90, 518, 255)"
          >
            Necesidades y expectativas de las partes (4.2)
          </text>

          <text
            x="280" y="497"
            textAnchor="middle"
            fontSize="8"
            fill="#9CA3AF"
            fontFamily="Poppins, system-ui, sans-serif"
          >
            Resultados previstos del sistema de gestión SST
          </text>

          {/* Outer main circle */}
          <circle cx={CX} cy={CY} r={OUTER_R} fill="none" stroke="#E5E7EB" strokeWidth="1.5" />

          {/* Clockwise arrow markers at 45°/135°/225°/315° */}
          {ARROW_MARKERS.map((a, i) => (
            <polygon
              key={i}
              points="-7,-4 7,0 -7,4"
              transform={`translate(${a.x}, ${a.y}) rotate(${a.rotate})`}
              fill="#CBD5E1"
            />
          ))}

          {/* PHVA labels */}
          <text x={CX} y={CY - OUTER_R - 10} textAnchor="middle" fontSize="17" fontWeight="700" fill="#9CA3AF" fontFamily="Montserrat, system-ui">P</text>
          <text x={CX + OUTER_R + 14} y={CY + 6} textAnchor="middle" fontSize="17" fontWeight="700" fill="#9CA3AF" fontFamily="Montserrat, system-ui">H</text>
          <text x={CX} y={CY + OUTER_R + 22} textAnchor="middle" fontSize="17" fontWeight="700" fill="#9CA3AF" fontFamily="Montserrat, system-ui">V</text>
          <text x={CX - OUTER_R - 14} y={CY + 6} textAnchor="middle" fontSize="17" fontWeight="700" fill="#9CA3AF" fontFamily="Montserrat, system-ui">A</text>

          {/* Satellite circles */}
          {SATELLITE_CIRCLES.map((c) => {
            const active = isHovered(c.key)
            return (
              <g
                key={c.key}
                onClick={() => setSelectedPhase(c.key)}
                onMouseEnter={() => setHovered(c.key)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}
                role="button"
                aria-label={c.phva}
              >
                <circle
                  cx={c.x}
                  cy={c.y}
                  r={SAT_R}
                  fill={active ? '#E8F5E9' : 'white'}
                  stroke={active ? '#4CAF50' : '#D1D5DB'}
                  strokeWidth={active ? 2 : 1.5}
                  filter={active ? 'url(#glow-green)' : undefined}
                  style={{ transition: 'all 200ms ease' }}
                />
                <TextInCircle
                  x={c.x}
                  y={c.y}
                  lines={c.lines}
                  sub={c.sub}
                  isActive={active}
                />
              </g>
            )
          })}

          {/* Center circle — Liderazgo y Participación */}
          <g
            onClick={() => setSelectedPhase('center')}
            onMouseEnter={() => setHovered('center')}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label="Liderazgo y Participación"
          >
            <circle
              cx={CX}
              cy={CY}
              r={CTR_R}
              fill={isHovered('center') ? '#E8F5E9' : '#F9FAFB'}
              stroke="#4CAF50"
              strokeWidth="2"
              style={{ transition: 'all 200ms ease' }}
            />
            <text
              x={CX} y={CY - 15}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="700"
              fill={isHovered('center') ? '#2E7D32' : '#4CAF50'}
              fontFamily="Montserrat, system-ui, sans-serif"
              style={{ transition: 'fill 200ms ease' }}
            >
              Liderazgo y
            </text>
            <text
              x={CX} y={CY - 3}
              textAnchor="middle"
              fontSize="9.5"
              fontWeight="700"
              fill={isHovered('center') ? '#2E7D32' : '#4CAF50'}
              fontFamily="Montserrat, system-ui, sans-serif"
              style={{ transition: 'fill 200ms ease' }}
            >
              participación
            </text>
            <text
              x={CX} y={CY + 10}
              textAnchor="middle"
              fontSize="8.5"
              fill={isHovered('center') ? '#2E7D32' : '#6B8F71'}
              fontFamily="Poppins, system-ui, sans-serif"
              style={{ transition: 'fill 200ms ease' }}
            >
              trabajadores
            </text>
            <text
              x={CX} y={CY + 22}
              textAnchor="middle"
              fontSize="8"
              fill={isHovered('center') ? '#4CAF50' : '#9CA3AF'}
              fontFamily="Poppins, system-ui, sans-serif"
              style={{ transition: 'fill 200ms ease' }}
            >
              ISO 5
            </text>
          </g>
        </svg>

        {/* Module selection panel */}
        {selectedPhase && modules && phaseLabel ? (
          <div className="mt-3 bg-surface-base rounded-xl border border-border-subtle p-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">{phaseLabel.title}</span>
                <span className="text-xs text-text-tertiary bg-surface-elevated px-1.5 py-0.5 rounded font-mono">
                  ISO {phaseLabel.iso}
                </span>
              </div>
              <button
                onClick={() => setSelectedPhase(null)}
                className="text-text-tertiary hover:text-text-secondary transition-colors text-lg leading-none"
                aria-label="Cerrar"
              >
                ×
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {modules.map((mod) => (
                <button
                  key={mod.label}
                  onClick={() => handleModuleClick(mod)}
                  className="text-left px-3 py-2.5 rounded-lg border border-border-subtle bg-surface-base hover:bg-success-bg hover:border-green-200 hover:text-success text-sm font-medium text-text-secondary transition-colors"
                >
                  {mod.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Phase hint legend */
          <div className="flex justify-center gap-6 mt-2 flex-wrap">
            {SATELLITE_CIRCLES.map((c) => (
              <button
                key={c.key}
                onClick={() => setSelectedPhase(c.key)}
                className="flex items-center gap-1.5 text-xs text-text-tertiary hover:text-success transition-colors"
              >
                <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
                <span className="font-medium text-text-secondary">{c.key}</span>
                <span>{c.phva}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
