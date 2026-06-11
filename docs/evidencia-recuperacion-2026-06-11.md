# Evidencia de prueba de recuperación — Sigmetría HyS

> **Documento probatorio** del estándar de ALMACENAMIENTO, RESPALDO Y RECUPERACIÓN
> (Res. SRT 48/2025 + Disp. 15/2026). Acredita que la plataforma cuenta con copias de
> respaldo cifradas en una ubicación independiente y que dichas copias **se restauran y
> verifican con éxito** — no de forma teórica, sino ejecutada sobre datos reales de producción.

| Dato | Valor |
|---|---|
| **Resultado** | ✅ **ÉXITO** (`conclusion: success`) |
| **Fecha (UTC)** | 2026-06-11T18:24:33Z (backup interno 18:25:52Z) |
| **Ejecutado por** | GitHub Actions — workflow "Prueba de recuperación (auditoría)" |
| **Run ID** | 27368489932 |
| **Enlace verificable** | https://github.com/ezequieldanza93-tech/sigmetria-app/actions/runs/27368489932 |
| **Commit auditado** | `4d9aedd40a74cbc31dc97851df7f5407d3043bc6` |
| **Runner** | ubuntu (Linux x86_64), entorno efímero y aislado |
| **Origen de los datos** | Base de datos y Storage de **producción** (acceso de solo lectura) |
| **Ubicación del respaldo** | Cloudflare R2 (bucket `sigmetria-backups`) — independiente de Supabase |
| **Log crudo (evidencia original)** | Artifact `recovery-test-log-6` de la corrida (retención 90 días) |

> **Nota de seguridad:** esta corrida se ejecutó *después* de incorporar el enmascarado de
> credenciales en los logs (commit `4d9aedd`). El log crudo muestra la contraseña como `***`
> — **no expone ningún secreto** y es apto para entregar a un auditor sin redacción adicional.

---

## 1. Qué se probó

El ciclo **completo** de respaldo y recuperación, de punta a punta, contra infraestructura real:

```
Backup de PRODUCCIÓN (DB + Storage) → cifrado AES-256 → subida a Cloudflare R2
   → descarga desde R2 → descifrado → verificación de checksums
   → restauración en un Postgres limpio → conteo de filas e integridad
```

No es una simulación: el origen fue la base de datos y los archivos **reales** de producción, y el
destino del respaldo fue el **bucket R2 real**, físicamente separado del proveedor primario (Supabase).

---

## 2. Resultados verificados (extraídos del log)

### 2.1 Respaldo de la base de datos (cifrado)
- Dump lógico de producción (esquema + datos + roles) vía conexión *Session pooler*.
- Empaquetado y **cifrado AES-256-CBC** (PBKDF2, 100.000 iteraciones).
- Bundle: `backup-2026-06-11T18-25-52-778Z.tar.enc` — **SHA-256 `4b2290495673b4c1…`**.
- Subido a R2 en **dos ubicaciones** (retención diaria + mensual) + manifiesto con checksums:
  - `s3://sigmetria-backups/db/daily/2026-06-11/`
  - `s3://sigmetria-backups/db/monthly/2026-06/`

### 2.2 Respaldo de Storage (archivos) — incremental **demostrado**
- Inventario detectado: **22 buckets, 55 objetos, 31,29 MiB**.
- Sincronización **incremental**: `Δ Delta: 0 de 55 objetos a sincronizar (55 ya presentes)`.
  → Esta corrida **prueba en vivo el comportamiento incremental**: los 55 objetos ya estaban en R2
  (subidos en una corrida previa), por lo que **no se re-subió ninguno**. Solo se transfiere el
  delta — ahorro de transferencia y costo, sin perder cobertura.
- Espejados a `s3://sigmetria-backups/storage/<bucket>/<path>` + `storage/manifest.json`.

### 2.3 Recuperación + verificación de integridad
Restauración del bundle en un **Postgres limpio y efímero** (nunca producción):

| Verificación | Resultado |
|---|---|
| Descifrado del bundle | ✅ OK |
| Restauración de esquema + datos + roles | ✅ OK |
| **Filas de negocio restauradas** | **8.217** |
| **Tablas restauradas (schema public)** | **180** |
| **Checksums del manifiesto vs archivos** | ✅ **`Todos los checksums coinciden`** |

Cierre del log: `✅ Ciclo de recuperación completado. Este log es la evidencia.`

---

## 3. Citas textuales del log (fuente: artifact `recovery-test-log-6`)

```
🔐 Cifrado DB: backup-2026-06-11T18-25-52-778Z.tar.enc (SHA-256 4b2290495673b4c1…)
✅ Track DB subido. Bundle: backup-2026-06-11T18-25-52-778Z.tar.enc
   db/daily/2026-06-11/  +  db/monthly/2026-06/
  Δ Delta: 0 de 55 objetos a sincronizar (55 ya presentes, no se re-suben).
✅ Track Storage sincronizado. Inventario: 55 objetos, 31.29 MiB.
...
  TOTAL filas restauradas: 8217
🔐 Verificando checksums del manifest contra los archivos extraídos…
  ✓ Todos los checksums coinciden.
✅ Restauración + verificación de la DB completas sobre el Postgres objetivo.
### RESULTADO — tablas y filas restauradas en el destino efímero
 tablas public: 180
✅ Ciclo de recuperación completado. Este log es la evidencia.
```

---

## 4. Garantías que acredita esta prueba

1. **Existen copias de respaldo** de la información (datos de negocio + archivos). La generación
   demostrada hasta ahora fue por **corrida manual** del pipeline (`workflow_dispatch`); el
   agendado diario (04:00 UTC) está **armado** y correrá de forma autónoma en el próximo ciclo.
2. **Confidencialidad:** el respaldo de la base viaja **cifrado** (AES-256); el respaldo de Storage
   reside en un bucket **privado** con cifrado en reposo y TLS en tránsito.
3. **Ubicación independiente:** las copias se guardan en **Cloudflare R2**, separado del proveedor
   primario (Supabase) — una falla de uno no afecta al otro.
4. **Recuperabilidad demostrada:** las copias **se restauran con éxito** y los datos vuelven íntegros
   (8.217 filas, 180 tablas), con **verificación criptográfica de integridad** (checksums).
5. **Eficiencia incremental probada:** el respaldo de Storage solo transfiere el delta
   (esta corrida: 0 de 55 objetos re-subidos), demostrando que el esquema escala sin re-subir todo.
6. **Reproducibilidad:** la prueba es un workflow versionado y disparable a demanda — cualquier
   auditoría futura puede re-ejecutarla y obtener un nuevo log fechado.

---

## 5. Notas de transparencia (alcance honesto)

- **Fallback JSON:** el respaldo intenta además un volcado JSON vía API REST como red secundaria;
  en esta corrida no se generó porque falta una función auxiliar (`get_tables`) en el esquema. **No
  afecta la prueba**: el respaldo autoritativo es el dump SQL cifrado (esquema + datos + roles), que
  sí se generó, subió y restauró correctamente.
- **Advertencia de pg_dump** sobre FK circulares (`empresas` ↔ `organizaciones_externas`): es
  informativa; la restauración se completó igualmente.
- **Destino de restauración:** un Postgres genérico efímero (no un proyecto Supabase completo). Por
  eso la restauración tolera errores no-fatales esperables (referencias a los esquemas `auth`/`storage`
  gestionados por Supabase, owners/roles). La **integridad se acredita por checksums + conteo de
  filas**, no por "cero advertencias". En una recuperación real ante desastre se restauraría sobre
  un proyecto Supabase nuevo, donde esas referencias se resuelven.
- **Credenciales:** ninguna credencial figura en este documento ni en el repositorio. Viven como
  *secrets* cifrados de GitHub y aparecen enmascaradas (`***`) en el log crudo.

---

## 6. Cómo reproducir / repetir la prueba

GitHub → **Actions** → **"Prueba de recuperación (auditoría)"** → **Run workflow**. Al finalizar,
descargar el artifact `recovery-test-log-<N>`: ese log fechado es la evidencia de esa corrida.

El respaldo está **agendado** para correr **automáticamente todos los días** (workflow "Backup
externo", 04:00 UTC). El workflow standalone de backup fue **ejecutado y verificado con éxito de
forma manual** (`workflow_dispatch`) — corrida CI **27371773547** (`conclusion: success`): dump
cifrado a R2 + espejo incremental de Storage, sin la prueba de restore. La **primera corrida
autónoma** del agendado (sin intervención) ocurrirá en el próximo ciclo de las 04:00 UTC.

---

*Sigmetría HyS · Amarilla Ingeniería · Evidencia generada el 2026-06-11 a partir de la corrida CI
27368489932. Runbook de recuperación: `docs/recuperacion.md`. Estrategia: `docs/almacenamiento.md`.*
