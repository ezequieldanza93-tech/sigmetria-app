// Supabase Edge Function — Cron diario de vencimientos
// Se ejecuta 1 vez por día via pg_cron o Supabase Cron
//
// Deployment:
//   supabase functions deploy cron-vencimientos --no-verify-jwt
//
// Schedule (via Supabase Dashboard > Edge Functions > Triggers):
//   Schedule: 0 6 * * * (todos los días a las 6 AM)
//
// Security: protegido por CRON_SECRET (requerido)
// El caller debe enviar: Authorization: Bearer <CRON_SECRET>

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4'

Deno.serve(async (req: Request) => {
  const cronSecret = Deno.env.get('CRON_SECRET')
  const authHeader = req.headers.get('authorization')

  if (!cronSecret) {
    console.error('CRON_SECRET no configurado en la Edge Function')
    return new Response(JSON.stringify({ error: 'Server misconfiguration' }), { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  const consultoras = await supabase.from('consultoras').select('id').eq('is_active', true)
  if (!consultoras.data) {
    return new Response(JSON.stringify({ procesadas: 0 }), { status: 200 })
  }

  let procesadas = 0

  for (const consultora of consultoras.data) {
    const { data: config } = await supabase
      .from('configuracion_vencimientos')
      .select('tipo_entidad, nombre, dias_aviso')
      .eq('consultora_id', consultora.id)
      .eq('tiene_vencimiento', true)
      .eq('activo', true)

    if (!config || config.length === 0) continue

    interface NotificableRow {
      entidad_tipo: string
      entidad_id: string
      entidad_nombre: string
      contexto_nombre: string | null
      fecha_vencimiento: string
      consultora_id: string
    }

    const rows: NotificableRow[] = []

    function findConfig(tipo: string, nombre: string) {
      return config.find((c: { tipo_entidad: string; nombre: string }) => c.tipo_entidad === tipo && c.nombre === nombre)
    }

    // 1. empresas_documentos
    const { data: empDocs } = await supabase
      .from('empresas_documentos')
      .select(`
        id, fecha_vencimiento,
        documentos_tipos!inner(nombre),
        empresas!inner(id, razon_social, consultora_id)
      `)
      .not('fecha_vencimiento', 'is', null)
      .eq('empresas.consultora_id', consultora.id)

    for (const d of (empDocs ?? []) as any[]) {
      if (findConfig('empresa', d.documentos_tipos?.nombre)) {
        rows.push({
          entidad_tipo: 'documento_empresa',
          entidad_id: d.id,
          entidad_nombre: d.documentos_tipos?.nombre ?? 'Documento',
          contexto_nombre: d.empresas?.razon_social ?? null,
          fecha_vencimiento: d.fecha_vencimiento,
          consultora_id: consultora.id,
        })
      }
    }

    // 2. establecimientos_documentos
    const { data: estDocs } = await supabase
      .from('establecimientos_documentos')
      .select(`
        id, fecha_vencimiento,
        documentos_tipos!inner(nombre),
        establecimientos!inner(id, nombre, empresas!inner(id, consultora_id))
      `)
      .not('fecha_vencimiento', 'is', null)
      .eq('establecimientos.empresas.consultora_id', consultora.id)

    for (const d of (estDocs ?? []) as any[]) {
      if (findConfig('establecimiento', d.documentos_tipos?.nombre)) {
        rows.push({
          entidad_tipo: 'documento_establecimiento',
          entidad_id: d.id,
          entidad_nombre: d.documentos_tipos?.nombre ?? 'Documento',
          contexto_nombre: d.establecimientos?.nombre ?? null,
          fecha_vencimiento: d.fecha_vencimiento,
          consultora_id: consultora.id,
        })
      }
    }

    // 3. personas_documentos — scoped a consultora via created_in_consultora_id
    const { data: perDocs } = await supabase
      .from('personas_documentos')
      .select(`
        id, fecha_vencimiento,
        documentos_tipos!inner(nombre),
        personas_directorio!inner(id, nombre, apellido, created_in_consultora_id)
      `)
      .not('fecha_vencimiento', 'is', null)
      .eq('personas_directorio.created_in_consultora_id', consultora.id)

    for (const d of (perDocs ?? []) as any[]) {
      if (findConfig('persona', d.documentos_tipos?.nombre)) {
        rows.push({
          entidad_tipo: 'documento_persona',
          entidad_id: d.id,
          entidad_nombre: d.documentos_tipos?.nombre ?? 'Documento',
          contexto_nombre: d.personas_directorio
            ? `${d.personas_directorio.nombre} ${d.personas_directorio.apellido}`
            : null,
          fecha_vencimiento: d.fecha_vencimiento,
          consultora_id: consultora.id,
        })
      }
    }

    // 4. gestiones_registros
    const { data: gestiones } = await supabase
      .from('gestiones_registros')
      .select(`
        id, fecha_vencimiento,
        gestiones_establecimientos!inner(
          gestiones!inner(id, nombre),
          establecimientos!inner(id, nombre, empresas!inner(id, consultora_id))
        )
      `)
      .not('fecha_vencimiento', 'is', null)
      .eq('gestiones_establecimientos.establecimientos.empresas.consultora_id', consultora.id)

    for (const g of (gestiones ?? []) as any[]) {
      const nombreGestion = g.gestiones_establecimientos?.gestiones?.nombre ?? ''
      if (findConfig('gestion', nombreGestion)) {
        rows.push({
          entidad_tipo: 'gestion',
          entidad_id: g.id,
          entidad_nombre: nombreGestion,
          contexto_nombre: g.gestiones_establecimientos?.establecimientos?.nombre ?? null,
          fecha_vencimiento: g.fecha_vencimiento,
          consultora_id: consultora.id,
        })
      }
    }

    // 5. matriculas
    const { data: mats } = await supabase
      .from('matriculas')
      .select(`
        id, fecha_vencimiento,
        personas_directorio!inner(id, nombre, apellido)
      `)

    for (const m of (mats ?? []) as any[]) {
      rows.push({
        entidad_tipo: 'matricula',
        entidad_id: m.id,
        entidad_nombre: 'Matrícula',
        contexto_nombre: m.personas_directorio
          ? `${m.personas_directorio.nombre} ${m.personas_directorio.apellido}`
          : null,
        fecha_vencimiento: m.fecha_vencimiento,
        consultora_id: consultora.id,
      })
    }

    // 6. certificados_calibracion
    const { data: certs } = await supabase
      .from('certificados_calibracion')
      .select(`
        id, fecha_vencimiento,
        instrumentos!inner(id, nombre)
      `)

    for (const c of (certs ?? []) as any[]) {
      rows.push({
        entidad_tipo: 'certificado',
        entidad_id: c.id,
        entidad_nombre: 'Certificado de Calibración',
        contexto_nombre: c.instrumentos?.nombre ?? null,
        fecha_vencimiento: c.fecha_vencimiento,
        consultora_id: consultora.id,
      })
    }

    // 7. sap_presentaciones con fecha_vencimiento
    const { data: sapPres } = await supabase
      .from('sap_presentaciones')
      .select(`
        id, fecha_vencimiento,
        establecimientos!inner(nombre),
        empresas!inner(razon_social)
      `)
      .not('fecha_vencimiento', 'is', null)
      .eq('consultora_id', consultora.id)
      .is('deleted_at', null)
      .neq('estado', 'no_aplica')

    for (const s of (sapPres ?? []) as any[]) {
      rows.push({
        entidad_tipo: 'sap_presentacion',
        entidad_id: s.id,
        entidad_nombre: `SAP — ${s.empresas?.razon_social ?? 'Empresa'}`,
        contexto_nombre: s.establecimientos?.nombre ?? null,
        fecha_vencimiento: s.fecha_vencimiento,
        consultora_id: consultora.id,
      })
    }

    // 8. observaciones acciones inmediatas (nivel >= 2) — deadline = fecha_planificada
    // Obtenemos los gestiones_registros para esta consultora vía cadena de joins
    const { data: grCron } = await supabase
      .from('gestiones_registros')
      .select(`
        id,
        gestiones_establecimientos!inner(
          establecimientos!inner(nombre, empresas!inner(consultora_id))
        )
      `)
      .eq('gestiones_establecimientos.establecimientos.empresas.consultora_id', consultora.id)

    const grIdsCron = (grCron ?? []).map((g: any) => g.id)
    const grEstMapCron = new Map<string, string>()
    for (const g of (grCron ?? []) as any[]) {
      grEstMapCron.set(g.id, g.gestiones_establecimientos?.establecimientos?.nombre ?? null)
    }

    if (grIdsCron.length > 0) {
      const { data: obsAct } = await supabase
        .from('gestiones_observaciones')
        .select(`
          id,
          descripcion,
          fecha_planificada,
          registro_gestion_id,
          observaciones_categorias!inner(nivel)
        `)
        .is('fecha_cierre', null)
        .not('fecha_planificada', 'is', null)
        .gte('observaciones_categorias.nivel', 2)
        .in('registro_gestion_id', grIdsCron)

      for (const obs of (obsAct ?? []) as any[]) {
        rows.push({
          entidad_tipo: 'observacion_accion_inmediata',
          entidad_id: obs.id,
          entidad_nombre: obs.descripcion?.slice(0, 80) ?? 'Acción inmediata',
          contexto_nombre: grEstMapCron.get(obs.registro_gestion_id) ?? null,
          fecha_vencimiento: obs.fecha_planificada,
          consultora_id: consultora.id,
        })
      }
    }

    // 9. Incidentes abiertos — SLA implícito 30 días
    const { data: incAbiertos } = await supabase
      .from('incidentes')
      .select(`
        id, titulo, fecha_incidente,
        empresas!inner(razon_social),
        establecimientos(nombre)
      `)
      .eq('consultora_id', consultora.id)
      .neq('estado', 'cerrada')

    for (const inc of (incAbiertos ?? []) as any[]) {
      const [y, m, d] = (inc.fecha_incidente as string).split('-').map(Number)
      const dt = new Date(y, m - 1, d + 30)
      const fechaVenc = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
      const contexto = [inc.empresas?.razon_social, inc.establecimientos?.nombre].filter(Boolean).join(' — ')
      rows.push({
        entidad_tipo: 'incidente',
        entidad_id: inc.id,
        entidad_nombre: inc.titulo,
        contexto_nombre: contexto || null,
        fecha_vencimiento: fechaVenc,
        consultora_id: consultora.id,
      })
    }

    const hoy = new Date()
    hoy.setHours(0, 0, 0, 0)

    for (const row of rows) {
      const venc = new Date(row.fecha_vencimiento + 'T00:00:00')
      const dias = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000)

      const cfg = findConfig(
        row.entidad_tipo === 'documento_empresa' ? 'empresa'
          : row.entidad_tipo === 'documento_establecimiento' ? 'establecimiento'
          : row.entidad_tipo === 'documento_persona' ? 'persona'
          : 'gestion',
        row.entidad_nombre
      )

      if (dias >= 0 && dias <= (cfg?.dias_aviso ?? 7)) {
        const titulo = dias === 0 ? 'Vence hoy' : `Vence en ${dias} día${dias !== 1 ? 's' : ''}`
        const mensaje = dias < 0
          ? `VENCIDO — ${row.entidad_nombre} venció hace ${Math.abs(dias)}d`
          : dias === 0 ? `VENCE HOY — ${row.entidad_nombre}`
          : `Vence en ${dias}d — ${row.entidad_nombre}`

        const { error } = await supabase.from('notificaciones').upsert(
          {
            consultora_id: row.consultora_id,
            tipo: 'vencimiento',
            entidad_tipo: row.entidad_tipo,
            entidad_id: row.entidad_id,
            titulo,
            mensaje,
            entidad_nombre: row.entidad_nombre,
            contexto_nombre: row.contexto_nombre,
            fecha_vencimiento: row.fecha_vencimiento,
            dias_restantes: dias,
          },
          {
            onConflict: 'consultora_id, entidad_tipo, entidad_id, dias_restantes',
            ignoreDuplicates: false,
          }
        )
        if (!error) procesadas++
      }
    }

    // Cleanup stale notifications
    const { data: existing } = await supabase
      .from('notificaciones')
      .select('id, entidad_tipo, entidad_id, dias_restantes')
      .eq('consultora_id', consultora.id)

    if (existing) {
      // Tipos que no dependen de configuracion_vencimientos — solo se limpian si la entidad desaparece
      const independentTypes = new Set(['matricula', 'certificado', 'sap_presentacion', 'observacion_accion_inmediata', 'incidente'])

      const staleIds: string[] = []
      for (const n of existing) {
        const row = rows.find(
          r => r.entidad_tipo === n.entidad_tipo && r.entidad_id === n.entidad_id
        )
        if (!row) {
          staleIds.push(n.id)
          continue
        }
        if (independentTypes.has(n.entidad_tipo)) {
          continue // la entidad existe → la notificación sigue vigente
        }
        const venc = new Date(row.fecha_vencimiento + 'T00:00:00')
        const dias = Math.ceil((venc.getTime() - hoy.getTime()) / 86400000)
        const cfg = findConfig(
          n.entidad_tipo === 'documento_empresa' ? 'empresa'
            : n.entidad_tipo === 'documento_establecimiento' ? 'establecimiento'
            : n.entidad_tipo === 'documento_persona' ? 'persona'
            : 'gestion',
          row.entidad_nombre
        )
        if (!cfg || (dias >= 0 && dias > cfg.dias_aviso)) {
          staleIds.push(n.id)
        }
      }

      if (staleIds.length > 0) {
        await supabase.from('notificaciones').delete().in('id', staleIds)
      }
    }
  }

  return new Response(
    JSON.stringify({ procesadas }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
