'use client'

import { useState, useTransition } from 'react'
import { Mail, Phone, Download, CalendarDays, ShieldCheck, Globe, Tag, ExternalLink, MessageSquare, Loader2 } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { updateLead } from '@/lib/actions/crm'
import {
  ESTADOS_CRM,
  ETAPAS_FUNNEL,
  estadoBadgeVariant,
  estadoLabel,
  type EstadoCrm,
  type Lead,
  type LeadMagnetDescarga,
  type Consentimiento,
} from '@/lib/crm/types'

interface Props {
  lead: Lead
  descargas: LeadMagnetDescarga[]
  consentimientos: Consentimiento[]
  onClose: () => void
  onUpdated: (lead: Lead) => void
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })
  } catch {
    return iso
  }
}

export function LeadDetailModal({ lead, descargas, consentimientos, onClose, onUpdated }: Props) {
  const [estado, setEstado] = useState<EstadoCrm>(lead.estado_crm)
  const [etapa, setEtapa] = useState(lead.etapa_funnel ?? '')
  const [notas, setNotas] = useState(lead.notas_crm ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [pending, start] = useTransition()

  const matchEmail = (e: string | null) => !!lead.email && !!e && e.trim().toLowerCase() === lead.email.trim().toLowerCase()
  const misDescargas = descargas.filter(d => matchEmail(d.email) || d.lead_id === lead.id)
  const misConsent = consentimientos.filter(c => matchEmail(c.email) || c.lead_id === lead.id)

  const dirty = estado !== lead.estado_crm || (etapa || '') !== (lead.etapa_funnel ?? '') || (notas ?? '') !== (lead.notas_crm ?? '')

  function save() {
    setError(null)
    setSaved(false)
    start(async () => {
      const res = await updateLead(lead.id, { estado_crm: estado, etapa_funnel: etapa, notas_crm: notas })
      if (!res.success) {
        setError(res.error)
        return
      }
      setSaved(true)
      onUpdated({
        ...lead,
        estado_crm: estado,
        etapa_funnel: etapa || null,
        notas_crm: notas.trim() || null,
      })
    })
  }

  return (
    <Modal open onClose={onClose} title={lead.nombre || lead.email || 'Lead'} size="wide">
      <div className="grid gap-6 md:grid-cols-[1.1fr_1fr]">
        {/* Columna izquierda: datos del contacto */}
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={estadoBadgeVariant(lead.estado_crm)}>{estadoLabel(lead.estado_crm)}</Badge>
            {lead.es_usuario_app && <Badge variant="info">Usuario de la app</Badge>}
            {lead.contrato_servicio && <Badge variant="success">Contrató servicio</Badge>}
            {lead.tipo_contacto && <Badge variant="default">{lead.tipo_contacto}</Badge>}
          </div>

          <div className="space-y-2 text-sm">
            {lead.email && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Mail size={15} className="shrink-0 text-text-tertiary" />
                <a href={`mailto:${lead.email}`} className="text-brand-primary hover:underline break-all">{lead.email}</a>
              </div>
            )}
            {lead.telefono && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Phone size={15} className="shrink-0 text-text-tertiary" />
                <a href={`tel:${lead.telefono}`} className="text-brand-primary hover:underline">{lead.telefono}</a>
              </div>
            )}
            <div className="flex items-center gap-2 text-text-secondary">
              <CalendarDays size={15} className="shrink-0 text-text-tertiary" />
              <span>Ingresó el {fmtDate(lead.created_at)}</span>
            </div>
            {lead.fuente && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Globe size={15} className="shrink-0 text-text-tertiary" />
                <span>Fuente: {lead.fuente}{lead.primer_canal && lead.primer_canal !== lead.fuente ? ` · ${lead.primer_canal}` : ''}</span>
              </div>
            )}
            {lead.lead_magnet && (
              <div className="flex items-center gap-2 text-text-secondary">
                <Tag size={15} className="shrink-0 text-text-tertiary" />
                <span>Lead magnet: {lead.lead_magnet}</span>
              </div>
            )}
            {lead.pagina_origen && (
              <div className="flex items-center gap-2 text-text-secondary">
                <ExternalLink size={15} className="shrink-0 text-text-tertiary" />
                <a href={lead.pagina_origen} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline truncate">{lead.pagina_origen}</a>
              </div>
            )}
          </div>

          {lead.mensaje && (
            <div className="rounded-lg bg-surface-sunken p-3 text-sm text-text-secondary">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
                <MessageSquare size={13} /> Mensaje
              </div>
              {lead.mensaje}
            </div>
          )}

          {lead.servicios_interes && lead.servicios_interes.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-text-tertiary">Servicios de interés</p>
              <div className="flex flex-wrap gap-1.5">
                {lead.servicios_interes.map(s => <Badge key={s} variant="default">{s}</Badge>)}
              </div>
            </div>
          )}

          {/* Consentimientos */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
              <ShieldCheck size={13} /> Consentimientos
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant={lead.acepta_privacidad ? 'success' : 'default'}>
                Privacidad {lead.acepta_privacidad ? '✓' : '—'}
              </Badge>
              <Badge variant={lead.acepta_email_marketing ? 'success' : 'default'}>
                Email marketing {lead.acepta_email_marketing ? '✓' : '—'}
              </Badge>
              <Badge variant={lead.acepta_cookies ? 'success' : 'default'}>
                Cookies {lead.acepta_cookies ? '✓' : '—'}
              </Badge>
            </div>
            {misConsent.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs text-text-tertiary">
                {misConsent.map(c => (
                  <li key={c.id}>
                    {c.tipo} · {c.otorgado ? 'otorgado' : 'revocado'} · {fmtDate(c.created_at)}{c.texto_version ? ` · ${c.texto_version}` : ''}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Descargas */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-text-tertiary">
              <Download size={13} /> Descargas ({misDescargas.length})
            </p>
            {misDescargas.length === 0 ? (
              <p className="text-xs text-text-tertiary">Todavía no descargó ningún material.</p>
            ) : (
              <ul className="space-y-1 text-sm text-text-secondary">
                {misDescargas.map(d => (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">{d.lead_magnet_key}</span>
                    <span className="shrink-0 text-xs text-text-tertiary">{fmtDate(d.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Columna derecha: gestión del pipeline */}
        <div className="space-y-4 md:border-l md:border-border-subtle md:pl-6">
          <p className="text-sm font-semibold text-text-primary">Gestión</p>

          <Select
            label="Estado"
            options={ESTADOS_CRM.map(e => ({ value: e.value, label: e.label }))}
            value={estado}
            onChange={e => setEstado(e.target.value as EstadoCrm)}
          />

          <Select
            label="Etapa del funnel"
            options={[{ value: '', label: 'Sin definir' }, ...ETAPAS_FUNNEL.map(e => ({ value: e.value, label: e.label }))]}
            value={etapa}
            onChange={e => setEtapa(e.target.value)}
          />

          <Textarea
            label="Notas"
            placeholder="Notas internas sobre el contacto, próximos pasos, etc."
            rows={6}
            value={notas}
            onChange={e => setNotas(e.target.value)}
          />

          {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
          {saved && !dirty && <p className="text-xs text-[var(--success)]">Guardado ✓</p>}

          <div className="flex items-center justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={onClose}>Cerrar</Button>
            <Button variant="primary" onClick={save} disabled={pending || !dirty}>
              {pending ? <><Loader2 size={15} className="animate-spin" /> Guardando…</> : 'Guardar cambios'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
