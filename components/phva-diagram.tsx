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

  const isHovered = (key: string) => hovered === key

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
          <text
            x="280" y="36"
            textAnchor="middle"
            fontSize="9"
            fontWeight="600"
            fill="#9CA3AF"
            fontFamily="Poppins, system-ui, sans-serif"
            letterSpacing="0.06em"
          >
            CONTEXTO DE LA ORGANIZACIÓN · ISO 45001
          </text>

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
                onClick={() => router.push(getUrl(c.tab))}
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

          {/* Center circle — Contexto y Stakeholders */}
          <g
            onClick={() => router.push(getCenterUrl())}
            onMouseEnter={() => setHovered('center')}
            onMouseLeave={() => setHovered(null)}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label="Contexto y Stakeholders"
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
              x={CX} y={CY - 9}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={isHovered('center') ? '#2E7D32' : '#4CAF50'}
              fontFamily="Montserrat, system-ui, sans-serif"
              style={{ transition: 'fill 200ms ease' }}
            >
              Contexto y
            </text>
            <text
              x={CX} y={CY + 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight="700"
              fill={isHovered('center') ? '#2E7D32' : '#4CAF50'}
              fontFamily="Montserrat, system-ui, sans-serif"
              style={{ transition: 'fill 200ms ease' }}
            >
              Stakeholders
            </text>
            <text
              x={CX} y={CY + 18}
              textAnchor="middle"
              fontSize="8.5"
              fill={isHovered('center') ? '#4CAF50' : '#9CA3AF'}
              fontFamily="Poppins, system-ui, sans-serif"
              style={{ transition: 'fill 200ms ease' }}
            >
              ISO 5
            </text>
          </g>
        </svg>

        {/* Phase hint legend */}
        <div className="flex justify-center gap-6 mt-2 flex-wrap">
          {SATELLITE_CIRCLES.map((c) => (
            <button
              key={c.key}
              onClick={() => router.push(getUrl(c.tab))}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-green-600 transition-colors"
            >
              <span className="w-2 h-2 rounded-full bg-gray-300 inline-block" />
              <span className="font-medium text-gray-500">{c.key}</span>
              <span>{c.phva}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
