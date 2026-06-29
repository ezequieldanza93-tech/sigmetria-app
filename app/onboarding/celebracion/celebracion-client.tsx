'use client'

import { useState, useEffect } from 'react'
import { CheckCircle2, Star, ArrowRight } from 'lucide-react'
import Link from 'next/link'

const FEATURE_LABELS: Record<string, string> = {
  gestion_documental: 'Gestión documental',
  seguimiento_desvios: 'Seguimiento de desvíos',
  capacitaciones_digitales: 'Capacitaciones digitales',
  matriz_riesgos: 'Matriz de riesgos',
  app_campo: 'App de campo',
  kpis_reportes: 'KPIs y reportes',
  exportacion_datos: 'Exportación PDF/Excel',
  colaboradores_multiples: 'Múltiples colaboradores',
  roles_permisos: 'Roles y permisos',
  export_pdf: 'Exportación PDF',
  export_excel: 'Exportación Excel',
  iperc: 'IPERC',
  notificaciones: 'Notificaciones',
  firmas_digitales: 'Firmas digitales',
  mapas_riesgo: 'Mapas de riesgo',
  subcontratistas: 'Subcontratistas',
  denuncias_incidentes: 'Denuncias e incidentes',
  modo_offline: 'Modo offline',
  api_webhooks: 'API y webhooks',
  capacitaciones: 'Capacitaciones',
  auditoria_seguridad: 'Auditoría de seguridad',
  workflow_aprobaciones: 'Flujo de aprobaciones',
}

interface ChecklistItem {
  id: string
  label: string
  href: string
  nota?: string
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'primera_empresa',
    label: 'Cargá tu primera empresa cliente',
    href: '/dashboard/empresas/nueva',
  },
  {
    id: 'primer_establecimiento',
    label: 'Creá un establecimiento',
    href: '/dashboard/empresas',
    nota: 'desde una empresa',
  },
  {
    id: 'primera_gestion',
    label: 'Completá tu primera gestión y exportá el reporte',
    href: '/dashboard/empresas',
    nota: 'desde el panel de la empresa',
  },
  {
    id: 'primer_viewer',
    label: 'Sumá a tu cliente como Viewer (gratis)',
    href: '/dashboard/usuarios',
  },
]

const STORAGE_KEY = 'onboarding_checklist'

interface ChecklistState {
  [id: string]: boolean
}

function loadChecklist(): ChecklistState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as ChecklistState
  } catch {
    return {}
  }
}

function saveChecklist(state: ChecklistState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage no disponible: ignorar
  }
}

export interface CelebracionClientProps {
  nombre: string | null
  planNombre: string
  isFounder: boolean
  features: string[]
}

export function CelebracionClient({
  nombre,
  planNombre,
  isFounder,
  features,
}: CelebracionClientProps) {
  const [checks, setChecks] = useState<ChecklistState>({})
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setChecks(loadChecklist())
    setMounted(true)
  }, [])

  function toggle(id: string) {
    setChecks((prev) => {
      const next = { ...prev, [id]: !prev[id] }
      saveChecklist(next)
      return next
    })
  }

  const completados = Object.values(checks).filter(Boolean).length
  const total = CHECKLIST_ITEMS.length

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12 space-y-10">

        {/* ── Sección 1: Hero ── */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <span
              className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10"
              style={{ animation: 'celebracion-pulse 2s ease-in-out infinite' }}
            >
              <CheckCircle2 className="w-10 h-10 text-success" />
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-text-primary">
              {nombre ? `¡Bienvenido a Sigmetría, ${nombre}!` : '¡Bienvenido a Sigmetría!'}
            </h1>
            <p className="text-lg text-text-secondary">
              Tu plan <span className="font-semibold text-text-primary">{planNombre}</span> ya está activo.
            </p>
          </div>

          {isFounder && (
            <div className="inline-flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-semibold px-3 py-1.5 rounded-full">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              Fundador — descuento del 20% de por vida
            </div>
          )}
        </div>

        {/* ── Sección 2: Checklist primeros pasos ── */}
        <div className="bg-surface border border-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">Primeros pasos</h2>
            {mounted && (
              <span className="text-xs text-text-tertiary">
                {completados}/{total} completados
              </span>
            )}
          </div>

          <div className="space-y-3">
            {CHECKLIST_ITEMS.map((item) => {
              const done = mounted && !!checks[item.id]
              return (
                <div
                  key={item.id}
                  className="flex items-start gap-3 group"
                >
                  <button
                    type="button"
                    onClick={() => toggle(item.id)}
                    className={[
                      'mt-0.5 w-5 h-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors',
                      done
                        ? 'bg-success border-success text-white'
                        : 'border-border bg-background hover:border-brand-primary',
                    ].join(' ')}
                    aria-label={done ? 'Marcar como pendiente' : 'Marcar como completado'}
                  >
                    {done && (
                      <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none">
                        <path
                          d="M2 6l3 3 5-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    )}
                  </button>

                  <div className="flex-1 min-w-0">
                    <span className={[
                      'text-sm text-text-primary',
                      done ? 'line-through text-text-tertiary' : '',
                    ].join(' ')}>
                      {item.label}
                    </span>
                    {item.nota && (
                      <span className="text-xs text-text-tertiary ml-1">
                        ({item.nota})
                      </span>
                    )}
                  </div>

                  <Link
                    href={item.href}
                    className="shrink-0 text-xs text-brand-primary hover:underline flex items-center gap-0.5"
                  >
                    Ir <ArrowRight className="w-3 h-3" />
                  </Link>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Sección 3: Features desbloqueadas ── */}
        {features.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-base font-semibold text-text-primary">
              Features desbloqueadas en tu plan
            </h2>
            <div className="flex flex-wrap gap-2">
              {features.map((key) => (
                <span
                  key={key}
                  className="inline-flex items-center bg-brand-primary/5 border border-brand-primary/20 text-brand-primary text-xs font-medium px-3 py-1 rounded-full"
                >
                  {FEATURE_LABELS[key] ?? key}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── CTA final ── */}
        <div className="text-center pt-2">
          <Link
            href="/dashboard/empresas"
            className="inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-colors bg-brand-primary hover:bg-brand-hover text-white hover:-translate-y-px hover:shadow-md active:translate-y-0 px-5 py-2.5 text-sm"
          >
            Ir a mi panel <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </div>
      </div>

      {/* Keyframe de animación CSS pura */}
      <style>{`
        @keyframes celebracion-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(34,197,94,0.3); }
          50%       { box-shadow: 0 0 0 12px rgba(34,197,94,0); }
        }
      `}</style>
    </div>
  )
}
