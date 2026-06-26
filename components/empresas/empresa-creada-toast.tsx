'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { toast } from '@/lib/hooks/use-toast'

/**
 * Dispara UNA sola vez un toast celebratorio cuando la lista de empresas se
 * carga con ?success=empresa_created (lo setea createEmpresa al redirigir).
 * Luego limpia el query param de la URL para que no se re-dispare al refrescar
 * o navegar. No renderiza nada.
 */
export function EmpresaCreadaToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const yaDisparado = useRef(false)

  useEffect(() => {
    if (yaDisparado.current) return
    if (searchParams.get('success') !== 'empresa_created') return

    yaDisparado.current = true
    toast.success('🎉 ¡Sumaste un cliente a tu cartera! En Sigmetría nos alegra verte crecer.')

    // Limpiamos el param preservando el resto de la query (ej. ?section=...).
    const params = new URLSearchParams(searchParams.toString())
    params.delete('success')
    const query = params.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [searchParams, router, pathname])

  return null
}
