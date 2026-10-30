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
const soloFecha = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })

// "12.000", "12000", "12.000,50" o "$ 12000" -> número (null si está vacío o no se entiende)
const aNumero = (texto) => {
  const limpio = String(texto || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  if (!limpio) return null
  const n = Number(limpio)
  return Number.isFinite(n) ? n : null
}

const RANGOS_RAPIDOS = [
  { label: 'Últimos 30 días', desde: () => haceDiasISO(30) },
  { label: 'Últimos 90 días', desde: () => haceDiasISO(90) },
  { label: 'Este año', desde: () => `${new Date().getFullYear()}-01-01` },
  { label: 'Todo', desde: () => '2000-01-01' },
]

const card = { background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 'var(--radius)', padding: '12px 14px' }

function letra(tipoFc) {
  const t = String(tipoFc || '').toUpperCase()
  return t.startsWith('NC') ? `Nota de crédito ${t.slice(-1)}` : t.startsWith('ND') ? `Nota de débito ${t.slice(-1)}` : `Factura ${t.slice(-1)}`
}

function FilaFactura({ f, onUnauthorized }) {
  const [abriendo, setAbriendo] = useState(false)
  const [errorPdf, setErrorPdf] = useState(null)
  const [pdfUrl, setPdfUrl] = useState(null) // la factura se ve en un recuadro dentro de Miguelito, sin abrir otra pestaña

  const cerrarPdf = () => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl)
    setPdfUrl(null)
  }

  useEffect(() => {
    if (!pdfUrl) return undefined
    const alTeclear = (e) => { if (e.key === 'Escape') cerrarPdf() }
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [pdfUrl]) // eslint-disable-line react-hooks/exhaustive-deps

  const abrirPdf = async () => {
    setAbriendo(true)
    setErrorPdf(null)
    try {
      const res = await apiFetch(f.pdf_ruta, {}, onUnauthorized)
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'No pude traer el PDF')
      const blob = await res.blob()
      setPdfUrl(URL.createObjectURL(new Blob([blob], { type: 'application/pdf' })))
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
          {f.nro_doc ? <span style={{ color: 'var(--gray-muted)', fontSize: 13 }}> · {f.tipo_doc || 'Doc'} {f.nro_doc}</span> : null}
        </div>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontWeight: 700, color: f.es_nota_credito ? 'var(--alerta)' : 'var(--charcoal)' }}>
          {f.es_nota_credito ? '−' : ''}{pesos(f.total)}
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--gray-muted)', marginTop: 2 }}>
        {fechaCorta(f.fecha)} · <span style={f.es_nota_credito ? { color: 'var(--alerta)', fontWeight: 700 } : undefined}>{letra(f.tipo_fc)}</span> {f.numero_factura || ''}
        {f.origen === 'ml' ? ` · venta ML ${f.numero_orden_ml || ''}` : ' · fuera de ML'}
        {f.adjunta_ml ? ' · ✔ cargada en ML' : ''}
        {f.condicion_venta ? ` · ${f.condicion_venta}` : ''}
      </div>
      {f.observaciones ? <div style={{ fontSize: 12, color: 'var(--gray-muted)', marginTop: 2 }}>Obs.: {f.observaciones}</div> : null}

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
        {f.url_comprobante && !f.pdf_ruta && <a className="sort-btn" href={f.url_comprobante} target="_blank" rel="noreferrer">Ver factura</a>}
        {f.pdf_ruta && (
          <button type="button" className="sort-btn" onClick={abrirPdf} disabled={abriendo}>{abriendo ? 'Abriendo…' : 'Ver factura'}</button>
        )}
        {errorPdf && <span role="alert" style={{ fontSize: 12, color: 'var(--alerta)' }}>{errorPdf}</span>}
      </div>
      {pdfUrl && (
        <div className="modal-overlay" onClick={cerrarPdf}>
          <div className="modal" style={{ maxWidth: 900, height: '90vh', maxHeight: '90vh' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <strong>{letra(f.tipo_fc)} {f.numero_factura || ''} · {f.comprador || ''}</strong>
              <button className="modal-close" onClick={cerrarPdf} aria-label="Cerrar">✕</button>
            </div>
            <iframe title="Factura" src={pdfUrl} style={{ flex: 1, width: '100%', border: 0, minHeight: 0 }} />
            <div className="modal-footer">
              <a className="sort-btn" href={pdfUrl} download={`factura_${f.numero_factura || f.id}.pdf`}>Descargar PDF</a>
              <button className="sort-btn" onClick={cerrarPdf}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function HistoricoFacturasView({ onUnauthorized }) {
  const [cliente, setCliente] = useState('')
  const [producto, setProducto] = useState('')
  const [desde, setDesde] = useState(haceDiasISO(30))
  const [hasta, setHasta] = useState(hoyISO())
  const [montoMin, setMontoMin] = useState('')
  const [montoMax, setMontoMax] = useState('')
  const [resultado, setResultado] = useState(null)       // la última respuesta (totales, avisos); las facturas van acumuladas en `facturas`
  const [facturas, setFacturas] = useState([])
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [avance, setAvance] = useState(null)

  // Trae una página. Sin `seguir`, empieza de cero; con `seguir`, agrega las siguientes 50 a las que ya se ven.
  const buscar = (override = {}, seguir = false) => {
    const p = { cliente, producto, desde, hasta, montoMin, montoMax, ...override }
    setCargando(true)
    setError(null)
    const qs = new URLSearchParams({ cliente: p.cliente.trim(), producto: p.producto.trim(), desde: p.desde, hasta: p.hasta })
    if (aNumero(p.montoMin) != null) qs.set('monto_min', String(aNumero(p.montoMin)))
    if (aNumero(p.montoMax) != null) qs.set('monto_max', String(aNumero(p.montoMax)))
    if (seguir && resultado?.siguiente != null) qs.set('desde_fila', String(resultado.siguiente))
    apiFetch(`/facturacion/historico?${qs}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setResultado(d)
        setFacturas((prev) => (seguir ? [...prev, ...d.facturas] : d.facturas))
      })
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
    setMontoMin('')
    setMontoMax('')
    buscar({ cliente: '', producto: '', montoMin: '', montoMax: '' })
  }

  const cob = resultado?.cobertura
  const t = resultado?.totales
  const enter = (e) => { if (e.key === 'Enter') buscar() }
  const comp = avance?.comprobantes

  return (
    <div style={{ padding: '0 12px 24px' }}>
      <h2 style={{ margin: '0 0 4px', color: 'var(--charcoal)' }}>🔎 Histórico de facturas</h2>
      <div style={{ fontSize: 13, color: 'var(--gray-muted)', marginBottom: 12 }}>
        Todo lo que facturaste, de ML y de afuera. Buscá lo que le facturaste a un cliente o a quién le facturaste un producto. Podés usar solo uno de los filtros o combinarlos, también con el monto (sobre el total de cada comprobante).
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
          <label style={{ fontSize: 12, color: 'var(--gray-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            Monto mín. ($)
            <input className="corte-input" style={{ width: 110, maxWidth: 'none' }} inputMode="decimal" placeholder="Ej: 10.000" value={montoMin}
              onChange={(e) => setMontoMin(e.target.value)} onKeyDown={enter} />
          </label>
          <label style={{ fontSize: 12, color: 'var(--gray-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            Monto máx. ($)
            <input className="corte-input" style={{ width: 110, maxWidth: 'none' }} inputMode="decimal" placeholder="Ej: 50.000" value={montoMax}
              onChange={(e) => setMontoMax(e.target.value)} onKeyDown={enter} />
          </label>
          <button type="submit" className="scan-btn" disabled={cargando}>{cargando && facturas.length === 0 ? 'Buscando…' : 'Buscar'}</button>
          <button type="button" className="sort-btn" onClick={limpiar}>Limpiar</button>
        </div>
        {aNumero(montoMin) != null && aNumero(montoMax) != null && aNumero(montoMin) > aNumero(montoMax) && (
          <div role="alert" style={{ fontSize: 12, color: 'var(--atencion)' }}>⚠ El monto mínimo es mayor que el máximo: no va a encontrar nada.</div>
        )}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {RANGOS_RAPIDOS.map((r) => (
            <button key={r.label} type="button" className="sort-btn" onClick={() => rangoRapido(r)}>{r.label}</button>
          ))}
        </div>
      </form>

      {error && <div className="error-state" role="alert" style={{ marginTop: 10 }}>No pude buscar: {error}</div>}

      {resultado && (
        <div style={{ marginTop: 12 }}>
          <div style={{ ...card, display: 'flex', gap: 18, flexWrap: 'wrap', color: 'var(--charcoal)' }} role="status" aria-live="polite">
            <div><strong>{t.facturas}</strong> {t.facturas === 1 ? 'comprobante' : 'comprobantes'}</div>
            <div>Facturado: <strong>{pesos(t.total_facturado)}</strong></div>
            {t.unidades_del_producto != null && <div>Unidades del producto: <strong>{t.unidades_del_producto}</strong></div>}
            <div style={{ color: 'var(--gray-muted)', fontSize: 13 }}>{resultado.desde < '2010' ? 'desde el principio' : `desde el ${fechaCorta(`${resultado.desde}T12:00:00`)}`} hasta el {fechaCorta(`${resultado.hasta}T12:00:00`)}</div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-muted)', marginTop: 4 }}>Las notas de crédito restan del total.</div>

          {resultado.aviso && <div style={{ marginTop: 8, fontSize: 13, color: 'var(--atencion)' }}>⚠ {resultado.aviso}</div>}
          {cob.rango_sin_cargar && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--atencion)' }}>
              ⚠ Las facturas de afuera de ML se están cargando desde Contabilium hacia atrás
              {cob.contabilium_cargado_desde ? ` (ya están cargadas desde el ${soloFecha(cob.contabilium_cargado_desde)})` : ' (todavía no empezó)'}.
              Antes de esa fecha solo ves las de ML.
            </div>
          )}
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

          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {facturas.length === 0 && !cargando && (
              <div style={{ ...card, color: 'var(--gray-muted)' }}>No encontré facturas con esos filtros en ese rango de fechas.</div>
            )}
            {facturas.map((f) => <FilaFactura key={f.id} f={f} onUnauthorized={onUnauthorized} />)}
          </div>

          {facturas.length > 0 && (
            <div style={{ marginTop: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--gray-muted)' }}>Mostrando {facturas.length} de {t.facturas}</span>
              {resultado.hay_mas && (
                <button type="button" className="scan-btn" onClick={() => buscar({}, true)} disabled={cargando}>
                  {cargando ? 'Cargando…' : `Mostrar ${Math.min(50, t.facturas - facturas.length)} más`}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* el contador de carga solo se ve mientras falta traer algo; con todo cargado desaparece */}
      {avance && ((avance.total > 0 && avance.pendiente > 0) || (comp && comp.total > 0 && comp.pendiente > 0)) && (
        <div style={{ marginTop: 16, fontSize: 12, color: 'var(--gray-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {avance.total > 0 && avance.pendiente > 0 && (
            <div>
              Ventas de ML: productos cargados en {avance.completas} de {avance.total} facturas
              {avance.pendiente > 0 ? ` · quedan ${avance.pendiente}` : ''}.
            </div>
          )}
          {comp && comp.total > 0 && comp.pendiente > 0 && (
            <div>
              Todas las facturas de Contabilium: {comp.total} cargadas{comp.cubre_desde ? ` (desde el ${soloFecha(comp.cubre_desde)})` : ''}
              {' '}· productos en {comp.ok + comp.sin_datos} de {comp.total}{comp.pendiente > 0 ? ` · quedan ${comp.pendiente}` : ''}.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
