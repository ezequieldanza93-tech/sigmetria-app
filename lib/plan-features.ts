export const FEATURE_CATALOG: { key: string; label: string; category: string }[] = [
  { key: 'export_pdf', label: 'Exportar a PDF', category: 'Exportación' },
  { key: 'export_excel', label: 'Exportar a Excel', category: 'Exportación' },
  { key: 'notificaciones', label: 'Notificaciones automáticas', category: 'Comunicaciones' },
  { key: 'firmas_digitales', label: 'Firmas digitales', category: 'Documentación' },
  { key: 'mapas_riesgo', label: 'Mapas de riesgo', category: 'Gestión de Riesgos' },
  { key: 'iperc', label: 'IPERC', category: 'Gestión de Riesgos' },
  { key: 'subcontratistas', label: 'Subcontratistas', category: 'Gestión Operativa' },
  { key: 'denuncias_incidentes', label: 'Denuncias e incidentes', category: 'Gestión Operativa' },
  { key: 'workflow_aprobaciones', label: 'Workflow de aprobaciones', category: 'Gestión Operativa' },
  { key: 'capacitaciones', label: 'Capacitaciones', category: 'Gestión Operativa' },
  { key: 'api_webhooks', label: 'API y Webhooks', category: 'Integraciones' },
  { key: 'multi_idioma', label: 'Multi-idioma', category: 'Integraciones' },
  { key: 'modo_offline', label: 'Modo offline', category: 'Integraciones' },
  { key: 'sso', label: 'SSO (Inicio de sesión único)', category: 'Seguridad' },
  { key: 'auditoria_seguridad', label: 'Auditoría de seguridad', category: 'Seguridad' },
]

export function getFeaturesByCategory(): Map<string, typeof FEATURE_CATALOG> {
  const map = new Map<string, typeof FEATURE_CATALOG>()
  for (const f of FEATURE_CATALOG) {
    const existing = map.get(f.category) ?? []
    existing.push(f)
    map.set(f.category, existing)
  }
  return map
}

export function getFeatureLabel(key: string): string {
  return FEATURE_CATALOG.find(f => f.key === key)?.label ?? key
}
