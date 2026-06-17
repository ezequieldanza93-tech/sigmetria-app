# Legajo técnico condicional — recap (trabajo nocturno 2026-06-17)

Resumen de lo que quedó **vivo en producción** y lo que **dejé flagged** para resolver juntos.

## ✅ Hecho y desplegado a prod (migraciones aplicadas + ledger reconciliado)

### 1. Catálogo de documentos — modo de aplicación + pregunta + norma
- Migración `20260723000024`: columnas en `documentos_tipos`:
  - `requiere_pregunta` (bool, default false = "aplica siempre")
  - `pregunta_sugerida` (text — la pregunta inducida: SÍ = aplica)
  - `pregunta_id` (FK `riesgos_preguntas` — la pregunta del alta que lo gatilla)
  - `norma_id` (FK `normativa_normas` — 1 norma por documento)
- Seed condicional: Actas/Informes de **Demolición**→`Q_DEMOLICION`, **Excavación**→`Q_EXCAV_120`, **Aviso de Obra**→`Q_AVISO_OBRA`.
- UI en `configuracion/documentos-catalogo`: selector Aplica siempre/Requiere pregunta + texto pregunta + selector de pregunta del alta + selector de norma. Indicador "❓" en la fila.

### 2. Motor de auto-gating del legajo
- `getLegajoEsperados` ([lib/actions/establecimiento-ficha.ts](../lib/actions/establecimiento-ficha.ts)): un doc "requiere pregunta" entra al legajo SOLO si el establecimiento respondió **SÍ** a su pregunta del alta (`establecimientos_respuestas`). Si "aplica siempre" → entra como antes.

### 3. Override por establecimiento (quitar/restaurar)
- Migración `20260723000025`: tabla `establecimiento_documentos_override` (incluido true/false) + RLS (`has_establecimiento_read/write_access`).
- Motor: force-out (quitar) y force-in (sumar) sobre las categorías empresa / empresa×estab / establecimiento.
- UI en el legajo: botón **Quitar** por fila + panel **"Documentos quitados · Restaurar"**. Actions `setDocumentoOverride` / `getDocumentoOverrides`.

### 4. Normativa legal condicional (arranque)
- Migración `20260723000026`: mismas columnas (`requiere_pregunta`, `pregunta_sugerida`, `pregunta_id`) en `normativa_normas`.
- Nueva pregunta `Q_SUBMURACION` (subsuelo con submuración) + enganchada a Construcción.
- Gating en `getNormativasAplicables`. Seed: **Res SRT 61/2023**→`Q_ALTURA`, **Res SRT 550/2011**→`Q_SUBMURACION`.

## ⚠️ FLAGGED — no lo forcé a ciegas, lo resolvemos juntos

1. **Documentos custom ("agregar un doc que no existe")**: elegiste "nuevo tipo en el catálogo de la consultora". Requiere `consultora_id` en `documentos_tipos`, que choca con el `UNIQUE(nombre)` global (que usan `configuracion_vencimientos` y el seed para matchear por nombre) + RLS multi-tenant + ~5 lectores de la tabla. Tocarlo a ciegas tiene riesgo de fuga entre consultoras. **Propuesta:** tabla separada `consultora_documentos_tipos` (aislada, sin tocar el catálogo global) que el legajo mergea. Lo armamos con vos mirando.
2. **"Activar un doc del listado"** (force-in desde la UI): el motor ya soporta force-in; falta el modal de "agregar del catálogo". Es bajo riesgo, lo sumo cuando definamos junto con el punto 1 (comparten modal).
3. **Res SRT 503/2014** (excavación O demolición): son DOS preguntas (OR) y el modelo es 1 pregunta por norma. ¿Querés que use una pregunta combinada, o pasamos norma↔pregunta a N:N?
4. **Docs dudosos sin gatillo asignado** (quedaron "aplica siempre"): Corte de Suministro Gas/Eléctrico, Relevamiento de Medianeras. Decime con qué pregunta van.
5. **UI de edición en la librería de Normativa**: el motor y las columnas están; falta la pantalla para curar modo/pregunta sobre las normas (como la del catálogo).

## Cómo probarlo
1. En un establecimiento de **Construcción**, respondé las preguntas del alta (demolición/excavación/altura/submuración).
2. Andá al **Legajo Técnico**: deberían aparecer/desaparecer las Actas, Informes, etc. según las respuestas.
3. Probá **Quitar** un documento y **Restaurar**lo desde el panel ámbar de arriba.
