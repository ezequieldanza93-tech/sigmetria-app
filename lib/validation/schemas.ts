import { z } from 'zod'

export const uuid = z.string().uuid()
export const email = z.string().email().nullable().optional()
export const url = z.string().url().nullable().optional()

export const tipoEstablecimiento = z.enum([
  'industria', 'agro', 'construccion', 'comercio', 'administrativo',
  'logistica', 'centro_salud', 'otro', 'obra_construccion', 'local_comercial',
  'local_administrativo',
])

export const userRole = z.enum([
  'full_access_main', 'full_access_branch', 'colaborador', 'full_viewer',
  'colaborador_viewer', 'visualizador_comentarista',
])

export const siniestroTipo = z.enum(['accidente', 'incidente', 'casi_accidente', 'enfermedad_profesional'])

export const siniestroEstado = z.enum(['pendiente', 'en_investigacion', 'cerrado'])

export const inspeccionEstado = z.enum(['programada', 'realizada', 'con_observaciones', 'cancelada'])

export const riesgoNivel = z.enum(['bajo', 'medio', 'alto', 'critico'])

export const documentoTipo = z.enum(['habilitacion', 'seguro', 'certificado', 'procedimiento', 'instructivo', 'otro'])

export const establecimientoCreateSchema = z.object({
  nombre: z.string().min(1, { error: 'El nombre es obligatorio' }).max(200),
  tipo: tipoEstablecimiento,
  direccion: z.string().nullable().optional(),
  localidad_id: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: email,
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
  email: z.string().email({ error: 'Email inválido' }),
  full_name: z.string().min(1, { error: 'El nombre es obligatorio' }),
  role: userRole,
})

export const consultoraCreateSchema = z.object({
  nombre: z.string().min(1, { error: 'El nombre es obligatorio' }).max(200),
  ruc: z.string().nullable().optional(),
  direccion: z.string().nullable().optional(),
  telefono: z.string().nullable().optional(),
  email: email,
  website: z.string().nullable().optional(),
  logo_url: z.string().nullable().optional(),
})

export const consultoraUpdateSchema = z.object({
  nombre: z.string().min(1, { error: 'El nombre es obligatorio' }).max(200),
  telefono: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
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
  email: email,
  telefono: z.string().nullable().optional(),
  dni: z.string().nullable().optional(),
  fecha_ingreso: z.string().nullable().optional(),
  fecha_nacimiento: z.string().nullable().optional(),
  observaciones: z.string().nullable().optional(),
})

export const feedbackCreateSchema = z.object({
  establecimiento_id: z.string().min(1),
  tipo: z.enum(['positivo', 'negativo', 'sugerencia']),
  descripcion: z.string().min(1).max(2000),
  fecha: z.string().min(1),
})

export const incidenteTipo = z.enum([
  'electrico', 'mecanico', 'estructural', 'quimico',
  'ergonomico', 'ambiental', 'incendio', 'caida',
  'herramienta', 'vehiculo', 'otro',
])

export const denunciaTipo = z.enum([
  'laboral', 'acoso', 'condiciones_inseguras',
  'incumplimiento_normativo', 'conducta', 'otro',
])

export const severidad = z.enum(['baja', 'media', 'alta', 'critica'])

export const seguimientoEstado = z.enum([
  'recibida', 'en_analisis', 'accion_planificada', 'implementada', 'cerrada',
])

export const incidenteCreateSchema = z.object({
  empresa_id: z.string().min(1, { error: 'La empresa es obligatoria' }),
  establecimiento_id: z.string().nullable().optional(),
  titulo: z.string().min(1, { error: 'El título es obligatorio' }).max(300),
  tipo_incidente: incidenteTipo,
  severidad,
  fecha_incidente: z.string().min(1, { error: 'La fecha es obligatoria' }),
  hora_incidente: z.string().nullable().optional(),
  lugar_especifico: z.string().nullable().optional(),
  descripcion: z.string().min(1, { error: 'La descripción es obligatoria' }),
  involucrados: z.string().nullable().optional(),
  testigos: z.string().nullable().optional(),
})

export const denunciaCreateSchema = z.object({
  empresa_id: z.string().min(1, { error: 'La empresa es obligatoria' }),
  establecimiento_id: z.string().nullable().optional(),
  titulo: z.string().min(1, { error: 'El título es obligatorio' }).max(300),
  tipo_denuncia: denunciaTipo,
  denunciante_tipo: z.enum(['interno', 'externo', 'anonimo']),
  denunciante_nombre: z.string().nullable().optional(),
  denunciante_dni: z.string().nullable().optional(),
  denunciante_contacto: z.string().nullable().optional(),
  fecha_denuncia: z.string().min(1, { error: 'La fecha es obligatoria' }),
  descripcion: z.string().min(1, { error: 'La descripción es obligatoria' }),
  involucrados: z.string().nullable().optional(),
  confidencial: z.literal('true').optional(),
})

export const estadoUpdateSchema = z.object({
  acciones_tomadas: z.string().nullable().optional(),
  conclusion: z.string().nullable().optional(),
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
