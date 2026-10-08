import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from './api.js'
import Modal from './Modal.jsx'
import AlertModal from './AlertModal.jsx'

const formatoPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

// Día de la venta en hora argentina (AAAA-MM-DD): acota la búsqueda en Contabilium.
function fechaAR(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' })
}

const MAX_LOTE = 100
const ICONO_ESTADO = { pendiente: '⌛', procesando: '⏳', ok: '✅', simulada: '🧪', error: '❌', omitida: '⏭️', revisar: '⚠️' }
const guardado = (k) => { try { return localStorage.getItem(k) } catch { return null } }
const guardar = (k, v) => { try { localStorage.setItem(k, v) } catch { /* sin almacenamiento: no pasa nada */ } }

async function leerError(res) {
  try {
    const d = await res.json()
    return typeof d.detail === 'string' ? d.detail : JSON.stringify(d.detail || d)
  } catch {
    return `Error ${res.status}`
  }
}

export default function FacturacionVentasView({ onUnauthorized }) {
  const [data, setData] = useState(null)
  const [revision, setRevision] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [dias, setDias] = useState(7)
  const [filtro, setFiltro] = useState('pendientes')
  const [busquedaTexto, setBusquedaTexto] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [recarga, setRecarga] = useState(0)
  const [tipoFc, setTipoFc] = useState('') // '' | 'FCA' | 'FCB'
  const [montoMin, setMontoMin] = useState('')
  const [montoMax, setMontoMax] = useState('')

  const [preparando, setPreparando] = useState(null) // número de ML en proceso de "preparar"
  const [resumen, setResumen] = useState(null) // { venta, datos }
  const [facturando, setFacturando] = useState(false)
  const [adjuntando, setAdjuntando] = useState(null) // número de ML (o 'todas') mientras se adjunta
  const [aviso, setAviso] = useState(null)

  // Facturación por lotes: se procesa en el servidor; acá solo se elige y se mira cómo va.
  const [seleccion, setSeleccion] = useState([]) // números de venta elegidos
  const [confirmandoLote, setConfirmandoLote] = useState(false)
  const [creandoLote, setCreandoLote] = useState(false)
  const [lote, setLote] = useState(null)
  const loteViejoRef = useRef(null) // estado del lote en la consulta anterior, para detectar cuándo termina

  // Espera a que termine de tipear antes de buscar en ML (si no, consulta por cada letra).
  useEffect(() => {
    const t = setTimeout(() => setBusqueda(busquedaTexto.trim()), 600)
    return () => clearTimeout(t)
  }, [busquedaTexto])

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    apiFetch(`/facturacion/pendientes?dias=${dias}&q=${encodeURIComponent(busqueda)}`, {}, onUnauthorized)
      .then(async (res) => {
        if (!res.ok) throw new Error(await leerError(res))
        const d = await res.json()
        if (!vigente) return
        setData(d)
        setCargando(false)
      })
      .catch((err) => {
        if (!vigente) return
        setError(err.message)
        setCargando(false)
      })
    apiFetch('/facturacion/revision-pendiente', {}, onUnauthorized)
      .then((res) => (res.ok ? res.json() : { pendientes: [] }))
      .then((d) => vigente && setRevision(d.pendientes || []))
      .catch(() => {})
    return () => { vigente = false }
  }, [dias, busqueda, recarga])

  // Al entrar (o volver a la pestaña, o desbloquear el celular): recuperar el último lote para ver cómo quedó.
  const cargarUltimoLote = () =>
    apiFetch('/facturacion/lote/ultimo', {}, onUnauthorized)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => {
        const l = d?.lote
        if (!l) return
        if (l.estado === 'en_curso' || guardado('lote_cerrado') !== String(l.id)) setLote(l)
      })
      .catch(() => {})

  useEffect(() => {
    cargarUltimoLote()
    const alVolver = () => { if (document.visibilityState === 'visible') cargarUltimoLote() }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [])

  // Mientras el lote esté en curso: consultar cada 3 s y mantener la pantalla encendida (si el navegador lo permite).
  const loteEnCurso = lote?.estado === 'en_curso'
  useEffect(() => {
    if (!loteEnCurso) return undefined
    const id = lote.id
    const t = setInterval(() => {
      apiFetch(`/facturacion/lote/${id}`, {}, onUnauthorized)
        .then((res) => (res.ok ? res.json() : null))
        .then((l) => l && setLote(l))
        .catch(() => {}) // sin internet: el servidor sigue; se reintenta en 3 s
    }, 3000)
    let candado = null
    const pedirCandado = async () => {
      try {
        if ('wakeLock' in navigator && document.visibilityState === 'visible') candado = await navigator.wakeLock.request('screen')
      } catch { /* no disponible: igual el lote sigue en el servidor */ }
    }
    pedirCandado()
    const alVolver = () => { if (document.visibilityState === 'visible') pedirCandado() }
    document.addEventListener('visibilitychange', alVolver)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', alVolver)
      try { candado?.release() } catch { /* ya liberado */ }
    }
  }, [loteEnCurso, lote?.id])

  // Cuando el lote termina, refrescar la lista una vez.
  useEffect(() => {
    if (loteViejoRef.current === 'en_curso' && lote?.estado === 'terminado') setRecarga((n) => n + 1)
    loteViejoRef.current = lote?.estado || null
  }, [lote?.estado])

  const ventas = data?.ventas || []
  const cantFacturadas = ventas.filter((v) => v.facturada).length
  const cantPendientes = ventas.length - cantFacturadas
  const sinAdjuntar = (v) => v.facturada && !v.factura?.adjunta_ml
  const cantSinAdjuntar = ventas.filter(sinAdjuntar).length

  const visibles = useMemo(() => {
    return ventas.filter((v) => {
      if (filtro === 'pendientes' && v.facturada) return false
      if (filtro === 'facturadas' && !v.facturada) return false
      if (filtro === 'sinadjuntar' && !sinAdjuntar(v)) return false
      if (tipoFc && v.tipo_fc !== tipoFc) return false
      const min = parseFloat(montoMin.replace(',', '.'))
      const max = parseFloat(montoMax.replace(',', '.'))
      if (!Number.isNaN(min) && (v.total || 0) < min) return false
      if (!Number.isNaN(max) && (v.total || 0) > max) return false
      return true
    })
  }, [ventas, filtro, tipoFc, montoMin, montoMax])

  const preparar = async (venta) => {
    setPreparando(venta.id_orden_ml)
    try {
      const res = await apiFetch(
        `/facturacion/${venta.id_orden_ml}/preparar?fecha=${fechaAR(venta.fecha)}`,
        { method: 'POST' },
        onUnauthorized,
      )
      if (!res.ok) throw new Error(await leerError(res))
      setResumen({ venta, datos: await res.json() })
    } catch (err) {
      setAviso(`No se pudo preparar la factura:\n${err.message}`)
    } finally {
      setPreparando(null)
    }
  }

  const confirmar = async () => {
    if (!resumen || facturando) return
    setFacturando(true)
    const { venta } = resumen
    try {
      const res = await apiFetch(
        `/facturacion/${venta.id_orden_ml}/confirmar?fecha=${fechaAR(venta.fecha)}`,
        { method: 'POST' },
        onUnauthorized,
      )
      if (!res.ok) throw new Error(await leerError(res))
      const d = await res.json()
      setResumen(null)
      const contab = d.finalizada_contabilium
        ? '\n✅ La orden quedó Finalizada en Contabilium.'
        : '\nℹ️ La orden sigue como "Pagada" en Integraciones de Contabilium (la factura es válida igual).'
      const nota = d.nota_revision ? `\n\n⚠️ PARA REVISAR: ${d.nota_revision}` : ''
      if (d.simulado) setAviso(d.mensaje)
      else if (d.adjuntada) setAviso(`Factura emitida: ${d.numero_factura} (CAE ${d.cae}).\n\n✅ ${d.adjuntada_por_contabilium ? 'Contabilium la adjuntó a la venta de ML (lo confirmé en ML).' : 'Quedó adjunta a la venta de ML.'}${contab}${nota}`)
      else setAviso(`Factura emitida: ${d.numero_factura} (CAE ${d.cae}).\n\n⚠️ NO QUEDÓ ADJUNTA a la venta de ML:\n${d.error_adjunto}\n\nLa venta figura en amarillo: usá "Adjuntar a ML" para reintentar. No la vuelvas a facturar.${contab}${nota}`)
      setRecarga((n) => n + 1)
    } catch (err) {
      setResumen(null)
      setAviso(`No se facturó:\n${err.message}`)
      setRecarga((n) => n + 1)
    } finally {
      setFacturando(false)
    }
  }

  const adjuntar = async (venta) => {
    setAdjuntando(venta.id_orden_ml)
    try {
      const res = await apiFetch(`/facturacion/${venta.id_orden_ml}/adjuntar`, { method: 'POST' }, onUnauthorized)
      if (!res.ok) throw new Error(await leerError(res))
      const d = await res.json()
      setAviso(d.adjuntada ? '✅ La factura quedó adjunta a la venta de ML.' : `⚠️ Todavía no se pudo adjuntar:\n${d.error}`)
    } catch (err) {
      setAviso(`⚠️ No se pudo adjuntar:\n${err.message}`)
    } finally {
      setAdjuntando(null)
      setRecarga((n) => n + 1)
    }
  }

  const adjuntarTodas = async () => {
    setAdjuntando('todas')
    try {
      const res = await apiFetch('/facturacion/adjuntar-pendientes?limite=20', { method: 'POST' }, onUnauthorized)
      if (!res.ok) throw new Error(await leerError(res))
      const d = await res.json()
      const fallos = d.fallaron.map((f) => `• Factura ${f.numero_factura} (venta #${f.numero_orden_ml}): ${f.error}`).join('\n')
      setAviso(`Se intentó con ${d.intentadas} factura(s): ${d.adjuntadas} quedaron adjuntas.${fallos ? `\n\nNo se pudieron adjuntar:\n${fallos}` : ''}`)
    } catch (err) {
      setAviso(`⚠️ No se pudo adjuntar:\n${err.message}`)
    } finally {
      setAdjuntando(null)
      setRecarga((n) => n + 1)
    }
  }

  const cancelada = (v) => v.estado_ml && !['paid', 'confirmed'].includes(v.estado_ml)
  const seleccionable = (v) => !v.facturada && v.en_contabilium !== false && !cancelada(v)
  const visiblesSeleccionables = visibles.filter(seleccionable)
  const elegidas = ventas.filter((v) => seleccion.includes(v.id_orden_ml) && seleccionable(v))
  const totalElegidas = elegidas.reduce((acc, v) => acc + (v.total || 0), 0)

  const alternar = (v) =>
    setSeleccion((sel) => (sel.includes(v.id_orden_ml) ? sel.filter((n) => n !== v.id_orden_ml) : sel.length >= MAX_LOTE ? sel : [...sel, v.id_orden_ml]))
  const elegirTodas = () => setSeleccion(visiblesSeleccionables.slice(0, MAX_LOTE).map((v) => v.id_orden_ml))

  const iniciarLote = async () => {
    if (creandoLote || elegidas.length === 0) return
    setCreandoLote(true)
    try {
      const res = await apiFetch('/facturacion/lote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ventas: elegidas.map((v) => ({ numero_ml: v.id_orden_ml, fecha: fechaAR(v.fecha), comprador: v.comprador, total: v.total })) }),
      }, onUnauthorized)
      if (!res.ok) throw new Error(await leerError(res))
      setLote(await res.json())
      setSeleccion([])
      setConfirmandoLote(false)
    } catch (err) {
      setConfirmandoLote(false)
      setAviso(`No se pudo armar el lote (no se facturó nada):\n${err.message}`)
    } finally {
      setCreandoLote(false)
    }
  }

  const cancelarLote = async () => {
    if (!lote) return
    try {
      const res = await apiFetch(`/facturacion/lote/${lote.id}/cancelar`, { method: 'POST' }, onUnauthorized)
      if (res.ok) setLote(await res.json())
    } catch { /* se reintenta tocando de nuevo */ }
  }

  const cerrarLote = () => {
    if (lote) guardar('lote_cerrado', String(lote.id))
    setLote(null)
  }

  const marcarRevisado = async (f) => {
    const res = await apiFetch(`/facturacion/${f.id_orden_contabilium}/marcar-revisado`, { method: 'POST' }, onUnauthorized)
    if (res.ok) setRecarga((n) => n + 1)
    else setAviso(await leerError(res))
  }

  return (
    <>
      <div className="controls">
        <label className="corte-label">
          Últimos días
          <select className="corte-input" value={dias} onChange={(e) => setDias(Number(e.target.value))}>
            {[1, 3, 7, 15, 30, 60, 90].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button className={`sort-btn ${filtro === 'pendientes' ? 'active-outline' : ''}`} onClick={() => setFiltro('pendientes')}>
          🔴 Pendientes ({cantPendientes})
        </button>
        <button className={`sort-btn ${filtro === 'facturadas' ? 'active-outline' : ''}`} onClick={() => setFiltro('facturadas')}>
          🟢 Facturadas ({cantFacturadas})
        </button>
        <button className={`sort-btn ${filtro === 'sinadjuntar' ? 'active-outline' : ''}`} onClick={() => setFiltro('sinadjuntar')}>
          🟡 Sin adjuntar ({cantSinAdjuntar})
        </button>
        <button className={`sort-btn ${filtro === 'todas' ? 'active-outline' : ''}`} onClick={() => setFiltro('todas')}>
          Todas ({ventas.length})
        </button>
        <input
          className="corte-input"
          style={{ width: 260 }}
          placeholder="Buscar nº de venta o de carrito, usuario, producto o SKU"
          value={busquedaTexto}
          onChange={(e) => setBusquedaTexto(e.target.value)}
        />
        <select className="corte-input" value={tipoFc} onChange={(e) => setTipoFc(e.target.value)} title="Para las pendientes es una estimación por CUIT/DNI; el tipo real se confirma al preparar la factura">
          <option value="">Factura A y B</option>
          <option value="FCA">Solo Factura A</option>
          <option value="FCB">Solo Factura B</option>
        </select>
        <input className="corte-input" style={{ width: 100 }} inputMode="decimal" placeholder="Monto mín." value={montoMin} onChange={(e) => setMontoMin(e.target.value)} />
        <input className="corte-input" style={{ width: 100 }} inputMode="decimal" placeholder="Monto máx." value={montoMax} onChange={(e) => setMontoMax(e.target.value)} />
        <button className="sort-btn" onClick={() => setRecarga((n) => n + 1)} disabled={cargando}>↻ Actualizar</button>
        <button className="sort-btn" onClick={adjuntarTodas} disabled={adjuntando !== null}>
          {adjuntando === 'todas' ? 'Adjuntando...' : '📎 Adjuntar las que faltan'}
        </button>
      </div>

      {data && data.cruce_historico_ok === false && (
        <div className="error-state">
          No pude consultar Contabilium para cruzar las ventas con lo ya facturado. Hasta que se resuelva, una venta
          marcada como Pendiente puede estar ya facturada: no factures sin revisar antes.
        </div>
      )}

      {data?.indice?.activo && !data.indice.al_dia && (
        <div className="id-cell mono" style={{ margin: '6px 0' }}>
          Preparando la copia de las órdenes de Contabilium (la primera vez tarda unos minutos). Mientras tanto la lista lee
          Contabilium en vivo y puede tardar más.
        </div>
      )}
      {data?.indice?.al_dia && data.indice.desde && data.indice.objetivo && data.indice.desde > data.indice.objetivo && (
        <div className="id-cell mono" style={{ margin: '6px 0' }}>
          Copia de Contabilium completa desde el {new Date(data.indice.desde + 'T12:00:00').toLocaleDateString('es-AR')}: lo anterior
          se lee en vivo (todavía se está completando hacia atrás).
        </div>
      )}

      {data?.truncado && (
        <div className="error-state">
          Hay más de 2.000 ventas en este período y ML solo devuelve las últimas 2.000. Achicá los días o buscá por usuario o producto.
        </div>
      )}

      {revision.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>⚠️ Para revisar ({revision.length})</h3>
          <div className="id-cell mono" style={{ marginBottom: 8 }}>
            Facturas con algo para mirar a mano: a un cliente le faltaba la Condición de IVA y se completó sola, o la factura
            salió con una letra distinta de la esperada. Confirmalo en Contabilium.
          </div>
          <div className="list">
            {revision.map((f) => (
              <div key={f.id_orden_contabilium} className="row">
                <div className="title-cell">
                  {f.comprador}
                  <span className="id-cell mono">
                    {f.tipo_doc} {f.nro_doc} · Factura {f.tipo_fc === 'FCA' ? 'A' : 'B'} {f.numero_factura || '(sin número leído)'}
                  </span>
                  {f.nota_revision && (
                    <span className="id-cell mono" style={{ color: '#B23A2E' }}>{f.nota_revision}</span>
                  )}
                </div>
                <button className="sort-btn" onClick={() => marcarRevisado(f)}>Ya la revisé</button>
              </div>
            ))}
          </div>
        </>
      )}

      {lote && (
        <div className="error-state" style={{ background: 'var(--card-bg)', color: 'inherit', border: '1px solid var(--gray-line)', margin: '12px 0' }}>
          <strong>
            Lote #{lote.id}: {lote.hechos} de {lote.total} {lote.estado === 'en_curso' ? '· facturando…' : '· terminado'}
            {lote.cancelar && lote.estado === 'en_curso' ? ' · cancelando (termina la que está en curso)' : ''}
          </strong>
          <div style={{ height: 8, background: 'var(--gray-line)', borderRadius: 4, margin: '8px 0' }}>
            <div style={{ height: 8, borderRadius: 4, background: 'var(--navy)', width: `${lote.total ? (100 * lote.hechos) / lote.total : 0}%` }} />
          </div>
          {lote.estado === 'en_curso' ? (
            <div className="id-cell mono">
              Podés bloquear el celular o cerrar esta pantalla: la facturación sigue en el servidor. Al volver vas a ver cómo quedó.
              Mientras tanto no vuelvas a facturar estas ventas.
            </div>
          ) : (
            <div className="id-cell mono">
              {Object.entries(lote.cuenta).map(([e, n]) => `${ICONO_ESTADO[e] || ''} ${e}: ${n}`).join(' · ')}
            </div>
          )}
          <div style={{ maxHeight: 280, overflowY: 'auto', marginTop: 8 }}>
            {lote.items.map((i) => (
              <div key={i.id} className="id-cell mono" style={{ padding: '3px 0' }}>
                {ICONO_ESTADO[i.estado] || ''} #{i.numero_ml} {i.comprador || ''}
                {i.numero_factura ? ` · Factura ${i.numero_factura}` : ''}
                {i.estado === 'ok' && i.adjuntada === false ? ' · ⚠️ SIN adjuntar a ML' : ''}
                {i.mensaje ? ` · ${i.mensaje}` : ''}
                {i.nota ? ` · ⚠️ ${i.nota}` : ''}
                {i.estado === 'revisar' ? ' · NO reintentar sin mirar en Contabilium' : ''}
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8 }}>
            {lote.estado === 'en_curso' ? (
              <button className="sort-btn" disabled={lote.cancelar} onClick={cancelarLote}>Cancelar las que faltan</button>
            ) : (
              <button className="sort-btn" onClick={cerrarLote}>Cerrar</button>
            )}
          </div>
        </div>
      )}

      {!loteEnCurso && visiblesSeleccionables.length > 0 && (
        <div className="controls" style={{ marginTop: 8 }}>
          <button className="sort-btn" onClick={elegirTodas}>
            ☑ Elegir las pendientes visibles ({Math.min(visiblesSeleccionables.length, MAX_LOTE)})
          </button>
          {seleccion.length > 0 && (
            <>
              <button className="sort-btn" onClick={() => setSeleccion([])}>Quitar selección</button>
              <button className="scan-btn" onClick={() => setConfirmandoLote(true)}>
                Facturar {elegidas.length} elegida(s) · {formatoPesos.format(totalElegidas)}
              </button>
            </>
          )}
        </div>
      )}

      {cargando && <div className="loading-state">Cargando ventas...</div>}
      {error && <div className="error-state">Error: {error}</div>}

      {!cargando && data && (
        <div className="list" style={{ marginTop: 12 }}>
          {visibles.length === 0 && <div className="empty-state">No hay ventas para mostrar con este filtro.</div>}
          {visibles.map((v) => (
            <div key={v.id_orden_ml} className="row">
              {!v.facturada && (
                <input
                  type="checkbox"
                  style={{ width: 22, height: 22 }}
                  checked={seleccion.includes(v.id_orden_ml)}
                  disabled={!seleccionable(v) || loteEnCurso}
                  onChange={() => alternar(v)}
                  aria-label={`Elegir la venta ${v.id_orden_ml}`}
                />
              )}
              <span
                style={{ fontSize: 20 }}
                title={!v.facturada ? 'Pendiente de facturar' : v.factura?.adjunta_ml ? 'Facturada y adjunta a la venta de ML' : 'Facturada, pero SIN adjuntar a la venta de ML'}
              >
                {!v.facturada ? '🔴' : v.factura?.adjunta_ml ? '🟢' : '🟡'}
              </span>
              <div className="title-cell">
                {v.comprador || '—'}
                <span className="id-cell mono">
                  {v.fecha ? new Date(v.fecha).toLocaleString('es-AR') : '—'} · #{v.id_orden_ml}
                  {v.pack_id && v.pack_id !== v.id_orden_ml ? ` · carrito #${v.pack_id}` : ''}
                  {cancelada(v) ? ` · ML: ${v.estado_ml === 'cancelled' ? 'CANCELADA' : v.estado_ml}` : ''}
                  {v.facturada && v.factura ? ` · Factura ${v.factura.tipo_fc === 'FCA' ? 'A' : 'B'} ${v.factura.numero_factura}` : ''}
                  {!v.facturada && v.tipo_fc ? ` · Factura ${v.tipo_fc === 'FCA' ? 'A' : 'B'} (estimada)` : ''}
                  {!v.facturada && v.en_contabilium === false ? ' · todavía no está en Contabilium' : ''}
                </span>
                {v.productos?.length > 0 && (
                  <span className="id-cell mono">
                    {v.productos.map((p) => `${p.cantidad}× ${p.titulo || p.sku}`).join(' · ')}
                  </span>
                )}
                {sinAdjuntar(v) && (
                  <span className="id-cell mono" style={{ color: '#B23A2E' }}>
                    Sin adjuntar a la venta de ML{v.factura?.adjunta_ml_error ? `: ${v.factura.adjunta_ml_error}` : ''}
                  </span>
                )}
              </div>
              <span className="badge badge-acordar">{formatoPesos.format(v.total || 0)}</span>
              {v.facturada ? (
                <>
                  {sinAdjuntar(v) && (
                    <button className="scan-btn" disabled={adjuntando !== null} onClick={() => adjuntar(v)}>
                      {adjuntando === v.id_orden_ml ? 'Adjuntando...' : 'Adjuntar a ML'}
                    </button>
                  )}
                  {v.factura?.url_comprobante && (
                    <a className="sort-btn" href={v.factura.url_comprobante} target="_blank" rel="noreferrer">Ver factura</a>
                  )}
                </>
              ) : cancelada(v) ? (
                <span className="id-cell mono">No se factura</span>
              ) : (
                <button
                  className="scan-btn"
                  disabled={preparando !== null || facturando || loteEnCurso}
                  onClick={() => preparar(v)}
                >
                  {preparando === v.id_orden_ml ? 'Preparando...' : 'Facturar'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {resumen && (
        <Modal
          titulo={`Facturar venta #${resumen.venta.id_orden_ml}`}
          onCerrar={() => !facturando && setResumen(null)}
          footer={
            <>
              <button className="sort-btn" disabled={facturando} onClick={() => setResumen(null)}>Cancelar</button>
              <button className="scan-btn" disabled={facturando} onClick={confirmar}>
                {facturando ? 'Facturando...' : resumen.datos.dry_run ? 'Simular factura' : `Emitir Factura ${resumen.datos.etiqueta_fc}`}
              </button>
            </>
          }
        >
          {resumen.datos.dry_run && (
            <div className="error-state" style={{ marginBottom: 12 }}>
              MODO SIMULACIÓN: no se va a emitir nada real ante AFIP.
            </div>
          )}
          <div className="id-cell mono" style={{ marginBottom: 8 }}>
            La factura se adjunta sola a la venta de ML, y se verifica que haya quedado.
            {resumen.datos.se_finaliza_orden
              ? ' La orden pasa a Finalizada en Contabilium.'
              : ' La orden va a seguir como "Pagada" en Integraciones de Contabilium.'}
          </div>
          {resumen.datos.orden_ya_tiene_comprobante && (
            <div className="error-state" style={{ marginBottom: 12 }}>
              Esta orden ya tiene un comprobante en Contabilium. Revisá en Integraciones antes de facturar.
            </div>
          )}
          <p style={{ margin: '0 0 8px', fontSize: 15, lineHeight: 1.5 }}>
            <strong>{resumen.datos.comprador}</strong><br />
            {resumen.datos.tipo_doc} {resumen.datos.nro_doc}<br />
            Factura <strong>{resumen.datos.etiqueta_fc}</strong>
            {resumen.datos.cliente_existe
              ? ` (cliente existente${resumen.datos.condicion_iva_real ? `, IVA: ${resumen.datos.condicion_iva_real}` : ''})`
              : ' (cliente nuevo: se crea en Contabilium)'}
            <br />
            Total: <strong>${resumen.datos.total}</strong>
          </p>
          {resumen.datos.condicion_iva_vacia && (
            <div className="error-state" style={{ marginBottom: 8 }}>
              Este cliente no tiene Condición de IVA cargada. Si AFIP la rechaza se completa sola y queda en "Para revisar".
            </div>
          )}
          <div className="list">
            {resumen.datos.items.map((it, i) => (
              <div key={i} className="row">
                <div className="title-cell">
                  {it.Cantidad} × {it.Concepto}
                  <span className="id-cell mono">neto ${it.PrecioUnitario} · IVA {it.Iva}%</span>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}

      {confirmandoLote && (
        <Modal
          titulo={`Facturar ${elegidas.length} venta(s)`}
          onCerrar={() => !creandoLote && setConfirmandoLote(false)}
          footer={
            <>
              <button className="sort-btn" disabled={creandoLote} onClick={() => setConfirmandoLote(false)}>Cancelar</button>
              <button className="scan-btn" disabled={creandoLote} onClick={iniciarLote}>
                {creandoLote ? 'Armando el lote...' : data?.modo?.simulacion ? 'Simular el lote' : `Facturar ${elegidas.length}`}
              </button>
            </>
          }
        >
          {data?.modo?.simulacion ? (
            <div className="error-state" style={{ marginBottom: 12 }}>MODO SIMULACIÓN: no se va a emitir nada real ante AFIP.</div>
          ) : (
            <div className="error-state" style={{ marginBottom: 12 }}>
              Se van a emitir {elegidas.length} facturas REALES ante AFIP por {formatoPesos.format(totalElegidas)} en total. No se pueden deshacer.
            </div>
          )}
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
            Se facturan de a una, en el servidor. Podés bloquear el celular o cerrar la pantalla: sigue solo y al volver ves cómo quedó.
            Cada venta pasa por los mismos controles que el botón Facturar (ya facturada, adjunto en ML, etc.) y las que fallen quedan
            marcadas sin frenar a las demás.
          </p>
        </Modal>
      )}

      {aviso && <AlertModal mensaje={aviso} onCerrar={() => setAviso(null)} />}
    </>
  )
}
