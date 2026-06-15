'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { ActionResult } from '@/lib/types'

// Clasificación N:N producto ↔ categoría (tabla producto_categoria_map).
// La RLS de producto_categoria_map garantiza permisos (base → developer; propios → members).

/** IDs de categorías asignadas a un producto (multi). */
export async function getProductoCategorias(
  productoId: string,
): Promise<ActionResult<string[]>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('producto_categoria_map')
    .select('categoria_id')
    .eq('producto_id', productoId)
  if (error) return { success: false, error: error.message }
  return { success: true, data: (data ?? []).map(r => r.categoria_id as string) }
}

/**
 * Reemplaza el set de categorías de un producto (borra + inserta).
 * La primera del array queda como principal y se sincroniza productos.categoria_id
 * (compat con el card y el form). Set vacío deja al producto sin categoría.
 */
export async function setProductoCategorias(
  productoId: string,
  categoriaIds: string[],
): Promise<ActionResult<null>> {
  const supabase = await createClient()

  const { error: delErr } = await supabase
    .from('producto_categoria_map')
    .delete()
    .eq('producto_id', productoId)
  if (delErr) return { success: false, error: delErr.message }

  const ids = [...new Set(categoriaIds)].filter(Boolean)
  if (ids.length > 0) {
    const rows = ids.map((cid, i) => ({
      producto_id: productoId,
      categoria_id: cid,
      es_principal: i === 0,
    }))
    const { error: insErr } = await supabase.from('producto_categoria_map').insert(rows)
    if (insErr) return { success: false, error: insErr.message }

    // Sincronizar la principal en productos (para el card / form).
    await supabase.from('productos').update({ categoria_id: ids[0] }).eq('id', productoId)
  }

  revalidatePath('/dashboard/productos')
  return { success: true, data: null }
}
