'use client'

import Link from 'next/link'
import {
  Building2, CalendarClock, AlertTriangle, GraduationCap,
  FileText, ClipboardList, BarChart2, Map, UserCog, CreditCard,
  MessageSquare, BookMarked, ArrowRight, Zap,
} from 'lucide-react'

const QUICK_ACTIONS = [
  { label: 'Registrar una visita a un establecimiento', href: '/dashboard/empresas', section: 'Gestión de campo' },
  { label: 'Ver documentos que vencen esta semana', href: '/dashboard/configuracion/vencimientos', section: 'Control documental' },
  { label: 'Asignar un curso a personas', href: '/dashboard/cursos/admin', section: 'Capacitación' },
  { label: 'Ver riesgos críticos activos', href: '/dashboard/analytics', section: 'Analytics' },
  { label: 'Agregar un nuevo establecimiento', href: '/dashboard/empresas', section: 'Empresas' },
  { label: 'Invitar a un colega al equipo', href: '/dashboard/usuarios', section: 'Usuarios' },
]

const MODULES = [
  {
    icon: Building2,
    title: 'Empresas y establecimientos',
    description: 'Portfolio de clientes, fichas, sectores, documentos y el trabajo de campo organizado por lugar.',
    href: '/dashboard/empresas',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
    topics: ['Crear una empresa', 'Agregar establecimientos', 'Gestionar sectores', 'Dashboard del establecimiento'],
  },
  {
    icon: CalendarClock,
    title: 'Agenda y gestiones',
    description: 'Registrá cada visita, inspección o reunión. El historial de campo completo en un calendario.',
    href: '/dashboard/empresas',
    color: 'text-indigo-500',
    bg: 'bg-indigo-500/10',
    topics: ['Registrar una gestión', 'Planificar visitas futuras', 'Asignar acciones correctivas', 'Seguimiento de pendientes'],
  },
  {
    icon: AlertTriangle,
    title: 'Incidentes y denuncias',
    description: 'Canal formal para eventos adversos y reclamos. Trazabilidad desde la detección hasta el cierre.',
    href: '/dashboard/incidentes',
    color: 'text-amber-500',
    bg: 'bg-amber-500/10',
    topics: ['Diferencia entre incidente y denuncia', 'Registrar un incidente', 'Gestionar una denuncia', 'Estados y seguimiento'],
  },
  {
    icon: GraduationCap,
    title: 'Capacitación',
    description: 'LMS integrado para capacitación en SSO. Cursos, quizzes, certificados y compliance.',
    href: '/dashboard/cursos',
    color: 'text-emerald-500',
    bg: 'bg-emerald-500/10',
    topics: ['Crear y publicar un curso', 'Asignar cursos a personas', 'Revisar compliance por empresa', 'Descargar certificados'],
  },
  {
    icon: FileText,
    title: 'Documentos y vencimientos',
    description: 'Control documental con alertas automáticas por color. Nunca más un certificado vencido.',
    href: '/dashboard/configuracion/vencimientos',
    color: 'text-rose-500',
    bg: 'bg-rose-500/10',
    topics: ['Cargar un documento', 'Configurar alertas', 'Ver vencimientos próximos', 'Renovar documentación'],
  },
  {
    icon: ClipboardList,
    title: 'IPERC',
    description: 'Identificación de peligros, evaluación de riesgos y controles. La librería es tuya para configurar.',
    href: '/dashboard/configuracion/iperc',
    color: 'text-orange-500',
    bg: 'bg-orange-500/10',
    topics: ['Configurar la librería', 'Hacer una evaluación', 'La matriz de riesgo', 'Jerarquía de controles'],
  },
  {
    icon: BarChart2,
    title: 'Analytics',
    description: 'KPIs, tendencias y métricas de todo el portfolio. Datos para decisiones y reportes a clientes.',
    href: '/dashboard/analytics',
    color: 'text-violet-500',
    bg: 'bg-violet-500/10',
    topics: ['Dashboard general', 'Filtrar por empresa', 'Exportar datos', 'Dashboard por establecimiento'],
  },
  {
    icon: Map,
    title: 'Mapa de riesgos',
    description: 'Todos los establecimientos en un mapa. El color del marcador te dice dónde está el mayor riesgo.',
    href: '/dashboard/mapas',
    color: 'text-teal-500',
    bg: 'bg-teal-500/10',
    topics: ['Leer el mapa de colores', 'Navegar a un establecimiento', 'Usar el mapa para planificar', 'Exportar vista'],
  },
  {
    icon: UserCog,
    title: 'Usuarios y roles',
    description: 'Gestioná el equipo con permisos granulares. Cada rol ve y puede hacer exactamente lo que necesita.',
    href: '/dashboard/usuarios',
    color: 'text-sky-500',
    bg: 'bg-sky-500/10',
    topics: ['Invitar a un usuario', 'Cambiar roles', 'Desactivar accesos', 'Gestionar seats'],
  },
  {
    icon: CreditCard,
    title: 'Facturación',
    description: 'Plan, asientos y pagos. Integrado con Mercado Pago para facturación mensual o anual.',
    href: '/dashboard/billing',
    color: 'text-pink-500',
    bg: 'bg-pink-500/10',
    topics: ['Cambiar de plan', 'Agregar asientos', 'Métodos de pago', 'Historial de pagos'],
  },
  {
    icon: MessageSquare,
    title: 'SIGIA — Asistente IA',
    description: 'El asistente inteligente siempre disponible. Preguntale qué hacer, cómo hacerlo o qué muestran tus datos.',
    href: '/dashboard',
    color: 'text-brand-primary',
    bg: 'bg-brand-primary/10',
    topics: ['Consultas sobre el sistema', 'Analizar tus datos con SIGIA', 'Preguntas sobre normativa', 'Buenas prácticas'],
  },
]

export function TutorialesHub() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-10">

      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <BookMarked size={22} className="text-brand-primary" strokeWidth={1.75} />
          <h1 className="text-xl font-semibold text-text-primary" style={{ fontFamily: 'Montserrat, system-ui' }}>
            Tutoriales de Uso
          </h1>
        </div>
        <p className="text-sm text-text-tertiary">
          Encontrá lo que necesitás rápido — sin leer todo el manual.
        </p>
      </div>

      {/* Acciones rápidas */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap size={15} className="text-brand-primary" strokeWidth={2} />
          <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
            Acciones frecuentes
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {QUICK_ACTIONS.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="group flex items-start gap-3 px-4 py-3 rounded-xl border border-border-subtle bg-surface-elevated hover:border-brand-primary/40 hover:bg-brand-muted/30 transition-all"
            >
              <ArrowRight
                size={14}
                strokeWidth={2}
                className="text-text-tertiary group-hover:text-brand-primary transition-colors mt-0.5 shrink-0"
              />
              <div>
                <p className="text-sm text-text-primary leading-snug">{action.label}</p>
                <p className="text-xs text-text-tertiary mt-0.5">{action.section}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Módulos */}
      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-text-tertiary">
          Todos los módulos
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MODULES.map((mod) => {
            const Icon = mod.icon
            return (
              <Link
                key={mod.title}
                href={mod.href}
                className="group flex flex-col gap-3 p-5 rounded-xl border border-border-subtle bg-surface-elevated hover:border-brand-primary/40 hover:shadow-[var(--shadow-md)] transition-all"
              >
                {/* Icon + title */}
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${mod.bg} shrink-0`}>
                    <Icon size={18} strokeWidth={1.75} className={mod.color} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary group-hover:text-brand-primary transition-colors">
                      {mod.title}
                    </p>
                    <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
                      {mod.description}
                    </p>
                  </div>
                </div>

                {/* Topics */}
                <div className="flex flex-wrap gap-1.5">
                  {mod.topics.map((topic) => (
                    <span
                      key={topic}
                      className="text-xs px-2 py-0.5 rounded-full bg-surface-sunken text-text-tertiary"
                    >
                      {topic}
                    </span>
                  ))}
                </div>
              </Link>
            )
          })}
        </div>
      </section>

    </div>
  )
}
