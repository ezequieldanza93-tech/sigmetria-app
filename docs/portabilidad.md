# Portabilidad y exportación de datos

> Insumo para la inscripción como **Prestador de Soluciones 4.0** (Res. SRT 48/2025).
> Describe **solo lo implementado en el código**. Lo no terminado está en la sección
> [Pendiente](#pendiente), separado.

La norma exige que los titulares puedan **recuperar y transferir sus datos** en
"formato estructurado, de uso común y de lectura mecánica", total o parcialmente,
con mecanismos claros, sencillos y de rápido acceso, sin impedimentos técnicos.

---

## Qué se exporta (alcance)

El export es **por empresa-cliente**. Incluye todas las entidades de la jerarquía de
esa empresa. Cada tabla se trae con `select('*')` (todos los campos, no un subconjunto).

Definición declarativa: [`lib/export/entities.ts`](../lib/export/entities.ts).

| Archivo en el paquete | Tabla | Cómo se asocia a la empresa |
|---|---|---|
| `empresa` | `empresas` | la propia empresa (1 fila) |
| `establecimientos` | `establecimientos` | `empresa_id` |
| `documentos_empresa` | `empresas_documentos` | `empresa_id` |
| `documentos_establecimientos` | `establecimientos_documentos` | por establecimiento |
| `personas_establecimientos` | `personas_establecimientos` | por establecimiento |
| `sectores` | `establecimientos_sectores` | por establecimiento |
| `horarios` | `establecimientos_horarios` | por establecimiento |
| `art` | `empresas_art` | `empresa_id` |
| `incidentes` | `incidentes` | `empresa_id` |
| `incidentes_fotos` | `incidentes_fotos` | hijos de `incidentes` |
| `denuncias` | `denuncias` | `empresa_id` |
| `denuncias_fotos` | `denuncias_fotos` | hijos de `denuncias` |
| `inspecciones` | `inspecciones` | por establecimiento |
| `inspecciones_adjuntos` | `inspecciones_adjuntos` | hijos de `inspecciones` |
| `riesgos` | `riesgos` | por establecimiento |
| `mediciones` | `mediciones` | por establecimiento |
| `capacitaciones` | `capacitaciones` | `empresa_id` |
| `capacitaciones_asistentes` | `capacitaciones_asistentes` | hijos de `capacitaciones` |
| `gestiones_establecimientos` | `gestiones_establecimientos` | por establecimiento |
| `gestiones_registros` | `gestiones_registros` | hijos de `gestiones_establecimientos` |
| `gestiones_observaciones` | `gestiones_observaciones` | hijos de `gestiones_registros` |

Si en un entorno una tabla no existe o el usuario no tiene acceso, esa entidad se
**omite** (best-effort) y queda registrada en `manifest.json` → `omitidas` y en el
audit log.

---

## Formatos del paquete

El paquete es un **ZIP** con la siguiente estructura:

```
sigmetria_export_<empresa>_<fecha>.zip
├── data/
│   ├── <entidad>.csv     ← BOM UTF-8 (compatible Excel), separador coma, RFC-4180
│   └── <entidad>.json    ← array de objetos (lectura mecánica)
├── archivos/
│   └── <bucket>/<path>   ← binarios ORIGINALES descargados de Storage
└── manifest.json
```

- **CSV y JSON** de cada tabla (lectura mecánica + uso común). El formato se elige al
  exportar: `csv`, `json` o ambos (default). Serialización: [`lib/export/serialize.ts`](../lib/export/serialize.ts).
- **Archivos binarios originales** (fotos de incidentes/denuncias, documentos, adjuntos
  de inspecciones, evidencias de gestiones) se **descargan de Storage** y se incluyen
  bajo `archivos/<bucket>/<path>` — no solo las URLs. Extracción de referencias:
  [`lib/export/storage-refs.ts`](../lib/export/storage-refs.ts).
- **`manifest.json`** describe: contenido (cada archivo con tipo, entidad, bytes, filas),
  **relaciones** entre archivos (claves foráneas a nivel tabla), **fecha de generación**,
  totales y un **checksum SHA-256 de cada archivo** del paquete (algoritmo declarado en el
  propio manifest). Construcción: [`lib/export/manifest.ts`](../lib/export/manifest.ts).

---

## Export parcial

Vía query params del endpoint (validados en [`lib/export/scoping.ts`](../lib/export/scoping.ts)):

| Param | Efecto |
|---|---|
| `?desde=2026-01-01&hasta=2026-12-31` | rango de fechas (inclusive); marca el export como **parcial** |
| `?entidades=inspecciones,riesgos` | solo esos tipos de entidad |
| `?formato=csv\|json\|both` | formato (default `both`) |
| `?archivos=0` | excluir los binarios |
| `?async=1` | forzar entrega por link (ver abajo) |

Ej.: solo recorridas/inspecciones de 2026 → `?entidades=inspecciones&desde=2026-01-01&hasta=2026-12-31`.

El rango de fechas se aplica sobre la columna de fecha de cada entidad (`created_at`,
`fecha`, `fecha_planificada`, según corresponda; ver `dateColumn` en `entities.ts`).

---

## Cómo se dispara

### UI — "Exportar mis datos"

Componente [`components/export/export-empresa-button.tsx`](../components/export/export-empresa-button.tsx),
visible en la ficha de empresa (`app/(dashboard)/dashboard/empresas/[id]`) **solo para
quien puede editar la empresa** (`puedeEditar`). Abre un panel simple para elegir:
alcance (completo / por rango de fechas), rango, formato (CSV+JSON / CSV / JSON) e incluir
archivos. Muestra feedback de progreso y descarga.

### Endpoint

`GET /api/export/empresa/{empresa_id}` —
[`app/api/export/empresa/[empresa_id]/route.ts`](../app/api/export/empresa/[empresa_id]/route.ts).

- **Síncrono** (default): arma el ZIP y lo devuelve como descarga directa.
- **Asíncrono** (paquete > 25 MB o `?async=1`): guarda el ZIP en el bucket privado
  `exports`, devuelve un **signed URL temporal** en JSON y **notifica por email** con el link.

---

## Seguridad del link (entrega async)

- El paquete se guarda en el **bucket privado `exports`** (no público).
- Path con prefijo de tenant: `{consultora_id}/{empresa_id}/{timestamp}_<filename>.zip`.
- **RLS por consultora** (migración [`20260704000001_exports_bucket.sql`](../supabase/migrations/20260704000001_exports_bucket.sql)):
  solo miembros activos de la consultora dueña del path pueden leer/escribir/borrar,
  usando el helper existente `storage_path_consultora_id(name)`.
- La descarga se hace con un **signed URL temporal (TTL 1 hora)**, firmado server-side
  ([`lib/export/store-and-sign.ts`](../lib/export/store-and-sign.ts)).
- El email con el link se envía con Resend ([`lib/email/export-listo.ts`](../lib/email/export-listo.ts)),
  best-effort (si falla, no rompe el export).

---

## Registro de auditoría

Cada export se registra con `logAuditEvent(..., { accion: 'EXPORT' })`
([`lib/audit/log-event.ts`](../lib/audit/log-event.ts)):

- `tabla: 'empresas'`, `registroId: <empresa_id>`, `consultoraId`.
- `meta`: alcance (completo/parcial), rango de fechas, entidades, formatos, si incluyó
  archivos, cantidad de filas y bytes, formato de entrega (descarga directa / signed URL),
  path en Storage (en async) y entidades omitidas.

Es **best-effort**: si el registro de auditoría falla, el export NO se bloquea.

---

## Aislamiento multi-tenant

El export de la empresa A **nunca** incluye filas de la empresa B. Se garantiza en
**dos capas** ([`lib/export/build-package.ts`](../lib/export/build-package.ts)):

1. **RLS de Supabase**: el paquete se arma con el cliente de **sesión del usuario**
   (no service role). Las policies (`has_empresa_read_access`, `has_establecimiento_read_access`)
   ya filtran por tenant. El acceso a la empresa se valida además con
   `has_empresa_read_access(empresa_id)` antes de empezar (403 si no).
2. **Filtro explícito** (defensa en profundidad): se calcula el set de
   `establecimiento_ids` de la empresa y cada tabla se filtra por `empresa_id` o por ese
   set; las tablas hijas se filtran por los ids de su padre ya scopeado. Lógica pura en
   [`lib/export/scoping.ts`](../lib/export/scoping.ts).

### Test de aislamiento

[`lib/export/__tests__/isolation.test.ts`](../lib/export/__tests__/isolation.test.ts) — con
un mock de Supabase en memoria (dos empresas A y B). Demuestra que:

- el paquete de A contiene solo empresa/establecimientos/incidentes/riesgos de A;
- **aunque el backend filtre mal** y devuelva filas de B, el filtro explícito las descarta;
- el manifest tiene un SHA-256 válido por cada archivo.

Correr (sin DB):

```bash
npx vitest run lib/export
```

> **Cómo validar el aislamiento contra la DB real (RLS):** con dos usuarios de consultoras
> distintas, llamar `GET /api/export/empresa/{empresa_de_otra_consultora}` debe devolver
> **403**. Requiere entorno con DB y sesiones reales (no se corre en esta máquina sin Docker).

---

## Pendiente

- **Worker async completo (cola/background)**: hoy la **generación** del ZIP es
  **síncrona** dentro del request; el guardado en bucket privado + signed URL + email YA
  funcionan. Falta mover la generación a un job en segundo plano (cola Upstash + cron)
  para paquetes muy grandes que excedan el tiempo de un request. El endpoint
  [`/api/cron/limpiar-exports`](../app/api/cron/limpiar-exports/route.ts) ya existe como
  patrón Vercel Cron y es el lugar natural para drenar esa cola.
- **Declarar el cron en `vercel.json`**: agregar
  `{ "crons": [{ "path": "/api/cron/limpiar-exports", "schedule": "0 * * * *" }] }`.
- **Migración `20260704000001_exports_bucket.sql` NO aplicada**: es aditiva y está
  versionada; debe pushearse (`npx supabase db push`) para que el bucket `exports` y su
  RLS existan en la base. Sin ella, el modo async cae a descarga directa (fallback).
- **Subcontratistas**: `subcontratistas` no tiene `empresa_id` (cuelga de
  `organizaciones_externas` a nivel consultora), por lo que **no** se incluye en el export
  por empresa para no mezclar tenants. Queda pendiente decidir el criterio de scoping.
- **URLs legacy absolutas**: archivos cuyo valor guardado es una URL pública absoluta
  (datos viejos pre-refactor de paths) **no** se descargan como binario (no hay path);
  quedan como URL dentro del CSV/JSON. Se resolverán al migrar esos valores a paths.
