# Módulo de Incidentes + Denuncias con Seguimiento

## Objetivo
Dos módulos nuevos separados: **Incidentes** (casi-accidentes sin lesión) y **Denuncias** (reclamos formales). Cada uno con listado, formulario de alta, detalle con fotos y flujo de estados. Secciones separadas en el menú principal.

## Stack
- Next.js 15 App Router + Server Actions
- Supabase PostgreSQL 17
- Supabase Storage (para fotos)
- TanStack React Query 5
- Tailwind CSS + shadcn/ui primitives

## Decisiones tomadas

| Decisión | Opción |
|----------|--------|
| Tipo de formulario | Separados: uno para Incidentes, otro para Denuncias |
| Relación | Vinculados a empresa + establecimiento |
| Creadores | Roles específicos (full_access_main, full_access_branch) |
| Flujo de estados | Recibida → En análisis → Acción planificada → Implementada → Cerrada |
| Transición estados | Cualquier usuario con acceso al establecimiento |
| Fotos | Carga de archivos + cámara (Supabase Storage) |
| Denuncias anónimas | Sí, opción para ocultar datos del denunciante |
| Menú | Dos entradas separadas: /dashboard/incidentes y /dashboard/denuncias |

## Requerimientos funcionales

### 1. Base de datos — Migraciones

#### 1a. Tabla `incidentes`
```sql
CREATE TABLE incidentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  establecimiento_id UUID REFERENCES establecimientos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  tipo_incidente TEXT NOT NULL CHECK (tipo_incidente IN (
    'electrico', 'mecanico', 'estructural', 'quimico',
    'ergonomico', 'ambiental', 'incendio', 'caida',
    'herramienta', 'vehiculo', 'otro'
  )),
  severidad TEXT NOT NULL CHECK (severidad IN ('baja', 'media', 'alta', 'critica')),
  lugar_especifico TEXT,
  fecha_incidente DATE NOT NULL DEFAULT CURRENT_DATE,
  hora_incidente TIME,
  involucrados TEXT,
  testigos TEXT,
  estado TEXT NOT NULL DEFAULT 'recibida' CHECK (estado IN (
    'recibida', 'en_analisis', 'accion_planificada', 'implementada', 'cerrada'
  )),
  responsable_asignado_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  acciones_tomadas TEXT,
  conclusion TEXT,
  cerrado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  fecha_cierre TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_incidentes_consultora ON incidentes(consultora_id);
CREATE INDEX idx_incidentes_empresa ON incidentes(empresa_id);
CREATE INDEX idx_incidentes_estado ON incidentes(estado);
```

#### 1b. Tabla `denuncias`
```sql
CREATE TABLE denuncias (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  consultora_id UUID NOT NULL REFERENCES consultoras(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
  establecimiento_id UUID REFERENCES establecimientos(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  tipo_denuncia TEXT NOT NULL CHECK (tipo_denuncia IN (
    'laboral', 'acoso', 'condiciones_inseguras',
    'incumplimiento_normativo', 'conducta', 'otro'
  )),
  denunciante_tipo TEXT NOT NULL CHECK (denunciante_tipo IN ('interno', 'externo', 'anonimo')),
  denunciante_nombre TEXT,
  denunciante_dni TEXT,
  denunciante_contacto TEXT,
  fecha_denuncia DATE NOT NULL DEFAULT CURRENT_DATE,
  involucrados TEXT,
  estado TEXT NOT NULL DEFAULT 'recibida' CHECK (estado IN (
    'recibida', 'en_analisis', 'accion_planificada', 'implementada', 'cerrada'
  )),
  responsable_asignado_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  acciones_tomadas TEXT,
  conclusion TEXT,
  confidencial BOOLEAN NOT NULL DEFAULT false,
  cerrado_por UUID REFERENCES profiles(id) ON DELETE SET NULL,
  fecha_cierre TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_denuncias_consultora ON denuncias(consultora_id);
CREATE INDEX idx_denuncias_empresa ON denuncias(empresa_id);
CREATE INDEX idx_denuncias_estado ON denuncias(estado);
```

#### 1c. Tabla `incidentes_fotos` y `denuncias_fotos`
```sql
CREATE TABLE incidentes_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incidente_id UUID NOT NULL REFERENCES incidentes(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE denuncias_fotos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  denuncia_id UUID NOT NULL REFERENCES denuncias(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  filename TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

#### 1d. Bucket de Storage
Crear bucket `incidentes` y `denuncias` en Supabase Storage con políticas de acceso autenticado.

### 2. Rutas

- `/dashboard/incidentes` — Listado de incidentes
- `/dashboard/incidentes/nuevo` — Formulario de creación
- `/dashboard/incidentes/[id]` — Detalle + seguimiento de estados + fotos
- `/dashboard/denuncias` — Listado de denuncias
- `/dashboard/denuncias/nueva` — Formulario de creación
- `/dashboard/denuncias/[id]` — Detalle + seguimiento de estados + fotos

### 3. Server Actions

- `crear_incidente` — Crea incidente + sube fotos a Storage
- `actualizar_estado_incidente` — Cambia estado + registra quién + opcional acciones_tomadas
- `subir_foto_incidente` — Sube archivo a Storage y crea registro en incidentes_fotos
- `eliminar_foto_incidente` — Elimina foto de Storage y su registro
- `get_incidentes` — Query TanStack con filtros por empresa, estado, fechas
- `get_incidente` — Query TanStack con detalle + fotos
- Mismos actions para Denuncias (crear_denuncia, actualizar_estado_denuncia, etc.)

### 4. Frontend — Listados

Cada listado (incidentes/denuncias) debe tener:
- Tabla con columnas: Título, Tipo, Empresa, Establecimiento, Estado, Fecha, Responsable
- Filtros: por empresa, estado, tipo, rango de fechas
- Badge de color según estado:
  - Recibida → rojo
  - En análisis → amarillo
  - Acción planificada → azul
  - Implementada → naranja
  - Cerrada → verde
- Botón "Nuevo incidente" / "Nueva denuncia"
- Paginación

### 5. Frontend — Formulario de creación (Incidente)

- Selector de empresa (solo empresas del usuario)
- Selector de establecimiento (filtrado por empresa)
- Título (input)
- Tipo (select: eléctrico, mecánico, estructural, químico, ergonómico, ambiental, incendio, caída, herramienta, vehiculo, otro)
- Severidad (select: baja, media, alta, crítica)
- Fecha y hora del incidente (date picker + time picker)
- Lugar específico (texto)
- Descripción (textarea)
- Involucrados (textarea)
- Testigos (textarea)
- Fotos (file input con preview, múltiples archivos, soporte para cámara en mobile)
- Botón "Guardar"

### 6. Frontend — Formulario de creación (Denuncia)

- Selector de empresa
- Selector de establecimiento
- Tipo (select: laboral, acoso, condiciones inseguras, incumplimiento normativo, conducta, otro)
- Denunciante:
  - Tipo: Interno / Externo / Anónimo
  - Si no es anónimo: nombre, DNI, contacto
- Título (input)
- Descripción (textarea)
- Fecha de denuncia (date picker)
- Involucrados (textarea)
- Checkbox "Confidencial" (no mostrar detalles de la denuncia en listados)
- Fotos (file input con preview)
- Botón "Guardar"

### 7. Frontend — Detalle y seguimiento

Página de detalle con:
- Cabecera con título, tipo, estado (badge), empresa, establecimiento
- Timeline visual del flujo de estados con fecha y responsable de cada cambio
- Sección de fotos (galería / grid con preview)
- Detalles del incidente/denuncia
- Botón "Avanzar estado" (siguiente estado en el flujo) con campo opcional para acciones tomadas
- Campo de conclusión al cerrar
- Para denuncias confidenciales: ocultar datos del denunciante en la UI

### 8. RLS Policies

- `incidentes`, `denuncias`: el usuario puede ver solo los de empresas/establecimientos a los que tiene acceso (usar lógica existente de permisos)
- `incidentes_fotos`, `denuncias_fotos`: mismo criterio
- Creación: solo roles full_access_main, full_access_branch (verificar sistema de permisos actual)
- Storage: bucket con RLS para que solo usuarios autenticados con acceso puedan subir/ver fotos

### 9. UX

- Los formularios deben funcionar bien en dispositivos móviles (para carga en campo)
- Preview de fotos antes de subir
- Confirmación al cambiar de estado
- Notificaciones (integrar con el sistema de notificaciones si ya existe): al crear, al cambiar de estado, al asignar responsable
- Loaders y estados vacíos

## Archivos existentes relevantes
- `lib/actions/` — Server actions (seguir patrón)
- `lib/queries/` — React Query hooks
- `lib/types.ts` — Tipos
- `lib/constants.ts` — Constantes (agregar tipos de incidente/denuncia)
- `components/ui/` — Button, Card, Modal, Input, Select, Badge, Textarea
- `components/forms/` — Formularios existentes (ver patrón de empresa, inspección)
- `app/(dashboard)/dashboard/empresas/[id]/` — Ver patrón de detalle con tabs
- Módulo de inspecciones — referencia para flujo similar
- Ver sistema de permisos actual en `lib/types.ts` para determinar qué roles pueden crear

## Notas de implementación
- Las fotos deben subirse a Supabase Storage con path: `{bucket}/{entidad_id}/{filename}`
- Implementar compresión de imágenes antes de subir (opcional para MVP)
- La transición de estados debe validar que sea secuencial (no saltar de Recibida a Cerrada)
- El timeline de estados se puede implementar como tabla separada `incidentes_historial_estados` o como JSONB en la misma tabla — decidir según complejidad
- Para cámara en web mobile: usar input type="file" accept="image/*" capture="environment"
- Investigar el sistema de permisos actual para determinar exactamente qué roles pueden crear
