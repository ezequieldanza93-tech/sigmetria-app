# Módulo de Subcontratistas con Gestión de Documentación

## Objetivo
Módulo dedicado a subcontratistas con vista de detalle, edición, gestión documental completa (vencimientos, tipos documentales desde la library existente), integración con establecimientos donde trabajan, dashboard de estado, y notificaciones de documentos próximos a vencer.

## Stack
- Next.js 15 App Router + Server Actions
- Supabase PostgreSQL 17 + Storage (documentos)
- TanStack React Query 5
- Tailwind CSS + shadcn/ui

## Decisiones tomadas

| Decisión | Opción |
|----------|--------|
| Documentos para subcontratistas | Nueva tabla `subcontratistas_documentos` que referencia `documentos_tipos` (catálogo existente) |
| Storage | Bucket `subcontratistas` como AssetBucket, via `uploadAsset()` con path `{consultoraId}/subcontratista/{subId}/{tipo}.{ext}` |
| Tipos documentales | Reutilizar `documentos_tipos` existente, filtrando por los que apliquen (nuevo flag `aplica_subcontratista`) |
| Notificaciones | Reutilizar sistema de notificaciones existente + widget `documentos_vencer_7d/15d/30d` |
| La tabla `subcontratistas` ya existe | No recrear — extender con lo que falta |

## Estado actual del código (NO repetir)

### Tablas existentes (ya migradas, no recrear)

**`organizaciones_externas`** — tabla base para toda organización externa, con `scope` ('global'|'empresa'), `empresa_id`, más campos normalizados: `domicilio`, `localidad_id`, `codigo_postal`, `cuit`, `tipo_identidad_impositiva` (CUIT|CUIL|CDI).

**`subcontratistas`** — extensión 1:1 con `organizacion_id → organizaciones_externas(id) ON DELETE CASCADE`. Columnas:
- `rubro_id → subcontratistas_rubros(id)`
- `art_id → organizaciones_externas(id)` (ART)
- `art_numero_contrato`
- `tipo_establecimiento_id → tipos_establecimiento(id)` (con `codigo IN ('CONSTRUCCION',...)`)
- `actividad_principal`, `cantidad_trabajadores`, `informacion_general`
- Ya NO tiene: domicilio, localidad, codigo_postal, cuit, tipo_identidad_impositiva (normalizados a `organizaciones_externas`)

**`subcontratistas_rubros`** — 22 rubros precargados (Albañilería, Electricidad, Medicina Laboral, Seguridad e Higiene, etc.)

**`subcontratista_respuestas`** — respuestas a preguntas de riesgo (PK compuesta: subcontratista_id + pregunta_id). Cargadas en el formulario de creación según `tipo_establecimiento_id`.

**`tipo_organizaciones`** — catálogo con: 'Proveedor', 'Subcontratista', 'Agente Gubernamental', 'Marca'.

**`organizacion_establecimiento`** — junction organizaciones ↔ establecimientos (PK compuesta).

### Archivos existentes

| Archivo | Propósito |
|---------|-----------|
| `lib/actions/organizacion.ts` | Server actions: `createOrganizacion`, `createOrganizacionExterna`, `addOrganizacionToEstablecimiento`, `deleteOrganizacion` |
| `lib/queries/organizacion.ts` | Queries: `useOrganizacionTipos`, `useSubcontratistaRubros`, `useArtOrgs` |
| `components/forms/organizacion-externa-form.tsx` | Formulario completo de creación con lógica de tipo, rubro, preguntas de riesgo |
| `app/(dashboard)/dashboard/organizaciones-externas/page.tsx` | Listado simple de organizaciones (client component, fetch directo sin query library) |
| `app/(dashboard)/dashboard/organizaciones-externas/nueva/page.tsx` | Página de creación nueva organización |
| `lib/actions/documento.ts` | `createDocumento(empresaId, establecimientoId, prev, formData)` — para empresas/establecimientos |
| `lib/actions/trabajador-documento.ts` | `createTrabajadorDocumento(trabajadorId, establecimientoId, empresaId, prev, formData)` |
| `components/forms/documento-form.tsx` | Formulario de documento genérico (usa bucket `documentos` no gestionado) |
| `components/ui/file-upload-input.tsx` | Input de archivo reutilizable con preview y validación |
| `lib/storage/upload.ts` | Sistema unificado `uploadAsset()` con buckets: logos, consultora, firmas, matriculas, planos, certificados, incidentes, denuncias |
| `lib/types.ts` | Interfaces: `Subcontratista`, `SubcontratistaRubro`, `Organizacion`, `Documento`, `EmpresaDocumento`, etc. |
| `lib/schemas/index.ts` | Schemas Zod: `subcontratistaIdentidadSchema`, `createDocumentoFormSchema`, `addOrganizacionFormSchema` |
| `supabase/migrations/20260525000003_normalize_subcontratistas_3nf.sql` | Normalización 3NF — columnas de dirección/CUIT movidas a `organizaciones_externas` |
| `components/empresa-documentos-section.tsx` | Sección de documentos en ficha de empresa (referencia de UI) |
| `components/establecimiento/documentos-tab.tsx` | Tab de documentos en establecimiento (referencia de UI) |

### Lo que NO existe (hay que crearlo)
- **Ruta detail**: `/dashboard/organizaciones-externas/[id]/` con tabs
- **Ruta edit**: `/dashboard/organizaciones-externas/[id]/editar`
- **Documentos de subcontratista**: tabla, server actions, queries, UI
- **Dashboard/widget**: vista rápida de subcontratistas con documentos por vencer
- **Notificaciones**: integración con alertas de vencimiento para subcontratistas

## Arquitectura de la información

```
Consultora
└── Subcontratista (extiende organizaciones_externas)
    ├── Datos generales (razón social, CUIT, rubro, domicilio)
    ├── Contacto (email, teléfono)
    ├── ART (ART, número de contrato)
    ├── Actividad (tipo de establecimiento, actividad principal, cantidad trabajadores)
    ├── Preguntas de Riesgo (respuestas según tipo de establecimiento)
    ├── Establecimientos donde trabaja (N:N via organizacion_establecimiento)
    └── Documentos (N:1 via subcontratistas_documentos)
        ├── Tipo documental (de documentos_tipos)
        ├── Archivo en Storage
        ├── Fecha de emisión
        └── Fecha de vencimiento
```

## Base de datos — Migraciones

### Tabla `subcontratistas_documentos`

```sql
CREATE TABLE public.subcontratistas_documentos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subcontratista_id UUID NOT NULL REFERENCES public.subcontratistas(id) ON DELETE CASCADE,
  tipo_id         UUID NOT NULL REFERENCES public.documentos_tipos(id),
  archivo_url     TEXT,
  fecha_emision   DATE,
  fecha_vencimiento DATE,
  observaciones   TEXT,
  subido_por      UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sub_doc_subcontratista ON public.subcontratistas_documentos(subcontratista_id);
CREATE INDEX idx_sub_doc_vencimiento ON public.subcontratistas_documentos(fecha_vencimiento)
  WHERE fecha_vencimiento IS NOT NULL;
```

### Agregar `aplica_subcontratista` a `documentos_tipos`

```sql
ALTER TABLE public.documentos_tipos
  ADD COLUMN aplica_subcontratista BOOLEAN NOT NULL DEFAULT false;

-- Tipos que aplican a subcontratistas (seed)
UPDATE public.documentos_tipos SET aplica_subcontratista = true WHERE nombre IN (
  'Seguro de Vida Obligatorio',
  'ART / Riesgos del Trabajo',
  'Habilitación / Certificado',
  'Seguro',
  'Certificado',
  'Contrato / Acuerdo',
  'Otro'
);
```

### Storage

- **Bucket**: `subcontratistas` (privado, similar a `certificados`)
- **Registrar en `BUCKETS` en `upload.ts`**:

```typescript
subcontratistas: {
  maxBytes: 10 * 1024 * 1024,
  mimes: ['application/pdf', 'image/jpeg', 'image/png'],
  public: false,
}
```

- **Registrar `EntityType`**:

```typescript
export type EntityType = ... | 'subcontratista'
```

- **Path**: `{consultoraId}/subcontratista/{subcontratistaId}/{tipo}.{ext}`
- **Bucket creation SQL**:

```sql
INSERT INTO storage.buckets (id, name, public, avif_autodetection)
VALUES ('subcontratistas', 'subcontratistas', false, false)
ON CONFLICT (id) DO NOTHING;

-- RLS políticas (solo authenticated users)
CREATE POLICY "subcontratistas: select" ON storage.objects
  FOR SELECT TO authenticated USING (bucket_id = 'subcontratistas' AND auth.role() = 'authenticated');
CREATE POLICY "subcontratistas: insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'subcontratistas' AND auth.role() = 'authenticated');
CREATE POLICY "subcontratistas: update" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'subcontratistas' AND auth.role() = 'authenticated');
CREATE POLICY "subcontratistas: delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'subcontratistas' AND auth.role() = 'authenticated');
```

### RLS para `subcontratistas_documentos`

```sql
ALTER TABLE public.subcontratistas_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "subcontratistas_documentos: select" ON public.subcontratistas_documentos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.subcontratistas s
      JOIN public.organizaciones_externas oe ON oe.id = s.organizacion_id
      WHERE s.id = subcontratistas_documentos.subcontratista_id
        AND (
          EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND system_role = 'developer')
          OR EXISTS (SELECT 1 FROM public.consultora_members cm WHERE cm.user_id = auth.uid() AND cm.is_active = true)
        )
    )
  );

-- Mismas condiciones para INSERT, UPDATE, DELETE (con CHECK de rol operativo en escritura)
```

## Tipos TypeScript (para `lib/types.ts`)

```typescript
export interface SubcontratistaDocumento {
  id: string
  subcontratista_id: string
  tipo_id: string
  archivo_url: string | null
  fecha_emision: string | null
  fecha_vencimiento: string | null
  observaciones: string | null
  subido_por: string
  created_at: string
  updated_at: string
  documentos_tipos?: { nombre: string } | null
}

// Extender Subcontratista para incluir relación
export interface SubcontratistaWithOrg extends Subcontratista {
  organizaciones_externas?: {
    nombre: string
    cuit: string | null
    domicilio: string | null
    email: string | null
    telefono: string | null
    tipo_identidad_impositiva: string | null
    localidades?: { nombre: string; provincia: string } | null
  } | null
  subcontratistas_documentos?: SubcontratistaDocumento[]
}
```

## Server Actions

### `lib/actions/subcontratista.ts`

```typescript
'use server'

// updateSubcontratista(id, prev, formData) — actualiza organizaciones_externas + subcontratistas
// deleteSubcontratista(id) — soft-delete o hard-delete (ya existe deleteOrganizacion)
// getSubcontratistaCompleto(id) — subcontratista + org + documentos + establecimientos

// createSubcontratistaDocumento(subcontratistaId, prev, formData)
//   - Usa uploadAsset() con bucket: 'subcontratistas', entityType: 'subcontratista', kind: based on tipo_id
//   - Guarda en subcontratistas_documentos

// deleteSubcontratistaDocumento(documentoId)
//   - Borra archivo de Storage via deleteAsset()
//   - Borra registro en subcontratistas_documentos
```

### Firma estándar (seguir patrón existente)

```typescript
export async function updateSubcontratista(
  id: string,
  _prev: ActionResult<null> | null,
  formData: FormData
): Promise<ActionResult<null>> {
  // 1. Auth + consultora_id (patrón standard con consultora_members)
  // 2. Update organizaciones_externas (nombre, cuit, email, telefono, domicilio, localidad_id)
  // 3. Update subcontratistas (rubro_id, art_id, tipo_establecimiento_id, etc.)
  // 4. Recalcular respuestas si cambió tipo_establecimiento
  // 5. revalidatePath(`/dashboard/organizaciones-externas/${id}`)
  // 6. return { success: true, data: null }
}
```

## React Query Hooks

### `lib/queries/subcontratista.ts`

```typescript
export function useSubcontratista(id: string | undefined) { ... }
export function useSubcontratistaDocumentos(subcontratistaId: string | undefined) { ... }
export function useSubcontratistaEstablecimientos(subcontratistaId: string | undefined) { ... }
export function useSubcontratistasList(filters?: { rubro_id?: string; activo?: boolean }) { ... }
export function useSubcontratistasConVencimientos(fechaDesde: string, fechaHasta: string) { ... }
```

## Frontend — Navegación

```
/dashboard/organizaciones-externas
  └── [id]/
      ├── layout.tsx              → Provider + tabs (Información, Documentos, Establecimientos)
      ├── page.tsx                → Tab Información (datos generales + ART + actividad + respuestas)
      ├── editar/
      │   └── page.tsx            → Formulario de edición (reutiliza lógica del form existente)
      └── documentos/
          └── page.tsx            → Lista de documentos + upload

/dashboard/dashboard
  └── Widget: "Subcontratistas con documentos por vencer" (próximos 30 días)
```

## Frontend — Tab Información

- Encabezado con nombre, rubro (badge), CUIT, estado (activo/inactivo)
- Grid de datos generales: tipo identidad, CUIT, domicilio, localidad, provincia
- Sección ART: nombre ART, nº contrato
- Sección Actividad: tipo de establecimiento, actividad principal, cantidad trabajadores
- Sección Respuestas de Riesgo (checkbox readonly con respuesta)
- Botón "Editar" → `/editar`

## Frontend — Tab Documentos

Basado en el patrón de `establecimiento/documentos-tab.tsx`:

- Tabla con: Tipo documental, Archivo (link descarga), Emisión, Vencimiento, Estado (vigente/vencido/próximo a vencer), Acciones
- Estado visual por color:
  - 🟢 Vigente (fecha_vencimiento > 30 días)
  - 🟡 Próximo a vencer (fecha_vencimiento entre hoy y 30 días)
  - 🔴 Vencido (fecha_vencimiento < hoy)
  - ⚪ Sin vencimiento
- Botón "+ Agregar Documento" → modal/formulario
  - Select: tipo documental (solo `aplica_subcontratista = true`)
  - FileUploadInput con upload a Storage
  - Fecha de emisión (opcional)
  - Fecha de vencimiento (opcional)
  - Observaciones (opcional)
- Columna acciones: descargar / eliminar

## Frontend — Tab Establecimientos

- Lista de establecimientos donde trabaja el subcontratista
- Tabla: nombre del establecimiento, empresa, sector(es)
- Botón "Vincular a establecimiento" → selector de establecimiento de la consultora
- Botón "Desvincular" con confirmación

## Frontend — Formulario de Edición

Reutiliza `organizacion-externa-form.tsx` o crea `organizacion-externa-edit-form.tsx` con:
- Mismos campos que creación, precargados con datos existentes
- Update action en vez de insert
- Las preguntas de riesgo se recargan si cambia tipo_establecimiento_id
- Al guardar, redirige a `/dashboard/organizaciones-externas/[id]`

## Frontend — Listado mejorado

Mejorar `organizaciones-externas/page.tsx` actual para que:
- Muestre un badge de "Subcontratista" con color distintivo
- Muestre rubro (para subcontratistas)
- Muestre si tiene documentos vencidos (ícono)
- Click en fila → `/organizaciones-externas/[id]`

## Notificaciones y Dashboard

- Widget en dashboard ejecutivo: "Subcontratistas con documentos por vencer" (cards compactas)
- Query: `subcontratistas_documentos` con `fecha_vencimiento BETWEEN NOW() AND NOW() + INTERVAL '30 days'`
- Cada card: nombre del subcontratista, tipo documental, días restantes
- Click → redirige al tab documentos de ese subcontratista

## Patrones a seguir

- **Server Actions**: Usar `ActionResult<T>` como return type, `FormData` como input, `bind()` para IDs fijos. Ver `lib/actions/documento.ts` como referencia.
- **Upload**: Usar `uploadAsset()` de `lib/storage/upload.ts`, NO el viejo DocumentoForm que sube directo al bucket `documentos`. Extender `AssetBucket` y `EntityType`.
- **Provider/Context**: Crear `SubcontratistaProvider` con datos básicos para los tabs (similar a `EmpresaProvider`/`EstablecimientoProvider`).
- **Layout con tabs**: Similar a `empresas/[id]/layout.tsx` con sidebar de tabs.
- **Document Type filtering**: Usar `documentos_tipos` con `aplica_subcontratista = true`.

## Archivos existentes relevantes
- `lib/actions/organizacion.ts` — Server actions a extender
- `lib/queries/organizacion.ts` — Queries existentes
- `components/forms/organizacion-externa-form.tsx` — Formulario creación a reutilizar para edición
- `components/establecimiento/documentos-tab.tsx` — Patrón de UI para documentos
- `components/empresa-documentos-section.tsx` — Patrón de UI alternativo
- `components/ui/file-upload-input.tsx` — Input de archivo reutilizable
- `lib/storage/upload.ts` — Sistema de upload a extender
- `lib/actions/documento.ts` — Patrón de server action para documentos
- `lib/types.ts` — Tipos a extender
- `lib/contexts/empresa-context.tsx` — Patrón de provider
- `lib/constants.ts` — Constantes (agregar si hace falta)
- `supabase/migrations/20260525000003_normalize_subcontratistas_3nf.sql` — Normalización ya aplicada
- `app/(dashboard)/dashboard/organizaciones-externas/page.tsx` — Listado a mejorar
