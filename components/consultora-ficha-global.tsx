'use client'

import { useState, useCallback } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Building2,
  FileText,
  Mail,
  Phone,
  Globe,
  Hash,
} from 'lucide-react'
import Image from 'next/image'
import { EmpresaFichaEstablecimientos } from '@/components/empresa-ficha-establecimientos'
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
 * Ficha a nivel GLOBAL / consultora con efecto cascada minimalista.
 *
 * Nivel 0 — Header: card limpia con los datos de la consultora (quien paga la
 * suscripción).
 * Nivel 1 — Empresas: acordeón colapsado por defecto. Cada header muestra la
 * razón social y la cantidad de establecimientos.
 * Nivel 2 — Establecimientos: al expandir una empresa se monta (carga DIFERIDA
 * real) el componente reusado EmpresaFichaEstablecimientos, que a su vez maneja
 * el acordeón de establecimientos con sus 11 tabs lazy-load.
 *
 * Carga diferida: EmpresaFichaEstablecimientos de una empresa NO se monta hasta
 * que esa empresa se expande. Una vez montado, permanece montado para no perder
 * el estado interno (tabs/fichas ya cargadas) al colapsar/expandir de nuevo,
 * pero se oculta vía CSS.
 */
export function ConsultoraFichaGlobal({ consultora, empresas, canWrite }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [mounted, setMounted] = useState<Set<string>>(new Set())

  const toggle = useCallback((id: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
        // Carga diferida: marcamos la empresa como montada solo al expandirla.
        setMounted(curr => {
          if (curr.has(id)) return curr
          const m = new Set(curr)
          m.add(id)
          return m
        })
      }
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
              const isMounted = mounted.has(emp.id)
              const count = emp.establecimientos.length

              return (
                <div
                  key={emp.id}
                  className="bg-surface-base border border-border-subtle rounded-xl overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => toggle(emp.id)}
                    aria-expanded={isOpen}
                    className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-surface-sunken/40 transition-colors"
                  >
                    <span className="text-text-tertiary shrink-0">
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </span>
                    <Building2 size={16} className="text-sig-500 shrink-0" aria-hidden="true" />
                    <span className="font-medium text-text-primary truncate flex-1">
                      {emp.razon_social}
                    </span>
                    <span className="text-xs text-text-tertiary shrink-0">
                      {count} {count === 1 ? 'establecimiento' : 'establecimientos'}
                    </span>
                  </button>

                  {/* Nivel 2 — Establecimientos (carga diferida: solo se monta al expandir) */}
                  {isMounted && (
                    <div
                      className={`border-t border-border-subtle bg-surface-sunken/20 p-4 pl-6 ${
                        isOpen ? '' : 'hidden'
                      }`}
                    >
                      <EmpresaFichaEstablecimientos
                        empresaId={emp.id}
                        establecimientos={emp.establecimientos}
                        canWrite={canWrite}
                      />
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
