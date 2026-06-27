# Pendientes — requieren decisión del equipo

> Generado: 2026-06-26 | Auditoría de base de datos Sigmetría HyS  
> Estos ítems NO fueron implementados porque requieren contexto de negocio
> o decisión arquitectónica que el equipo debe tomar.

---

## 1. CHECK en columnas con dominio incierto (CAT-001 residual)

Columnas de texto libre que NO recibieron CHECK por ser extensibles o tener
valores desconocidos en esta etapa:

| Tabla | Columna | Razón para no agregar CHECK |
|-------|---------|----------------------------|
| `alertas_emitidas_log` | `tipo` | Extensible: recibe valores del enum `alerta_tipo` + strings libres ('vencimiento', 'alerta_srt'). Agregar CHECK requeriría actualizarlo en cada nuevo tipo de alerta. |
| `alertas_emitidas_log` | `referencia_tipo` | Campo libre por diseño: identifica el tipo de entidad referenciada (polimórfico). |
| `notificaciones` | `tipo` | Solo 'vencimiento' hoy, pero el diseño anticipa más tipos. CHECK `('vencimiento')` sería demasiado restrictivo. |
| `notificaciones` | `entidad_tipo` | Valores conocidos: 'documento_empresa', 'documento_establecimiento', 'documento_persona', 'gestion', 'matricula', 'certificado'. Si se agregan nuevas entidades notificables, habría que actualizar el CHECK. **Acción**: agregar CHECK si el set está cerrado, o dejarlo como está si crecerá. |
| `calculo_carga_fuego_materiales` | `estado` | 0 filas en producción. Valores no encontrados en código. Buscar en el wizard de carga de fuego. |
| `calculo_carga_fuego_sector_materiales` | `estado` | Ídem. |
| `observaciones_fotos_cliente` | `categoria` | 0 filas. Dominio abierto (definido por cada consultora). No conviene restringir. |
| `normativa_auditoria_items` | `categoria_nombre` | Libre, viene de la normativa (varía por norma). |
| `normativa_auditoria_items` | `norma_tipo` | Ídem. |
| `leads` | `tipo_contacto` | CRM extensible. Solo 'suscriptor' hoy, podrían agregarse 'telefono', 'email', 'evento'. |
| `cursos` | `categoria` | Solo 'Seguridad' hoy, pero probablemente habrá más categorías. |
| `ct_var_ropa` | `tipo_ropa` | Strings descriptivos largos (Decreto 351). Conjunto muy específico que cambia con regulaciones. |
| `payments` | `mp_status` | Valores del API de MercadoPago. Externos y pueden cambiar con versiones del API. No restringir. |

**Acción recomendada para `notificaciones.entidad_tipo`**:
```sql
ALTER TABLE public.notificaciones
  ADD CONSTRAINT chk_notificaciones_entidad_tipo
  CHECK (entidad_tipo IN (
    'documento_empresa','documento_establecimiento','documento_persona',
    'gestion','matricula','certificado'
  ));
```
Solo agregar si el set está definidamente cerrado.

---

## 2. CHECK → ENUM nativo (CAT-002)

65 columnas ya tienen CHECK con lista de strings y son candidatas a enum nativo.
El agente paralelo NO las convirtió. Razón: ALTER COLUMN TYPE a enum puede requerir
lock breve en tablas con datos; en tablas operativas con tráfico conviene hacerlo
en una ventana de mantenimiento.

**Prioridad alta** (conjuntos estables ya con CHECK, bajo riesgo):
- `calculo_carga_fuego.estado` → enum 'borrador','finalizado'
- `denuncias.estado` → enum 'recibida','en_analisis','accion_planificada','cerrada'
- `cursos.estado` → enum 'borrador','publicado','archivado'
- `cursos.nivel` → enum 'basico','intermedio','avanzado'
- `capacitacion_participantes.estado`
- `capacitacion_sesiones.estado`
- `ergonomia_evaluaciones.estado`

**Proceso por columna** (en ventana de mantenimiento):
```sql
BEGIN;
CREATE TYPE enum_<nombre> AS ENUM ('val1', 'val2', ...);
ALTER TABLE <tabla>
  ALTER COLUMN <col> TYPE enum_<nombre>
  USING <col>::enum_<nombre>;
ALTER TABLE <tabla> DROP CONSTRAINT chk_<antiguo>;
COMMIT;
```

---

## 3. FK ON DELETE — políticas sin resolver (INTEG-001 residual)

El agente paralelo aplicó 20260731000005 con algunas correcciones. 
Las FKs con política ambigua que quedaron pendientes:

| Tabla.columna → Referencia | Situación | Decisión necesaria |
|---|---|---|
| `consultoras_members.invited_by → profiles` | Historial de invitación. Si el perfil se borra, ¿mantener quién invitó? | SET NULL (historial) o RESTRICT (bloquear) |
| `firmas.asistente_id → profiles` | ¿La firma pierde sentido sin el asistente? | SET NULL o mantener RESTRICT |
| `firmas.firmante_usuario_id → profiles` | Firma legal vinculada a un usuario | RESTRICT (firma no puede perder firmante) |
| `formularios_items_respuestas.item_id → formularios_items` | ¿Respuestas sobreviven al ítem? | CASCADE (probablemente) |
| `blog_comments.auth_user_id → users` | Comentario sin usuario → autor anónimo | SET NULL |

---

## 4. FK nullable → NOT NULL (INTEG-002 residual)

222 FKs admiten NULL. Muchas son legítimamente opcionales. Las que probablemente
deberían ser NOT NULL (requieren backfill primero si hay NULLs):

| Tabla.columna | Razón para NOT NULL |
|---|---|
| `agent_conversations.consultora_id` | Toda conversación pertenece a una consultora |
| `calculo_carga_fuego.gestion_establecimiento_id` | Sin gestión no tiene sentido |
| `capacitacion_sesiones.empresa_id` | Toda sesión es de una empresa |

**Proceso**: verificar con `SELECT COUNT(*) FROM <tabla> WHERE <col> IS NULL`, si 0 → `ALTER TABLE <tabla> ALTER COLUMN <col> SET NOT NULL`.

---

## 5. sap_presentaciones — normalización (WIDE-001)

Ver `propuesta-sap-presentaciones.md` para el análisis completo.

**Decisión requerida**: 
- ¿Se implementa ANTES del lanzamiento (recomendado, costo bajo hoy)?
- ¿Las columnas `profesional_*` son snapshot histórico o siempre actuales?

---

## 6. Automatización de particiones de audit_log (PART-001 residual)

Se crearon particiones hasta 2027-12 (migración 20260731100002).
Para garantizar disponibilidad permanente, se necesita uno de estos enfoques:

**Opción A**: Usar `pg_partman` (extensión de Postgres). Crea particiones automáticamente.
Requiere instalarlo en el proyecto Supabase (posible vía extensiones).

**Opción B**: Edge Function o cron job mensual que ejecute:
```sql
CREATE TABLE IF NOT EXISTS public.audit_log_YYYYMM
  PARTITION OF public.audit_log
  FOR VALUES FROM ('YYYY-MM-01') TO ('YYYY-{MM+1}-01');
```

**Opción C**: Agregar más particiones manualmente cada año (migración).

La partición DEFAULT actúa como red de seguridad (ningún INSERT fallará), pero
las particiones específicas son necesarias para rendimiento óptimo.

---

## 7. Columnas derivadas → GENERATED (3FN-002 residual)

26 columnas con nombres de derivadas. Las candidatas a convertir a `GENERATED ALWAYS AS STORED`:

| Tabla.columna | Expresión probable | Verificar |
|---|---|---|
| `iperc_matriz_riesgos.valor_calculado` | `probabilidad * consecuencia` (o similar) | Buscar en el code de IPERC |
| `medicion_ruido_puntos.dosis_pct` | `(dosis / limite_permisible) * 100` | Verificar columnas relacionadas |
| `payments.monto_total` | `subtotal + iva_monto` (si existe iva_monto) | Verificar schema |

Las 23 restantes se interpretan como "valores de configuración" (días_aviso, porcentaje_aprobacion) o "contadores actualizados por trigger" → NO convertir a GENERATED.

---

## 8. Tablas operativas sin columna tenant directa (TENANT-002)

19 tablas con FKs pero sin `consultora_id/empresa_id/establecimiento_id` propio.
El aislamiento depende de JOINs encadenados (RLS más lenta).

**Candidatas a denormalizar** (agregar columna de tenant con FK + índice):
- `medicion_iluminacion_celdas` → agregar `medicion_id` + join con `medicion_iluminacion` para tenant
- `formularios_items_respuestas` → agregar `consultora_id` desnormalizado

Las tablas del scraper (`scraper_*`, `producto_*`) son catálogos globales → NO necesitan tenant.

**Acción**: evaluar caso a caso según frecuencia de acceso y costo de subconsulta en RLS.
