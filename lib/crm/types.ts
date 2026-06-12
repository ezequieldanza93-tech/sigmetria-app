/** Tipos y constantes del módulo CRM. Espejan el esquema consolidado en Supabase. */

export type EstadoCrm = 'nuevo' | 'contactado' | 'en_conversacion' | 'cliente' | 'descartado'
export type EtapaFunnel = 'tofu' | 'mofu' | 'bofu'

export interface Lead {
  id: string
  consultora_id: string | null
  nombre: string | null
  email: string | null
  telefono: string | null
  mensaje: string | null
  servicios_interes: string[] | null
  fuente: string | null
  primer_canal: string | null
  canales_visitados: string[] | null
  pagina_origen: string | null
  etapa_funnel: string | null
  lead_magnet: string | null
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  utm_content: string | null
  tipo_contacto: string | null
  es_usuario_app: boolean
  app_user_id: string | null
  contrato_servicio: boolean
  servicio_contratado: string | null
  acepta_privacidad: boolean
  acepta_email_marketing: boolean
  acepta_cookies: boolean
  acepta_condiciones_at: string | null
  ultima_actividad_at: string | null
  notas_crm: string | null
  estado_crm: EstadoCrm
  created_at: string
}

export interface LeadMagnet {
  id: string
  key: string
  titulo: string
  tipo: string
  descripcion: string | null
  persona: string | null
  funnel: string | null
  activo: boolean
  created_at: string
}

export interface LeadMagnetDescarga {
  id: string
  lead_id: string | null
  email: string | null
  lead_magnet_key: string
  origen_pagina: string | null
  origen_slug: string | null
  canal: string | null
  etapa_funnel: string | null
  created_at: string
}

export interface Consentimiento {
  id: string
  lead_id: string | null
  email: string | null
  tipo: 'privacidad' | 'cookies' | 'email_marketing' | string
  otorgado: boolean
  texto_version: string | null
  pagina: string | null
  created_at: string
}

export const ESTADOS_CRM: { value: EstadoCrm; label: string }[] = [
  { value: 'nuevo', label: 'Nuevo' },
  { value: 'contactado', label: 'Contactado' },
  { value: 'en_conversacion', label: 'En conversación' },
  { value: 'cliente', label: 'Cliente' },
  { value: 'descartado', label: 'Descartado' },
]

export const ETAPAS_FUNNEL: { value: EtapaFunnel; label: string }[] = [
  { value: 'tofu', label: 'TOFU · descubrimiento' },
  { value: 'mofu', label: 'MOFU · consideración' },
  { value: 'bofu', label: 'BOFU · decisión' },
]

export function estadoLabel(estado: string): string {
  return ESTADOS_CRM.find(e => e.value === estado)?.label ?? estado
}

export function estadoBadgeVariant(estado: string): 'default' | 'success' | 'warning' | 'danger' | 'info' {
  switch (estado) {
    case 'cliente': return 'success'
    case 'contactado': return 'warning'
    case 'en_conversacion': return 'info'
    case 'descartado': return 'danger'
    default: return 'default'
  }
}
