# Declaración Jurada de Soluciones Tecnológicas + Compromiso de Adecuación

> **Bloque B · Prompt 9.** Borrador de la DDJJ para el **Registro Inicial (temporario)** en el
> Registro de Prestadores de Soluciones 4.0 de la SRT (Disp. SRT 15/2026, Anexo I, Cap. IV).
> **Se firma bajo juramento y se presenta ante un organismo estatal: la veracidad es crítica.**
>
> **Regla de oro:** cada funcionalidad declarada existe hoy en el producto; cada estándar
> declarado como cumplido está respaldado por su doc del Bloque A. Lo demás va "en proceso" y se
> remite al `plan_adecuacion.md`.

---

## 1. Identificación del presentante

- **Razón social:** `[RAZÓN SOCIAL — PLACEHOLDER]` (SAS en trámite).
- **CUIT:** `[PLACEHOLDER]`.
- **Representada por:** `[NOMBRE, DNI, cargo — PLACEHOLDER]`.
- **Categoría solicitada:** Prestador Integral de Soluciones 4.0.

## 2. Detalle de las soluciones tecnológicas

**Descripción general.** Sigmetría es una **plataforma web/móvil** de gestión de Higiene y
Seguridad para consultores y responsables internos en Argentina. Permite: gestión multiempresa y
multiestablecimiento; recorridas/inspecciones con reporte; gestión documental con control de
vencimientos; matriz de riesgos (IPERC); registro de incidentes y denuncias; capacitaciones con
evidencia; observaciones con seguimiento y cierre con evidencia; indicadores y panel de
cumplimiento; **accesos de solo lectura para clientes y dirección** (perfiles "Visualizador" y
"Viewer de Observaciones"); y **acceso a la documentación del legajo técnico por QR**.

**Tipo de tecnología.** Plataforma de **registro digital, gestión y reportes**. Incluye:
- Protocolos técnicos de medición conforme normativa: **iluminación (SRT 84/2012)**, **carga
  térmica / estrés térmico (SRT 30/2023)**, ruido, puesta a tierra y cálculo de carga de fuego
  (verificado en el esquema: `medicion_iluminacion`, `medicion_carga_termica`, y los flujos de
  `gestiones.tipo_ejecucion`).
- **Asistente conversacional interno con IA (SIGIA)** para ayudar al usuario a navegar y operar la
  plataforma. **No** realiza decisiones automáticas de seguridad ni analítica predictiva ni
  monitoreo en tiempo real. `[REVISAR CON ABOGADO: alcance a declarar sobre el componente de IA]`.
- **No** se declara analítica predictiva ni monitoreo en tiempo real (no existen en el producto).

**Procesos del Sistema de Riesgos del Trabajo que la plataforma ASISTE y DOCUMENTA** (la app
asiste y documenta el cumplimiento, **no lo sustituye**): registro de recorridas/visitas e
inspecciones; documentación de condiciones de los establecimientos; seguimiento de medidas
correctivas (observaciones); gestión de vencimientos documentales; registro y seguimiento de
incidentes/accidentes y enfermedades profesionales; identificación y seguimiento de riesgos
(IPERC); capacitaciones con registro de asistentes y evidencias; mediciones técnicas según los
protocolos citados.

- **Ámbito de implementación:** nacional (Argentina).
- **Datos biométricos:** NO (verificado contra el esquema real — 0 columnas biométricas).
- **Infraestructura de almacenamiento:** terceros — **Supabase**, región **`us-east-2` (EE.UU.)**;
  hosting de la app en **Vercel**. Contrato vigente `[ADJUNTAR COMPROBANTE DE SUSCRIPCIÓN +
  TÉRMINOS DE SERVICIO — PLACEHOLDER]`. `[REVISAR CON ABOGADO: transferencia internacional]`.

## 3. Estado de cumplimiento de los estándares (resumen honesto)

**Operativos en producción** (aplicados y verificados el 2026-06-11; ver docs del Bloque A):
- **Almacenamiento, respaldo y disponibilidad** — backup externo cifrado dos tracks + prueba de
  recuperación ejecutada (`almacenamiento.md`).
- **Trazabilidad y cadena de custodia** — audit log inmutable con hash chain SHA-256, migración
  `20260702000001` aplicada (`trazabilidad.md`).
- **Portabilidad** — exportación por empresa (21 entidades, CSV+JSON+binarios, manifest con
  checksums, signed URL); bucket `exports` aplicado (`portabilidad.md`).
- **Perfiles, accesos y QR** — RLS por rol y tenant, 2FA email, viewers solo-lectura, QR
  revocable; fixes de acceso aplicados (`accesos.md`).
- **Autocontrol** — validación en base, detección de inconsistencias, alertas, panel de
  cumplimiento; migraciones `20260705000001/2` aplicadas (`autocontrol.md`).

**En proceso** (detalle y plazos en `plan_adecuacion.md`): Supabase Pro/PITR, credenciales R2/B2
y lifecycle, UI de auditoría, `trace_id` en CRUD, `VALIDATE` de constraints, worker async de
export, y **certificación** ante un Certificador 4.0.

## 4. Compromiso formal de adecuación

`[RAZÓN SOCIAL — PLACEHOLDER]` **se compromete** a adecuar la plataforma a la totalidad de los
estándares técnicos de la **Res. SRT 48/2025** y la **Disp. SRT 15/2026**, conforme al **plan de
adecuación técnica** que se acompaña (`plan_adecuacion.md`), y a someterse a los mecanismos de
auditoría y control que establezca la SRT.

## 5. Carácter de declaración jurada

La presente se formula en **carácter de declaración jurada**, asumiendo la responsabilidad por la
veracidad de su contenido.

Firma del representante legal: `[REPRESENTANTE LEGAL — PLACEHOLDER]`.
