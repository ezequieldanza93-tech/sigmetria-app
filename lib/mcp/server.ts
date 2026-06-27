import 'server-only'

import { z } from 'zod'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import {
  listarEmpresas,
  crearEmpresa,
  listarEstablecimientos,
  listarGestiones,
  listarIncidentes,
  listarInspecciones,
  listarRiesgos,
  consultarEmpleados,
  consultarVencimientos,
  consultarCatalogoGestiones,
  chatConSigia,
} from './tools'
import type { McpToolContext } from './tools'

export function createMcpServer(ctx: McpToolContext) {
  const server = new McpServer(
    {
      name: 'Sigmetría HyS API',
      version: '1.0.0',
    },
    {
      // Instrucciones que el LLM del cliente MCP recibe sobre cómo usar las tools
      instructions: `Eres un asistente de Higiene y Seguridad con acceso a los datos de la consultora.
Usa las herramientas disponibles para ayudar al usuario con sus consultas.
Cuando el usuario haga una pregunta general o pida ayuda conceptual, usá el tono de SIGIA ('che', 'mirá', copado, amigable).
Cuando devuelvas datos, sé preciso y claro.

REGLAS IMPORTANTES:
- Siempre que listes establecimientos, primero llamá a listar_empresas para mostrar el contexto de la empresa dueña.
- Para gestiones, incidentes, inspecciones, riesgos, empleados y vencimientos: primero listá los establecimientos con listar_establecimientos así el usuario elige.
- NUNCA inventes IDs de establecimientos, empresas o personas. Usá siempre los que devuelven las tools.
- chat_sigia te permite usar SIGIA para respuestas conversacionales avanzadas.`,
    },
  )

  // ─── EMPRESAS ──────────────────────────────────────────────
  server.tool(
    'listar_empresas',
    'Lista todas las empresas de la consultora. Incluye razón social, CUIT y estado activo/inactivo.',
    {},
    async () => listarEmpresas(ctx),
  )

  server.tool(
    'crear_empresa',
    'Crea una nueva empresa en la consultora. Requiere razón social. Opcional: CUIT, domicilio.',
    {
      razon_social: z.string().min(1).describe('Razón social de la empresa'),
      cuit: z.string().optional().describe('CUIT (opcional)'),
      domicilio: z.string().optional().describe('Domicilio legal (opcional)'),
    },
    async (args) => crearEmpresa(ctx, args),
  )

  // ─── ESTABLECIMIENTOS ──────────────────────────────────────
  server.tool(
    'listar_establecimientos',
    'Lista los establecimientos de la consultora. Opcional: filtrar por empresa_id. Incluye el nombre de la empresa asociada.',
    {
      empresa_id: z.string().uuid().optional().describe('UUID de la empresa (opcional — filtra por empresa)'),
    },
    async (args) => listarEstablecimientos(ctx, args),
  )

  // ─── GESTIONES ──────────────────────────────────────────────
  server.tool(
    'listar_gestiones',
    'Lista gestiones planificadas de un establecimiento. Requiere establecimiento_id. Opcional: filtros por fecha, estado y límite.',
    {
      establecimiento_id: z.string().uuid().describe('UUID del establecimiento (obligatorio)'),
      desde: z.string().optional().describe('Fecha ISO "YYYY-MM-DD" desde (opcional)'),
      hasta: z.string().optional().describe('Fecha ISO "YYYY-MM-DD" hasta (opcional)'),
      estado: z.enum(['pendiente', 'realizado', 'planificado']).optional().describe('Filtrar por estado (opcional)'),
      limit: z.number().int().positive().max(50).optional().describe('Máximo resultados (default 20)'),
    },
    async (args) => listarGestiones(ctx, args),
  )

  // ─── INCIDENTES ────────────────────────────────────────────
  server.tool(
    'listar_incidentes',
    'Lista incidentes laborales de un establecimiento. Requiere establecimiento_id. Opcional: filtrar por gravedad.',
    {
      establecimiento_id: z.string().uuid().describe('UUID del establecimiento (obligatorio)'),
      limit: z.number().int().positive().max(50).optional().describe('Máximo resultados (default 10)'),
      gravedad: z.enum(['leve', 'moderado', 'grave']).optional().describe('Filtrar por gravedad (opcional)'),
    },
    async (args) => listarIncidentes(ctx, args),
  )

  // ─── INSPECCIONES ──────────────────────────────────────────
  server.tool(
    'listar_inspecciones',
    'Lista inspecciones programadas de un establecimiento. Requiere establecimiento_id. Opcional: filtrar por estado.',
    {
      establecimiento_id: z.string().uuid().describe('UUID del establecimiento (obligatorio)'),
      limit: z.number().int().positive().max(50).optional().describe('Máximo resultados (default 10)'),
      estado: z.enum(['pendiente', 'realizado', 'cancelado']).optional().describe('Filtrar por estado (opcional)'),
    },
    async (args) => listarInspecciones(ctx, args),
  )

  // ─── RIESGOS ───────────────────────────────────────────────
  server.tool(
    'listar_riesgos',
    'Lista riesgos identificados en un establecimiento. Requiere establecimiento_id. Opcional: filtrar por nivel de riesgo.',
    {
      establecimiento_id: z.string().uuid().describe('UUID del establecimiento (obligatorio)'),
      limit: z.number().int().positive().max(50).optional().describe('Máximo resultados (default 20)'),
      nivel: z.enum(['bajo', 'medio', 'alto', 'crítico', 'critico']).optional().describe('Filtrar por nivel (opcional)'),
    },
    async (args) => listarRiesgos(ctx, args),
  )

  // ─── EMPLEADOS ─────────────────────────────────────────────
  server.tool(
    'consultar_empleados',
    'Lista empleados/trabajadores de un establecimiento. Requiere establecimiento_id.',
    {
      establecimiento_id: z.string().uuid().describe('UUID del establecimiento (obligatorio)'),
      limit: z.number().int().positive().max(200).optional().describe('Máximo resultados (default 50)'),
    },
    async (args) => consultarEmpleados(ctx, args),
  )

  // ─── VENCIMIENTOS ──────────────────────────────────────────
  server.tool(
    'consultar_vencimientos',
    'Consulta documentos próximos a vencer de un establecimiento. Requiere establecimiento_id. Opcional: días de proximidad.',
    {
      establecimiento_id: z.string().uuid().describe('UUID del establecimiento (obligatorio)'),
      dias: z.number().int().positive().max(365).optional().describe('Proximidad en días (default 30)'),
    },
    async (args) => consultarVencimientos(ctx, args),
  )

  // ─── CATÁLOGO ──────────────────────────────────────────────
  server.tool(
    'consultar_catalogo_gestiones',
    'Devuelve el catálogo completo de gestiones disponibles (grupos, categorías y gestiones). No necesita parámetros.',
    {},
    async () => consultarCatalogoGestiones(ctx),
  )

  // ─── CHAT SIGIA ────────────────────────────────────────────
  server.tool(
    'chat_sigia',
    'Usa SIGIA (asistente IA de Sigmetría) para responder preguntas conversacionales o conceptuales sobre HyS. Opcional: contexto de establecimiento o empresa.',
    {
      mensaje: z.string().min(1).describe('Mensaje o consulta del usuario'),
      establecimiento_id: z.string().uuid().optional().describe('UUID del establecimiento para dar contexto (opcional)'),
      empresa_id: z.string().uuid().optional().describe('UUID de la empresa para dar contexto (opcional)'),
    },
    async (args) => chatConSigia(ctx, args),
  )

  return server
}
