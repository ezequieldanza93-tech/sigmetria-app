# PROMPT — Checklist técnico de PRE-LANZAMIENTO · Sigmetría HyS

> **Cómo usar este archivo:** copiá TODO el contenido de abajo (desde "Sos un agente…")
> y pegáselo a tu agente (Claude Code) cuando estés por lanzar la app con clientes reales.
> Está escrito como instrucciones para el agente: te va a guiar ítem por ítem, te va a decir
> qué puede hacer él (código) y qué tenés que hacer vos (pagos, trámites, config externa),
> y cómo verificar cada cosa.

---

Sos un agente senior trabajando en **Sigmetría HyS** — SaaS multi-tenant de Higiene y Seguridad
(`c:\dev\sigmetria-app`, Next.js 15 App Router + Supabase + Vercel, deploy desde `master`).

## Contexto

La app está **EN FASE DE ARMADO** y ya cumple, del lado del software, los estándares técnicos
de la **Res. SRT 48/2025** + **Disp. SRT 15/2026** ("Prevención 4.0"). El estado de los 11
estándares está en `docs/disp-15-26/plan_adecuacion.md` (esa es la fuente de verdad — leela primero).

Lo que sigue es el **checklist de PRE-LANZAMIENTO**: lo que falta NO es código de features, es
**configuración, seguridad de producción, servicios pagos y trámites**. Tu trabajo es guiarme
para resolver cada ítem **uno por uno**, sin romper nada.

## Reglas de trabajo (IMPORTANTE)

1. **Un ítem a la vez.** No toques varios en paralelo. Antes de cada uno, **verificá el estado
   actual** (no asumas) y mostrámelo.
2. **Distinguí siempre** quién hace qué:
   - `[AGENTE]` = lo podés implementar vos (código/migración).
   - `[VOS]` = lo tengo que hacer yo (pagar, contratar, tocar un dashboard externo, un trámite).
     En estos, guiame con pasos concretos y links, y verificá el resultado cuando te diga que lo hice.
3. **Verificá CADA cosa contra el estado real** (DB viva, env de Vercel, respuesta HTTP) antes de
   declararla hecha. Nada de "debería andar".
4. **No toques** `.env.local`, `.env.e2e`, `.vercel/.env.production.local`, ni migraciones ya
   aplicadas (solo agregás nuevas). Conventional commits, sin atribución de IA.
5. Cuando termines un ítem, **actualizá `docs/disp-15-26/plan_adecuacion.md`** con el cierre.

---

## Ítems (en el orden recomendado)

### 1. Apagar el bypass de MFA de testing 🔴 CRÍTICO DE SEGURIDAD `[VOS + AGENTE]`
**Por qué:** hoy el MFA por OTP está **bypaseado por defecto** para poder probar sin buzón real.
En producción con usuarios reales, el segundo factor TIENE que regir para todas las cuentas
(Art. 4.5 Res. 48/2025). Dejarlo prendido sería un **hallazgo grave** en una auditoría.
**Dónde:** `lib/auth/test-mfa-bypass.ts` (el kill-switch está documentado en el header del archivo).
**Pasos:**
- `[VOS]` En Vercel (proyecto `hys-app-sig`) → Settings → Environment Variables → producción:
  setear **`ALLOW_MFA_TEST_BYPASS=false`**. Redeploy.
- `[AGENTE]` Verificá que `EXTRA_BYPASS_EMAILS` y la env `MFA_BYPASS_EMAILS` estén **vacías**.
  Confirmá en el código que con el flag en `false`, `isTestBypassAccount()` devuelve `false` para
  todos (incluido `@sigmetria.app`).
**Verificación:** intentá loguear una cuenta cualquiera → debe pedir el código por mail SIEMPRE.

### 2. Supabase Pro + PITR (Point-in-Time Recovery) `[VOS]` → verifica `[AGENTE]`
**Por qué:** estándar 1 (Almacenamiento) y 4 (Disponibilidad). PITR = poder restaurar la base a
un punto exacto en el tiempo. Requiere plan Pro.
**Pasos:**
- `[VOS]` Supabase dashboard (proyecto ref `lslzhgmoaxgkcjeweqaz`) → upgrade a **Pro** → activar
  **PITR** (backups gestionados + retención 7 días).
- `[AGENTE]` Cuando esté, guiame para **probar una restauración PITR** a un punto en el tiempo
  (documentá el RTO medido). Actualizá la evidencia en `docs/`.
**Verificación:** restauración PITR probada y documentada.

### 3. Credenciales R2/B2 reales + lifecycle `[VOS + AGENTE]`
**Por qué:** estándar 1 (Almacenamiento) — backup externo cifrado del que ya existe la
infraestructura (`backup.yml` en GitHub Actions), falta cargar credenciales reales + reglas de
expiración por prefijo.
**Pasos:**
- `[VOS]` Crear cuenta/bucket Cloudflare R2 (o Backblaze B2) y obtener credenciales.
- `[VOS]` Cargar los secrets en GitHub (repo `sigmetria-app` → Settings → Secrets) — pedile al
  agente la lista exacta de nombres de secret que usa `.github/workflows/backup.yml`.
- `[AGENTE]` Configurar el **lifecycle**: `db/daily` 30 días, `db/monthly` 365 días. Verificá que
  el workflow `backup.yml` corra **verde** subiendo a R2.
**Verificación:** una corrida del backup sube a R2 OK + lifecycle activo.

### 4. Verificar dominio en Resend (emails/MFA) `[VOS + AGENTE]`
**Por qué:** hoy el sender de prueba (`onboarding@resend.dev`) **solo entrega al dueño de la cuenta
Resend**. Para que el código MFA y los avisos lleguen a CUALQUIER destinatario (clientes,
colaboradores, auditores) hace falta un dominio verificado.
**Pasos:**
- `[VOS]` En Resend → agregar dominio (ej. `sigmetria.com.ar`) → cargar los registros DNS (SPF,
  DKIM, DMARC) en tu proveedor de DNS → esperar verificación.
- `[VOS]` En Vercel: setear **`EMAIL_FROM`** al remitente del dominio verificado
  (ej. `Sigmetría <no-responder@sigmetria.com.ar>`).
- `[AGENTE]` Verificá que `lib/email/from.ts` use `EMAIL_FROM` y mandá un email de prueba a una
  casilla externa (no la del dueño) para confirmar entrega.
**Verificación:** un MFA/aviso llega a un mail externo (no `@` del dueño de Resend).

### 5. Monitor de uptime externo `[VOS + AGENTE]`
**Por qué:** estándar 4 (Disponibilidad). Ya existe el endpoint `/api/health` (devuelve 200);
falta un monitor externo que lo vigile y alerte.
**Pasos:**
- `[VOS]` Alta en un servicio (UptimeRobot, Better Stack, o el monitoring de Vercel) apuntando a
  `https://hys-app-sig.vercel.app/api/health` cada 1-5 min, con alerta por mail.
- `[AGENTE]` Confirmá que `/api/health` responde 200 y documentá el monitor en `docs/`.
**Verificación:** el monitor muestra el servicio "up" y avisa si cae.

### 6. Resolver bug React #418 → re-habilitar Service Worker `[AGENTE]`
**Por qué:** estándares 4 (Disponibilidad) y 6 (Omnicanalidad) están **parciales** porque el
Service Worker está **deshabilitado** (kill-switch en `public/sw.js`) por un bug de hidratación
React #418. Resolverlo habilita PWA + offline.
**Pasos `[AGENTE]`:**
- Investigá la causa real del React #418 (mismatch de hidratación server/client) — NO re-habilites
  el SW sin resolver el bug (la regla está en `CLAUDE.md`).
- Arreglá el mismatch, re-habilitá el SW con cuidado, probá PWA + cola offline.
**Verificación:** SW activo sin errores de hidratación; la app instala como PWA y funciona offline.

### 7. Contratar un Certificador 4.0 inscripto `[VOS]` — trámite
**Por qué:** estándar 11 (Certificación) — es el objetivo del **Registro Definitivo**. Depende de
que haya Certificadores 4.0 inscriptos disponibles en el Registro de la SRT.
**Pasos `[VOS]`:** contactar un Certificador 4.0 inscripto, agendar la certificación de la
solución. (No es código; el agente solo te ayuda a preparar la evidencia técnica que pidan.)
**Verificación:** certificación obtenida.

### 8. (Mejora) Streaming del ZIP de export — evitar OOM `[AGENTE]` · opcional
**Por qué:** el worker async de export (estándar 3) ya está, pero el ZIP se arma **en memoria**
(`lib/export/build-package.ts`, `zip.generateAsync({ type: 'uint8array' })`). En paquetes
ENORMES puede quedarse sin RAM. No es bloqueante para lanzar, pero conviene antes de clientes con
mucho volumen.
**Pasos `[AGENTE]`:** stremear el ZIP directo a Storage (Supabase/R2) en vez de buffearlo entero.
**Verificación:** export de un paquete muy grande sin picos de memoria.

---

## Cierre

Cuando termines un ítem: verificalo contra el estado real, marcalo en
`docs/disp-15-26/plan_adecuacion.md`, y avisame qué sigue. Los ítems 1, 4 y 5 son los más urgentes
para un lanzamiento seguro; el 7 (certificador) corre por carril aparte (trámite). El 2 y 3
(Supabase Pro + R2) elevan el RPO/RTO real. El 6 y 8 son mejoras que pueden ir después del launch
inicial si hace falta.

> **Recordá:** la parte legal/administrativa (datos sensibles de salud, transferencia internacional,
> registro AAIP, placeholders societarios) la ve el abogado — está documentada en
> `docs/disp-15-26/` y NO es parte de este checklist técnico.
