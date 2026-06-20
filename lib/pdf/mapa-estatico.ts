/**
 * mapa-estatico.ts — Genera un MAPA ESTÁTICO (data URL PNG) pegando tiles oficiales
 * de OpenStreetMap (tile.openstreetmap.org), la MISMA fuente confiable que usan los
 * mapas Leaflet de la app (components/iperc/mapa-general.tsx, empresa-mapa-establecimientos).
 *
 * Por qué NO usamos staticmap.openstreetmap.de: es un servicio comunitario de terceros
 * poco confiable que suele bloquear IPs de datacenter (Vercel) → el mapa nunca salía.
 *
 * Estrategia: calcular el tile central para (lat, lon) a un zoom dado, bajar la grilla
 * de tiles que cubre el recorte deseado, componerla con sharp, recortar centrado y
 * dibujar un pin en el centro. Best-effort: si falla, devuelve undefined (la carátula
 * tiene fallback sin mapa).
 */

import sharp from 'sharp'

const TILE = 256
/** User-Agent identificable (requerido por la política de uso de tiles de OSM). */
const UA = 'SigmetriaHyS/1.0 (+https://hys-app-sig.vercel.app; protocolos HyS)'

/** Pin rojo estilo marcador (la punta queda en el centro del recorte). */
const PIN = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="40" viewBox="0 0 30 40">
    <path d="M15 0C7 0 0 6.5 0 15c0 10 15 25 15 25s15-15 15-25C30 6.5 23 0 15 0z" fill="#D7263D" stroke="#fff" stroke-width="2"/>
    <circle cx="15" cy="15" r="5.5" fill="#fff"/>
  </svg>`,
)

/** Convierte (lon, lat, zoom) a coordenadas de tile FRACCIONARIAS (Web Mercator). */
function lonLatToTile(lon: number, lat: number, zoom: number): { x: number; y: number } {
  const n = 2 ** zoom
  const x = ((lon + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const y = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  return { x, y }
}

/** Baja un tile PNG de OSM. Devuelve null si falla o no es imagen. */
async function fetchTile(zoom: number, x: number, y: number): Promise<Buffer | null> {
  const sub = ['a', 'b', 'c'][Math.abs(x + y) % 3]
  const url = `https://${sub}.tile.openstreetmap.org/${zoom}/${x}/${y}.png`
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 7000)
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': UA } })
    if (!res.ok) return null
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.startsWith('image')) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  } finally {
    clearTimeout(timeout)
  }
}

export interface MapaEstaticoOpts {
  zoom?: number
  width?: number
  height?: number
}

/**
 * Genera un mapa estático centrado en (lat, lon) como data URL PNG.
 * @returns data URL, o undefined si no se pudo (lat/lon inválidos, tiles caídos, etc.).
 */
export async function generarMapaEstaticoDataUrl(
  lat: number,
  lon: number,
  opts: MapaEstaticoOpts = {},
): Promise<string | undefined> {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return undefined
  const zoom = opts.zoom ?? 16
  const W = opts.width ?? 600
  const H = opts.height ?? 460
  const n = 2 ** zoom

  try {
    const center = lonLatToTile(lon, lat, zoom)
    const cx = center.x * TILE // pixel mundo del centro
    const cy = center.y * TILE
    const left = cx - W / 2 // borde del recorte en pixeles mundo
    const top = cy - H / 2

    const tx0 = Math.floor(left / TILE)
    const tx1 = Math.floor((left + W - 1) / TILE)
    const ty0 = Math.floor(top / TILE)
    const ty1 = Math.floor((top + H - 1) / TILE)
    const cols = tx1 - tx0 + 1
    const rows = ty1 - ty0 + 1

    // Bajar todos los tiles de la grilla en paralelo.
    const jobs: Array<Promise<{ buf: Buffer | null; gx: number; gy: number }>> = []
    for (let ty = ty0; ty <= ty1; ty++) {
      if (ty < 0 || ty >= n) continue // fuera de rango vertical (polos)
      for (let tx = tx0; tx <= tx1; tx++) {
        const wx = ((tx % n) + n) % n // wrap horizontal
        jobs.push(fetchTile(zoom, wx, ty).then(buf => ({ buf, gx: tx - tx0, gy: ty - ty0 })))
      }
    }
    const tiles = await Promise.all(jobs)
    const overlays = tiles
      .filter((t): t is { buf: Buffer; gx: number; gy: number } => t.buf !== null)
      .map(t => ({ input: t.buf, top: t.gy * TILE, left: t.gx * TILE }))

    if (overlays.length === 0) return undefined // todos los tiles fallaron

    // Componer la grilla, recortar centrado y pegar el pin.
    const grid = await sharp({
      create: { width: cols * TILE, height: rows * TILE, channels: 4, background: { r: 233, g: 233, b: 233, alpha: 1 } },
    })
      .composite(overlays)
      .png()
      .toBuffer()

    const offsetX = Math.round(left - tx0 * TILE)
    const offsetY = Math.round(top - ty0 * TILE)

    const out = await sharp(grid)
      .extract({ left: offsetX, top: offsetY, width: W, height: H })
      .composite([{ input: PIN, top: Math.round(H / 2 - 40), left: Math.round(W / 2 - 15) }])
      .png()
      .toBuffer()

    return `data:image/png;base64,${out.toString('base64')}`
  } catch (err) {
    console.error('[MAPA-ESTATICO] no se pudo generar el mapa:', err instanceof Error ? err.message : String(err))
    return undefined
  }
}
