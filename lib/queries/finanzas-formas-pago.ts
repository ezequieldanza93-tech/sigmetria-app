import 'server-only'
import { createClient } from '@/lib/supabase/server'

/**
 * Formas de pago del módulo Finanzas (presupuestos/cotizaciones y comprobantes).
 *
 * Catálogo híbrido (mismo patrón que fin_categorias): las genéricas de Sigmetría
 * viven con consultora_id NULL y las comparten todas las consultoras; cada
 * consultora puede sumar las suyas propias.
 *
 * Espejo de la tabla `public.fin_formas_pago` (migración 20260801000003).
 */
export interface FinFormaPago {
  id: string
  /** NULL = forma de pago genérica de Sigmetría (compartida por todas las consultoras). */
  consultora_id: string | null
  nombre: string
  orden: number
  is_active: boolean
}

/**
 * Lista las formas de pago disponibles para una consultora: las genéricas
 * (consultora_id NULL) + las propias de la consultora. Solo activas, ordenadas
 * por `orden` y luego por nombre.
 */
export async function listarFormasPago(consultoraId: string): Promise<FinFormaPago[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('fin_formas_pago')
    .select('id, consultora_id, nombre, orden, is_active')
    .eq('is_active', true)
    .or(`consultora_id.is.null,consultora_id.eq.${consultoraId}`)
    .order('orden', { ascending: true })
    .order('nombre', { ascending: true })

  return (data ?? []) as unknown as FinFormaPago[]
}
