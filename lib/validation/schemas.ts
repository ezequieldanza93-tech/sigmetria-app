import { z } from 'zod'

export const uuid = z.uuid()
export const email = z.email()
export const url = z.url().nullable().optional()

export const tipoEstablecimiento = z.enum([
  'industria', 'agro', 'construccion', 'comercio', 'administrativo',
  'logistica', 'centro_salud', 'otro', 'obra_construccion', 'local_comercial',
  'local_administrativo',
])

export const userRole = z.enum([
  'full_access_main', 'branch_admin', 'collaborator', 'viewer_global', 'viewer_limited',
])

export const siniestroTipo = z.enum(['accidente', 'incidente', 'enfermedad', 'cuasi'])

export const siniestroEstado = z.enum([
  'pendiente', 'investigacion', 'cerrado', 'archivado',
])

export const inspeccionEstado = z.enum(['pendiente', 'aprobada', 'observada', 'rechazada'])

export const riesgoNivel = z.enum(['bajo', 'medio', 'alto', 'critico'])

export const documentoTipo = z.enum(['reglamento', 'procedimiento', 'matriz', 'certificado', 'otro'])

// ──────────────────────────────────────
// Action-specific schemas
// ──────────────────────────────────────

export const establecimientoCreateSchema = z.object({
  nombre: z.string().min(1, { error: 'El nombre es obligatorio' }).max(200),
  tipo: tipoEstablecimiento,
  direccion: z.string().nullable().optional(),
  localidad_id: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: email.nullable().optional(),
  responsable: z.string().nullable().optional(),
  photo_site: z.string().nullable().optional(),
  ubicacion: z.string().nullable().optional(),
  rubro_ids: z.array(z.string()).nullable().optional(),
  horarios_json: z.string().nullable().optional(),
  respuestas_json: z.string().nullable().optional(),
})

export const gestionPlanificarSchema = z.object({
  gestion_establecimiento_id: z.string().min(1),
  fecha_planificada: z.string().min(1),
  notas: z.string().nullable().optional(),
})

export const gestionPlanificarMultiSchema = z.object({
  gestion_establecimiento_id: z.string().min(1),
  cantidad: z.coerce.number().int().min(2).max(12),
  intervalo_dias: z.coerce.number().int().min(1).max(365),
})

export const usuarioInviteSchema = z.object({
  email: z.email(),
  full_name: z.string().min(1).max(200),
  role: userRole,
})

export const consultoraCreateSchema = z.object({
  nombre: z.string().min(1, { error: 'El nombre es obligatorio' }).max(200),
  ruc: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: email.nullable().optional(),
  website: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
})

export const consultoraUpdateSchema = z.object({
  nombre: z.string().min(1, { error: 'El nombre es obligatorio' }).max(200),
  telefono: z.string().nullable().optional(),
  email: z.email().nullable().optional(),
  website: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
  social_links: z.record(z.string(), z.string()).nullable().optional(),
})

export const siniestroCreateSchema = z.object({
  establecimiento_id: z.string().min(1),
  tipo: siniestroTipo,
  titulo: z.string().min(1).max(300),
  fecha_ocurrencia: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  gravedad: z.string().nullable().optional(),
  lesionados: z.coerce.number().int().min(0).nullable().optional(),
  dias_perdidos: z.coerce.number().int().min(0).nullable().optional(),
  investigacion: z.string().nullable().optional(),
  estado: siniestroEstado.optional(),
})

export const personaDirectorioCreateSchema = z.object({
  establecimiento_id: z.string().min(1),
  tipo_id: z.string().nullable().optional(),
  nombre: z.string().min(1).max(100),
  apellido: z.string().min(1).max(100),
  email: email.nullable().optional(),
  telefono: z.string().nullable().optional(),
  dni: z.string().nullable().optional(),
  fecha_ingreso: z.string().nullable().optional(),
  fecha_nacimiento: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
})

export const feedbackCreateSchema = z.object({
  establecimiento_id: z.string().min(1),
  tipo: z.enum(['positivo', 'negativo', 'mejora', 'sugerencia']),
  descripcion: z.string().min(1).max(2000),
  fecha: z.string().min(1),
})

export const denunciaCreateSchema = z.object({
  establecimiento_id: z.string().min(1),
  tipo: z.string().min(1),
  descripcion: z.string().min(1).max(5000),
  fecha: z.string().min(1),
  responsable: z.string().nullable().optional(),
  estado: z.string().nullable().optional(),
})

export const addEppSchema = z.object({
  puesto_id: z.string().min(1),
  epp_id: z.string().min(1),
  cantidad: z.coerce.number().int().positive(),
  observacion: z.string().nullable().optional(),
})

export const calibracionCreateSchema = z.object({
  instrumento_id: z.string().min(1),
  fecha_calibracion: z.string().min(1),
  fecha_vencimiento: z.string().nullable().optional(),
  certificado_url: z.string().nullable().optional(),
  resultado: z.string().nullable().optional(),
  laboratorio: z.string().nullable().optional(),
})
