'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useGeoCaptura } from '@/lib/hooks/use-geo-captura'
import { descargarProtocoloPdf } from '@/lib/pdf/protocolo-pdf'
import {
  crearCalculoCargaFuego,
  getMaterialesPci,
  getResistenciaYExtintor,
  getSectoresYPuestos,
  type MaterialPci,
  type ResistenciaYExtintor,
  type SectorConPuestos,
} from '@/lib/actions/calculo-carga-fuego'
import {
  coefEquiv,
  equivMadera,
  cargaFuego,
  franjaQf,
  type FranjaQf,
  type MaterialCarga,
} from '@/lib/calculo-carga-fuego/calculos'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import {
  Flame, Building2, Layers, FileText, Plus, Trash2,
  ChevronLeft, ChevronRight, CheckCircle, Loader2,
  Info, ArrowRight, Check, Sparkles, Camera, ShieldCheck, Gauge, Download,
} from 'lucide-react'

// ── Props ────────────────────────────────────────────────────────────
interface CalculoCargaFuegoEjecutorModalProps {
  establecimientoId: string
  registroId: string
  rgFechaPlanificada: string
  gestionEstablecimientoId?: string
  onClose: () => void
  onSuccess: () => void
}

// ── Modelo de estado del wizard ───────────────────────────────────────

type Ventilacion = 'natural' | 'mecanica'
type Riesgo = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7'
const RIESGOS: Riesgo[] = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7']

interface MaterialState {
  key: number
  descripcion: string
  /** id de dec351_materiales_pci elegido, o '' si carga manual. */
  material_pci_id: string
  estado: string
  peso_kg: string
  /** PCI en kcal/kg (autocompletado del lookup o manual). */
  pci_kcal: string
  /** Coeficiente C (autocompletado de pci_kcal/4400 o del lookup, o manual). */
  coef_c: string
}

type WizardStep = 'datos' | 'materiales' | 'resultado' | 'observaciones' | 'conclusiones' | 'revisar' | 'listo'

const STEP_ORDER: WizardStep[] = ['datos', 'materiales', 'resultado', 'observaciones', 'conclusiones', 'revisar']
const STEP_LABELS: Record<WizardStep, string> = {
  datos: 'Datos',
  materiales: 'Materiales',
  resultado: 'Resultado',
  observaciones: 'Observaciones',
  conclusiones: 'Conclusiones',
  revisar: 'Revisar',
  listo: 'Listo',
}

// ── Contexto read-only del establecimiento / empresa ──────────────────
interface EstablecimientoCtx {
  nombre: string
  domicilio: string | null
  codigo_postal: string | null
  localidad: string | null
  provincia: string | null
  empresa_razon_social: string | null
  empresa_cuit: string | null
  empresa_domicilio: string | null
}

// ── Datos consolidados para el PDF oficial (3 hojas Dec 351/79 Anexo VII) ──
interface PdfFilaMaterial {
  n: number
  descripcion: string
  estado: string
  pesoKg: number | null
  pciKcal: number | null
  coefC: number | null
  equivMaderaKg: number
}

interface ProtocoloPdfData {
  razonSocial: string | null
  cuit: string | null
  establecimiento: string | null
  domicilio: string | null
  localidad: string | null
  provincia: string | null
  sectorIncendio: string | null
  superficie: number | null
  ventilacion: Ventilacion
  observacionesGenerales: string | null
  firmante: string | null
  filasMateriales: PdfFilaMaterial[]
  totalEquiv: number
  qf: number | null
  franja: FranjaQf | null
  riesgo: Riesgo | ''
  fExigido: string | null
  potencialA: string | null
  potencialB: string | null
  conclusiones: string | null
  recomendaciones: string | null
}

// ── Observaciones de seguimiento (replicado del reporte fotográfico) ───
interface CategoriaObs {
  id: string
  nombre: string
  nivel: number
  color: string
}

interface ObsDraft {
  key: number
  descripcion: string
  categoria_id: string
  clasificacion_id: string
  responsable_id: string
  fecha_subsanacion: string
  foto_preview: string | null
  foto_file: File | null
}

let obsKeySeq = 0

let materialKeySeq = 0
function nuevoMaterial(): MaterialState {
  return {
    key: materialKeySeq++,
    descripcion: '',
    material_pci_id: '',
    estado: '',
    peso_kg: '',
    pci_kcal: '',
    coef_c: '',
  }
}

// Helpers de parseo numérico tolerante (campos de texto → number | null).
function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Equivalente en madera (kg) de un material del estado del wizard. */
function equivDe(m: MaterialState): number {
  const peso = num(m.peso_kg) ?? 0
  const c = num(m.coef_c) ?? 0
  return equivMadera(peso, c)
}

export function CalculoCargaFuegoEjecutorModal({
  establecimientoId,
  registroId,
  rgFechaPlanificada,
  gestionEstablecimientoId,
  onClose,
  onSuccess,
}: CalculoCargaFuegoEjecutorModalProps) {
  const [step, setStep] = useState<WizardStep>('datos')
  const { capturarUbicacion } = useGeoCaptura()
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [descargandoPdf, setDescargandoPdf] = useState(false)

  // Refs a las 3 hojas ocultas del protocolo oficial (DATOS / MATERIALES / RESULTADO).
  // Se renderizan fuera de pantalla y se rasterizan al descargar el PDF.
  const hojaDatosRef = useRef<HTMLDivElement>(null)
  const hojaMaterialesRef = useRef<HTMLDivElement>(null)
  const hojaResultadoRef = useRef<HTMLDivElement>(null)

  // ── Catálogos ───────────────────────────────────────────────────────
  const [estCtx, setEstCtx] = useState<EstablecimientoCtx | null>(null)
  const [sectores, setSectores] = useState<SectorConPuestos[]>([])
  const [materialesPci, setMaterialesPci] = useState<MaterialPci[]>([])
  const [lookups, setLookups] = useState<ResistenciaYExtintor | null>(null)

  // ── Hoja 1: datos ───────────────────────────────────────────────────
  const [firmante, setFirmante] = useState('')
  const [sectorIncendio, setSectorIncendio] = useState('')
  const [superficie, setSuperficie] = useState('')
  const [ventilacion, setVentilacion] = useState<Ventilacion>('natural')
  const [observacionesGenerales, setObservacionesGenerales] = useState('')
  const [certificadoFile, setCertificadoFile] = useState<File | null>(null)
  const [planoFile, setPlanoFile] = useState<File | null>(null)

  // ── Hoja 2: materiales ──────────────────────────────────────────────
  const [materiales, setMateriales] = useState<MaterialState[]>([nuevoMaterial()])

  // ── Hoja 3: resultado ───────────────────────────────────────────────
  const [riesgo, setRiesgo] = useState<Riesgo | ''>('')

  // ── Hoja 5: conclusiones ────────────────────────────────────────────
  const [conclusiones, setConclusiones] = useState('')
  const [recomendaciones, setRecomendaciones] = useState('')

  // ── Hoja 4: observaciones de seguimiento ────────────────────────────
  const [observacionesSeguimiento, setObservacionesSeguimiento] = useState<ObsDraft[]>([])
  const [categoriasObs, setCategoriasObs] = useState<CategoriaObs[]>([])
  const [clasificacionesObs, setClasificacionesObs] = useState<{ id: string; nombre: string }[]>([])
  const [personasObs, setPersonasObs] = useState<{ id: string; nombre: string; apellido: string }[]>([])

  const inputCls = 'w-full border border-border-default rounded-lg px-3 py-2 text-sm bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500'
  const labelCls = 'text-sm font-medium text-text-secondary block mb-1'

  // ── Carga de catálogos ──────────────────────────────────────────────
  useEffect(() => {
    let activo = true
    const supabase = createClient()

    supabase
      .from('establecimientos')
      .select('nombre, domicilio, codigo_postal, localidades!localidad_id(nombre, provincia), empresas!inner(razon_social, cuit, domicilio)')
      .eq('id', establecimientoId)
      .maybeSingle()
      .then(({ data }) => {
        if (!activo || !data) return
        const loc = data.localidades as { nombre: string | null; provincia: string | null } | { nombre: string | null; provincia: string | null }[] | null
        const locRow = Array.isArray(loc) ? loc[0] : loc
        const emp = data.empresas as { razon_social: string | null; cuit: string | null; domicilio: string | null } | { razon_social: string | null; cuit: string | null; domicilio: string | null }[] | null
        const empRow = Array.isArray(emp) ? emp[0] : emp
        setEstCtx({
          nombre: (data.nombre as string) ?? '',
          domicilio: (data.domicilio as string | null) ?? null,
          codigo_postal: (data.codigo_postal as string | null) ?? null,
          localidad: locRow?.nombre ?? null,
          provincia: locRow?.provincia ?? null,
          empresa_razon_social: empRow?.razon_social ?? null,
          empresa_cuit: empRow?.cuit ?? null,
          empresa_domicilio: empRow?.domicilio ?? null,
        })
      })

    getSectoresYPuestos(establecimientoId).then(r => { if (activo && r.success) setSectores(r.data) })
    getMaterialesPci().then(r => { if (activo && r.success) setMaterialesPci(r.data) })
    getResistenciaYExtintor().then(r => { if (activo && r.success) setLookups(r.data) })

    // Catálogos de las observaciones de seguimiento (mismas queries que el reporte
    // fotográfico / iluminación: categorías, clasificaciones y personas del estab.).
    supabase
      .from('personas_establecimientos')
      .select('personas_directorio!persona_id(id, nombre, apellido)')
      .eq('establecimiento_id', establecimientoId)
      .then(({ data }) => {
        if (!activo) return
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const ps = ((data ?? []) as any[])
          .map(pe => pe.personas_directorio)
          .filter(Boolean)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .sort((a: any, b: any) => a.apellido.localeCompare(b.apellido))
        setPersonasObs(ps)
      })
    supabase
      .from('observaciones_clasificaciones')
      .select('id, nombre')
      .eq('is_active', true)
      .order('nombre')
      .then(({ data }) => { if (activo) setClasificacionesObs((data ?? []) as { id: string; nombre: string }[]) })
    supabase
      .from('observaciones_categorias')
      .select('id, nombre, nivel, color')
      .eq('is_active', true)
      .order('nivel')
      .then(({ data }) => { if (activo) setCategoriasObs((data ?? []) as CategoriaObs[]) })

    return () => { activo = false }
  }, [establecimientoId])

  // ── Mutadores de materiales ─────────────────────────────────────────
  function updateMaterial(key: number, patch: Partial<MaterialState>) {
    setMateriales(prev => prev.map(m => (m.key === key ? { ...m, ...patch } : m)))
  }

  // Al elegir un material del lookup: autocompleta descripción, PCI y coeficiente C.
  // El técnico puede pisar cualquiera de esos campos a mano después.
  function elegirMaterialPci(key: number, pciId: string) {
    if (!pciId) {
      updateMaterial(key, { material_pci_id: '' })
      return
    }
    const m = materialesPci.find(x => x.id === pciId)
    if (!m) { updateMaterial(key, { material_pci_id: pciId }); return }
    updateMaterial(key, {
      material_pci_id: pciId,
      descripcion: m.material,
      pci_kcal: m.pci_kcal != null ? String(m.pci_kcal) : '',
      coef_c: m.coef_c != null ? String(m.coef_c) : (m.pci_kcal != null ? coefEquiv(m.pci_kcal).toFixed(2) : ''),
    })
  }

  // Si el técnico edita el PCI a mano, recalculamos el coeficiente C en vivo.
  function updatePci(key: number, pciStr: string) {
    const pci = num(pciStr)
    updateMaterial(key, {
      pci_kcal: pciStr,
      coef_c: pci != null ? coefEquiv(pci).toFixed(2) : '',
    })
  }

  function addMaterial() {
    setMateriales(prev => [...prev, nuevoMaterial()])
  }

  function removeMaterial(key: number) {
    setMateriales(prev => {
      if (prev.length === 1) return prev // siempre queda al menos uno
      return prev.filter(m => m.key !== key)
    })
  }

  // ── Mutadores de observaciones de seguimiento ───────────────────────
  function addObs() {
    setObservacionesSeguimiento(prev => [...prev, {
      key: obsKeySeq++,
      descripcion: '',
      categoria_id: '',
      clasificacion_id: '',
      responsable_id: '',
      fecha_subsanacion: '',
      foto_preview: null,
      foto_file: null,
    }])
  }

  function removeObs(key: number) {
    setObservacionesSeguimiento(prev => {
      const obj = prev.find(o => o.key === key)
      if (obj?.foto_preview) URL.revokeObjectURL(obj.foto_preview)
      return prev.filter(o => o.key !== key)
    })
  }

  function updateObs(key: number, field: keyof Omit<ObsDraft, 'key' | 'foto_preview' | 'foto_file'>, value: string) {
    setObservacionesSeguimiento(prev => prev.map(o => o.key === key ? { ...o, [field]: value } : o))
  }

  function updateObsFoto(key: number, file: File | null) {
    setObservacionesSeguimiento(prev => prev.map(o => {
      if (o.key !== key) return o
      if (o.foto_preview) URL.revokeObjectURL(o.foto_preview)
      return { ...o, foto_file: file, foto_preview: file ? URL.createObjectURL(file) : null }
    }))
  }

  // ── Resultados derivados (en vivo) ──────────────────────────────────
  const superficieNum = num(superficie)

  const materialesCarga: MaterialCarga[] = useMemo(
    () => materiales.map(m => ({ peso: num(m.peso_kg) ?? 0, c: num(m.coef_c) ?? 0 })),
    [materiales]
  )

  const totalEquiv = useMemo(
    () => materiales.reduce((acc, m) => acc + equivDe(m), 0),
    [materiales]
  )

  // Qf = Σ(peso·C) / S. Si no hay superficie válida, queda null (no se puede calcular).
  const qf = useMemo(() => {
    if (superficieNum == null || superficieNum <= 0) return null
    return cargaFuego(materialesCarga, superficieNum)
  }, [materialesCarga, superficieNum])

  const franja: FranjaQf | null = qf != null ? franjaQf(qf) : null

  // Cruce de lookups: F exigido (resistencia) + potencial extintor A/B según
  // ventilación + riesgo + franja. R6/R7 no figuran en los cuadros 2.2 (solo R1-R5):
  // para esos riesgos no hay match y se muestra "—".
  const fExigido = useMemo(() => {
    if (!lookups || !riesgo || !franja) return null
    const row = lookups.resistencia.find(r => r.ventilacion === ventilacion && r.riesgo === riesgo && r.franja === franja)
    return row?.f_minutos ?? null
  }, [lookups, ventilacion, riesgo, franja])

  const potencialA = useMemo(() => {
    if (!lookups || !riesgo || !franja) return null
    const row = lookups.extintor.find(r => r.clase === 'A' && r.riesgo === riesgo && r.franja === franja)
    return row?.potencial ?? null
  }, [lookups, riesgo, franja])

  const potencialB = useMemo(() => {
    if (!lookups || !riesgo || !franja) return null
    const row = lookups.extintor.find(r => r.clase === 'B' && r.riesgo === riesgo && r.franja === franja)
    return row?.potencial ?? null
  }, [lookups, riesgo, franja])

  // ── Gamificación: checks por hoja ───────────────────────────────────
  interface Check { id: string; label: string; done: boolean }
  const checks: Check[] = useMemo(() => {
    const algunMaterialConDatos = materiales.some(m => num(m.peso_kg) != null && num(m.coef_c) != null)
    return [
      { id: 'firmante', label: 'Cargá el profesional firmante', done: !!firmante.trim() },
      { id: 'sector', label: 'Indicá el sector de incendio', done: !!sectorIncendio.trim() },
      { id: 'superficie', label: 'Cargá la superficie del sector (m²)', done: superficieNum != null && superficieNum > 0 },
      { id: 'materiales', label: 'Cargá al menos un material con peso y coef. C', done: algunMaterialConDatos },
      { id: 'qf', label: 'Calculá la carga de fuego (Qf)', done: qf != null && totalEquiv > 0 },
      { id: 'riesgo', label: 'Definí el nivel de riesgo (R1-R7)', done: !!riesgo },
      { id: 'conclusiones', label: 'Redactá las conclusiones', done: !!conclusiones.trim() },
      { id: 'recomendaciones', label: 'Redactá las recomendaciones', done: !!recomendaciones.trim() },
    ]
  }, [firmante, sectorIncendio, superficieNum, materiales, qf, totalEquiv, riesgo, conclusiones, recomendaciones])

  const doneCount = checks.filter(c => c.done).length
  const totalChecks = checks.length || 1
  const pct = Math.round((doneCount / totalChecks) * 100)
  const proximoPaso = checks.find(c => !c.done)
  const level = levelFromPercent(pct)

  // ── Navegación ──────────────────────────────────────────────────────
  function goNext() {
    setError(null)
    if (step === 'datos') {
      if (!firmante.trim()) { setError('Cargá el profesional firmante del cálculo.'); return }
      if (sectores.length === 0) { setError('Primero creá sectores en la ficha del establecimiento: el sector de incendio se elige de esa lista.'); return }
      if (!sectorIncendio.trim()) { setError('Elegí el sector de incendio analizado.'); return }
      if (!sectores.some(s => s.nombre === sectorIncendio)) { setError('El sector de incendio elegido no existe en el establecimiento. Elegí uno de la lista.'); return }
      if (superficieNum == null || superficieNum <= 0) { setError('Cargá la superficie del sector (m²).'); return }
      setStep('materiales')
    } else if (step === 'materiales') {
      const algunoConDatos = materiales.some(m => num(m.peso_kg) != null && num(m.coef_c) != null)
      if (!algunoConDatos) { setError('Cargá al menos un material con su peso y coeficiente C.'); return }
      setStep('resultado')
    } else if (step === 'resultado') {
      if (!riesgo) { setError('Definí el nivel de riesgo del sector (R1-R7).'); return }
      setStep('observaciones')
    } else if (step === 'observaciones') {
      const obsSinCat = observacionesSeguimiento.filter(o => o.descripcion.trim() && !o.categoria_id)
      if (obsSinCat.length > 0) { setError('Toda observación de seguimiento requiere una categoría.'); return }
      setStep('conclusiones')
    } else if (step === 'conclusiones') {
      setStep('revisar')
    }
  }

  function goBack() {
    setError(null)
    const idx = STEP_ORDER.indexOf(step)
    if (idx > 0) setStep(STEP_ORDER[idx - 1])
  }

  // ── Guardar ─────────────────────────────────────────────────────────
  async function handleGuardar() {
    setError(null)

    const obsSinCat = observacionesSeguimiento.filter(o => o.descripcion.trim() && !o.categoria_id)
    if (obsSinCat.length > 0) {
      setError('Toda observación de seguimiento requiere una categoría.')
      setStep('observaciones')
      return
    }

    setSaving(true)
    try {
      const fd = new FormData()
      fd.set('registro_id', registroId)
      fd.set('rg_fecha_planificada', rgFechaPlanificada)
      fd.set('establecimiento_id', establecimientoId)
      if (gestionEstablecimientoId) fd.set('gestion_establecimiento_id', gestionEstablecimientoId)
      fd.set('firmante', firmante)
      fd.set('sector_incendio', sectorIncendio)
      if (superficieNum != null) fd.set('superficie_m2', String(superficieNum))
      fd.set('ventilacion', ventilacion)
      if (riesgo) fd.set('riesgo', riesgo)
      if (qf != null) fd.set('qf_kg_m2', String(qf))
      if (fExigido) fd.set('f_exigido', fExigido)
      if (potencialA) fd.set('potencial_extintor_a', potencialA)
      if (potencialB) fd.set('potencial_extintor_b', potencialB)
      fd.set('observaciones', observacionesGenerales)
      fd.set('conclusiones', conclusiones)
      fd.set('recomendaciones', recomendaciones)
      if (certificadoFile) fd.set('certificado', certificadoFile)
      if (planoFile) fd.set('plano', planoFile)

      // Geo-sello: capturamos la ubicación del dispositivo justo antes de cerrar la
      // gestión. NO bloquea: si falla, se envía igual con el geo_estado correspondiente.
      const geo = await capturarUbicacion()
      fd.set('geo_lat', geo.lat != null ? String(geo.lat) : '')
      fd.set('geo_lng', geo.lng != null ? String(geo.lng) : '')
      fd.set('geo_accuracy', geo.accuracy != null ? String(geo.accuracy) : '')
      fd.set('geo_estado', geo.estado)

      // Materiales → contrato del server action. Solo los que tienen algún dato real.
      const materialesPayload = materiales
        .filter(m => m.descripcion.trim() || num(m.peso_kg) != null)
        .map((m, idx) => ({
          descripcion: m.descripcion.trim() || null,
          estado: m.estado || null,
          peso_kg: num(m.peso_kg),
          pci_kcal: num(m.pci_kcal),
          coef_c: num(m.coef_c),
          equiv_madera_kg: equivDe(m),
          orden: idx,
        }))
      fd.set('materiales', JSON.stringify(materialesPayload))

      // Observaciones de seguimiento → mismo contrato que iluminación / reporte
      // fotográfico: meta como JSON y fotos como `obs-foto-{idx}` File.
      const validObs = observacionesSeguimiento.filter(o => o.descripcion.trim())
      if (validObs.length > 0) {
        const obsMeta = validObs.map((o, idx) => {
          if (o.foto_file) fd.set(`obs-foto-${idx}`, o.foto_file)
          return {
            descripcion: o.descripcion,
            categoria_id: o.categoria_id,
            clasificacion_id: o.clasificacion_id,
            responsable_id: o.responsable_id,
            fecha_subsanacion: o.fecha_subsanacion,
            tiene_foto: !!o.foto_file,
          }
        })
        fd.set('observaciones_seguimiento', JSON.stringify(obsMeta))
      }

      const result = await crearCalculoCargaFuego(fd)
      if (!result.success) { setError(result.error); setSaving(false); return }

      setStep('listo')
      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado al guardar el cálculo')
    } finally {
      setSaving(false)
    }
  }

  const stepIdx = STEP_ORDER.indexOf(step)
  const materialesValidos = materiales.filter(m => m.descripcion.trim() || num(m.peso_kg) != null)

  // ── Datos consolidados para el PDF oficial ─────────────────────────
  // Se arma con los datos en memoria del wizard. Qf / franja / F / extintores
  // salen de los derivados que ya usan lib/calculo-carga-fuego/calculos.
  const pdfData: ProtocoloPdfData = useMemo(() => {
    const filasMateriales: PdfFilaMaterial[] = materialesValidos.map((m, i) => ({
      n: i + 1,
      descripcion: m.descripcion.trim() || 'Material',
      estado: m.estado || '',
      pesoKg: num(m.peso_kg),
      pciKcal: num(m.pci_kcal),
      coefC: num(m.coef_c),
      equivMaderaKg: equivDe(m),
    }))
    return {
      razonSocial: estCtx?.empresa_razon_social ?? null,
      cuit: estCtx?.empresa_cuit ?? null,
      establecimiento: estCtx?.nombre ?? null,
      domicilio: estCtx?.domicilio ?? estCtx?.empresa_domicilio ?? null,
      localidad: estCtx?.localidad ?? null,
      provincia: estCtx?.provincia ?? null,
      sectorIncendio: sectorIncendio || null,
      superficie: superficieNum,
      ventilacion,
      observacionesGenerales: observacionesGenerales || null,
      firmante: firmante || null,
      filasMateriales,
      totalEquiv,
      qf,
      franja,
      riesgo,
      fExigido,
      potencialA,
      potencialB,
      conclusiones: conclusiones || null,
      recomendaciones: recomendaciones || null,
    }
  }, [
    materialesValidos, estCtx, sectorIncendio, superficieNum, ventilacion,
    observacionesGenerales, firmante, totalEquiv, qf, franja, riesgo,
    fExigido, potencialA, potencialB, conclusiones, recomendaciones,
  ])

  // ── Descargar PDF oficial (3 hojas Dec 351/79 Anexo VII) ───────────
  // Genera el protocolo client-side a partir de los datos en memoria, sin tocar
  // storage (v1): rasteriza las 3 hojas ocultas y arma un A4 multipágina.
  async function handleDescargarPdf() {
    const hojas = [hojaDatosRef.current, hojaMaterialesRef.current, hojaResultadoRef.current]
      .filter((h): h is HTMLDivElement => h != null)
    if (hojas.length === 0) return
    setDescargandoPdf(true)
    setError(null)
    try {
      const nombre = `carga-de-fuego-${rgFechaPlanificada || new Date().toISOString().slice(0, 10)}.pdf`
      await descargarProtocoloPdf({ hojas }, nombre)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el PDF.')
    } finally {
      setDescargandoPdf(false)
    }
  }

  // ── Render: post-guardado ───────────────────────────────────────────
  if (step === 'listo') {
    return (
      <Modal open title="Cálculo de carga de fuego guardado" onClose={onClose} size="full">
        <div className="space-y-5 py-2">
          <div className="text-center py-4">
            <div className="w-14 h-14 bg-success-bg rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={28} className="text-success" />
            </div>
            <h3 className="font-semibold text-text-primary text-base">Cálculo registrado</h3>
            <p className="text-sm text-text-secondary mt-1">
              {materialesValidos.length} {materialesValidos.length === 1 ? 'material' : 'materiales'}
              {qf != null && <> · Qf {qf.toFixed(1)} kg/m² · franja {franja}</>}
            </p>
          </div>
          {error && (
            <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
          )}
          <div className="flex flex-col sm:flex-row flex-wrap gap-2 sm:gap-3 justify-center pt-2">
            <Button type="button" onClick={handleDescargarPdf} disabled={descargandoPdf}>
              {descargandoPdf ? (
                <><Loader2 size={14} className="inline mr-1.5 animate-spin" /> Generando…</>
              ) : (
                <><Download size={14} className="inline mr-1.5" /> Descargar PDF</>
              )}
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>Cerrar</Button>
          </div>
        </div>

        {/* Hojas ocultas del PDF oficial (se rasterizan al descargar). */}
        <ProtocoloCargaFuegoHojas
          data={pdfData}
          hojaDatosRef={hojaDatosRef}
          hojaMaterialesRef={hojaMaterialesRef}
          hojaResultadoRef={hojaResultadoRef}
        />
      </Modal>
    )
  }

  return (
    <Modal open title="Cálculo de Carga de Fuego (Dec 351/79 Anexo VII)" onClose={onClose} size="full">
      <div className="space-y-4 max-h-[86vh] overflow-y-auto pr-1">
        {/* ── Gamificación: anillo de progreso sticky ──────────────── */}
        <div className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 bg-surface-base/90 backdrop-blur-md border-b border-border-subtle">
          <div className="flex items-center gap-4">
            <ProgressRing pct={pct} level={level} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-wider ${level.color}`}>{level.label}</span>
                <span className="text-xs text-text-tertiary">·</span>
                <span className="text-xs text-text-tertiary tabular-nums">{doneCount}/{totalChecks} campos clave</span>
              </div>
              {proximoPaso ? (
                <div className="flex items-center gap-1.5 mt-0.5 text-sm text-text-primary truncate">
                  <ArrowRight size={13} className="text-sig-500 shrink-0" />
                  <span className="text-text-tertiary">Próximo paso:</span>
                  <span className="font-medium truncate">{proximoPaso.label}</span>
                </div>
              ) : (
                <p className="mt-0.5 text-sm text-success font-medium flex items-center gap-1.5">
                  <Sparkles size={14} /> Cálculo completo. Revisá y guardá.
                </p>
              )}
            </div>
          </div>

          {/* Stepper */}
          <div className="flex items-center gap-1.5 text-xs mt-3 flex-wrap">
            {STEP_ORDER.map((s, i) => (
              <div key={s} className="flex items-center gap-1.5">
                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] font-semibold ${
                  i === stepIdx ? 'bg-sig-500 text-white' : i < stepIdx ? 'bg-success text-white' : 'bg-surface-sunken text-text-tertiary'
                }`}>
                  {i < stepIdx ? <Check size={12} /> : i + 1}
                </span>
                <span className={i === stepIdx ? 'font-semibold text-text-primary' : 'text-text-tertiary'}>
                  {STEP_LABELS[s]}
                </span>
                {i < STEP_ORDER.length - 1 && <ChevronRight size={12} className="text-text-tertiary" />}
              </div>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-danger-bg border border-red-200 text-danger text-sm rounded-lg px-3 py-2">{error}</div>
        )}

        {/* ══ HOJA 1: DATOS ═══════════════════════════════════════════ */}
        {step === 'datos' && (
          <div className="space-y-5">
            {/* Contexto read-only del establecimiento / empresa */}
            <section className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2 mb-3">
                <Building2 size={16} className="text-sig-500" /> Establecimiento y empresa
                <span className="text-xs font-normal text-text-tertiary">(datos reusados, solo lectura)</span>
              </h3>
              {estCtx ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">
                  <ReadOnly label="Razón social" value={estCtx.empresa_razon_social} />
                  <ReadOnly label="CUIT" value={estCtx.empresa_cuit} />
                  <ReadOnly label="Establecimiento" value={estCtx.nombre} />
                  <ReadOnly label="Domicilio" value={estCtx.domicilio ?? estCtx.empresa_domicilio} />
                  <ReadOnly label="Localidad" value={estCtx.localidad} />
                  <ReadOnly label="Provincia" value={estCtx.provincia} />
                </div>
              ) : (
                <p className="text-xs text-text-tertiary flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Cargando datos…</p>
              )}
            </section>

            {/* Datos del sector + responsable */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Flame size={16} className="text-sig-500" /> Sector de incendio y responsable
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Profesional firmante (nombre y matrícula) <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className={inputCls}
                    value={firmante}
                    onChange={e => setFirmante(e.target.value)}
                    placeholder="Ing. Juan Pérez — Mat. 1234"
                  />
                </div>
                <div>
                  <label className={labelCls}>Sector de incendio <span className="text-danger">*</span></label>
                  {sectores.length > 0 ? (
                    <select
                      className={inputCls}
                      value={sectorIncendio}
                      onChange={e => setSectorIncendio(e.target.value)}
                    >
                      <option value="">Elegí un sector…</option>
                      {sectores.map(s => (
                        <option key={s.id} value={s.nombre}>{s.nombre}</option>
                      ))}
                    </select>
                  ) : (
                    <div className="rounded-lg border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs text-amber-700 flex items-start gap-1.5">
                      <Info size={14} className="shrink-0 mt-0.5" />
                      <span>Primero creá sectores en la ficha del establecimiento. El sector de incendio se elige de esa lista.</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className={labelCls}>Superficie del sector (m²) <span className="text-danger">*</span></label>
                  <input
                    type="number"
                    className={inputCls}
                    value={superficie}
                    onChange={e => setSuperficie(e.target.value)}
                    placeholder="Ej: 200"
                  />
                </div>
                <div>
                  <label className={labelCls}>Ventilación</label>
                  <div className="flex gap-3 pt-1">
                    {(['natural', 'mecanica'] as Ventilacion[]).map(v => (
                      <label
                        key={v}
                        className={`flex-1 flex items-center justify-center gap-2 text-sm rounded-lg border px-3 py-2 cursor-pointer ${ventilacion === v ? 'border-sig-500 bg-sig-50/40 text-text-primary' : 'border-border-default text-text-secondary'}`}
                      >
                        <input type="radio" name="ventilacion" checked={ventilacion === v} onChange={() => setVentilacion(v)} />
                        {v === 'natural' ? 'Natural' : 'Mecánica'}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            {/* Adjuntos + observaciones generales */}
            <section className="space-y-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <FileText size={16} className="text-sig-500" /> Adjuntos
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Memoria de cálculo / certificado (archivo)</label>
                  <input type="file" className={inputCls} accept=".pdf,image/*" onChange={e => setCertificadoFile(e.target.files?.[0] ?? null)} />
                </div>
                <div>
                  <label className={labelCls}>Plano / croquis del sector</label>
                  <input type="file" className={inputCls} accept=".pdf,image/*" onChange={e => setPlanoFile(e.target.files?.[0] ?? null)} />
                </div>
              </div>
              <div>
                <label className={labelCls}>Observaciones generales</label>
                <textarea className={`${inputCls} resize-none`} rows={2} value={observacionesGenerales} onChange={e => setObservacionesGenerales(e.target.value)} placeholder="Observaciones generales del cálculo…" />
              </div>
            </section>
          </div>
        )}

        {/* ══ HOJA 2: MATERIALES ═════════════════════════════════════ */}
        {step === 'materiales' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Layers size={16} className="text-sig-500" /> Inventario de materiales combustibles
              </h3>
              <p className="text-xs text-text-tertiary mt-1">
                Por cada material: peso y poder calorífico. El coeficiente C (= PCI / 4400) y el
                equivalente en madera (peso · C) se calculan solos. Elegí un material de la tabla del
                Anexo VII para autocompletar el PCI, o cargalo a mano.
              </p>
            </div>

            <div className="space-y-2">
              {materiales.map((m, idx) => {
                const equiv = equivDe(m)
                return (
                  <div key={m.key} className="border border-border-subtle rounded-lg p-3 space-y-3 bg-surface-elevated/30">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-text-secondary">Material {idx + 1}</span>
                      {materiales.length > 1 && (
                        <button type="button" onClick={() => removeMaterial(m.key)} className="text-text-tertiary hover:text-danger inline-flex items-center gap-1 text-xs">
                          <Trash2 size={14} /> Quitar
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Material (tabla Anexo VII)</label>
                        <select
                          className={`${inputCls} text-sm`}
                          value={m.material_pci_id}
                          onChange={e => elegirMaterialPci(m.key, e.target.value)}
                        >
                          <option value="">Carga manual…</option>
                          {materialesPci.map(mp => (
                            <option key={mp.id} value={mp.id}>
                              {mp.categoria ? `${mp.categoria} · ` : ''}{mp.material}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Descripción</label>
                        <input
                          type="text"
                          className={`${inputCls} text-sm`}
                          value={m.descripcion}
                          onChange={e => updateMaterial(m.key, { descripcion: e.target.value })}
                          placeholder="Descripción del material"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Peso (kg)</label>
                        <input type="number" className={`${inputCls} text-sm`} value={m.peso_kg} onChange={e => updateMaterial(m.key, { peso_kg: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">PCI (kcal/kg)</label>
                        <input type="number" className={`${inputCls} text-sm`} value={m.pci_kcal} onChange={e => updatePci(m.key, e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Coef. C</label>
                        <input type="number" className={`${inputCls} text-sm`} value={m.coef_c} onChange={e => updateMaterial(m.key, { coef_c: e.target.value })} placeholder="PCI / 4400" />
                      </div>
                      <div>
                        <p className="text-xs text-text-tertiary mb-0.5">Equiv. madera</p>
                        <div className="rounded-lg border border-border-subtle bg-surface-elevated/60 px-3 py-2 text-sm tabular-nums">
                          {equiv > 0 ? `${equiv.toFixed(1)} kg` : <span className="text-text-tertiary">—</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              onClick={addMaterial}
              className="inline-flex items-center gap-1 rounded-lg border border-dashed border-sig-400 text-sig-600 px-3 py-1.5 text-sm hover:bg-sig-50/40"
            >
              <Plus size={14} /> Agregar material
            </button>

            {/* Total + Qf en vivo */}
            <section className="rounded-xl border border-sig-300 bg-sig-50/40 p-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                <Metric label="Total equiv. madera" value={`${totalEquiv.toFixed(1)} kg`} />
                <Metric label={`Superficie (S)`} value={superficieNum != null && superficieNum > 0 ? `${superficieNum} m²` : '—'} />
                <div className="rounded-lg border border-sig-400 bg-surface-base px-3 py-2">
                  <p className="text-xs text-text-tertiary">Carga de fuego (Qf = Σequiv / S)</p>
                  <p className="font-bold text-sig-700 tabular-nums text-lg">
                    {qf != null ? `${qf.toFixed(1)} kg/m²` : '—'}
                    {franja && <span className="ml-2 text-xs font-semibold text-sig-600">franja {franja}</span>}
                  </p>
                </div>
              </div>
              {qf == null && (
                <p className="text-xs text-amber-600 flex items-center gap-1.5 mt-2">
                  <Info size={13} /> Cargá la superficie del sector en la hoja Datos para calcular el Qf.
                </p>
              )}
            </section>
          </div>
        )}

        {/* ══ HOJA 3: RESULTADO ══════════════════════════════════════ */}
        {step === 'resultado' && (
          <div className="space-y-5">
            <section className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Gauge size={16} className="text-sig-500" /> Carga de fuego calculada
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Metric label="Total equiv. madera" value={`${totalEquiv.toFixed(1)} kg`} />
                <Metric label="Qf" value={qf != null ? `${qf.toFixed(1)} kg/m²` : '—'} />
                <Metric label="Franja de carga" value={franja ?? '—'} />
              </div>
            </section>

            {/* Selección de riesgo */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                Nivel de riesgo del sector <span className="text-danger">*</span>
                <span
                  className="inline-flex items-center text-text-tertiary cursor-help"
                  title="Riesgo del sector según el material/actividad (Dec 351/79): R1 explosivos, R2 inflamables, R3 muy combustibles, R4 combustibles, R5 poco combustibles, R6 incombustibles, R7 refractarios."
                >
                  <Info size={14} />
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {RIESGOS.map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRiesgo(r)}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                      riesgo === r ? 'border-sig-500 bg-sig-50/40 text-text-primary font-medium' : 'border-border-default text-text-secondary hover:bg-surface-elevated'
                    }`}
                  >
                    {riesgo === r && <Check size={13} className="text-sig-600" />}
                    {r}
                  </button>
                ))}
              </div>
            </section>

            {/* Resultados del cruce de lookups en vivo */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-lg border border-border-subtle bg-surface-elevated/40 px-3 py-3">
                <p className="text-xs text-text-tertiary flex items-center gap-1.5"><ShieldCheck size={13} className="text-sig-500" /> Resistencia al fuego exigida (F)</p>
                <p className="font-semibold text-text-primary tabular-nums mt-1">{fExigido ?? '—'}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5">Ventilación {ventilacion === 'natural' ? 'natural' : 'mecánica'}</p>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-elevated/40 px-3 py-3">
                <p className="text-xs text-text-tertiary">Potencial extintor — Clase A</p>
                <p className="font-semibold text-text-primary tabular-nums mt-1">{potencialA ?? '—'}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5">Sólidos combustibles</p>
              </div>
              <div className="rounded-lg border border-border-subtle bg-surface-elevated/40 px-3 py-3">
                <p className="text-xs text-text-tertiary">Potencial extintor — Clase B</p>
                <p className="font-semibold text-text-primary tabular-nums mt-1">{potencialB ?? '—'}</p>
                <p className="text-[11px] text-text-tertiary mt-0.5">Líquidos / gases inflamables</p>
              </div>
            </section>

            {(!riesgo || !franja) && (
              <p className="text-xs text-amber-600 flex items-center gap-1.5">
                <Info size={13} /> Elegí el riesgo y asegurate de tener Qf calculado para ver la exigencia de F y extintores.
              </p>
            )}
            {riesgo && (riesgo === 'R6' || riesgo === 'R7') && (
              <p className="text-xs text-text-tertiary flex items-center gap-1.5">
                <Info size={13} /> R6/R7 no figuran en los Cuadros 2.2 de resistencia/extintor (solo R1-R5): la exigencia se evalúa por criterio profesional.
              </p>
            )}
          </div>
        )}

        {/* ══ HOJA 4: OBSERVACIONES DE SEGUIMIENTO ═══════════════════ */}
        {step === 'observaciones' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                <Camera size={16} className="text-sig-500" /> Observaciones de seguimiento
                <span className="text-xs font-normal text-text-tertiary">(opcional)</span>
              </h3>
              <p className="text-xs text-text-tertiary mt-1">
                Findings del relevamiento. Cada observación entra al plan de Seguimiento con su
                responsable, fecha de subsanación y foto.
              </p>
            </div>

            <div className="flex items-center justify-between">
              <h4 className="text-sm font-semibold text-text-secondary">
                Observaciones
                {observacionesSeguimiento.length > 0 && (
                  <span className="ml-2 text-xs font-normal text-text-tertiary">({observacionesSeguimiento.length})</span>
                )}
              </h4>
              <button
                type="button"
                onClick={addObs}
                className="text-xs text-sig-600 hover:text-sig-700 font-medium inline-flex items-center gap-1"
              >
                <Plus size={14} /> Agregar
              </button>
            </div>

            {observacionesSeguimiento.length === 0 ? (
              <p className="text-xs text-text-tertiary text-center py-4 border border-dashed border-border-subtle rounded-lg">
                Sin observaciones de seguimiento. Hacé clic en &quot;+ Agregar&quot; para registrar un finding.
              </p>
            ) : (
              <div className="space-y-2">
                {observacionesSeguimiento.map((obs, idx) => (
                  <div key={obs.key} className="border border-border-subtle rounded-lg p-3 space-y-2 bg-surface-elevated/30">
                    <div className="flex items-start gap-2">
                      <span className="text-xs text-text-tertiary mt-2 w-4 shrink-0">{idx + 1}.</span>
                      <textarea
                        value={obs.descripcion}
                        onChange={e => updateObs(obs.key, 'descripcion', e.target.value)}
                        placeholder="Descripción de la observación…"
                        rows={2}
                        className="flex-1 border border-border-default rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-sig-500"
                      />
                      <button
                        type="button"
                        onClick={() => removeObs(obs.key)}
                        className="text-text-tertiary hover:text-danger mt-1 shrink-0"
                        title="Eliminar observación"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 pl-6">
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">
                          Categoría <span className="text-danger">*</span>
                        </label>
                        <select
                          value={obs.categoria_id}
                          onChange={e => updateObs(obs.key, 'categoria_id', e.target.value)}
                          className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                          style={obs.categoria_id ? { backgroundColor: categoriasObs.find(c => c.id === obs.categoria_id)?.color, color: '#000' } : {}}
                        >
                          <option value="">Seleccionar…</option>
                          {categoriasObs.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Tipo de riesgo</label>
                        <select
                          value={obs.clasificacion_id}
                          onChange={e => updateObs(obs.key, 'clasificacion_id', e.target.value)}
                          className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                        >
                          <option value="">Sin clasificar</option>
                          {clasificacionesObs.map(c => (
                            <option key={c.id} value={c.id}>{c.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Responsable</label>
                        <select
                          value={obs.responsable_id}
                          onChange={e => updateObs(obs.key, 'responsable_id', e.target.value)}
                          className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs bg-surface-base focus:outline-none focus:ring-2 focus:ring-sig-500"
                        >
                          <option value="">Sin asignar</option>
                          {personasObs.map(p => (
                            <option key={p.id} value={p.id}>{p.apellido}, {p.nombre}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-text-secondary block mb-0.5">Fecha subsanación</label>
                        <input
                          type="date"
                          value={obs.fecha_subsanacion}
                          onChange={e => updateObs(obs.key, 'fecha_subsanacion', e.target.value)}
                          className="w-full border border-border-default rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sig-500"
                        />
                      </div>
                    </div>

                    {/* Foto de la observación (adjuntar / tomar, con preview) */}
                    <div className="pl-6">
                      {!obs.foto_preview ? (
                        <label className="inline-flex items-center gap-1.5 text-xs text-text-tertiary hover:text-sig-600 cursor-pointer transition-colors">
                          <Camera size={13} />
                          Adjuntar / sacar foto
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const f = e.target.files?.[0]
                              if (!f) return
                              updateObsFoto(obs.key, f)
                            }}
                          />
                        </label>
                      ) : (
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={obs.foto_preview} alt="Foto observación" className="w-14 h-14 object-cover rounded-lg border border-border-subtle" />
                          <button
                            type="button"
                            onClick={() => updateObsFoto(obs.key, null)}
                            className="text-xs text-red-400 hover:text-danger"
                          >
                            Eliminar foto
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ══ HOJA 5: CONCLUSIONES ═══════════════════════════════════ */}
        {step === 'conclusiones' && (
          <div className="space-y-5">
            <section className="rounded-xl border border-border-subtle bg-surface-elevated/40 p-4">
              <h3 className="text-sm font-semibold text-text-primary mb-3">Resumen del cálculo</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                <Metric label="Qf" value={qf != null ? `${qf.toFixed(1)} kg/m²` : '—'} />
                <Metric label="Franja" value={franja ?? '—'} />
                <Metric label="Riesgo" value={riesgo || '—'} />
                <Metric label="F exigido" value={fExigido ?? '—'} />
              </div>
              <p className="text-xs text-text-tertiary mt-3">Usá este resumen para redactar las conclusiones y las recomendaciones.</p>
            </section>

            <div>
              <label className={labelCls}>Conclusiones</label>
              <textarea className={`${inputCls} resize-y`} rows={5} value={conclusiones} onChange={e => setConclusiones(e.target.value)} placeholder="Conclusiones del cálculo de carga de fuego…" />
            </div>
            <div>
              <label className={labelCls}>Recomendaciones</label>
              <textarea className={`${inputCls} resize-y`} rows={5} value={recomendaciones} onChange={e => setRecomendaciones(e.target.value)} placeholder="Recomendaciones (medios de extinción, resistencia estructural, etc.)…" />
            </div>
          </div>
        )}

        {/* ══ REVISAR Y GUARDAR ══════════════════════════════════════ */}
        {step === 'revisar' && (
          <div className="space-y-5">
            <p className="text-sm text-text-secondary">Revisá el cálculo antes de guardarlo.</p>

            {/* Resumen datos */}
            <ReviewSection title="Datos del sector">
              <ReviewGrid>
                <ReadOnly label="Empresa" value={estCtx?.empresa_razon_social} />
                <ReadOnly label="Establecimiento" value={estCtx?.nombre} />
                <ReadOnly label="Profesional firmante" value={firmante} />
                <ReadOnly label="Sector de incendio" value={sectorIncendio} />
                <ReadOnly label="Superficie" value={superficieNum != null ? `${superficieNum} m²` : null} />
                <ReadOnly label="Ventilación" value={ventilacion === 'natural' ? 'Natural' : 'Mecánica'} />
              </ReviewGrid>
              <div className="flex gap-3 mt-2 text-xs text-text-tertiary">
                <span>{certificadoFile ? '✓ Memoria/certificado adjunto' : 'Sin memoria adjunta'}</span>
                <span>{planoFile ? '✓ Plano adjunto' : 'Sin plano adjunto'}</span>
              </div>
            </ReviewSection>

            {/* Resumen materiales */}
            <ReviewSection title={`Materiales (${materialesValidos.length})`}>
              <div className="space-y-2">
                {materialesValidos.map((m, i) => {
                  const equiv = equivDe(m)
                  return (
                    <div key={m.key} className="rounded-lg border border-border-subtle px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                      <span className="font-medium text-text-primary">{i + 1}. {m.descripcion || 'Material'}</span>
                      <span className="text-text-tertiary tabular-nums">{num(m.peso_kg) ?? 0} kg</span>
                      <span className="text-text-tertiary tabular-nums">C {num(m.coef_c) ?? 0}</span>
                      <span className="text-text-tertiary tabular-nums">equiv {equiv.toFixed(1)} kg</span>
                    </div>
                  )
                })}
              </div>
            </ReviewSection>

            {/* Resumen resultado */}
            <ReviewSection title="Resultado">
              <ReviewGrid>
                <ReadOnly label="Total equiv. madera" value={`${totalEquiv.toFixed(1)} kg`} />
                <ReadOnly label="Carga de fuego (Qf)" value={qf != null ? `${qf.toFixed(1)} kg/m²` : null} />
                <ReadOnly label="Franja" value={franja} />
                <ReadOnly label="Riesgo" value={riesgo || null} />
                <ReadOnly label="F exigido" value={fExigido} />
                <ReadOnly label="Potencial extintor A / B" value={[potencialA, potencialB].filter(Boolean).join(' / ') || null} />
              </ReviewGrid>
            </ReviewSection>

            {/* Resumen conclusiones */}
            <ReviewSection title="Conclusiones y recomendaciones">
              <ReadOnly label="Conclusiones" value={conclusiones} block />
              <ReadOnly label="Recomendaciones" value={recomendaciones} block />
            </ReviewSection>

            {/* Resumen observaciones de seguimiento */}
            {observacionesSeguimiento.filter(o => o.descripcion.trim()).length > 0 && (
              <ReviewSection title={`Observaciones de seguimiento (${observacionesSeguimiento.filter(o => o.descripcion.trim()).length})`}>
                <div className="space-y-2">
                  {observacionesSeguimiento.filter(o => o.descripcion.trim()).map((o, i) => {
                    const cat = categoriasObs.find(c => c.id === o.categoria_id)
                    const resp = personasObs.find(p => p.id === o.responsable_id)
                    return (
                      <div key={o.key} className="rounded-lg border border-border-subtle px-3 py-2 text-sm flex flex-wrap items-center gap-x-4 gap-y-1">
                        <span className="font-medium text-text-primary">{i + 1}.</span>
                        <span className="text-text-secondary flex-1 min-w-[12rem]">{o.descripcion}</span>
                        {cat && <span className="text-xs rounded px-2 py-0.5" style={{ backgroundColor: cat.color, color: '#000' }}>{cat.nombre}</span>}
                        {resp && <span className="text-text-tertiary text-xs">{resp.apellido}, {resp.nombre}</span>}
                        {o.fecha_subsanacion && <span className="text-text-tertiary text-xs tabular-nums">Subsana {o.fecha_subsanacion}</span>}
                        {o.foto_file && <span className="text-text-tertiary text-xs inline-flex items-center gap-1"><Camera size={12} /> Foto</span>}
                      </div>
                    )
                  })}
                </div>
              </ReviewSection>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 pt-3 pb-1 sticky bottom-0 bg-surface-base border-t border-border-subtle">
          {step !== 'datos' && (
            <Button type="button" variant="secondary" onClick={goBack} disabled={saving}>
              <ChevronLeft size={14} /> Atrás
            </Button>
          )}
          {step !== 'revisar' ? (
            <Button type="button" onClick={goNext}>
              Continuar <ChevronRight size={14} />
            </Button>
          ) : (
            <>
              <Button type="button" onClick={handleGuardar} disabled={saving || descargandoPdf}>
                {saving ? <><Loader2 size={14} className="animate-spin" /> Guardando…</> : 'Guardar cálculo'}
              </Button>
              <Button type="button" variant="secondary" onClick={handleDescargarPdf} disabled={saving || descargandoPdf}>
                {descargandoPdf ? (
                  <><Loader2 size={14} className="animate-spin" /> Generando…</>
                ) : (
                  <><Download size={14} /> Descargar PDF</>
                )}
              </Button>
            </>
          )}
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>Cancelar</Button>
        </div>

        {/* Hojas ocultas del PDF oficial (se rasterizan al descargar). */}
        <ProtocoloCargaFuegoHojas
          data={pdfData}
          hojaDatosRef={hojaDatosRef}
          hojaMaterialesRef={hojaMaterialesRef}
          hojaResultadoRef={hojaResultadoRef}
        />
      </div>
    </Modal>
  )
}

// ── Subcomponentes de presentación ─────────────────────────────────────

function ReadOnly({ label, value, block }: { label: string; value: string | null | undefined; block?: boolean }) {
  return (
    <div className={block ? 'mb-2' : ''}>
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className={`text-text-primary ${block ? 'whitespace-pre-wrap text-sm' : 'font-medium'}`}>{value || <span className="text-text-tertiary font-normal">—</span>}</p>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface-elevated/60 px-3 py-2">
      <p className="text-xs text-text-tertiary">{label}</p>
      <p className="font-semibold text-text-primary tabular-nums">{value}</p>
    </div>
  )
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle p-4">
      <h3 className="text-sm font-semibold text-text-primary mb-3">{title}</h3>
      {children}
    </section>
  )
}

function ReviewGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-2 text-sm">{children}</div>
}

// ── Anillo de progreso (gamificación) ──────────────────────────────────

interface Level { label: string; color: string; ring: string; track: string }
function levelFromPercent(pct: number): Level {
  if (pct >= 100) return { label: 'Completo', color: 'text-success', ring: 'stroke-success', track: 'stroke-success/15' }
  if (pct >= 90) return { label: 'Casi completo', color: 'text-sig-700', ring: 'stroke-sig-700', track: 'stroke-sig-700/15' }
  if (pct >= 60) return { label: 'Avanzado', color: 'text-sig-500', ring: 'stroke-sig-500', track: 'stroke-sig-500/15' }
  if (pct >= 30) return { label: 'En progreso', color: 'text-sig-400', ring: 'stroke-sig-400', track: 'stroke-sig-400/15' }
  return { label: 'En construcción', color: 'text-text-tertiary', ring: 'stroke-text-tertiary', track: 'stroke-text-tertiary/15' }
}

function ProgressRing({ pct, level }: { pct: number; level: Level }) {
  const size = 56
  const stroke = 5
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (pct / 100) * circumference
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" className={level.track} />
        <circle cx={size / 2} cy={size / 2} r={radius} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className={`${level.ring} transition-[stroke-dashoffset] duration-500 ease-out`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {pct >= 100 ? <Check className="text-success" size={20} strokeWidth={2.5} /> : <span className={`text-sm font-bold tabular-nums ${level.color}`}>{pct}%</span>}
      </div>
    </div>
  )
}

// ── Hojas ocultas del PDF oficial (3 hojas Dec 351/79 Anexo VII) ────────
//
// Maqueta autocontenida con estilos INLINE (no tokens de Tailwind): html2canvas
// rasteriza mejor colores concretos, y el protocolo debe verse igual sin importar
// el tema de la app. Cada hoja es un nodo A4 (≈794px = 210mm @96dpi) fuera de
// pantalla (position:fixed, left:-99999px) para que html2canvas pueda medirlo.
//
// Reusa el mismo patrón que el protocolo de Iluminación (shell `HojaA4`,
// tipografía y helpers de tabla); solo cambia el contenido de las hojas.

const PDF_PAGE_WIDTH = 794 // px ≈ 210mm @ 96dpi
const PDF_FONT = 'Helvetica, Arial, sans-serif'
const PDF_INK = '#1a1a1a'
const PDF_MUTED = '#555555'
const PDF_BORDER = '#999999'

const RIESGO_LABEL: Record<Riesgo, string> = {
  R1: 'R1 — Explosivos',
  R2: 'R2 — Inflamables',
  R3: 'R3 — Muy combustibles',
  R4: 'R4 — Combustibles',
  R5: 'R5 — Poco combustibles',
  R6: 'R6 — Incombustibles',
  R7: 'R7 — Refractarios',
}

function dash(v: string | number | null | undefined): string {
  if (v == null || v === '') return '—'
  return String(v)
}

function HojaA4({
  hojaRef,
  titulo,
  subtitulo,
  children,
}: {
  hojaRef: React.RefObject<HTMLDivElement | null>
  titulo: string
  subtitulo: string
  children: React.ReactNode
}) {
  return (
    <div
      ref={hojaRef}
      style={{
        width: PDF_PAGE_WIDTH,
        minHeight: 1123, // ≈ 297mm @ 96dpi
        backgroundColor: '#ffffff',
        color: PDF_INK,
        fontFamily: PDF_FONT,
        fontSize: 12,
        lineHeight: 1.4,
        padding: 48,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ borderBottom: `2px solid ${PDF_INK}`, paddingBottom: 8, marginBottom: 16 }}>
        <p style={{ margin: 0, fontSize: 11, letterSpacing: 1, color: PDF_MUTED, textTransform: 'uppercase' }}>
          Cálculo de Carga de Fuego · Dec. 351/79 Anexo VII
        </p>
        <h1 style={{ margin: '4px 0 0', fontSize: 18, fontWeight: 700 }}>{titulo}</h1>
        <p style={{ margin: '2px 0 0', fontSize: 12, color: PDF_MUTED }}>{subtitulo}</p>
      </div>
      {children}
    </div>
  )
}

function PdfSeccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700, color: PDF_INK }}>{titulo}</h2>
      {children}
    </div>
  )
}

function PdfCampo({ label, value }: { label: string; value: string | null }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: '3px 0', borderBottom: `1px solid #eeeeee` }}>
      <span style={{ minWidth: 150, color: PDF_MUTED, fontSize: 11 }}>{label}</span>
      <span style={{ flex: 1, fontWeight: 500 }}>{dash(value)}</span>
    </div>
  )
}

function PdfFirma({ firmante }: { firmante: string | null }) {
  return (
    <div style={{ marginTop: 40 }}>
      <div style={{ width: 280, borderTop: `1px solid ${PDF_INK}`, paddingTop: 6 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>{dash(firmante)}</p>
        <p style={{ margin: '2px 0 0', fontSize: 10, color: PDF_MUTED }}>Firma · Aclaración · Matrícula / Registro</p>
      </div>
    </div>
  )
}

function ProtocoloCargaFuegoHojas({
  data,
  hojaDatosRef,
  hojaMaterialesRef,
  hojaResultadoRef,
}: {
  data: ProtocoloPdfData
  hojaDatosRef: React.RefObject<HTMLDivElement | null>
  hojaMaterialesRef: React.RefObject<HTMLDivElement | null>
  hojaResultadoRef: React.RefObject<HTMLDivElement | null>
}) {
  const subtitulo = [data.establecimiento, data.razonSocial].filter(Boolean).join(' · ') || 'Establecimiento'

  const th: React.CSSProperties = {
    border: `1px solid ${PDF_BORDER}`,
    padding: '5px 4px',
    fontSize: 9.5,
    fontWeight: 700,
    backgroundColor: '#f0f0f0',
    textAlign: 'center',
    verticalAlign: 'middle',
  }
  const td: React.CSSProperties = {
    border: `1px solid ${PDF_BORDER}`,
    padding: '4px',
    fontSize: 10,
    textAlign: 'center',
    verticalAlign: 'middle',
  }

  return (
    <div
      aria-hidden
      style={{ position: 'fixed', left: -99999, top: 0, width: PDF_PAGE_WIDTH, pointerEvents: 'none' }}
    >
      {/* ── HOJA 1: DATOS ─────────────────────────────────────────── */}
      <HojaA4 hojaRef={hojaDatosRef} titulo="Hoja 1 — Datos del sector" subtitulo={subtitulo}>
        <PdfSeccion titulo="Empresa y establecimiento">
          <PdfCampo label="Razón social" value={data.razonSocial} />
          <PdfCampo label="CUIT" value={data.cuit} />
          <PdfCampo label="Establecimiento" value={data.establecimiento} />
          <PdfCampo label="Domicilio" value={data.domicilio} />
          <PdfCampo label="Localidad" value={data.localidad} />
          <PdfCampo label="Provincia" value={data.provincia} />
        </PdfSeccion>

        <PdfSeccion titulo="Sector de incendio">
          <PdfCampo label="Sector de incendio" value={data.sectorIncendio} />
          <PdfCampo label="Superficie (S)" value={data.superficie != null ? `${data.superficie} m²` : null} />
          <PdfCampo label="Ventilación" value={data.ventilacion === 'natural' ? 'Natural' : 'Mecánica'} />
          <PdfCampo label="Observaciones" value={data.observacionesGenerales} />
        </PdfSeccion>

        <PdfFirma firmante={data.firmante} />
      </HojaA4>

      {/* ── HOJA 2: MATERIALES ────────────────────────────────────── */}
      <HojaA4 hojaRef={hojaMaterialesRef} titulo="Hoja 2 — Inventario de materiales combustibles" subtitulo={subtitulo}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...th, width: 24 }}>N°</th>
              <th style={th}>Descripción</th>
              <th style={th}>Estado</th>
              <th style={th}>Peso<br />(kg)</th>
              <th style={th}>PCI<br />(kcal/kg)</th>
              <th style={th}>Coef. C</th>
              <th style={th}>Equiv. madera<br />(kg)</th>
            </tr>
          </thead>
          <tbody>
            {data.filasMateriales.map(f => (
              <tr key={f.n}>
                <td style={td}>{f.n}</td>
                <td style={{ ...td, textAlign: 'left' }}>{f.descripcion}</td>
                <td style={td}>{dash(f.estado)}</td>
                <td style={td}>{f.pesoKg != null ? f.pesoKg : '—'}</td>
                <td style={td}>{f.pciKcal != null ? f.pciKcal : '—'}</td>
                <td style={td}>{f.coefC != null ? f.coefC : '—'}</td>
                <td style={td}>{f.equivMaderaKg > 0 ? f.equivMaderaKg.toFixed(1) : '—'}</td>
              </tr>
            ))}
            <tr>
              <td style={{ ...td, fontWeight: 700, textAlign: 'right' }} colSpan={6}>
                Total equivalente en madera (Σ peso · C)
              </td>
              <td style={{ ...td, fontWeight: 700 }}>{data.totalEquiv.toFixed(1)} kg</td>
            </tr>
          </tbody>
        </table>

        <div
          style={{
            marginTop: 16,
            border: `2px solid ${PDF_INK}`,
            padding: '10px 12px',
            backgroundColor: '#f7f7f7',
            display: 'flex',
            alignItems: 'baseline',
            gap: 12,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700 }}>Carga de fuego (Qf = Σ equiv / S)</span>
          <span style={{ fontSize: 18, fontWeight: 700 }}>
            {data.qf != null ? `${data.qf.toFixed(1)} kg/m²` : '—'}
          </span>
          {data.franja && (
            <span style={{ fontSize: 12, fontWeight: 600, color: PDF_MUTED }}>franja {data.franja}</span>
          )}
        </div>
        <p style={{ marginTop: 10, fontSize: 9, color: PDF_MUTED }}>
          Coeficiente C = PCI / 4400 kcal/kg (madera de referencia, C = 1). Equivalente en
          madera = peso · C. Qf = Σ(peso · C) / superficie. Cálculos según Dec. 351/79 Anexo VII.
        </p>
      </HojaA4>

      {/* ── HOJA 3: RESULTADO Y ANÁLISIS ──────────────────────────── */}
      <HojaA4 hojaRef={hojaResultadoRef} titulo="Hoja 3 — Resultado y análisis" subtitulo={subtitulo}>
        <PdfSeccion titulo="Resultado del cálculo">
          <PdfCampo label="Total equiv. madera" value={`${data.totalEquiv.toFixed(1)} kg`} />
          <PdfCampo label="Carga de fuego (Qf)" value={data.qf != null ? `${data.qf.toFixed(1)} kg/m²` : null} />
          <PdfCampo label="Franja de carga" value={data.franja} />
          <PdfCampo label="Nivel de riesgo" value={data.riesgo ? RIESGO_LABEL[data.riesgo] : null} />
          <PdfCampo label="Resistencia al fuego exigida (F)" value={data.fExigido} />
          <PdfCampo label="Potencial extintor — Clase A" value={data.potencialA} />
          <PdfCampo label="Potencial extintor — Clase B" value={data.potencialB} />
        </PdfSeccion>

        <PdfSeccion titulo="Conclusiones">
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', minHeight: 60 }}>{dash(data.conclusiones)}</p>
        </PdfSeccion>
        <PdfSeccion titulo="Recomendaciones">
          <p style={{ margin: 0, whiteSpace: 'pre-wrap', minHeight: 60 }}>{dash(data.recomendaciones)}</p>
        </PdfSeccion>
        <PdfFirma firmante={data.firmante} />
      </HojaA4>
    </div>
  )
}
