'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { EstablecimientoIcon } from '@/components/icons/establecimiento-icon'
import {
  ChevronDown,
  ChevronRight,
  Building2,
  FileText,
  Mail,
  Phone,
  Globe,
  Hash,
  ExternalLink,
  Users,
  Briefcase,
  Gauge,
  UserCog,
  CreditCard,
  FileCheck,
  Package,
  Settings2,
  CalendarClock,
  MessageSquare,
  Map,
  Pencil,
} from 'lucide-react'
import Image from 'next/image'
import { publicAssetUrl } from '@/lib/storage/asset-url'
import type { Consultora, UserRole } from '@/lib/types'
import type { Icon as LucideIcon } from 'lucide-react'

interface EmpresaConEstablecimientos {
  id: string
  razon_social: string
  is_active: boolean
  establecimientos: { id: string; nombre: string; status?: 'active' | 'on_hold' | 'cancelled' }[]
}

interface UsuarioInfo {
  fullName: string
  email: string | null
  avatarUrl: string | null
  rolLabel: string
}

interface Props {
  consultora: Consultora
  empresas: EmpresaConEstablecimientos[]
  canWrite: boolean
  usuario?: UsuarioInfo | null
  userRole?: UserRole | null
  isSuperAdmin?: boolean
}

interface NavItem {
  href: string
  icon: LucideIcon
  label: string
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const TIPO_LABEL: Record<string, string> = {
  consultora: 'Consultora',
  profesional: 'Profesional independiente',
  profesional_independiente: 'Profesional independiente',
}

function antiguedad(desde: string | null): string | null {
  if (!desde) return null
  const d = new Date(desde)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
}

/**
 * Ficha a nivel GLOBAL / consultora — árbol de navegación minimalista.
 *
 * Nivel 0 — Header: card con los datos de la consultora (quien paga la suscripción).
 * Nivel 1 — Empresas: acordeón colapsado por defecto. Cada fila tiene un botón
 *   "Abrir ficha" → ficha de la empresa (?section=ficha).
 * Nivel 2 — Establecimientos: al expandir una empresa se listan SOLO los nombres
 *   de sus establecimientos, cada uno con un botón "Abrir ficha" → ficha del
 *   establecimiento (?section=ficha).
 *
 * No embebe el contenido de las fichas: es un árbol liviano para navegar rápido
 * y abrir la ficha que corresponda a cada nivel.
 */
export function ConsultoraFichaGlobal({ consultora, empresas, usuario, userRole, isSuperAdmin = false }: Props) {
  const canEditConsultora = userRole === 'full_access_main' || isSuperAdmin
  const canVerReportes =
    userRole === 'full_access_main' || userRole === 'responsable_estandares' || isSuperAdmin

  const navGroups: NavGroup[] = [
    {
      label: 'Consultora',
      items: [
        { href: '/dashboard/configuracion/consultora', icon: Building2, label: 'Información' },
        { href: '/dashboard/instrumentos', icon: Gauge, label: 'Instrumentos' },
        { href: '/dashboard/usuarios', icon: UserCog, label: 'Usuarios' },
        { href: '/dashboard/billing', icon: CreditCard, label: 'Suscripción' },
        ...(canVerReportes
          ? [{ href: '/dashboard/reportes', icon: FileCheck, label: 'Reportes' }]
          : []),
      ],
    },
    {
      label: 'Herramientas',
      items: [
        { href: '/dashboard/configuracion/catalogacion', icon: Settings2, label: 'Catalogación' },
        { href: '/dashboard/configuracion/vencimientos', icon: CalendarClock, label: 'Vencimientos' },
        { href: '/dashboard/configuracion/feedback', icon: MessageSquare, label: 'Feedback' },
        { href: '/dashboard/mapas', icon: Map, label: 'Mapa de Riesgos' },
        ...(isSuperAdmin
          ? [{ href: '/dashboard/admin/catalogo-proveedores', icon: Package, label: 'Catálogo Proveedores' }]
          : []),
      ],
    },
  ]

  const tipoLabel = consultora.tipo ? (TIPO_LABEL[consultora.tipo] ?? consultora.tipo) : null
  const desde = antiguedad(consultora.created_at)
  const socials = consultora.social_links && typeof consultora.social_links === 'object'
    ? Object.entries(consultora.social_links).filter(([, v]) => typeof v === 'string' && v)
    : []
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  // Por defecto SOLO activas (a nivel consultora). El usuario puede elegir inactivas o todas.
  const [estadoSel, setEstadoSel] = useState<string>('activas')

  // Filtrado client-side. Empresas → is_active. Establecimientos anidados → status:
  // 'cancelled' SIEMPRE fuera; según el toggle se muestran active / on_hold / ambos.
  const empresasFiltradas = useMemo(() => {
    return empresas
      .filter(emp => {
        if (estadoSel === 'activas' && !emp.is_active) return false
        if (estadoSel === 'inactivas' && emp.is_active) return false
        return true
      })
      .map(emp => ({
        ...emp,
        establecimientos: emp.establecimientos.filter(est => {
          if (est.status === 'cancelled') return false
          if (estadoSel === 'activas' && est.status === 'on_hold') return false
          if (estadoSel === 'inactivas' && est.status === 'active') return false
          return true
        }),
      }))
  }, [empresas, estadoSel])

  const selectCls = 'bg-surface-base border border-border-default rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-sig-500/40 focus:border-sig-500 transition-shadow'

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  return (
    <div className="p-6 space-y-6">
      {/* Header — info de la consultora */}
      <header className="bg-surface-base border border-border-subtle rounded-xl p-5">
        <div className="flex items-start gap-4">
          {consultora.logo_url ? (
            <Image
              src={publicAssetUrl('consultora', consultora.logo_url) ?? consultora.logo_url}
              alt={consultora.nombre}
              width={56}
              height={56}
              className="h-14 w-14 rounded-lg object-contain bg-surface-sunken/40 shrink-0"
            />
          ) : (
            <div className="h-14 w-14 rounded-lg bg-sig-500/10 flex items-center justify-center shrink-0">
              <FileText size={24} className="text-sig-500" aria-hidden="true" />
            </div>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="text-lg font-semibold text-text-primary dark:text-white truncate">
                  {consultora.nombre}
                </h1>
                <p className="text-xs text-text-tertiary mt-0.5">
                  Ficha global de la consultora
                </p>
              </div>
              {canEditConsultora && (
                <Link
                  href="/dashboard/configuracion/consultora"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-text-secondary hover:text-sig-600 transition-colors shrink-0 mt-0.5"
                >
                  <Pencil size={13} aria-hidden="true" />
                  Editar
                </Link>
              )}
            </div>

            <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
              {consultora.cuit && (
                <div className="flex items-center gap-2 text-sm">
                  <Hash size={14} className="text-text-tertiary shrink-0" aria-hidden="true" />
                  <dt className="sr-only">CUIT</dt>
                  <dd className="text-text-secondary truncate">{consultora.cuit}</dd>
                </div>
              )}
              {consultora.email && (
                <div className="flex items-center gap-2 text-sm">
                  <Mail size={14} className="text-text-tertiary shrink-0" aria-hidden="true" />
                  <dt className="sr-only">Email</dt>
                  <dd className="text-text-secondary truncate">
                    <a href={`mailto:${consultora.email}`} className="hover:text-sig-600 transition-colors">
                      {consultora.email}
                    </a>
                  </dd>
                </div>
              )}
              {consultora.telefono && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone size={14} className="text-text-tertiary shrink-0" aria-hidden="true" />
                  <dt className="sr-only">Teléfono</dt>
                  <dd className="text-text-secondary truncate">{consultora.telefono}</dd>
                </div>
              )}
              {consultora.website && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe size={14} className="text-text-tertiary shrink-0" aria-hidden="true" />
                  <dt className="sr-only">Website</dt>
                  <dd className="truncate">
                    <a
                      href={consultora.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sig-600 hover:text-sig-700 transition-colors"
                    >
                      {consultora.website.replace(/^https?:\/\//, '')}
                    </a>
                  </dd>
                </div>
              )}
              {tipoLabel && (
                <div className="flex items-center gap-2 text-sm">
                  <Briefcase size={14} className="text-text-tertiary shrink-0" aria-hidden="true" />
                  <dt className="sr-only">Tipo</dt>
                  <dd className="text-text-secondary truncate">{tipoLabel}</dd>
                </div>
              )}
              {typeof consultora.seats_max === 'number' && (
                <div className="flex items-center gap-2 text-sm">
                  <Users size={14} className="text-text-tertiary shrink-0" aria-hidden="true" />
                  <dt className="sr-only">Asientos</dt>
                  <dd className="text-text-secondary truncate">{consultora.seats_max} usuarios</dd>
                </div>
              )}
              {desde && (
                <div className="flex items-center gap-2 text-sm">
                  <FileText size={14} className="text-text-tertiary shrink-0" aria-hidden="true" />
                  <dt className="sr-only">Antigüedad</dt>
                  <dd className="text-text-secondary truncate">Desde {desde}</dd>
                </div>
              )}
            </dl>

            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                  consultora.is_active
                    ? 'bg-success-bg text-success'
                    : 'bg-surface-sunken text-text-tertiary'
                }`}
              >
                {consultora.is_active ? 'Activa' : 'Inactiva'}
              </span>
              {socials.map(([red, url]) => (
                <a
                  key={red}
                  href={url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={red}
                  className="inline-flex items-center gap-1 text-xs text-sig-600 hover:text-sig-700 transition-colors"
                >
                  <Globe size={13} aria-hidden="true" />
                  <span className="capitalize">{red}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Usuario actual */}
        {usuario && (
          <div className="mt-5 pt-4 border-t border-border-subtle flex items-center gap-3">
            {usuario.avatarUrl ? (
              <Image
                src={usuario.avatarUrl}
                alt={usuario.fullName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover shrink-0"
              />
            ) : (
              <div className="h-10 w-10 rounded-full bg-sig-500/10 flex items-center justify-center shrink-0 text-sm font-semibold text-sig-600">
                {usuario.fullName.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium text-text-primary truncate">{usuario.fullName}</p>
              <p className="text-xs text-text-tertiary truncate">
                {usuario.rolLabel}{usuario.email ? ` · ${usuario.email}` : ''}
              </p>
            </div>
          </div>
        )}
      </header>

      {/* Accesos directos — grupos de navegación */}
      <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {navGroups.map(group => (
          <div
            key={group.label}
            className="bg-surface-base border border-border-subtle rounded-xl p-4"
          >
            <p className="text-xs uppercase tracking-wider text-text-tertiary font-semibold mb-2">
              {group.label}
            </p>
            <nav className="space-y-0.5">
              {group.items.map(item => {
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-surface-sunken/60 transition-colors"
                  >
                    <Icon size={16} strokeWidth={1.75} className="text-text-tertiary shrink-0" aria-hidden="true" />
                    <span className="truncate">{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        ))}
      </section>

      {/* Nivel 1 — Empresas */}
      <section className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-text-secondary dark:text-white">Empresas</h2>
            <span className="text-xs text-text-tertiary">
              {empresasFiltradas.length} {empresasFiltradas.length === 1 ? 'empresa' : 'empresas'}
            </span>
          </div>
          {empresas.length > 0 && (
            <select
              value={estadoSel}
              onChange={e => setEstadoSel(e.target.value)}
              aria-label="Filtrar por estado"
              className={selectCls}
            >
              <option value="activas">Activas</option>
              <option value="inactivas">Inactivas</option>
              <option value="todas">Todas</option>
            </select>
          )}
        </div>

        {empresas.length === 0 ? (
          <div className="bg-surface-base border border-border-subtle rounded-xl px-4 py-10 text-center">
            <Building2 size={28} className="mx-auto text-text-tertiary mb-2" aria-hidden="true" />
            <p className="text-sm text-text-tertiary">
              Esta consultora todavía no tiene empresas cargadas.
            </p>
          </div>
        ) : empresasFiltradas.length === 0 ? (
          <div className="bg-surface-base border border-border-subtle rounded-xl px-4 py-10 text-center">
            <Building2 size={28} className="mx-auto text-text-tertiary mb-2" aria-hidden="true" />
            <p className="text-sm text-text-tertiary">
              {estadoSel === 'inactivas'
                ? 'No hay empresas inactivas.'
                : 'No hay empresas activas.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {empresasFiltradas.map(emp => {
              const isOpen = expanded.has(emp.id)
              const count = emp.establecimientos.length

              return (
                <div
                  key={emp.id}
                  className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden"
                >
                  {/* Fila empresa: toggle + nombre + contador + Abrir ficha */}
                  <div className="flex items-center gap-2 px-4 py-3 hover:bg-surface-sunken/40 transition-colors">
                    <button
                      type="button"
                      onClick={() => toggle(emp.id)}
                      aria-expanded={isOpen}
                      aria-label={isOpen ? `Colapsar ${emp.razon_social}` : `Expandir ${emp.razon_social}`}
                      className="flex items-center gap-2 flex-1 min-w-0 text-left"
                    >
                      <span className="text-text-tertiary shrink-0">
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                      <Building2 size={16} className="text-sig-500 shrink-0" aria-hidden="true" />
                      <span className="font-medium text-text-primary truncate">
                        {emp.razon_social}
                      </span>
                      <span className="text-xs text-text-tertiary shrink-0">
                        {count} {count === 1 ? 'establecimiento' : 'establecimientos'}
                      </span>
                    </button>
                    <Link
                      href={`/dashboard/empresas/${emp.id}?section=ficha`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-sig-600 hover:text-sig-700 transition-colors shrink-0"
                    >
                      Abrir ficha <ExternalLink size={13} aria-hidden="true" />
                    </Link>
                  </div>

                  {/* Nivel 2 — solo nombres de establecimientos + Abrir ficha */}
                  {isOpen && (
                    <div className="border-t border-border-subtle bg-surface-sunken/20 py-1 pl-6 pr-2">
                      {count === 0 ? (
                        <p className="text-xs text-text-tertiary px-2 py-3">
                          Sin establecimientos.
                        </p>
                      ) : (
                        emp.establecimientos.map(est => (
                          <div
                            key={est.id}
                            className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-surface-base transition-colors"
                          >
                            <EstablecimientoIcon size={14} className="text-text-tertiary shrink-0" aria-hidden="true" />
                            <span className="text-sm text-text-secondary truncate flex-1">
                              {est.nombre}
                            </span>
                            <Link
                              href={`/dashboard/empresas/${emp.id}/establecimientos/${est.id}?section=ficha`}
                              className="inline-flex items-center gap-1 text-xs font-medium text-sig-600 hover:text-sig-700 transition-colors shrink-0"
                            >
                              Abrir ficha <ExternalLink size={13} aria-hidden="true" />
                            </Link>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
