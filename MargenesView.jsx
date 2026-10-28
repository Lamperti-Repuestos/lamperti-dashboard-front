import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'

// Margen de cada venta de ML = Total que muestra ML (precio − cargo por vender − costo fijo − impuestos)
// − costo del producto en el proveedor con IVA. Por ahora solo Expoyer.

const pesos = (n) => (n == null ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n))
const pesosExactos = (n) => (n == null ? '—' : new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 2 }).format(n))
const hoy = () => new Date().toLocaleDateString('en-CA')

const ESTADOS = {
  ok: null,
  falta_codigo: { texto: 'Falta código de proveedor', clase: 'badge-sin-explicar' },
  proveedor_no_integrado: { texto: 'Proveedor sin integrar', clase: 'badge-acordar' },
  sin_producto: { texto: 'SKU no está en Contabilium', clase: 'badge-acordar' },
  error: { texto: 'No se pudo calcular', clase: 'badge-sin-explicar' },
}

function colorMargen(pct) {
  if (pct == null) return 'var(--gray-muted)'
  if (pct < 0) return 'var(--alerta)'
  if (pct < 10) return 'var(--atencion)'
  return 'var(--ok)'
}

function FilaFaltaCodigo({ fila, onGuardado, onUnauthorized }) {
  const [codigo, setCodigo] = useState(fila.codigo_proveedor || '')
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const guardar = () => {
    setGuardando(true)
    setMensaje(null)
    apiFetch('/margenes/codigo-proveedor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku: fila.sku, codigo }),
    }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setMensaje(d.simulado
          ? `Simulado (Contabilium en modo prueba): no se guardó. Expoyer: ${d.producto.codigo_comercial}, costo ${pesosExactos(d.producto.costo_sin_iva)} + IVA`
          : `Guardado: ${d.producto.codigo_comercial}, costo ${pesosExactos(d.producto.costo_sin_iva)} + IVA`)
        if (!d.simulado) onGuardado()
      })
      .catch((e) => setMensaje(`Error: ${e.message}`))
      .finally(() => setGuardando(false))
  }

  return (
    <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="title-cell">{fila.titulo}</div>
        <span className="id-cell mono">{fila.ventas} {fila.ventas === 1 ? 'venta' : 'ventas'}</span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--gray-muted)' }}>
        SKU <span className="mono">{fila.sku || 'sin SKU'}</span>
        {' · '}{fila.proveedor ? `Proveedor: ${fila.proveedor}` : 'Sin proveedor en Contabilium'}
        {fila.codigo_proveedor && <> · el código cargado (<span className="mono">{fila.codigo_proveedor}</span>) no está en Expoyer</>}
      </div>
      {fila.sku && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            className="search-input"
            style={{ flex: '1 1 160px' }}
            placeholder="Código Expoyer (ej: 1192W00-I)"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && codigo.trim() && guardar()}
          />
          <button className="scan-btn" onClick={guardar} disabled={guardando || !codigo.trim()}>
            {guardando ? 'Guardando…' : 'Guardar en Contabilium'}
          </button>
        </div>
      )}
      {mensaje && <div style={{ fontSize: 12, color: mensaje.startsWith('Error') ? 'var(--alerta)' : 'var(--gray-muted)' }}>{mensaje}</div>}
    </div>
  )
}

function FilaVenta({ v }) {
  const [abierta, setAbierta] = useState(false)
  const estado = ESTADOS[v.estado]
  const errorOrden = v.items.find((i) => i.error_orden)?.error_orden
  const items = v.items.filter((i) => !i.error_orden)
  return (
    <div className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4, cursor: 'pointer' }} onClick={() => setAbierta(!abierta)}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <div className="title-cell">{v.titulo}</div>
        {v.margen != null && v.estado === 'ok'
          ? <span className="mono" style={{ fontWeight: 700, color: colorMargen(v.margen_pct), whiteSpace: 'nowrap' }}>{pesos(v.margen)} ({v.margen_pct}%)</span>
          : estado && <span className={`badge ${estado.clase}`} style={{ marginTop: 0 }}>{estado.texto}</span>}
      </div>
      <div style={{ fontSize: 12, color: 'var(--gray-muted)' }}>
        {new Date(v.fecha).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
        {' · '}#{v.order_id} · Precio {pesos(v.precio)} · Total ML {pesos(v.total_ml)} · Costo {pesos(v.costo_con_iva)}
      </div>
      {abierta && (
        <div style={{ fontSize: 12, display: 'grid', gap: 2, marginTop: 4 }}>
          <div>Precio: <span className="mono">{pesosExactos(v.precio)}</span></div>
          <div>− Cargo por vender (con costo fijo): <span className="mono">{pesosExactos(v.cargo_por_vender)}</span></div>
          <div>− Impuestos: <span className="mono">{v.impuestos == null ? 'no se pudo leer' : pesosExactos(v.impuestos)}</span></div>
          <div><strong>= Total ML: <span className="mono">{pesosExactos(v.total_ml)}</span></strong></div>
          {items.map((i, k) => (
            <div key={k}>
              − {i.cantidad} × <span className="mono">{i.codigo_comercial || i.sku || 'sin SKU'}</span>
              {i.costo_con_iva != null
                ? <> en {i.proveedor}: <span className="mono">{pesosExactos(i.costo_sin_iva)}</span> + IVA = <span className="mono">{pesosExactos(i.costo_con_iva)}</span></>
                : <> — {ESTADOS[i.estado]?.texto || i.estado}{i.error ? ` (${i.error})` : ''}</>}
            </div>
          ))}
          {v.margen != null && <div><strong>= Margen: <span className="mono">{pesosExactos(v.margen)}</span> ({v.margen_pct}% del precio)</strong></div>}
          {errorOrden && <div style={{ color: 'var(--alerta)' }}>{errorOrden}</div>}
        </div>
      )}
    </div>
  )
}

export default function MargenesView({ onUnauthorized }) {
  const [desde, setDesde] = useState(hoy())
  const [hasta, setHasta] = useState(hoy())
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const consulta = useRef(0)

  // El backend calcula de a tandas: mientras queden pendientes, se vuelve a pedir (lo ya calculado queda guardado).
  const cargar = () => {
    const id = ++consulta.current
    setCargando(true)
    setError(null)
    const pedir = () => apiFetch(`/margenes/ventas?desde=${desde}&hasta=${hasta}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        if (id !== consulta.current) return
        setData(d)
        if (d.pendientes > 0) return pedir()
        setCargando(false)
      })
    pedir().catch((e) => {
      if (id !== consulta.current) return
      setError(e.message)
      setCargando(false)
    })
  }

  useEffect(cargar, [desde, hasta])

  const r = data?.resumen
  return (
    <>
      <div className="controls" style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          Desde
          <input type="date" className="search-input" style={{ width: 150 }} value={desde} max={hoy()}
            onChange={(e) => { setDesde(e.target.value); if (e.target.value > hasta) setHasta(e.target.value) }} />
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          Hasta
          <input type="date" className="search-input" style={{ width: 150 }} value={hasta} min={desde} max={hoy()}
            onChange={(e) => setHasta(e.target.value)} />
        </label>
        <button className="sort-btn" onClick={cargar} disabled={cargando}>🔄 Actualizar</button>
      </div>

      {error && <div className="error-state">Error: {error}</div>}
      {cargando && (
        <div className="loading-state">
          Calculando márgenes…{data?.pendientes > 0 && ` (faltan ${data.pendientes} ventas)`}
        </div>
      )}

      {r && (
        <div className="summary">
          <div className="summary-item">
            <div className="value mono">{r.con_margen}/{r.ventas}</div>
            <div className="label">Ventas con margen</div>
          </div>
          <div className="summary-item">
            <div className="value mono">{pesos(r.facturacion)}</div>
            <div className="label">Precio de venta</div>
          </div>
          <div className="summary-item">
            <div className="value mono">{pesos(r.total_ml)}</div>
            <div className="label">Total ML</div>
          </div>
          <div className="summary-item">
            <div className="value mono">{pesos(r.costo)}</div>
            <div className="label">Costo con IVA</div>
          </div>
          <div className="summary-item">
            <div className="value mono" style={{ color: colorMargen(r.margen_pct) }}>{pesos(r.margen)}</div>
            <div className="label">Margen{r.margen_pct != null && ` (${r.margen_pct}%)`}</div>
          </div>
        </div>
      )}

      {data?.falta_codigo?.length > 0 && (
        <div className="list" style={{ flex: 'none', paddingBottom: 16 }}>
          <h2 className="section-title" style={{ margin: '0 0 6px 12px' }}>Falta código de proveedor ({data.falta_codigo.length})</h2>
          <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '0 0 8px 12px' }}>
            Se guarda en el campo Código de proveedor de Contabilium (y Expoyer como proveedor si no tenía ninguno).
            {data.contabilium_simulado && ' ⚠️ Contabilium está en modo prueba: no se va a guardar nada.'}
          </p>
          {data.falta_codigo.map((f) => (
            <FilaFaltaCodigo key={f.sku || f.titulo} fila={f} onGuardado={cargar} onUnauthorized={onUnauthorized} />
          ))}
        </div>
      )}

      {data && (
        <div className="list">
          <h2 className="section-title" style={{ margin: '0 0 6px 12px' }}>Ventas ({data.ventas.length})</h2>
          {data.ventas.map((v) => <FilaVenta key={v.order_id} v={v} />)}
          {data.ventas.length === 0 && !cargando && <div className="empty-state">Sin ventas pagadas en estas fechas.</div>}
        </div>
      )}
    </>
  )
}
