import Link from 'next/link'
import { Users, Building2 } from 'lucide-react'

interface HubCard {
  href: string
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>
  title: string
  description: string
}

const CARDS: HubCard[] = [
  {
    href: '/dashboard/personas',
    icon: Users,
    title: 'Personas',
    description: 'Trabajadores y contactos vinculados a la consultora.',
  },
  {
    href: '/dashboard/organizaciones-externas',
    icon: Building2,
    title: 'Organizaciones externas',
    description: 'Proveedores, contratistas y entidades de terceros.',
  },
]

export default function DirectorioHubPage() {
  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-sig-500/10 flex items-center justify-center shrink-0">
          <Users size={22} className="text-sig-500" aria-hidden />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Directorio</h1>
          <p className="text-sm text-text-tertiary mt-0.5">
            Personas y organizaciones vinculadas a la consultora
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CARDS.map((card) => {
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
