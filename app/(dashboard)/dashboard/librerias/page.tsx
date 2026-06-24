import Link from 'next/link'
import {
  Shield,
  ShieldCheck,
  Package,
  AlertTriangle,
  ClipboardList,
  ScrollText,
  FileText,
  GraduationCap,
  BookOpen,
  CheckCircle,
  Library,
  Scale,
} from 'lucide-react'
import { getEffectiveRole } from '@/lib/auth/effective-role'

type LucideIconType = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>

interface HubCard {
  href: string
  icon: LucideIconType
  title: string
  description: string
}

interface HubSection {
  title: string
  icon: LucideIconType
  cards: HubCard[]
}

export default async function LibreriasHubPage() {
  const eff = await getEffectiveRole()
  const canManageCursos =
    eff?.isSuperAdmin === true ||
    eff?.effectiveUserRole === 'full_access_main' ||
    eff?.effectiveUserRole === 'full_access_branch'

  const sections: HubSection[] = [
    {
      title: 'Catálogos de productos',
      icon: Package,
      cards: [
        {
          href: '/dashboard/productos?clase=epp',
          icon: Shield,
          title: 'Elementos de Protección (EPP)',
          description: 'Catálogo de protección personal: cabeza, ocular, manos, cuerpo, altura.',
        },
        {
          href: '/dashboard/productos?clase=epc',
          icon: ShieldCheck,
          title: 'Protección Colectiva (EPC)',
          description: 'Catálogo de protección colectiva y señalización.',
        },
        {
          href: '/dashboard/productos?clase=equipamiento',
          icon: Package,
          title: 'Equipamiento',
          description: 'Herramientas, maquinaria, andamios y consumibles.',
        },
      ],
    },
    {
      title: 'Requisitos legales',
      icon: Scale,
      cards: [
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
      ],
    },
    {
      title: 'Gestiones',
      icon: ClipboardList,
      cards: [
        {
          href: '/dashboard/libreria-gestiones',
          icon: ClipboardList,
          title: 'Gestiones',
          description: 'Plantillas y modelos de gestiones reutilizables.',
        },
        {
          href: '/dashboard/configuracion/iperc',
          icon: AlertTriangle,
          title: 'IPERC',
          description: 'Identificación de peligros y evaluación de riesgos.',
        },
      ],
    },
    {
      title: 'Campus Virtual',
      icon: GraduationCap,
      cards: [
        {
          href: '/dashboard/cursos',
          icon: GraduationCap,
          title: 'Campus',
          description: 'Cursos asignados y estado de completitud.',
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
                description: 'Control de cumplimiento del Campus.',
              } as HubCard,
            ]
          : []),
      ],
    },
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

      <div className="space-y-5">
        {sections.map((section) => {
          const SectionIcon = section.icon
          return (
            <section
              key={section.title}
              className="bg-surface-base border border-border-subtle rounded-2xl p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <SectionIcon size={18} strokeWidth={1.8} className="text-sig-500" aria-hidden />
                <h2 className="text-base font-semibold text-text-primary">{section.title}</h2>
                <span className="text-xs text-text-tertiary">({section.cards.length})</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {section.cards.map((card) => {
                  const Icon = card.icon
                  return (
                    <Link
                      key={card.href}
                      href={card.href}
                      className="group flex flex-row items-center gap-3 bg-surface-base border border-border-subtle rounded-xl p-4 hover:border-sig-400 hover:shadow-sm transition-all duration-150 active:scale-[0.98]"
                    >
                      <div className="h-12 w-12 rounded-xl bg-sig-500/10 flex items-center justify-center shrink-0 group-hover:bg-sig-500/15 transition-colors">
                        <Icon size={24} strokeWidth={1.6} className="text-sig-500" aria-hidden />
                      </div>
                      <div className="min-w-0">
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
            </section>
          )
        })}
      </div>
    </div>
  )
}
