/**
 * embed-protocolos.mjs — Genera lib/pdf/protocolos-html.ts embebiendo el HTML
 * legal de cada protocolo como string literal de TypeScript.
 *
 * POR QUÉ EXISTE:
 *   En Vercel, las funciones serverless solo incluyen en el bundle lo que Next.js
 *   puede trazar estáticamente en el grafo de imports. Un `fs.readFileSync(path)`
 *   en runtime apunta a /var/task/<archivo>, que NO está en el bundle → ENOENT →
 *   el módulo explota al cargarse y se cae TODA la ruta (no solo el PDF).
 *
 *   La solución robusta es embeber el HTML como string literal: queda dentro del
 *   JS compilado, disponible siempre, en cualquier runtime, sin configuración.
 *
 * USO:
 *   node scripts/embed-protocolos.mjs
 *   (correr tras crear o modificar cualquier HTML legal de la lista de abajo)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()

// Protocolos a embeber: export → HTML legal. Sumá acá los próximos (ruido, PAT, etc.).
const PROTOCOLOS = [
  {
    exportName: 'PROTOCOLO_ILUMINACION_HTML',
    descripcion: 'Protocolo de Iluminación (Res. SRT 84/2012)',
    ruta: 'contenido_gestiones/controles_operativos/Protocolos/Iluminacion_84_12/protocolo-iluminacion-srt-84-12.html',
  },
  {
    exportName: 'PROTOCOLO_RUIDO_HTML',
    descripcion: 'Protocolo de Ruido (Res. SRT 85/2012)',
    ruta: 'contenido_gestiones/controles_operativos/Protocolos/ruido_85_12/protocolo-ruido-srt-85-12.html',
  },
  {
    exportName: 'PROTOCOLO_PAT_HTML',
    descripcion: 'Protocolo de Puesta a Tierra (Res. SRT 900/2015)',
    ruta: 'contenido_gestiones/controles_operativos/Protocolos/PAT_900_15/PAT_900_15.html',
  },
  {
    exportName: 'PROTOCOLO_CARGA_TERMICA_HTML',
    descripcion: 'Protocolo de Estrés Térmico por Calor (Res. SRT 30/2023)',
    ruta: 'contenido_gestiones/controles_operativos/Protocolos/estres_por_calor30_23/protocolo-estres-calor-completo.html',
  },
  {
    exportName: 'PROTOCOLO_ERGONOMIA_HTML',
    descripcion: 'Protocolo de Ergonomía (Res. SRT 886/2015)',
    ruta: 'contenido_gestiones/controles_operativos/Protocolos/ergonomia_886_15/protocolo-ergonomia-srt-886-15.html',
  },
]

const cuerpos = PROTOCOLOS.map(({ exportName, descripcion, ruta }) => {
  const html = readFileSync(join(ROOT, ruta), 'utf8')
  return `/** ${descripcion}. Fuente: ${ruta} */\nexport const ${exportName}: string = ${JSON.stringify(html)}\n`
})

const header = `/* eslint-disable */
/**
 * protocolos-html.ts — AUTO-GENERADO por scripts/embed-protocolos.mjs. NO EDITAR A MANO.
 *
 * El HTML legal de cada protocolo se embebe como string literal en tiempo de BUILD
 * (corriendo el script), NO con fs.readFileSync en runtime. Esto evita el ENOENT
 * que rompe las funciones serverless de Vercel cuando el archivo no está en el bundle.
 *
 * Para regenerar tras cambiar un HTML legal:  node scripts/embed-protocolos.mjs
 */

`

writeFileSync(join(ROOT, 'lib/pdf/protocolos-html.ts'), header + cuerpos.join('\n'), 'utf8')
console.log('OK — protocolos-html.ts regenerado:', PROTOCOLOS.map((p) => p.exportName).join(', '))
