# Resumen de implementación — Auditoría de BD Sigmetría HyS

> Fecha: 2026-06-26 | Agentes: paralelo (20260731000001–07) + principal (20260731100001–03)

---

## Migraciones aplicadas

### Por el agente paralelo (20260731000001–07)

| Versión | Nombre | Hallazgo |
|---------|--------|---------|
| 20260731000001 | fk_coverage_indexes | FK-IDX-001: 160 CREATE INDEX CONCURRENTLY para FKs sin cobertura |
| 20260731000002 | archive_backup_tables | PK-002: 8 tablas _backup_* movidas/archivadas |
| 20260731000003 | check_constraints_estados | CAT-001+CAT-002: CHECKs y ENUMs en ~30 columnas de estado/tipo |
| 20260731000004 | partition_safety_defaults | PART-001: Partición DEFAULT en audit_log para seguridad |
| 20260731000005 | fk_ondelete_policies | INTEG-001: Corrección de ON DELETE para FKs hijas dependientes |
| 20260731000006 | fk_not_null_scraper | INTEG-002: NOT NULL en FKs de tablas scraper siempre presentes |
| 20260731000007 | document_snapshot_columns | 3FN-001: COMMENT ON COLUMN en 5 pares X_id+X_nombre (snapshots) |

### Por este agente (20260731100001–03)

| Versión | Nombre | Hallazgo |
|---------|--------|---------|
| 20260731100001 | checks_restantes_cat001 | CAT-001: CHECKs en `alertas_emitidas_log.severidad` y `gestiones_registros.estado` |
| 20260731100002 | audit_log_particiones_futuras | PART-001: 15 particiones mensuales audit_log (2026-10 → 2027-12) |
| 20260731100003 | gin_jsonb_hot_columns | JSONB-001: 5 índices GIN en columnas jsonb consultadas con operadores |

---

## Hallazgos salteados (con motivo)

| Hallazgo | Motivo | Ver |
|---------|--------|-----|
| CAT-001 (13 columnas residuales) | Dominio extensible o valores desconocidos en código | pendientes-decision.md §1 |
| CAT-002 (CHECK → ENUM) | Conversión compleja, requiere ventana mantenimiento | pendientes-decision.md §2 |
| INTEG-001 (FKs ON DELETE, residual) | Política ambigua por relación, requiere decisión negocio | pendientes-decision.md §3 |
| INTEG-002 (FK nullable, residual) | 222 casos, mayoría legítimos; identificados los candidatos clave | pendientes-decision.md §4 |
| WIDE-001 (sap_presentaciones) | Solo análisis; implementación impacta toda la app del SAP | propuesta-sap-presentaciones.md |
| 3FN-002 (columnas derivadas) | Requiere verificación caso a caso en el código | pendientes-decision.md §7 |
| PART-001 (automatización) | Requiere pg_partman o cron mensual; decisión arquitectónica | pendientes-decision.md §6 |
| TENANT-002 (tablas sin tenant) | Tablas de catálogo global (scraper) no necesitan tenant; resto requiere análisis | pendientes-decision.md §8 |
| TENANT-001 | Fortaleza del esquema, sin acción necesaria | — |

---

## GIN indexes creados (JSONB-001)

```
idx_export_jobs_scope_gin           ON export_jobs (scope)
idx_agent_pending_params_gin        ON agent_pending_actions (params)
idx_erg_factor_paso1_gin            ON ergonomia_evaluacion_factor (paso1_respuestas)
idx_erg_factor_paso2_gin            ON ergonomia_evaluacion_factor (paso2_respuestas)
idx_cap_participantes_respuestas_gin ON capacitacion_participantes (respuestas)
```

---

## Archivos de referencia

```
_auditoria-db/
├── schema.json                      → esquema completo extraído de la BD (257 tablas)
├── report-3nf.json                  → hallazgos de 3FN/escalabilidad con datos exactos
├── report-dead.json                 → análisis de tablas sin uso
├── analisis-preimpl.json            → análisis previo a implementación (valores distintos, etc.)
├── auditoria-base-datos.html        → reporte HTML completo interactivo
├── propuesta-sap-presentaciones.md  → propuesta de normalización de tabla de 82 cols
├── pendientes-decision.md           → ítems que requieren decisión del equipo
└── resumen-implementacion.md        → este archivo
```
