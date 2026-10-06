import { useEffect, useMemo, useState } from 'react'
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
  const [busqueda, setBusqueda] = useState('')
  const [recarga, setRecarga] = useState(0)

  const [preparando, setPreparando] = useState(null) // número de ML en proceso de "preparar"
  const [resumen, setResumen] = useState(null) // { venta, datos }
  const [facturando, setFacturando] = useState(false)
  const [aviso, setAviso] = useState(null)

  useEffect(() => {
    let vigente = true
    setCargando(true)
    setError(null)
    apiFetch(`/facturacion/pendientes?dias=${dias}`, {}, onUnauthorized)
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
  }, [dias, recarga])

  const ventas = data?.ventas || []
  const cantFacturadas = ventas.filter((v) => v.facturada).length
  const cantPendientes = ventas.length - cantFacturadas

  const visibles = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return ventas.filter((v) => {
      if (filtro === 'pendientes' && v.facturada) return false
      if (filtro === 'facturadas' && !v.facturada) return false
      if (!q) return true
      return (
        String(v.id_orden_ml).includes(q) ||
        (v.comprador || '').toLowerCase().includes(q) ||
        (v.factura?.numero_factura || '').toLowerCase().includes(q)
      )
    })
  }, [ventas, filtro, busqueda])

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
      setAviso(d.simulado ? d.mensaje : `Factura emitida: ${d.numero_factura}\nCAE ${d.cae}`)
      setRecarga((n) => n + 1)
    } catch (err) {
      setResumen(null)
      setAviso(`No se facturó:\n${err.message}`)
      setRecarga((n) => n + 1)
    } finally {
      setFacturando(false)
    }
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
            {[1, 3, 7, 15, 30].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <button className={`sort-btn ${filtro === 'pendientes' ? 'active-outline' : ''}`} onClick={() => setFiltro('pendientes')}>
          🔴 Pendientes ({cantPendientes})
        </button>
        <button className={`sort-btn ${filtro === 'facturadas' ? 'active-outline' : ''}`} onClick={() => setFiltro('facturadas')}>
          🟢 Facturadas ({cantFacturadas})
        </button>
        <button className={`sort-btn ${filtro === 'todas' ? 'active-outline' : ''}`} onClick={() => setFiltro('todas')}>
          Todas ({ventas.length})
        </button>
        <input
          className="corte-input"
          style={{ width: 200 }}
          placeholder="Buscar comprador o número"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
        />
        <button className="sort-btn" onClick={() => setRecarga((n) => n + 1)} disabled={cargando}>↻ Actualizar</button>
      </div>

      {data && data.cruce_historico_ok === false && (
        <div className="error-state">
          No pude consultar Contabilium para cruzar las ventas con lo ya facturado. Hasta que se resuelva, una venta
          marcada como Pendiente puede estar ya facturada: no factures sin revisar antes.
        </div>
      )}

      {revision.length > 0 && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>⚠️ Para revisar ({revision.length})</h3>
          <div className="id-cell mono" style={{ marginBottom: 8 }}>
            Al cliente le faltaba la Condición de IVA y se completó sola. Confirmá en Contabilium que sea la correcta.
          </div>
          <div className="list">
            {revision.map((f) => (
              <div key={f.id_orden_contabilium} className="row">
                <div className="title-cell">
                  {f.comprador}
                  <span className="id-cell mono">
                    {f.tipo_doc} {f.nro_doc} · Factura {f.numero_factura}
                  </span>
                </div>
                <button className="sort-btn" onClick={() => marcarRevisado(f)}>Ya la revisé</button>
              </div>
            ))}
          </div>
        </>
      )}

      {cargando && <div className="loading-state">Cargando ventas...</div>}
      {error && <div className="error-state">Error: {error}</div>}

      {!cargando && data && (
        <div className="list" style={{ marginTop: 12 }}>
          {visibles.length === 0 && <div className="empty-state">No hay ventas para mostrar con este filtro.</div>}
          {visibles.map((v) => (
            <div key={v.id_orden_ml} className="row">
              <span style={{ fontSize: 20 }} title={v.facturada ? 'Facturada' : 'Pendiente'}>
                {v.facturada ? '🟢' : '🔴'}
              </span>
              <div className="title-cell">
                {v.comprador || '—'}
                <span className="id-cell mono">
                  {v.fecha ? new Date(v.fecha).toLocaleString('es-AR') : '—'} · #{v.id_orden_ml}
                  {v.facturada && v.factura ? ` · Factura ${v.factura.tipo_fc === 'FCA' ? 'A' : 'B'} ${v.factura.numero_factura}` : ''}
                  {!v.facturada && v.en_contabilium === false ? ' · todavía no está en Contabilium' : ''}
                </span>
              </div>
              <span className="badge badge-acordar">{formatoPesos.format(v.total || 0)}</span>
              {v.facturada ? (
                v.factura?.url_comprobante && (
                  <a className="sort-btn" href={v.factura.url_comprobante} target="_blank" rel="noreferrer">Ver factura</a>
                )
              ) : (
                <button
                  className="scan-btn"
                  disabled={preparando !== null || facturando}
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

      {aviso && <AlertModal mensaje={aviso} onCerrar={() => setAviso(null)} />}
    </>
  )
}
