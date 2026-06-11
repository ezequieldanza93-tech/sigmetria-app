# Resumen de corrida — Bloque B (Documentación SRT)

> Corrida autónoma nocturna del **2026-06-11** (usuario ausente). Producción de la documentación
> del Bloque B (Disp. SRT 15/2026) para el registro como Prestador de Soluciones 4.0.
> **Leé este archivo primero.**

## Estado por prompt

| Prompt | Documento | Estado |
|--------|-----------|--------|
| 6 | `inventario_datos.md` | ✅ Completado (grounded en el esquema real) |
| 7 | `protocolo_riesgos.md` | ✅ Completado (marco ISO/IEC 27001) |
| 8 | `politica_privacidad.md` + `consentimiento_usuarios.md` + `nota_trabajadores.md` | ✅ Completado (3 piezas) |
| 9 | `ddjj_soluciones.md` | ✅ Completado |
| 10 | `plan_adecuacion.md` | ✅ Completado (11 estándares + cronograma) |
| 11 | `designacion_responsable_estandares.md` | ✅ Completado (borrador, requiere encuadre societario) |

**Freno del modo autónomo (biometría): NO se disparó.** Se verificó contra el esquema real (dump
2026-06-11): 0 columnas biométricas. Decisión confirmada por el usuario.

**Decisiones del usuario aplicadas:** marco ISO/IEC 27001; retención con default razonable +
abogado; aplicar los fixes de seguridad pendientes; prioridad Bloque B completo. Ver
`decisiones_blqB.md`.

**Seguridad aplicada en la corrida (autorizada por el usuario):** se aplicaron a prod los fixes
`20260707000001` (INSERT estricto de `personas_directorio`) y `20260707000002`
(`revocar_sesiones_usuario` + llamada en `email-change.ts`). `docs/accesos.md` actualizado.

---

## [PLACEHOLDER] por completar (datos que solo tenés vos / la SAS)

1. **Razón social** de la SAS (en trámite) — en todos los documentos.
2. **CUIT** de la SAS.
3. **Domicilio** legal de la SAS.
4. **Representante legal** (nombre, DNI, cargo) — DDJJ y designación.
5. **Nombre y DNI del Responsable de Estándares** (el fundador) — protocolo, designación, plan.
6. **Email de contacto de privacidad** — propuse `privacidad@sigmetria.com.ar` `[CONFIRMAR]`
   (el sitio público muestra `ezequiel@sigmetriahys.com`; unificar dominio).
7. **Fecha de versión** de la política y el consentimiento.
8. **Comprobante de suscripción Supabase + Términos de Servicio** — adjuntar a la DDJJ.
9. **Lugar y fecha** del acta de designación.

## [REVISAR CON ABOGADO] insertados (criterio legal)

1. **Datos de salud laboral = dato sensible** (tabla `incidentes`: baja/alta médica, enfermedad
   profesional, días perdidos). Base de licitud, resguardos, ¿registro especial? (inventario §1
   fila 4 y §4; política §2/§3; nota a trabajadores).
2. **Transferencia internacional de datos** (Supabase/Vercel en EE.UU.) — Ley 25.326 art. 12
   (inventario §3/§4; política §4; DDJJ §2).
3. **Rol de Sigmetría: ¿responsable o encargado del tratamiento?** y contrato con la
   empresa-cliente (inventario §4; consentimiento).
4. **Registro de la base ante la AAIP** (inventario §4).
5. **Plazos de retención finos** por tipo de dato (política §5).
6. **Imágenes en evidencias** que puedan mostrar personas (inventario §1 fila 7).
7. **Alcance a declarar del componente de IA (SIGIA)** en la DDJJ (ddjj §2).
8. **Deslinde de responsabilidad** usuario que carga datos de terceros vs. Sigmetría
   (consentimiento).

---

## Notas

- **Carpeta de salida:** todo el Bloque B está en `docs/disp-15-26/`. Nada fuera de ahí (salvo la
  actualización de `docs/accesos.md`, que es un doc del Bloque A, por los fixes aplicados).
- **Archivo de trabajo:** `docs/disp-15-26/_schema_tmp.sql` es el dump del esquema usado para el
  grounding; se puede borrar (no es entregable).
- **Paquete para Gabuzo (abogado):** `inventario_datos.md`, `protocolo_riesgos.md`,
  `politica_privacidad.md` (+ consentimiento + nota), `designacion_responsable_estandares.md`;
  conviene que también vea `ddjj_soluciones.md` y `plan_adecuacion.md` antes de presentar.
- **Trazabilidad (regla de oro):** cada afirmación se apoya en los docs del Bloque A, el esquema
  real o el código. Nada aspiracional se declaró como hecho.
