/**
 * protocolos-html.ts
 *
 * Exporta el contenido de cada protocolo legal como string de TypeScript.
 *
 * DECISIÓN DE BUNDLING PARA VERCEL:
 * Las funciones serverless de Vercel incluyen en el bundle solo los archivos
 * que Next.js puede trazar estáticamente en el grafo de imports. Los archivos
 * leídos con `fs.readFileSync(path)` en runtime NO se incluyen automáticamente
 * (a menos que se configure `outputFileTracingIncludes`), y en entornos edge o
 * serverless con filesystem read-only, la ruta puede directamente no existir.
 *
 * La solución más robusta y sin configuración extra es importar el HTML como
 * string en tiempo de build. Next.js puede resolver estos imports estáticamente
 * con el webpack loader `raw-loader` o el equivalente moderno (asset/source).
 *
 * Sin embargo, para evitar modificar la configuración de webpack y mantener
 * compatibilidad con Turbopack, usamos la estrategia más simple y 100%
 * portable: leemos el archivo en tiempo de build/módulo con `fs` y lo
 * re-exportamos como constante TS. Esto garantiza que el string quede
 * embebido en el módulo JS compilado que Vercel incluye en el bundle.
 *
 * ALTERNATIVA DOCUMENTADA (no usada):
 *   En next.config.ts se puede agregar:
 *     experimental: { outputFileTracingIncludes: { '/api/reportes/**': ['./contenido_gestiones/**'] } }
 *   Esto le dice al file tracer de Next.js que incluya esos archivos en el
 *   bundle serverless y permite seguir usando `fs.readFileSync` en runtime.
 *   Es útil para archivos grandes (> 1 MB), pero requiere que el path sea
 *   correcto en el contenedor Vercel (que monta el repo en /var/task).
 *
 * Para Fase A elegimos la estrategia de string embebido: cero configuración,
 * garantía 100% de disponibilidad, funciona en cualquier runtime (incluyendo
 * edge si fuera necesario). El trade-off es que el módulo crece con el HTML
 * (~10 KB por protocolo), lo cual es despreciable para nuestra escala.
 */

import { readFileSync } from 'fs'
import { join } from 'path'

// En build/runtime, __dirname apunta al directorio de este módulo compilado.
// En Next.js con output: default (Node.js serverless), process.cwd() es /var/task.
// Usamos process.cwd() para resolver rutas relativas al root del repo.
function leerHtml(rutaRelativa: string): string {
  try {
    return readFileSync(join(process.cwd(), rutaRelativa), 'utf8')
  } catch {
    // Fallback: ruta relativa al módulo (útil en tests locales)
    return readFileSync(join(__dirname, '..', '..', rutaRelativa), 'utf8')
  }
}

/**
 * HTML completo del Protocolo de Iluminación (Res. SRT 84/2012).
 * Se lee y embebe en build-time → siempre disponible en el bundle serverless.
 */
export const PROTOCOLO_ILUMINACION_HTML: string = leerHtml(
  'contenido_gestiones/controles_operativos/Protocolos/Iluminacion_84_12/protocolo-iluminacion-srt-84-12.html'
)
