import { useEffect, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
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

// Si el SKU termina en TAPA (ej C12140730ASTAPA), lo de antes suele ser el SKU del depósito: se ofrece de entrada.
function componentesSugeridos(sku) {
  const m = /^(.+?)TAPA[A-Z]*$/i.exec(sku || '')
  return [{ sku: m ? m[1] : '', cantidad: 1 }, { sku: '', cantidad: 1 }]
}

// Un SKU que se vende como combo (ej: depósito + tapa): se cargan los SKU de cada producto y cuántos lleva.
// El costo del combo es la suma de los costos de esos productos (cada uno con su proveedor y su código).
function FormCombo({ sku, inicial, onGuardado, onUnauthorized }) {
  const [filas, setFilas] = useState(inicial?.length ? inicial : componentesSugeridos(sku))
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const validas = filas.filter((f) => f.sku.trim())

  const cambiar = (k, campo, valor) => setFilas(filas.map((f, i) => (i === k ? { ...f, [campo]: valor } : f)))

  const guardar = () => {
    setGuardando(true)
    setMensaje(null)
    apiFetch('/margenes/combos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sku, componentes: validas.map((f) => ({ sku: f.sku.trim(), cantidad: Number(f.cantidad) || 1 })) }),
    }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        setMensaje('Combo guardado. Se recalcula ahora.')
        onGuardado()
      })
      .catch((e) => setMensaje(`Error: ${e.message}`))
      .finally(() => setGuardando(false))
  }

  return (
    <div style={{ display: 'grid', gap: 6, padding: 8, borderRadius: 8, background: 'var(--bg-activo)' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ fontSize: 12 }}>Productos que forman <span className="mono">{sku}</span> (SKU de cada uno; con o sin guion, da igual):</div>
      {filas.map((f, k) => (
        <div key={k} style={{ display: 'flex', gap: 6 }}>
          <input className="search-input" style={{ flex: '1 1 140px' }} placeholder={k === 0 ? 'SKU (ej: el depósito)' : 'SKU (ej: la tapa)'}
            value={f.sku} onChange={(e) => cambiar(k, 'sku', e.target.value.toUpperCase())} />
          <input className="search-input" style={{ flex: '0 0 64px' }} type="number" min="1" title="Cantidad en el combo"
            value={f.cantidad} onChange={(e) => cambiar(k, 'cantidad', e.target.value)} />
          {filas.length > 1 && (
            <button className="sort-btn" title="Quitar" onClick={() => setFilas(filas.filter((_, i) => i !== k))}>✕</button>
          )}
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button className="sort-btn" onClick={() => setFilas([...filas, { sku: '', cantidad: 1 }])}>+ Otro producto</button>
        <button className="scan-btn" onClick={guardar} disabled={guardando || validas.length === 0}>
          {guardando ? 'Guardando…' : 'Guardar combo'}
        </button>
      </div>
      {mensaje && <div style={{ fontSize: 12, color: mensaje.startsWith('Error') ? 'var(--alerta)' : 'var(--gray-muted)' }}>{mensaje}</div>}
    </div>
  )
}

// Los SKU ya cargados como combo, para revisarlos, corregirlos o quitarlos.
function CombosCargados({ onCambio, onUnauthorized }) {
  const [abierto, setAbierto] = useState(false)
  const [combos, setCombos] = useState(null)
  const [editando, setEditando] = useState(null)
  const [error, setError] = useState(null)

  const cargar = () => {
    apiFetch('/margenes/combos', {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        setCombos(d.combos)
      })
      .catch((e) => setError(e.message))
  }

  useEffect(() => { if (abierto) cargar() }, [abierto])

  const quitar = (sku) => {
    apiFetch(`/margenes/combos/${encodeURIComponent(sku)}`, { method: 'DELETE' }, onUnauthorized)
      .then(() => { cargar(); onCambio() })
  }

  const guardado = () => { setEditando(null); cargar(); onCambio() }

  return (
    <div className="list" style={{ flex: 'none' }}>
      <button className="sort-btn" onClick={() => setAbierto(!abierto)}>🧩 {abierto ? 'Ocultar' : 'Ver'} combos cargados</button>
      {abierto && error && <div className="error-state">Error: {error}</div>}
      {abierto && combos && (
        <div style={{ marginTop: 8 }}>
          {combos.length === 0 && <div className="empty-state">Todavía no hay combos cargados.</div>}
          {combos.map((c) => (
            <div key={c.sku} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <div className="title-cell mono">{c.sku}</div>
                <button className="sort-btn" onClick={() => setEditando(editando === c.sku ? null : c.sku)}>Editar</button>
                <button className="sort-btn" onClick={() => quitar(c.sku)}>Quitar</button>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-muted)' }}>
                = {c.componentes.map((x) => `${x.cantidad > 1 ? `${x.cantidad} × ` : ''}${x.sku}`).join(' + ')}
              </div>
              {editando === c.sku && <FormCombo sku={c.sku} inicial={c.componentes} onGuardado={guardado} onUnauthorized={onUnauthorized} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function FilaFaltaCodigo({ fila, onGuardado, onUnauthorized }) {
  const [esCombo, setEsCombo] = useState(false)
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
        {fila.parte_de?.length > 0 && <> · es parte del combo <span className="mono">{fila.parte_de.join(', ')}</span></>}
      </div>
      {fila.sku && !fila.parte_de?.length && (
        <label style={{ fontSize: 12, display: 'flex', gap: 6, alignItems: 'center' }}>
          <input type="checkbox" checked={esCombo} onChange={(e) => setEsCombo(e.target.checked)} />
          Es un combo (varios productos, ej: depósito + tapa)
        </label>
      )}
      {esCombo && <FormCombo sku={fila.sku} onGuardado={onGuardado} onUnauthorized={onUnauthorized} />}
      {fila.sku && !esCombo && (
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

const fechaCorta = (iso) => new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })

// De dónde salió el costo: leído al vender, tomado del histórico a la fecha de la venta, o leído después (aproximado).
function FuenteCosto({ i }) {
  if (i.fuente_costo === 'historial') {
    return <div style={{ color: 'var(--gray-muted)', paddingLeft: 12 }}>costo que regía desde el {fechaCorta(i.historial_desde)} (hoy: {pesosExactos(i.costo_actual_sin_iva)} + IVA)</div>
  }
  if (i.fuente_costo === 'posterior') {
    return <div style={{ color: 'var(--atencion)', paddingLeft: 12 }}>⚠️ costo leído {i.dias_despues} días después de la venta (todavía no había histórico de esa fecha)</div>
  }
  if (i.costo_leido) {
    return <div style={{ color: 'var(--gray-muted)', paddingLeft: 12 }}>costo al momento de la venta (leído el {fechaCorta(i.costo_leido)})</div>
  }
  return null
}

function FilaVenta({ v, onRecalcular, onUnauthorized }) {
  const [abierta, setAbierta] = useState(false)
  const [comboDe, setComboDe] = useState(null)
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
              − {i.cantidad} × <span className="mono">{i.componentes ? i.sku : (i.codigo_comercial || i.sku || 'sin SKU')}</span>
              {i.costo_con_iva != null
                ? <>{i.componentes ? ' (combo)' : ` en ${i.proveedor}`}: <span className="mono">{pesosExactos(i.costo_sin_iva)}</span> + IVA = <span className="mono">{pesosExactos(i.costo_con_iva)}</span></>
                : <> — {ESTADOS[i.estado]?.texto || i.estado}{i.error ? ` (${i.error})` : ''}</>}
              {i.costo_con_iva != null && !i.componentes && <FuenteCosto i={i} />}
              {i.componentes?.map((c, n) => (
                <div key={n} style={{ paddingLeft: 12 }}>
                  · {c.por_combo} × <span className="mono">{c.sku}</span>
                  {c.costo_con_iva != null
                    ? <> ({c.proveedor} <span className="mono">{c.codigo_comercial}</span>): <span className="mono">{pesosExactos(c.costo_sin_iva)}</span> + IVA = <span className="mono">{pesosExactos(c.costo_con_iva)}</span></>
                    : <> — {ESTADOS[c.estado]?.texto || c.estado}{c.error ? ` (${c.error})` : ''}</>}
                  {c.costo_con_iva != null && <FuenteCosto i={c} />}
                </div>
              ))}
              {i.estado !== 'ok' && !i.componentes && i.sku && (
                <button className="sort-btn" style={{ marginLeft: 8, padding: '2px 8px', fontSize: 12 }}
                  onClick={(e) => { e.stopPropagation(); setComboDe(comboDe === i.sku ? null : i.sku) }}>
                  ¿Es un combo?
                </button>
              )}
              {comboDe === i.sku && <FormCombo sku={i.sku} onGuardado={onRecalcular} onUnauthorized={onUnauthorized} />}
            </div>
          ))}
          {v.margen != null && <div><strong>= Margen: <span className="mono">{pesosExactos(v.margen)}</span> ({v.margen_pct}% del precio)</strong></div>}
          {errorOrden && <div style={{ color: 'var(--alerta)' }}>{errorOrden}</div>}
        </div>
      )}
    </div>
  )
}

function VentasMargenes({ onUnauthorized }) {
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
          {data.ventas.map((v) => <FilaVenta key={v.order_id} v={v} onRecalcular={cargar} onUnauthorized={onUnauthorized} />)}
          {data.ventas.length === 0 && !cargando && <div className="empty-state">Sin ventas pagadas en estas fechas.</div>}
        </div>
      )}

      <CombosCargados onCambio={cargar} onUnauthorized={onUnauthorized} />
    </>
  )
}

// Histórico de costos: un renglón por cada precio distinto que tuvo el producto en el proveedor. Se arma solo: cada
// venta lee el costo y una vez por día se vuelven a consultar todos los productos seguidos.
function HistoricoProducto({ sku, onUnauthorized }) {
  const [historial, setHistorial] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch(`/margenes/costos/${encodeURIComponent(sku)}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        setHistorial(d.historial)
      })
      .catch((e) => setError(e.message))
  }, [sku])

  if (error) return <div className="error-state">Error: {error}</div>
  if (!historial) return <div className="loading-state">Cargando…</div>

  // Escalones: cada costo rige desde su fecha hasta el siguiente; el último, hasta la última vez que se confirmó.
  const puntos = historial.map((h) => ({ t: new Date(h.desde).getTime(), costo: h.costo_sin_iva }))
  const ultimo = historial[historial.length - 1]
  if (ultimo) puntos.push({ t: new Date(ultimo.visto_hasta).getTime(), costo: ultimo.costo_sin_iva })

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 6 }}>
      {historial.length > 1 && (
        <ResponsiveContainer width="100%" height={160}>
          <LineChart data={puntos} margin={{ top: 8, right: 12, left: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--gray-line)" />
            <XAxis dataKey="t" type="number" scale="time" domain={['dataMin', 'dataMax']} tickFormatter={fechaCorta} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(n) => pesos(n)} tick={{ fontSize: 11 }} width={72} domain={['auto', 'auto']} />
            <Tooltip labelFormatter={fechaCorta} formatter={(n) => [pesosExactos(n), 'Costo sin IVA']} />
            <Line type="stepAfter" dataKey="costo" stroke="var(--navy)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
      <div style={{ fontSize: 12, display: 'grid', gap: 2 }}>
        {[...historial].reverse().map((h, k, arr) => {
          const anterior = arr[k + 1]
          const cambio = anterior ? ((h.costo_sin_iva / anterior.costo_sin_iva - 1) * 100).toFixed(1) : null
          return (
            <div key={h.desde}>
              Desde el {fechaCorta(h.desde)}: <span className="mono">{pesosExactos(h.costo_sin_iva)}</span> + IVA = <span className="mono">{pesosExactos(h.costo_con_iva)}</span>
              {cambio != null && <span style={{ color: cambio > 0 ? 'var(--alerta)' : 'var(--ok)' }}> ({cambio > 0 ? '+' : ''}{cambio}%)</span>}
              <span style={{ color: 'var(--gray-muted)' }}> · confirmado hasta el {fechaCorta(h.visto_hasta)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function HistoricoCostos({ onUnauthorized }) {
  const [productos, setProductos] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    apiFetch('/margenes/costos', {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        setProductos(d.productos)
      })
      .catch((e) => setError(e.message))
  }, [])

  const filtro = busqueda.trim().toLowerCase()
  const visibles = (productos || []).filter((p) => !filtro || [p.sku, p.codigo, p.descripcion].some((x) => (x || '').toLowerCase().includes(filtro)))
  const conCambios = visibles.filter((p) => p.cambios > 0).length

  return (
    <>
      <div className="controls" style={{ marginBottom: 12 }}>
        <input className="search-input" placeholder="Buscar por SKU, código o descripción…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
      </div>
      {error && <div className="error-state">Error: {error}</div>}
      {!productos && !error && <div className="loading-state">Cargando…</div>}
      {productos && (
        <div className="list">
          <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '0 0 8px 12px' }}>
            {visibles.length} productos seguidos · {conCambios} cambiaron de costo. Se suman solos cuando se venden.
          </p>
          {visibles.map((p) => (
            <div key={`${p.proveedor}-${p.sku}`} className="row" style={{ flexDirection: 'column', alignItems: 'stretch', gap: 4, cursor: 'pointer' }}
              onClick={() => setAbierto(abierto === p.sku ? null : p.sku)}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div className="title-cell">{p.descripcion || p.sku}</div>
                <span className="mono" style={{ whiteSpace: 'nowrap' }}>{pesosExactos(p.costo_sin_iva)}</span>
                {p.cambio_pct != null && (
                  <span className="mono" style={{ whiteSpace: 'nowrap', fontWeight: 700, color: p.cambio_pct > 0 ? 'var(--alerta)' : 'var(--ok)' }}>
                    {p.cambio_pct > 0 ? '▲ +' : '▼ '}{p.cambio_pct}%
                  </span>
                )}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-muted)' }}>
                {p.proveedor} · <span className="mono">{p.codigo || p.sku}</span> · sin IVA, rige desde el {fechaCorta(p.desde)}
                {p.costo_anterior_sin_iva != null && <> · antes {pesosExactos(p.costo_anterior_sin_iva)}</>}
                {p.cambios > 1 && <> · {p.cambios} cambios</>}
              </div>
              {abierto === p.sku && <HistoricoProducto sku={p.sku} onUnauthorized={onUnauthorized} />}
            </div>
          ))}
          {visibles.length === 0 && <div className="empty-state">Todavía no hay costos guardados{filtro ? ' con esa búsqueda' : ''}.</div>}
        </div>
      )}
    </>
  )
}

export default function MargenesView({ onUnauthorized }) {
  const [pestania, setPestania] = useState('ventas')
  return (
    <>
      <div className="tabs" style={{ padding: '16px var(--pad) 0' }}>
        <button className={`tab ${pestania === 'ventas' ? 'active' : ''}`} onClick={() => setPestania('ventas')}>Margen por venta</button>
        <button className={`tab ${pestania === 'costos' ? 'active' : ''}`} onClick={() => setPestania('costos')}>Histórico de costos</button>
      </div>
      {pestania === 'ventas' ? <VentasMargenes onUnauthorized={onUnauthorized} /> : <HistoricoCostos onUnauthorized={onUnauthorized} />}
    </>
  )
}
