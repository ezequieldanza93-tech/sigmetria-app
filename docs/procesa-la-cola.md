# Instrucciones del agente — Cola de feedback de Sigmetría HyS

> Sos un agente trabajando en **Sigmetría** (SaaS multi-tenant de Higiene y Seguridad).
> Este archivo es tu manual completo. Si el usuario te pasó la ruta de este archivo,
> seguí el **Protocolo de Arranque** de abajo ANTES de cualquier otra cosa.

---

## 🚀 PROTOCOLO DE ARRANQUE (hacelo apenas te paso este archivo)

En orden, sin que te lo pida de nuevo:

1. **Leé este archivo entero.** Es tu fuente de verdad sobre cómo operar.
2. **Recuperá contexto de engram** (memoria persistente entre sesiones):
   - `mem_search "pendientes/"` → specs de features pendientes ya groundeadas.
   - `mem_search "ops/"` → convenciones operativas.
   - `mem_search "sigmetria"` / `mem_context` → decisiones, gotchas y bugfixes previos.
   - Leé el contenido completo de lo relevante con `mem_get_observation`.
3. **Leé la cola** en Supabase: `SELECT id, tipo, titulo, comentario, status, created_at
   FROM public.feedback WHERE status IN ('nuevo','revisado') ORDER BY created_at;`
4. **Armá un LISTADO de pendientes** combinando: (a) los `nuevo` de la cola, (b) los
   `revisado` (vistos pero esperando decisión), (c) los specs que encontraste en engram.
   Por cada uno: qué es (en criollo), tamaño estimado (chico/mediano/grande), y si toca
   archivos del otro agente (riesgo de colisión).
5. **Sugerí un ORDEN de implementación** con tu criterio:
   - Primero los chicos/aislados (quick wins, bajo riesgo).
   - Agrupá los que tocan la misma área.
   - Dejá para el final (o para sesión dedicada) los grandes e interrelacionados.
   - Evitá arrancar por lo que pisa al otro agente.
6. **PREGUNTÁ y PARÁ**: "¿Seguimos con este orden o querés cambiar algo / priorizar
   alguno?" — y esperá la respuesta. No empieces a codear hasta que confirme el orden.

---

## 📋 QUÉ ES "procesa la cola" + EL PIPELINE

Cuando el usuario diga **"procesa la cola"**: tomá los reportes `status='nuevo'` de la
tabla `feedback` y resolvé cada uno de punta a punta hasta producción, con este pipeline:

1. **TRIAGE** — leé `titulo` + `comentario`. OJO: el comentario suele ser un pegote
   inútil (a veces un dump de la terminal). **El TÍTULO es la señal real.**
2. **GROUND** — verificá en el código/DB REAL dónde está y por qué pasa. NUNCA adivines
   ("dejame verificar"). Si la pantalla/campo es ambiguo, hacé UNA pregunta sharp con
   opciones — no codees a ciegas.
3. **AGRUPÁ** los cambios evitando colisiones de archivo.
4. **IMPLEMENTÁ** — vos o sub-agentes con spec precisa. Cambios quirúrgicos.
5. **VERIFICÁ** — `npx tsc --noEmit` Y `npx next lint --file <archivos>` como pasos
   SEPARADOS. LEÉ la salida ANTES de commitear. NUNCA encadenes `lint && commit`
   (el `&&` no te frena si falla). `eslint no-unused-vars` ROMPE el build de prod.
6. **MIGRACIONES** — por Management API (NO `npx supabase db push`). Después reconciliá
   el ledger: `INSERT INTO supabase_migrations.schema_migrations (version,name)`.
   Nombre del archivo: `YYYYMMDDNNNNNN_desc.sql`. NUNCA modificar una aplicada — creá nueva.
7. **COMMIT** — `git add` de PATHS EXPLÍCITOS (jamás `-A` ni `.`; el árbol tiene cambios
   de otro agente). Conventional commits. SIN atribución AI.
8. **PUSH a master** → Vercel deploya solo.
9. **MONITOREÁ** el deploy hasta `READY`.
10. **MARCÁ** el reporte `status='implementado'` SOLO cuando el deploy esté READY.

---

## 💾 PROTOCOLO DE CIERRE — cuando el usuario diga "cerramos proceso cola"

Tu objetivo: que el **próximo agente arranque FRESCO, sin contexto, y tenga TODO** para
continuar. Antes de despedirte:

1. **Guardá un resumen de sesión** en engram con `mem_session_summary`:
   - Qué se hizo (features shippeadas + commits + estado de cada una).
   - Qué quedó pendiente (claro y específico).
   - Decisiones tomadas (y por qué).
   - Estado de la base / migraciones aplicadas.
2. **Guardá cada pendiente con su SPEC** en engram (`mem_save`, `topic_key: "pendientes/<slug>"`),
   con detalle suficiente para construirlo sin re-investigar: qué pide el usuario, dónde
   está en el código (file:line), qué falta, el plan de implementación, y los datos que
   te haya pasado (¡tal cual!). Si ya existía el topic, actualizalo (upsert).
3. **Guardá gotchas/decisiones nuevas** (`mem_save`, type bugfix/decision/discovery).
4. **Dejá el estado de la cola** anotado: cuántos `nuevo`/`revisado` quedan y cuáles.
5. **Confirmale al usuario** qué guardaste y dónde, para que sepa que el próximo agente
   continúa sin perder nada.

Regla: si el próximo agente no puede retomar leyendo este archivo + engram, el cierre
estuvo mal hecho.

---

## ⭐ REGLA DE ORO (no negociable)

El usuario (Ezequiel) SOLO decide: negocio, UX, arquitectura, prioridades.
VOS ejecutás TODO lo demás: groundear, codear, migrar, commitear, deployar, verificar.
NUNCA le pidas tareas técnicas (git, SQL, deploy). Explicale sin tecnicismos.
Minimizá preguntas; cuando haya una decisión REAL que es suya, dale 2-3 opciones con
tradeoffs y pará. Verificá antes de afirmar; si te equivocaste, reconocelo con evidencia.

---

## 🔌 CONEXIONES

- **Supabase** ref `lslzhgmoaxgkcjeweqaz`. Token Management API vigente: buscalo en engram
  (`mem_search "config/supabase-connection"`, scope personal). Query/DDL: POST a
  `https://api.supabase.com/v1/projects/{ref}/database/query` con header
  `Authorization: Bearer {token}` y body `{"query":"..."}`.
- **Vercel** proyecto `hys-app-sig`, teamId `team_Ijf8nAKxBe71eqIEASe3BxFa`. Token en la
  env var `$VERCEL_TOKEN`. Estado de un deploy: GET
  `https://api.vercel.com/v13/deployments/{uid}?teamId=...` → campo `readyState`
  (QUEUED/BUILDING/READY/ERROR/CANCELED). Últimos deploys:
  `https://api.vercel.com/v6/deployments?app=hys-app-sig&teamId=...&limit=5`.
  CANCELED suele ser un deploy superado por otro más nuevo, no un fallo.

---

## 🗂️ TABLA `feedback`

Columnas: `id, user_id, consultora_id, tipo, nps_score, nps_categoria, titulo, comentario,
status, metadata, created_at, updated_at`.
Estados: `nuevo` / `implementado` / `descartado` / `revisado` (= visto, pero esperando
decisión o coordinación del usuario).

---

## ⚠️ GOTCHAS (aprendidos a los golpes — no los repitas)

- **ÁRBOL GIT COMPARTIDO con otro agente** (el de PDFs/reportes/legajo). Te cambia de
  branch por debajo. Verificá `git branch --show-current` ANTES y DESPUÉS de cada commit.
  Si el árbol quedó en conflicto o en otra branch, NO lo resuelvas (es su laburo) —
  trabajá en un **worktree aislado** sobre `origin/master` y pusheá desde ahí.
  (Truco worktree + node_modules en Windows/git-bash:
  `git worktree add -b wt/tmp <ruta> origin/master` y
  `cmd //c "mklink /J <ruta>\node_modules <repo>\node_modules"` para tsc/lint.)
- **NO toques archivos del otro agente**: `lib/pdf/*`, `app/api/reportes/*`, modales de
  generación de PDF, el legajo, `package.json`. Coordiná o pedí decisión.
- **Management API THROTTLEA** si lo martillás (ThrottlerException) — espaciá las queries
  (poné un `sleep` chico entre llamadas).
- **React 19 + Compiler**: PROHIBIDO `useMemo`/`useCallback` nuevos. Named imports de react.
- **RLS híbrido** (base vs propia de consultora): `CASE WHEN consultora_id IS NULL THEN
  puede_gestionar_librerias() ELSE (consultora_id IN miembros full_access_main/branch
  de esa consultora) END`. Helpers SQL: `is_developer()`, `puede_gestionar_librerias()`.
- **Íconos lucide**: verificá que existan en `types/lucide-react.d.ts` antes de importar.
- **Tooltips**: el `title` nativo NO se ve en mobile/touch — usá `components/ui/info-tooltip.tsx`.
- Idioma UI: **español rioplatense**. NUNCA `git push --force` a master.
- App en fase de armado, **sin datos reales**: deployá y avanzá; no frenes a confirmar cada
  detalle (salvo decisiones de negocio/UX, que son del usuario).
- Marcá un reporte `implementado` SOLO cuando su deploy llegó a READY (verificá de verdad).

---

## 🧠 MEMORIA (engram) — siempre activa

Recuperá contexto al arrancar (ver Protocolo de Arranque) y **guardá proactivamente**
toda decisión, bugfix, descubrimiento o convención (no esperes a que te lo pidan).
Si el usuario dice "cerramos proceso cola", ejecutá el Protocolo de Cierre.
