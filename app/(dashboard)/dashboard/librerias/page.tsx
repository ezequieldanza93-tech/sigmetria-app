import Link from 'next/link'
import {
  Shield,
  AlertTriangle,
  ClipboardList,
  ScrollText,
  FileText,
  GraduationCap,
  BookOpen,
  CheckCircle,
  Library,
} from 'lucide-react'
import { getEffectiveRole } from '@/lib/auth/effective-role'

interface HubCard {
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  title: string
  description: string
}

export default async function LibreriasHubPage() {
  const eff = await getEffectiveRole()
  const canManageCursos =
    eff?.isSuperAdmin === true ||
    eff?.effectiveUserRole === 'full_access_main' ||
    eff?.effectiveUserRole === 'full_access_branch'

  const cards: HubCard[] = [
    {
      href: '/dashboard/productos',
      icon: Shield,
      title: 'Elementos de Protección',
      description: 'Catálogo de EPP y elementos de seguridad.',
    },
    {
      href: '/dashboard/configuracion/iperc',
      icon: AlertTriangle,
      title: 'Librería IPERC',
      description: 'Identificación de peligros y evaluación de riesgos.',
    },
    {
      href: '/dashboard/libreria-gestiones',
      icon: ClipboardList,
      title: 'Librería de Gestiones',
      description: 'Plantillas y modelos de gestiones reutilizables.',
    },
    {
      href: '/dashboard/configuracion/normativa-legal',
      icon: ScrollText,
      title: 'Normativa Legal',
      description: 'Registro de normas, leyes y resoluciones vigentes.',
    },
    {
      href: '/dashboard/configuracion/documentos-catalogo',
      icon: FileText,
      title: 'Catálogo de Documentos',
      description: 'Tipos de documentos y requisitos documentales.',
    },
    {
      href: '/dashboard/cursos',
      icon: GraduationCap,
      title: 'Mis Cursos',
      description: 'Formaciones asignadas y estado de completitud.',
    },
    ...(canManageCursos
      ? [
          {
            href: '/dashboard/cursos/admin',
            icon: BookOpen,
            title: 'Administrar Cursos',
            description: 'Crear y gestionar cursos de la consultora.',
          } as HubCard,
          {
            href: '/dashboard/cursos/compliance',
            icon: CheckCircle,
            title: 'Compliance',
            description: 'Control de cumplimiento de formaciones.',
          } as HubCard,
        ]
      : []),
  ]

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-sig-500/10 flex items-center justify-center shrink-0">
          <Library size={22} className="text-sig-500" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Librerías</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            Recursos compartidos y activos de la consultora
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card) => {
          const Icon = card.icon
          return (
            <Link
              key={card.href}
              href={card.href}
              className="group flex flex-col gap-3 bg-surface-base border border-border-subtle rounded-xl p-5 hover:border-sig-400 hover:shadow-sm transition-all duration-150 active:scale-[0.98]"
            >
              <div className="h-10 w-10 rounded-lg bg-sig-500/10 flex items-center justify-center shrink-0 group-hover:bg-sig-500/15 transition-colors">
                <Icon size={20} strokeWidth={1.75} className="text-sig-500" aria-hidden />
              </div>
              <div>
                <p className="font-medium text-text-primary text-sm leading-snug">
                  {card.title}
                </p>
                <p className="text-xs text-text-tertiary mt-1 leading-relaxed">
                  {card.description}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
