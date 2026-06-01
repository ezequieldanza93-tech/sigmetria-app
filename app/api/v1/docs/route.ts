import { NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://app.sigmetria.com.ar'

export function GET() {
  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'Sigmetría HyS — API de Interoperabilidad',
      description: 'API REST para integración de datos de cumplimiento normativo según Art. 4.7 Res. SRT 48/2025.',
      version: '1',
      contact: { email: 'soporte@sigmetria.com.ar' },
    },
    servers: [{ url: `${BASE_URL}/api/v1`, description: 'Producción' }],
    security: [{ bearerAuth: [] }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'API key generada en Configuración → API Keys',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'NOT_FOUND' },
                message: { type: 'string', example: 'Empresa not found for this CUIT' },
              },
            },
          },
        },
        Empresa: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            razon_social: { type: 'string' },
            cuit: { type: 'string', nullable: true },
            rubro: { type: 'string', nullable: true },
            localidad: { type: 'string', nullable: true },
            provincia: { type: 'string', nullable: true },
          },
        },
        EstadoCumplimiento: {
          type: 'string',
          enum: ['verde', 'amarillo', 'rojo'],
          description: 'verde: sin alertas · amarillo: riesgos o incidentes menores · rojo: riesgos críticos, incidentes >30d o documentos vencidos',
        },
        EstablecimientoCumplimiento: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
            nombre: { type: 'string' },
            domicilio: { type: 'string', nullable: true },
            estado: { $ref: '#/components/schemas/EstadoCumplimiento' },
            riesgos_criticos: { type: 'integer' },
            riesgos_altos: { type: 'integer' },
            incidentes_abiertos: { type: 'integer' },
            siniestros_abiertos: { type: 'integer', deprecated: true, description: 'Alias deprecado de incidentes_abiertos' },
            documentos_vencidos: { type: 'integer' },
          },
        },
      },
    },
    paths: {
      '/empresas': {
        get: {
          summary: 'Listar empresas',
          description: 'Devuelve todas las empresas gestionadas por la consultora propietaria de la API key.',
          operationId: 'listEmpresas',
          responses: {
            '200': {
              description: 'Lista de empresas',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/Empresa' } },
                      total: { type: 'integer' },
                    },
                  },
                },
              },
            },
            '401': { description: 'API key inválida o ausente', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/empresas/{cuit}/cumplimiento': {
        get: {
          summary: 'Cumplimiento de empresa por CUIT',
          description: 'Devuelve el estado de cumplimiento de cada establecimiento de la empresa identificada por CUIT.',
          operationId: 'getEmpresaCumplimiento',
          parameters: [{ name: 'cuit', in: 'path', required: true, schema: { type: 'string' }, description: 'CUIT sin guiones (ej: 30719848531)' }],
          responses: {
            '200': {
              description: 'Cumplimiento por establecimiento',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      empresa: { $ref: '#/components/schemas/Empresa' },
                      establecimientos: { type: 'array', items: { $ref: '#/components/schemas/EstablecimientoCumplimiento' } },
                      generado_en: { type: 'string', format: 'date-time' },
                    },
                  },
                },
              },
            },
            '401': { description: 'API key inválida', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Empresa no encontrada', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
      '/establecimientos/{id}/legajo': {
        get: {
          summary: 'Legajo técnico de establecimiento',
          description: 'Devuelve el legajo completo: riesgos, inspecciones, documentos, capacitaciones e incidentes abiertos.',
          operationId: 'getEstablecimientoLegajo',
          parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' }, description: 'UUID del establecimiento' }],
          responses: {
            '200': { description: 'Legajo técnico completo' },
            '401': { description: 'API key inválida', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '403': { description: 'Acceso denegado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
            '404': { description: 'Establecimiento no encontrado', content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } } },
          },
        },
      },
    },
  }

  return NextResponse.json(spec)
}
