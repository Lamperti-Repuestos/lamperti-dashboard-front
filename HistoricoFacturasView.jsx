import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const hoyISO = () => new Date().toLocaleDateString('en-CA')
const haceDiasISO = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toLocaleDateString('en-CA')
}
const pesos = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`)
const fechaCorta = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return `${DIAS_SEM[d.getDay()]} ${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`
}

const RANGOS_RAPIDOS = [
  { label: 'Últimos 30 días', desde: () => haceDiasISO(30) },
  { label: 'Últimos 90 días', desde: () => haceDiasISO(90) },
  { label: 'Este año', desde: () => `${new Date().getFullYear()}-01-01` },
  { label: 'Todo', desde: () => '2000-01-01' },
]

const card = { background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 'var(--radius)', padding: '12px 14px' }

function FilaFactura({ f, onUnauthorized }) {
  const [abriendo, setAbriendo] = useState(false)
  const [errorPdf, setErrorPdf] = useState(null)

  const abrirPdf = async () => {
    setAbriendo(true)
    setErrorPdf(null)
    try {
      const res = await apiFetch(`/facturacion/${f.id_contabilium}/pdf`, {}, onUnauthorized)
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'No pude traer el PDF')
      const url = URL.createObjectURL(await res.blob())
      window.open(url, '_blank')
    } catch (e) {
      setErrorPdf(e.message)
    } finally {
      setAbriendo(false)
    }
  }

  return (
    <div style={card}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'baseline' }}>
        <div style={{ color: 'var(--charcoal)' }}>
          <strong>{f.comprador || 'Sin nombre'}</strong>
          <span style={{ color: 'var(--gray-muted)', fontSize: 13 }}> · {f.tipo_doc || 'Doc'} {f.nro_doc || '—'}</span>
        </div>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: 'var(--charcoal)' }}>{pesos(f.total)}</div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--gray-muted)', marginTop: 2 }}>
        {fechaCorta(f.fecha)} · Factura {f.tipo_fc ? f.tipo_fc.slice(-1) : ''} {f.numero_factura || ''}
        {f.numero_orden_ml ? ` · venta ML ${f.numero_orden_ml}` : ''}
        {f.adjunta_ml ? ' · ✔ cargada en ML' : ''}
      </div>

      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {f.productos.length > 0 ? f.productos.map((p, i) => (
          <div key={i} style={{ fontSize: 14, color: 'var(--charcoal)', padding: '2px 6px', borderRadius: 6, background: p.coincide ? 'var(--bg-activo)' : 'transparent', fontWeight: p.coincide ? 700 : 400 }}>
            {p.cantidad} × {p.descripcion || 'Sin descripción'}
            {p.codigo ? <span style={{ color: 'var(--gray-muted)', fontWeight: 400 }}> · cód. {p.codigo}</span> : null}
          </div>
        )) : (
          <div style={{ fontSize: 13, color: 'var(--gray-muted)' }}>Todavía no tengo los productos de esta factura.</div>
        )}
        {f.skus_ml.length > 0 && (
          <div style={{ fontSize: 12, color: 'var(--gray-muted)', padding: '0 6px' }}>SKU en ML: {f.skus_ml.join(', ')}</div>
        )}
      </div>

      <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {f.url_comprobante && <a className="sort-btn" href={f.url_comprobante} target="_blank" rel="noreferrer">Ver factura</a>}
        {!f.url_comprobante && f.pdf_bajo_demanda && (
          <button type="button" className="sort-btn" onClick={abrirPdf} disabled={abriendo}>{abriendo ? 'Abriendo…' : 'Ver factura'}</button>
        )}
        {errorPdf && <span role="alert" style={{ fontSize: 12, color: 'var(--alerta)' }}>{errorPdf}</span>}
      </div>
    </div>
  )
}

export default function HistoricoFacturasView({ onUnauthorized }) {
  const [cliente, setCliente] = useState('')
  const [producto, setProducto] = useState('')
  const [desde, setDesde] = useState(haceDiasISO(30))
  const [hasta, setHasta] = useState(hoyISO())
  const [resultado, setResultado] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [avance, setAvance] = useState(null)

  const buscar = (override = {}) => {
    const p = { cliente, producto, desde, hasta, ...override }
    setCargando(true)
    setError(null)
    const qs = new URLSearchParams({ cliente: p.cliente.trim(), producto: p.producto.trim(), desde: p.desde, hasta: p.hasta })
    apiFetch(`/facturacion/historico?${qs}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then(setResultado)
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false))
  }

  useEffect(() => {
    buscar()
    apiFetch('/facturacion/historico/estado', {}, onUnauthorized)
      .then((res) => (res.ok ? res.json() : null))
      .then(setAvance)
      .catch(() => {})
  }, [])

  const rangoRapido = (r) => {
    const d = r.desde()
    const h = hoyISO()
    setDesde(d)
    setHasta(h)
    buscar({ desde: d, hasta: h })
  }

  const limpiar = () => {
    setCliente('')
    setProducto('')
    buscar({ cliente: '', producto: '' })
  }

  const cob = resultado?.cobertura
  const t = resultado?.totales
  const enter = (e) => { if (e.key === 'Enter') buscar() }

  return (
    <div style={{ padding: '0 12px 24px' }}>
      <h2 style={{ margin: '0 0 4px', color: 'var(--charcoal)' }}>🔎 Histórico de facturas</h2>
      <div style={{ fontSize: 13, color: 'var(--gray-muted)', marginBottom: 12 }}>
        Buscá lo que le facturaste a un cliente o a quién le facturaste un producto. Podés usar solo uno de los dos filtros.
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); buscar() }}
        style={{ ...card, display: 'flex', flexDirection: 'column', gap: 10 }}
      >
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <label style={{ flex: '1 1 240px', fontSize: 12, color: 'var(--gray-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            Cliente (CUIT, DNI o razón social)
            <input className="corte-input" style={{ width: '100%', maxWidth: 'none', boxSizing: 'border-box' }} value={cliente}
              onChange={(e) => setCliente(e.target.value)} onKeyDown={enter} placeholder="Ej: 20-11111111-2 o Larraburu" />
          </label>
          <label style={{ flex: '1 1 240px', fontSize: 12, color: 'var(--gray-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            Producto (SKU, código o descripción)
            <input className="corte-input" style={{ width: '100%', maxWidth: 'none', boxSizing: 'border-box' }} value={producto}
              onChange={(e) => setProducto(e.target.value)} onKeyDown={enter} placeholder="Ej: pastillas freno Palio" />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <label style={{ fontSize: 12, color: 'var(--gray-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            Desde
            <input type="date" className="corte-input" style={{ width: 150, maxWidth: 'none' }} value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--gray-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            Hasta
            <input type="date" className="corte-input" style={{ width: 150, maxWidth: 'none' }} value={hasta} min={desde} max={hoyISO()} onChange={(e) => setHasta(e.target.value)} />
          </label>
          <button type="submit" className="scan-btn" disabled={cargando}>{cargando ? 'Buscando…' : 'Buscar'}</button>
          <button type="button" className="sort-btn" onClick={limpiar}>Limpiar</button>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RANGOS_RAPIDOS.map((r) => (
            <button key={r.label} type="button" className="sort-btn" onClick={() => rangoRapido(r)}>{r.label}</button>
          ))}
        </div>
      </form>

      {error && <div className="error-state" role="alert" style={{ marginTop: 10 }}>No pude buscar: {error}</div>}

      {resultado && (
        <div style={{ marginTop: 12, opacity: cargando ? 0.6 : 1 }}>
          <div style={{ ...card, display: 'flex', gap: 18, flexWrap: 'wrap', color: 'var(--charcoal)' }} role="status" aria-live="polite">
            <div><strong>{t.facturas}</strong> {t.facturas === 1 ? 'factura' : 'facturas'}</div>
            <div>Facturado: <strong>{pesos(t.total_facturado)}</strong></div>
            {t.unidades_del_producto != null && <div>Unidades del producto: <strong>{t.unidades_del_producto}</strong></div>}
            <div style={{ color: 'var(--gray-muted)', fontSize: 13 }}>{resultado.desde < '2010' ? 'desde el principio' : `desde el ${fechaCorta(`${resultado.desde}T12:00:00`)}`} hasta el {fechaCorta(`${resultado.hasta}T12:00:00`)}</div>
          </div>

          {producto.trim() && cob.pendientes > 0 && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--atencion)' }}>
              ⚠ A {cob.pendientes} {cob.pendientes === 1 ? 'factura' : 'facturas'} de este período todavía no se les cargaron los productos
              (se completan solas, de a poco), así que esta búsqueda por producto puede no mostrarlas todavía.
            </div>
          )}
          {producto.trim() && cob.sin_datos > 0 && (
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--gray-muted)' }}>
              {cob.sin_datos} {cob.sin_datos === 1 ? 'factura' : 'facturas'} del período no tienen el detalle de productos disponible en Contabilium.
            </div>
          )}
          {resultado.truncado && (
            <div style={{ marginTop: 6, fontSize: 13, color: 'var(--atencion)' }}>
              Hay {t.facturas} resultados y muestro las primeras {resultado.facturas.length}. Afiná el cliente, el producto o el rango de fechas para ver el resto.
            </div>
          )}

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {resultado.facturas.length === 0 && (
              <div style={{ ...card, color: 'var(--gray-muted)' }}>No encontré facturas con esos filtros en ese rango de fechas.</div>
            )}
            {resultado.facturas.map((f) => <FilaFactura key={f.id} f={f} onUnauthorized={onUnauthorized} />)}
          </div>
        </div>
      )}

      {avance && avance.total > 0 && (
        <div style={{ marginTop: 14, fontSize: 12, color: 'var(--gray-muted)' }}>
          Productos cargados en {avance.completas} de {avance.total} facturas
          {avance.pendiente > 0 ? ` · quedan ${avance.pendiente} por completar` : ''}
          {avance.sin_datos > 0 ? ` · ${avance.sin_datos} sin detalle en Contabilium` : ''}.
        </div>
      )}
    </div>
  )
}
