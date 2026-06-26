/**
 * contrato-html.ts — Generador del HTML del CONTRATO DE PRESTACIÓN DE SERVICIOS
 * PROFESIONALES DE HIGIENE Y SEGURIDAD EN EL TRABAJO.
 *
 * ARQUITECTURA: función pura `contratoHtml(datos)` → string HTML AUTOCONTENIDO
 * (DOCTYPE + <html><head><style>…@page A4…</style></head><body>…</body></html>),
 * listo para `renderHtmlToPdf` (Chromium serverless, respeta @page CSS).
 *
 * El clausulado replica el contrato modelo corto (scratchpad/contrato_modelo.md),
 * incluyendo la cláusula 9.3 bis (plataforma Sigmetría como medio fehaciente —
 * Res. SRT 48/2025 + Disp. SRT 15/2026) y el aviso legal del encabezado.
 *
 * Los campos NO provistos se renderizan como una LÍNEA EN BLANCO (placeholder
 * subrayado) para completar a mano antes de la firma — nunca se inventan datos.
 *
 * SERVER-ONLY de hecho (lo consume una server action), pero es una función de
 * librería sin efectos: no lleva 'use server'.
 */

import { resolveBrandColor } from '@/lib/pdf/brand-color'

// ─────────────────────────────────────────────────────────────────────────────
// TIPOS PÚBLICOS
// ─────────────────────────────────────────────────────────────────────────────

/** Un establecimiento alcanzado por el contrato (fila del Anexo de Establecimientos). */
export interface ContratoEstablecimiento {
  /** Denominación del establecimiento. */
  nombre?: string | null
  /** Domicilio del establecimiento. */
  domicilio?: string | null
  /** Localidad / provincia (texto compuesto, ej. "Rosario, Santa Fe"). */
  localidad?: string | null
  /** Actividad principal / CIIU del establecimiento (texto libre). */
  actividad?: string | null
  /** Dotación de trabajadores. */
  cantidadTrabajadores?: number | null
}

/**
 * Datos completos para interpolar el contrato. TODO es opcional: lo ausente
 * queda como línea en blanco para completar a mano. El prefill (server action)
 * llena lo derivable de la base; el formulario completa honorarios, vigencia,
 * frecuencia de visitas, etc.
 */
export interface ContratoDatos {
  // ── Comparecencia (lugar y fecha) ──
  ciudad?: string | null
  provincia?: string | null
  /** Día (número o palabra). Si se omite, queda en blanco. */
  dia?: string | null
  /** Mes (nombre). Si se omite, queda en blanco. */
  mes?: string | null
  /** Año. Si se omite, queda en blanco. */
  anio?: string | null

  // ── EL CONSULTOR (consultora / profesional) ──
  consultorRazonSocial?: string | null
  consultorCuit?: string | null
  consultorDomicilio?: string | null
  consultorTelefono?: string | null
  consultorEmail?: string | null
  /** Naturaleza: 'persona humana' | 'persona jurídica' (texto libre). */
  consultorNaturaleza?: string | null
  /** Logo de la consultora (URL pública del bucket `consultora`). Si falta, se usa el nombre como texto. */
  consultorLogoUrl?: string | null
  /** Color de marca (hex #RRGGBB). NULL = verde Sigmetría. */
  colorPrimario?: string | null
  colorSecundario?: string | null

  // ── Responsable técnico (full_access_main de la consultora) ──
  responsableNombre?: string | null
  responsableTitulo?: string | null
  responsableMatricula?: string | null
  /** Emisor de la matrícula (consejo / colegio profesional). */
  responsableMatriculaEmisor?: string | null
  /** Provincia de la matrícula. */
  responsableProvinciaMatricula?: string | null
  /** CUIT/CUIL del responsable técnico (si persona humana). */
  responsableCuit?: string | null
  /** DNI del responsable / firmante por el consultor. */
  responsableDni?: string | null
  /** Carácter del firmante por el consultor (Titular / Responsable técnico / Apoderado). */
  responsableCaracter?: string | null

  // ── EL CLIENTE (empresa) ──
  clienteRazonSocial?: string | null
  clienteCuit?: string | null
  clienteDomicilioFiscal?: string | null
  clienteActividad?: string | null
  /** Código CIIU / AFIP de la actividad del cliente. */
  clienteCiiu?: string | null
  /** Código SRT de la actividad del cliente. */
  clienteCodigoSrt?: string | null
  clienteArtNombre?: string | null
  clienteArtNumeroContrato?: string | null
  /** Referente interno designado por el cliente. */
  clienteReferenteNombre?: string | null
  clienteReferenteCargo?: string | null
  clienteTelefono?: string | null
  clienteEmail?: string | null
  /** Representante legal del cliente (firmante). */
  clienteRepresentante?: string | null
  clienteRepresentanteDni?: string | null
  clienteRepresentanteCaracter?: string | null

  // ── Establecimientos (Anexo) ──
  establecimientos?: ContratoEstablecimiento[]

  // ── Cláusula 3 — Alcance ──
  frecuenciaVisitas?: string | null
  /** Plazo objetivo de respuesta a consultas digitales. */
  plazoRespuesta?: string | null

  // ── Cláusula 6 — Honorarios, plazos y vigencia ──
  honorarios?: string | null
  honorariosEnLetras?: string | null
  /** Modalidad: mensuales / por visita / etc. */
  honorariosModalidad?: string | null
  /** Plazo de pago en días desde la factura. */
  honorariosPlazoPagoDias?: string | null
  /** Medio de pago (CBU/CVU, etc.). */
  honorariosMedioPago?: string | null
  /** Periodicidad de actualización de honorarios. */
  actualizacionPeriodicidad?: string | null
  /** Índice / criterio de actualización. */
  actualizacionIndice?: string | null
  fechaInicioVigencia?: string | null
  /** Antelación de no-renovación en días (default 60). */
  diasNoRenovacion?: string | null

  // ── Cláusula 8 — Responsabilidad y seguros ──
  sumaAseguradaRC?: string | null
  sumaAseguradaRCEnLetras?: string | null

  // ── Cláusula 9 — Jurisdicción ──
  jurisdiccion?: string | null

  // ── Metadatos del documento ──
  fechaEmision?: string | null
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Escapa texto para inserción segura en HTML. */
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Renderiza un dato: si está presente, lo muestra en negrita (.dato); si falta,
 * deja una línea en blanco subrayada para completar a mano.
 *
 * @param v      valor a mostrar
 * @param anchoMm ancho de la línea en blanco (mm) cuando el dato falta
 */
function D(v: unknown, anchoMm = 38): string {
  const s = v == null ? '' : String(v).trim()
  if (s) return `<span class="dato">${esc(s)}</span>`
  return `<span class="blank" style="min-width:${anchoMm}mm"></span>`
}

/** Devuelve el primer valor presente o una línea en blanco (versión inline corta). */
function blank(anchoMm = 38): string {
  return `<span class="blank" style="min-width:${anchoMm}mm"></span>`
}

// ─────────────────────────────────────────────────────────────────────────────
// ENCABEZADO (logo de la consultora o su nombre)
// ─────────────────────────────────────────────────────────────────────────────

function encabezado(d: ContratoDatos): string {
  const marca = d.consultorLogoUrl
    ? `<img class="logo" src="${esc(d.consultorLogoUrl)}" alt="">`
    : `<div class="marca-txt">${esc(d.consultorRazonSocial || 'Consultora')}</div>`
  const emision = d.fechaEmision ? `Emitido ${esc(d.fechaEmision)}` : ''
  return `
  <header class="hdr">
    <div class="hdr-marca">${marca}</div>
    <div class="hdr-meta">
      <div class="hdr-doc">Contrato de Servicios Profesionales · HyS</div>
      ${emision ? `<div class="hdr-fecha">${emision}</div>` : ''}
    </div>
  </header>`
}

// ─────────────────────────────────────────────────────────────────────────────
// ANEXO DE ESTABLECIMIENTOS
// ─────────────────────────────────────────────────────────────────────────────

function anexoEstablecimientos(d: ContratoDatos): string {
  const ests = d.establecimientos ?? []
  const filas = ests.length
    ? ests
        .map((e, i) => {
          const trab =
            e.cantidadTrabajadores != null && Number.isFinite(e.cantidadTrabajadores)
              ? String(e.cantidadTrabajadores)
              : blank(14)
          return `<tr>
            <td class="idx">${i + 1}</td>
            <td>${D(e.nombre, 40)}</td>
            <td>${D(e.domicilio, 50)}</td>
            <td>${D(e.localidad, 35)}</td>
            <td>${D(e.actividad, 35)}</td>
            <td class="num">${trab}</td>
          </tr>`
        })
        .join('')
    : `<tr><td class="idx">1</td><td>${blank(40)}</td><td>${blank(50)}</td><td>${blank(35)}</td><td>${blank(35)}</td><td class="num">${blank(14)}</td></tr>
       <tr><td class="idx">2</td><td>${blank(40)}</td><td>${blank(50)}</td><td>${blank(35)}</td><td>${blank(35)}</td><td class="num">${blank(14)}</td></tr>`

  return `
  <section class="anexo">
    <h2 class="anx-t">Anexo de Establecimientos</h2>
    <p class="anx-p">Forma parte integrante del Contrato. El alta o baja de establecimientos durante la vigencia se instrumentará por escrito mediante adenda firmada por LAS PARTES, con su correspondiente ajuste de honorarios y plan de visitas.</p>
    <table class="anx-tabla">
      <thead>
        <tr>
          <th class="idx">N°</th>
          <th>Denominación</th>
          <th>Domicilio</th>
          <th>Localidad / Provincia</th>
          <th>Actividad / CIIU</th>
          <th class="num">Dotación</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  </section>`
}

// ─────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Construye el HTML autocontenido del contrato de prestación de servicios de HyS.
 *
 * @param datos - Datos a interpolar (todos opcionales; lo ausente queda en blanco).
 * @returns string HTML completo (DOCTYPE + head con @page A4 + body).
 */
export function contratoHtml(datos: ContratoDatos): string {
  const d = datos
  const { primario: cMarca } = resolveBrandColor(datos.colorPrimario, datos.colorSecundario)

  const cuerpo = `
  ${encabezado(d)}

  <h1 class="titulo">Contrato de Prestación de Servicios Profesionales de Higiene y Seguridad en el Trabajo</h1>

  <div class="aviso">
    <strong>Aviso legal — leer antes de usar.</strong> Este documento es un <em>modelo orientativo</em> de contenido genérico. No constituye asesoramiento jurídico ni contempla necesariamente las particularidades de cada relación, jurisdicción, actividad o convenio aplicable. <strong>Antes de su firma debe ser revisado y adaptado por un abogado/a matriculado/a</strong>, completando los espacios en blanco. Su uso es bajo exclusiva responsabilidad de quien lo emplea; ni el autor ni Sigmetría asumen responsabilidad por su utilización.
  </div>

  <h3 class="sub">Comparecencia</h3>
  <p>En la Ciudad de ${D(d.ciudad, 40)}, Provincia de ${D(d.provincia, 38)}, República Argentina, a los ${D(d.dia, 14)} días del mes de ${D(d.mes, 26)} del año ${D(d.anio, 18)}, entre: <strong>POR UNA PARTE</strong>, ${D(d.consultorRazonSocial, 55)}, ${d.consultorNaturaleza ? `${D(d.consultorNaturaleza, 40)}` : blank(60)}, CUIT N° ${D(d.consultorCuit, 38)}, con domicilio en ${D(d.consultorDomicilio, 55)}, en adelante <strong>"EL CONSULTOR"</strong>; y <strong>POR LA OTRA PARTE</strong>, ${D(d.clienteRazonSocial, 55)}, CUIT N° ${D(d.clienteCuit, 38)}, con domicilio fiscal en ${D(d.clienteDomicilioFiscal, 55)}, representada por ${D(d.clienteRepresentante, 45)}, DNI N° ${D(d.clienteRepresentanteDni, 28)}, en carácter de ${D(d.clienteRepresentanteCaracter, 40)}, en adelante <strong>"EL CLIENTE"</strong>; ambas en conjunto <strong>"LAS PARTES"</strong>, quienes manifiestan tener capacidad y legitimación suficientes y convienen celebrar el presente Contrato de Prestación de Servicios Profesionales de Higiene y Seguridad en el Trabajo (el <strong>"Contrato"</strong>), que se regirá por las cláusulas siguientes y, supletoriamente, por el Código Civil y Comercial de la Nación (servicios profesionales, arts. 1251 y ss.) y demás legislación aplicable.</p>

  <h3 class="sub">Considerandos</h3>
  <p><strong>PRIMERO:</strong> Que EL CLIENTE desarrolla la actividad de ${D(d.clienteActividad, 50)} (código CIIU/AFIP N° ${D(d.clienteCiiu, 26)}, código SRT N° ${D(d.clienteCodigoSrt, 22)}) y, como empleador, se encuentra alcanzado por la normativa de Higiene y Seguridad y de Riesgos del Trabajo vigente, estando obligado a contar con un Servicio de Higiene y Seguridad en el Trabajo, interno o externo.</p>
  <p><strong>SEGUNDO:</strong> Que EL CONSULTOR es ${D(d.responsableTitulo, 40)} con incumbencia en HyS, matrícula profesional N° ${D(d.responsableMatricula, 30)} otorgada por ${D(d.responsableMatriculaEmisor, 40)}, habilitado y con la idoneidad técnica para prestar el servicio objeto del presente, conforme a las funciones de la Resolución SRT N° 905/2015 (Anexo II).</p>
  <p><strong>TERCERO:</strong> Que LAS PARTES han negociado libremente las condiciones del presente y manifiestan su voluntad de obligarse en el marco de la buena fe contractual (arts. 9, 961 y ccs. CCyCN).</p>
  <p>En virtud de lo expuesto, LAS PARTES acuerdan:</p>

  <h2 class="cl">Cláusula 1 — Datos de las partes</h2>
  <p><strong>1.1. EL CONSULTOR:</strong> ${D(d.consultorRazonSocial, 50)}, ${D(d.consultorNaturaleza, 40)}, CUIT/CUIL ${D(d.consultorCuit, 36)}, título ${D(d.responsableTitulo, 40)}, matrícula N° ${D(d.responsableMatricula, 28)} (${D(d.responsableMatriculaEmisor, 40)}${d.responsableProvinciaMatricula ? ` — ${esc(d.responsableProvinciaMatricula)}` : ''}), domicilio ${D(d.consultorDomicilio, 50)}, tel. ${D(d.consultorTelefono, 30)}, email ${D(d.consultorEmail, 45)}. Responsable técnico: ${D(d.responsableNombre, 45)}${d.responsableCuit ? `, CUIT ${esc(d.responsableCuit)}` : ''}.</p>
  <p><strong>1.2. EL CLIENTE:</strong> ${D(d.clienteRazonSocial, 50)}, CUIT ${D(d.clienteCuit, 36)}, domicilio fiscal ${D(d.clienteDomicilioFiscal, 50)}, actividad ${D(d.clienteActividad, 45)} (CIIU/AFIP ${D(d.clienteCiiu, 24)}, SRT ${D(d.clienteCodigoSrt, 20)}), ART contratada ${D(d.clienteArtNombre, 40)} (Afiliación N° ${D(d.clienteArtNumeroContrato, 28)}), referente interno ${D(d.clienteReferenteNombre, 40)} (${D(d.clienteReferenteCargo, 30)}), tel. ${D(d.clienteTelefono, 30)}, email ${D(d.clienteEmail, 45)}.</p>
  <p><strong>1.3. Establecimiento/s.</strong> El servicio se prestará respecto del/los establecimiento/s detallados en el Anexo de Establecimientos, que forma parte integrante del presente.</p>
  <p><strong>1.4. Domicilios y notificaciones.</strong> LAS PARTES constituyen domicilios especiales en los indicados, válidos para toda notificación judicial o extrajudicial, y domicilios electrónicos en las casillas consignadas, reconociendo validez a las comunicaciones cursadas por ese medio (Cláusula 9.5), sin perjuicio de la forma fehaciente que se exija para los actos que la requieran.</p>

  <h2 class="cl">Cláusula 2 — Objeto y marco normativo</h2>
  <p><strong>2.1.</strong> EL CLIENTE encomienda a EL CONSULTOR, y este acepta, la prestación del Servicio de Higiene y Seguridad en el Trabajo respecto del/los establecimiento/s del Anexo, en carácter de servicio externo (art. 35 y ccs. Decreto N° 351/79 y Resolución SRT N° 905/2015).</p>
  <p><strong>2.2. Funciones (Res. SRT 905/2015, Anexo II).</strong> EL CONSULTOR se obliga a prestar el servicio conforme a las funciones del Servicio de Higiene y Seguridad en el Trabajo establecidas en la Resolución SRT N° 905/2015, Anexo II, en lo que resulte aplicable a la actividad y dimensión del/los establecimiento/s, comprendiendo de manera enunciativa: la elaboración del Programa de Higiene y Seguridad / Programa Anual de Prevención de Riesgos y del manual de procedimientos; el relevamiento de riesgos y el Mapa de Riesgos (RGRL, nómina de expuestos y análisis por puesto); la definición de las mediciones de agentes de riesgo (sin perjuicio de la Cláusula 3.2); la especificación de los Elementos de Protección Personal (EPP) y colectiva; el plan de capacitación anual con certificación y registro; la investigación de accidentes e incidentes (árbol de causas); la señalización de seguridad; el asesoramiento en coordinación de contratistas; y la documentación y notificación fehaciente de toda su actuación, recomendaciones y observaciones.</p>
  <p><strong>2.3. Servicio de Medicina del Trabajo.</strong> Las funciones del Servicio de Medicina del Trabajo y las conjuntas previstas en el Anexo I de la Res. SRT N° 905/2015 <strong>NO</strong> integran el objeto, salvo pacto expreso, quedando a exclusivo cargo de EL CLIENTE; EL CONSULTOR coordinará con dicho servicio en lo necesario, sin asumir responsabilidad por las prestaciones médico-laborales.</p>
  <p><strong>2.4. Marco normativo.</strong> La prestación se rige por la normativa vigente, de manera no taxativa: Ley N° 19.587 y Decreto N° 351/79; Ley N° 24.557 de Riesgos del Trabajo y complementarias; Decreto N° 1.338/96; Resolución SRT N° 905/2015; demás resoluciones de la SRT y normas IRAM aplicables; Ley N° 25.326 de Protección de Datos Personales; y Ley N° 25.506 de Firma Digital. Toda referencia se entiende al texto vigente y a las normas que lo modifiquen o sustituyan.</p>

  <h2 class="cl">Cláusula 3 — Alcance y limitaciones</h2>
  <p><strong>3.1. INCLUYE:</strong> visitas periódicas al/los establecimiento/s con frecuencia ${D(d.frecuenciaVisitas, 36)}, documentadas mediante acta o informe firmado; informes técnicos de relevamiento y avance; elaboración y actualización del Programa de Higiene y Seguridad y del legajo técnico; dictado de las capacitaciones del plan anual con certificación y registro; gestión y asistencia técnica ante la ART en materia de Higiene y Seguridad; y consultas por medio digital en horario hábil, con respuesta objetivo de ${D(d.plazoRespuesta, 30)}.</p>
  <p><strong>3.2. NO INCLUYE</strong> (salvo pacto expreso y adicional, con su cotización): la provisión o financiamiento de EPP, equipos, señalética física, matafuegos o protecciones colectivas (EL CONSULTOR solo los especifica; su adquisición e instalación corresponde a EL CLIENTE); la ejecución material de obras, adecuaciones o medidas correctivas; la realización directa de mediciones de agentes de riesgo que requieran instrumental calibrado o laboratorio acreditado (ruido, iluminación, contaminantes, carga térmica, puesta a tierra, etc.), que se contratarán por separado con prestadores habilitados, limitándose EL CONSULTOR a definir protocolos, coordinar/supervisar e interpretar resultados; la representación judicial, penal o administrativa contenciosa ni el patrocinio letrado; las prestaciones del Servicio de Medicina del Trabajo y los exámenes médicos; la atención de establecimientos no detallados en el Anexo; y los trabajos fuera del plan anual acordado, que se cotizarán de manera adicional.</p>

  <h2 class="cl">Cláusula 4 — Obligaciones del consultor</h2>
  <p>EL CONSULTOR se obliga a: <strong>(4.1)</strong> realizar las visitas con la frecuencia pactada, dejando constancia documentada y firmada de cada una; <strong>(4.2)</strong> confeccionar y entregar los informes técnicos, el Programa de Higiene y Seguridad, el Mapa de Riesgos, el manual de procedimientos y demás entregables, en los plazos y formatos acordados y suscriptos por profesional habilitado; <strong>(4.3)</strong> planificar y dictar las capacitaciones del plan anual, emitiendo certificados y manteniendo registro de asistencia; <strong>(4.4)</strong> brindar asesoramiento técnico permanente y comunicar fehacientemente a EL CLIENTE los cambios normativos relevantes, las medidas de prevención a adoptar y los riesgos detectados; <strong>(4.5)</strong> prestar el servicio con la diligencia, idoneidad y ética propias de su profesión, siendo su obligación <strong>de medios</strong> y no de resultado; <strong>(4.6)</strong> mantener vigente su matrícula y habilitación durante toda la relación; <strong>(4.7)</strong> documentar su actuación con fecha, hora y firma, y entregar la documentación que deba conservarse en el establecimiento; y <strong>(4.8)</strong> guardar confidencialidad conforme a la Cláusula 7.</p>

  <h2 class="cl">Cláusula 5 — Obligaciones del cliente</h2>
  <p>EL CLIENTE se obliga a: <strong>(5.1)</strong> permitir el libre acceso a instalaciones, procesos y documentación, y proporcionar información completa, veraz y oportuna (nómina, descripción de puestos, siniestralidad, datos de la ART, etc.), de cuya veracidad y completitud depende la calidad del servicio; <strong>(5.2)</strong> designar un referente interno con facultades suficientes —${D(d.clienteReferenteNombre, 40)}, ${D(d.clienteReferenteCargo, 30)}—; <strong>(5.3)</strong> adoptar e implementar, en los plazos indicados, las medidas correctivas y preventivas recomendadas, destinando los recursos necesarios, entendiéndose que la decisión de no implementarlas, demorarlas o implementarlas parcialmente es responsabilidad exclusiva de EL CLIENTE como empleador y <strong>EXIME a EL CONSULTOR</strong> de toda responsabilidad por sus consecuencias; <strong>(5.4)</strong> notificar oportunamente todo cambio en procesos, instalaciones, dotación o actividad, y todo accidente, incidente o enfermedad profesional; <strong>(5.5)</strong> mantener vigente su afiliación a la ART y proveer el Servicio de Medicina del Trabajo y los exámenes médicos legales; y <strong>(5.6)</strong> abonar los honorarios conforme a la Cláusula 6.</p>

  <h2 class="cl">Cláusula 6 — Honorarios, plazos y vigencia</h2>
  <p><strong>6.1. Honorarios.</strong> EL CLIENTE abonará a EL CONSULTOR ${D(d.honorarios, 36)} (${D(d.honorariosEnLetras, 55)}) ${D(d.honorariosModalidad, 30)}, más IVA si correspondiere, pagaderos dentro de los ${D(d.honorariosPlazoPagoDias, 14)} días de la factura, mediante ${D(d.honorariosMedioPago, 45)}.</p>
  <p><strong>6.2. Actualización.</strong> Los honorarios se ajustarán ${D(d.actualizacionPeriodicidad, 28)} conforme a ${D(d.actualizacionIndice, 40)} o según lo que LAS PARTES acuerden por escrito.</p>
  <p><strong>6.3. Mora y suspensión.</strong> La falta de pago en término genera mora automática con interés según lo acordado. El atraso prolongado faculta a EL CONSULTOR a suspender la prestación, previa intimación fehaciente, sin responsabilidad a su cargo.</p>
  <p><strong>6.4. Vigencia y renovación.</strong> El presente entra en vigencia el ${D(d.fechaInicioVigencia, 36)}, con vigencia mínima de DOCE (12) meses, renovándose automáticamente por períodos sucesivos de DOCE (12) meses, salvo que cualquiera de LAS PARTES notifique fehacientemente su voluntad de no renovar con una antelación no menor a ${D(d.diasNoRenovacion ?? '60', 14)} días al vencimiento.</p>
  <p><strong>6.5. Terminación con causa.</strong> Cualquiera de LAS PARTES podrá rescindir ante incumplimiento grave de la otra, previa intimación fehaciente a subsanar dentro de QUINCE (15) días; vencido el plazo sin subsanación, la rescisión opera de pleno derecho, sin perjuicio de las acciones por daños.</p>
  <p><strong>6.6. Terminación sin causa.</strong> Cualquiera de LAS PARTES podrá rescindir sin causa con preaviso fehaciente de TREINTA (30) días. Si la rescisión sin causa proviene de EL CLIENTE, este abonará el período de preaviso y la totalidad de los trabajos efectivamente realizados y no facturados a la fecha, sin penalidad ni resarcimiento adicional.</p>
  <p><strong>6.7. Efectos.</strong> Producida la terminación por cualquier causa, EL CONSULTOR entregará la documentación técnica que corresponda conservar en el establecimiento, previa cancelación de los honorarios adeudados. Las obligaciones de confidencialidad (Cláusula 7) y propiedad intelectual (Cláusula 8 bis) subsisten conforme a sus propios plazos.</p>

  <h2 class="cl">Cláusula 7 — Confidencialidad y protección de datos</h2>
  <p><strong>7.1.</strong> Se considera información confidencial toda información técnica, comercial, operativa, de procesos, de personal o de siniestralidad a la que EL CONSULTOR acceda con motivo del presente, cualquiera sea su soporte. EL CONSULTOR se obliga a no divulgarla, cederla ni utilizarla para fines ajenos a la ejecución del Contrato, extendiendo esta obligación a su personal y colaboradores, y a adoptar medidas razonables para su resguardo.</p>
  <p><strong>7.2. Excepciones.</strong> No hay incumplimiento cuando la información sea de dominio público sin culpa de EL CONSULTOR, deba revelarse por orden judicial o requerimiento de autoridad competente (incluida la SRT) —limitándose a lo estrictamente requerido y notificando a EL CLIENTE cuando sea legalmente posible—, o sea autorizada por escrito por EL CLIENTE.</p>
  <p><strong>7.3. Vigencia.</strong> El deber de confidencialidad rige durante el Contrato y por los años posteriores que LAS PARTES acuerden a su finalización.</p>
  <p><strong>7.4. Datos personales (Ley N° 25.326).</strong> En cuanto EL CONSULTOR trate datos personales de trabajadores de EL CLIENTE, incluidos datos sensibles de salud (art. 2, Ley N° 25.326), lo hará en carácter de encargado del tratamiento, exclusivamente para el objeto del presente, con confidencialidad y seguridad, sin cesión a terceros no autorizados, suprimiéndolos o devolviéndolos al finalizar la relación salvo obligación legal de conservación. EL CLIENTE, como responsable de las bases, garantiza haber recabado las bases de licitud y consentimientos que correspondan. Los datos de salud reciben tratamiento reservado, accesibles solo a quienes deban conocerlos para las funciones conjuntas con el Servicio de Medicina del Trabajo.</p>

  <h2 class="cl">Cláusula 8 — Responsabilidad y seguros</h2>
  <p><strong>8.1. Obligación de medios.</strong> EL CONSULTOR se compromete a actuar con la diligencia e idoneidad técnica propias de su profesión, conforme a la normativa vigente, sin garantizar un resultado determinado.</p>
  <p><strong>8.2. Seguro de RC Profesional.</strong> EL CONSULTOR declara contar con (o se obliga a contratar y mantener vigente) un seguro de Responsabilidad Civil Profesional con suma asegurada no inferior a ${D(d.sumaAseguradaRC, 34)} (${D(d.sumaAseguradaRCEnLetras, 50)}), exhibiendo la póliza a requerimiento de EL CLIENTE.</p>
  <p><strong>8.3. Límite de responsabilidad.</strong> Salvo dolo o culpa grave, la responsabilidad total de EL CONSULTOR queda limitada al monto equivalente a los honorarios efectivamente percibidos durante los últimos DOCE (12) meses anteriores al hecho. En ningún caso responderá por daños indirectos, lucro cesante, pérdida de chance ni sanciones administrativas impuestas a EL CLIENTE por hechos que le sean imputables.</p>
  <p><strong>8.4. Exención por incumplimiento de EL CLIENTE.</strong> EL CONSULTOR <strong>no será responsable</strong> por daños, accidentes, enfermedades profesionales, sanciones o consecuencias derivadas de: la falta, demora o implementación parcial de las medidas recomendadas; la información inexacta, incompleta o falsa suministrada; la falta de provisión de EPP, recursos o medios; o el incumplimiento por EL CLIENTE de sus obligaciones legales o contractuales. Bastará que EL CONSULTOR acredite haber dejado constancia documentada y notificación fehaciente de la recomendación u observación.</p>
  <p><strong>8.5. Obligaciones de EL CLIENTE.</strong> EL CLIENTE declara mantener vigente su afiliación a la ART y los seguros legalmente exigibles, siendo de su exclusiva responsabilidad la cobertura de los riesgos del trabajo de su personal y la adopción material de las medidas de prevención.</p>

  <h2 class="cl">Cláusula 8 bis — Propiedad intelectual</h2>
  <p>Las metodologías, plantillas, matrices, software, know-how y materiales de elaboración propia de EL CONSULTOR permanecen de su exclusiva titularidad; EL CONSULTOR otorga a EL CLIENTE una licencia de uso no exclusiva, intransferible y limitada al uso interno necesario durante la vigencia del Contrato. La documentación técnica elaborada específicamente para EL CLIENTE (Programa, Mapa de Riesgos, legajo, informes, capacitaciones) podrá ser utilizada por este para sus fines propios y para su exhibición ante la autoridad de aplicación, ART y SRT, sin que ello implique cesión de la propiedad intelectual sobre las metodologías subyacentes, las que EL CLIENTE no podrá reproducir, comercializar ni ceder a terceros. Esta cláusula subsiste tras la finalización del Contrato por cualquier causa.</p>

  <h2 class="cl">Cláusula 9 — Firmas y aceptación</h2>
  <p><strong>9.1.</strong> LAS PARTES manifiestan haber leído, comprendido y aceptado la totalidad de las cláusulas y anexos, prestando su libre consentimiento.</p>
  <p><strong>9.2.</strong> El presente se firma en DOS (2) ejemplares de un mismo tenor y a un solo efecto. LAS PARTES rubricarán cada página; EL CONSULTOR estampará su sello profesional junto a su firma. Podrán, de común acuerdo, certificar las firmas ante escribano público.</p>
  <p><strong>9.3. Firma digital (Ley N° 25.506).</strong> El presente podrá suscribirse mediante firma digital o electrónica en los términos de la Ley N° 25.506, reconociéndose plena validez y eficacia probatoria. Las comunicaciones cursadas entre los domicilios electrónicos constituidos (Cláusula 1.4) se reputan válidas y eficaces.</p>
  <p><strong>9.3 bis. Plataforma Sigmetría como medio fehaciente de comunicación y registro.</strong> LAS PARTES acuerdan utilizar la plataforma <strong>Sigmetría</strong> como <strong>medio fehaciente de comunicación y registro</strong> entre ellas, reconociendo plena validez a las notificaciones, observaciones, recomendaciones, actas, informes y demás constancias asentadas en la plataforma con fecha, hora, identificación del responsable y trazabilidad. El carácter fehaciente de tales registros y comunicaciones se sustenta en el cumplimiento, por parte de la plataforma, de los estándares de gestión digital, registro y resguardo de la información establecidos por la <strong>Resolución SRT N° 48/2025</strong> y la <strong>Disposición SRT N° 15/2026</strong>. En consecuencia, las notificaciones y comunicaciones que la normativa exige cursar de manera fehaciente —en particular la notificación al empleador de las recomendaciones, medidas y observaciones de prevención prevista en la Resolución SRT N° 905/2015— podrán efectuarse válidamente a través de la plataforma, sin perjuicio de los domicilios electrónicos constituidos (Cláusula 1.4) y de la forma fehaciente adicional que cualquiera de LAS PARTES decida emplear.</p>
  <p><strong>9.4. Jurisdicción.</strong> El presente se rige por las leyes de la República Argentina; para toda controversia LAS PARTES se someten a los Tribunales Ordinarios de ${D(d.jurisdiccion, 40)}, con renuncia a cualquier otro fuero, sin perjuicio de la mediación previa obligatoria aplicable.</p>
  <p><strong>9.5. Integración.</strong> Forma parte integrante del presente el Anexo de Establecimientos y, en su caso, el anexo técnico de plan de visitas y entregables que LAS PARTES acuerden.</p>
  <p>En prueba de conformidad, previa lectura y ratificación, LAS PARTES firman en el lugar y fecha indicados en la comparecencia.</p>

  <table class="firmas">
    <tr>
      <td>
        <div class="firma-linea"></div>
        <div class="firma-rol">POR EL CONSULTOR</div>
        <div class="firma-pie">Firma y sello profesional</div>
        <div class="firma-campo">Nombre: ${D(d.responsableNombre, 40)}</div>
        <div class="firma-campo">DNI: ${D(d.responsableDni, 28)}</div>
        <div class="firma-campo">Carácter: ${D(d.responsableCaracter, 32)}</div>
        <div class="firma-campo">Matrícula N°: ${D(d.responsableMatricula, 28)}</div>
      </td>
      <td>
        <div class="firma-linea"></div>
        <div class="firma-rol">POR EL CLIENTE</div>
        <div class="firma-pie">Firma</div>
        <div class="firma-campo">Nombre: ${D(d.clienteRepresentante, 40)}</div>
        <div class="firma-campo">DNI: ${D(d.clienteRepresentanteDni, 28)}</div>
        <div class="firma-campo">Carácter: ${D(d.clienteRepresentanteCaracter, 32)}</div>
        <div class="firma-campo">&nbsp;</div>
      </td>
    </tr>
  </table>

  ${anexoEstablecimientos(d)}

  <p class="pie-modelo">Modelo provisto por Sigmetría — documento orientativo. Adaptar al caso concreto y validar con asesor legal antes de la firma.</p>
  `

  return `<!DOCTYPE html><html lang="es-AR"><head><meta charset="UTF-8">
<style>
  @page { size: A4 portrait; margin: 18mm 16mm 16mm; }
  * { box-sizing: border-box; }
  body {
    font-family: 'Georgia', 'Times New Roman', serif;
    color: #1f2430;
    font-size: 9.5pt;
    line-height: 1.5;
    text-align: justify;
  }
  .hdr {
    display: flex; justify-content: space-between; align-items: center;
    border-bottom: 2px solid ${cMarca}; padding-bottom: 6px; margin-bottom: 10px;
  }
  .hdr-marca { display: flex; align-items: center; }
  .hdr-marca .logo { max-height: 16mm; max-width: 60mm; object-fit: contain; }
  .hdr-marca .marca-txt {
    font-family: 'Helvetica', Arial, sans-serif; font-weight: 700;
    font-size: 14pt; color: #1b2b1b; letter-spacing: .3px;
  }
  .hdr-meta { text-align: right; font-family: 'Helvetica', Arial, sans-serif; }
  .hdr-doc { font-size: 8pt; color: ${cMarca}; font-weight: 700; text-transform: uppercase; letter-spacing: .6px; }
  .hdr-fecha { font-size: 7.5pt; color: #8a8f99; margin-top: 2px; }
  .titulo {
    font-family: 'Helvetica', Arial, sans-serif; font-size: 13.5pt; font-weight: 700;
    text-align: center; color: #16331a; margin: 4mm 0 3mm; line-height: 1.25; text-transform: uppercase;
    letter-spacing: .3px;
  }
  .aviso {
    font-family: 'Helvetica', Arial, sans-serif; font-size: 7.8pt; line-height: 1.45;
    background: #FFF8E1; border: 1px solid #F0D98C; border-left: 4px solid #C99A00;
    color: #6b5400; padding: 7px 10px; border-radius: 4px; margin: 0 0 5mm; text-align: left;
  }
  .sub {
    font-family: 'Helvetica', Arial, sans-serif; font-size: 10pt; font-weight: 700;
    color: #16331a; text-align: center; text-transform: uppercase; letter-spacing: 1px;
    margin: 5mm 0 2mm;
  }
  h2.cl {
    font-family: 'Helvetica', Arial, sans-serif; font-size: 10.5pt; font-weight: 700;
    color: ${cMarca}; border-bottom: 1px solid #D6E2D6; padding-bottom: 3px;
    margin: 5mm 0 2mm; break-after: avoid; page-break-after: avoid;
  }
  p { margin: 0 0 2.4mm; orphans: 2; widows: 2; }
  strong { color: #16331a; }
  .dato {
    font-family: 'Helvetica', Arial, sans-serif; font-weight: 700; color: #16331a;
  }
  .blank {
    display: inline-block; border-bottom: 1px solid #6b7280; height: 1em;
    vertical-align: baseline; margin: 0 1px;
  }
  /* Firmas */
  .firmas { width: 100%; margin: 8mm 0 4mm; border-collapse: collapse; break-inside: avoid; page-break-inside: avoid; }
  .firmas td { width: 50%; vertical-align: top; padding: 0 6mm; font-family: 'Helvetica', Arial, sans-serif; font-size: 8.5pt; text-align: left; }
  .firma-linea { border-top: 1px solid #1f2430; margin: 14mm 0 4px; }
  .firma-rol { font-weight: 700; color: #16331a; }
  .firma-pie { font-size: 7.5pt; color: #8a8f99; margin-bottom: 4px; }
  .firma-campo { margin-top: 2px; }
  /* Anexo */
  .anexo { break-before: page; page-break-before: always; }
  .anx-t {
    font-family: 'Helvetica', Arial, sans-serif; font-size: 11pt; font-weight: 700;
    color: ${cMarca}; border-bottom: 1px solid #D6E2D6; padding-bottom: 3px; margin: 0 0 2mm;
  }
  .anx-p { font-family: 'Helvetica', Arial, sans-serif; font-size: 8.2pt; color: #4b5563; margin-bottom: 4mm; text-align: left; }
  .anx-tabla { width: 100%; border-collapse: collapse; font-family: 'Helvetica', Arial, sans-serif; font-size: 8pt; }
  .anx-tabla th, .anx-tabla td { border: 1px solid #C8D2C8; padding: 4px 5px; text-align: left; vertical-align: top; }
  .anx-tabla th { background: #EAF2EA; color: #16331a; font-weight: 700; }
  .anx-tabla .idx { width: 8mm; text-align: center; }
  .anx-tabla .num { width: 18mm; text-align: center; }
  .pie-modelo {
    font-family: 'Helvetica', Arial, sans-serif; font-size: 7pt; color: #9aa0aa;
    text-align: center; margin-top: 8mm; border-top: 1px solid #E4E8E4; padding-top: 4px;
  }
</style></head>
<body>${cuerpo}</body></html>`
}
