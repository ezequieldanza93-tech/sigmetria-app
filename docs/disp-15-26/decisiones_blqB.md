# Decisiones — Bloque B (Documentación para el registro ante la SRT)

> Corrida autónoma del 2026-06-11 (nocturna, usuario ausente). Registro de decisiones
> tomadas para producir la documentación del Bloque B (Disp. SRT 15/2026). Cada entrada:
> **qué / por qué / alternativa**. Todo es revisable.
>
> Regla de oro vigente: solo se afirma lo implementado y verificado. Lo que falta va como
> `[PLACEHOLDER]` o `pendiente`. Lo legal va como `[REVISAR CON ABOGADO]`.

---

## Decisiones confirmadas por el usuario (consulta única inicial)

- **D-B0 · Marco de referencia de seguridad: ISO/IEC 27001.** Se adopta como marco de
  REFERENCIA (no certificación) para el Protocolo de Riesgos (Prompt 7). Motivo: es el más
  reconocido para un SGSI y mapea limpio con los controles ya implementados (RLS, backups
  cifrados, audit log inmutable, control por roles); alinea con el camino de certificación
  futura ante un Certificador 4.0. Alternativa descartada: NIST CSF (válido, más liviano,
  menos habitual para el camino de certificación local).
- **D-B1 · Retención de datos (default).** Donde el Bloque A no define plazo: conservar
  mientras la empresa siga siendo cliente + el plazo de prescripción laboral aplicable; el
  **audit log NUNCA se purga** (valor probatorio, alineado con `docs/decisiones.md` D5). Los
  plazos finos se marcan `[REVISAR CON ABOGADO]`. Alternativa descartada: dejar todo como
  placeholder sin default.
- **D-B2 · Sin biometría.** Confirmado por el usuario y **verificado en el esquema real**
  (dump 2026-06-11, 0 columnas biométricas: biometr/huella/dactilar/facial/iris). El freno
  del modo autónomo NO se dispara. La autenticación es contraseña + 2FA por OTP email.
- **D-B3 · Aplicar lo pendiente del Bloque A.** El usuario autorizó aplicar los fixes de
  seguridad que habían quedado "preparados, no aplicados". Se aplicaron a prod los fixes
  `20260707000001` (INSERT estricto de `personas_directorio`) y `20260707000002`
  (`revocar_sesiones_usuario` + llamada en `email-change.ts`). Ver `docs/accesos.md` §6.1/§6.2/§8.
- **D-B4 · Prioridad de la corrida: Bloque B completo.** Si falta tiempo, se prioriza dejar
  los 6 documentos SRT completos y revisables por sobre el pulido de la app.

## Decisiones operativas de la corrida (decididas y documentadas)

- **D-B5 · Datos societarios = `[PLACEHOLDER]`.** Razón social, CUIT y domicilio de la SAS
  (en trámite) y el representante legal van como placeholder en todos los documentos. No son
  pregunta (instrucción del usuario).
- **D-B6 · Responsable de Estándares = el fundador.** Nombre y DNI van como `[PLACEHOLDER]`.
- **D-B7 · Contacto de privacidad / Responsable de Estándares.** Se propone
  `privacidad@sigmetria.com.ar` (dominio de envío de la app: el 2FA sale de
  `seguridad@sigmetria.com.ar`). Marcado `[CONFIRMAR]` — el sitio público también muestra
  `ezequiel@sigmetriahys.com`; unificar dominio de contacto con el abogado.
- **D-B8 · Hosting fuera de Argentina = transferencia internacional.** Supabase corre en
  `us-east-2` (EE.UU.) — verificado en `docs/almacenamiento.md`. Se declara el hosting real y
  se marca `[REVISAR CON ABOGADO]` la transferencia internacional (Ley 25.326, art. 12).
- **D-B9 · HALLAZGO — datos de salud laboral (dato sensible).** La tabla `incidentes`
  (esquema real) tiene `persona_id` + `fecha_baja_medica` / `fecha_alta_medica` /
  `tiene_evolucion_medica` / `dias_perdidos` + tipo `enfermedad_profesional`. Son **datos de
  salud de un trabajador identificado** → categoría de **dato sensible** (Ley 25.326, arts. 2
  y 7). **NO es biometría** (no dispara el freno del modo autónomo), pero requiere criterio
  legal sobre base de licitud y resguardo. Se marca `[REVISAR CON ABOGADO]` en el inventario y
  en la política. No bloquea la redacción del resto.

## Insumos verificados (trazabilidad de la regla de oro)

- Esquema real: dump de Supabase `docs/disp-15-26/_schema_tmp.sql` (2026-06-11) — archivo de
  trabajo, se elimina al cierre.
- Docs Bloque A: `docs/{trazabilidad,almacenamiento,portabilidad,accesos,autocontrol,
  recuperacion}.md` + `decisiones.md` + `resumen_corrida.md`.
- `docs/accesos.md` está **actualizado** al sistema de usuarios vigente (8 roles incl.
  `viewer_observaciones`, identidad persona-céntrica, cambio de email con 2FA).
