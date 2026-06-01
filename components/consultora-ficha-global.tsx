'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import {
  ChevronDown,
  ChevronRight,
  Building2,
  FileText,
  Mail,
  Phone,
  Globe,
  Hash,
  MapPin,
  ExternalLink,
} from 'lucide-react'
import Image from 'next/image'
import type { Consultora } from '@/lib/types'

interface EmpresaConEstablecimientos {
  id: string
  razon_social: string
  establecimientos: { id: string; nombre: string }[]
}

interface Props {
  consultora: Consultora
  empresas: EmpresaConEstablecimientos[]
  canWrite: boolean
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
export function ConsultoraFichaGlobal({ consultora, empresas }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

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
              src={consultora.logo_url}
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
            <h1 className="text-lg font-semibold text-text-primary dark:text-white truncate">
              {consultora.nombre}
            </h1>
            <p className="text-xs text-text-tertiary mt-0.5">
              Ficha global de la consultora
            </p>

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
            </dl>
          </div>
        </div>
      </header>

      {/* Nivel 1 — Empresas */}
      <section className="space-y-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-text-secondary dark:text-white">Empresas</h2>
          <span className="text-xs text-text-tertiary">
            {empresas.length} {empresas.length === 1 ? 'empresa' : 'empresas'}
          </span>
        </div>

        {empresas.length === 0 ? (
          <div className="bg-surface-base border border-border-subtle rounded-xl px-4 py-10 text-center">
            <Building2 size={28} className="mx-auto text-text-tertiary mb-2" aria-hidden="true" />
            <p className="text-sm text-text-tertiary">
              Esta consultora todavía no tiene empresas cargadas.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {empresas.map(emp => {
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
                            <MapPin size={14} className="text-text-tertiary shrink-0" aria-hidden="true" />
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
