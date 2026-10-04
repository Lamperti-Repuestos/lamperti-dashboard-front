import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

function mesActual() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function PedidorView({ onUnauthorized }) {
  const [vista, setVista] = useState('pendientes') // 'pendientes' | 'metricas' | 'cupos'
  const [proveedores, setProveedores] = useState([])
  const [proveedor, setProveedor] = useState('')
  const [pendientes, setPendientes] = useState([])
  const [cargandoProveedores, setCargandoProveedores] = useState(true)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

  const [metricas, setMetricas] = useState([])
  const [cargandoMetricas, setCargandoMetricas] = useState(false)
  const [errorMetricas, setErrorMetricas] = useState(null)
  const [busquedaMetricas, setBusquedaMetricas] = useState('')
  const [desdeMetricas, setDesdeMetricas] = useState('2025-01-01')

  const [mesCupos, setMesCupos] = useState(mesActual())
  const [cupos, setCupos] = useState([])
  const [gastos, setGastos] = useState([])
  const [cargandoCupos, setCargandoCupos] = useState(false)
  const [errorCupos, setErrorCupos] = useState(null)
  const [nuevaMarca, setNuevaMarca] = useState('')
  const [nuevosTramos, setNuevosTramos] = useState([{ monto: '', descuento_pct: '' }])
  const [topeGlobal, setTopeGlobal] = useState('')

  useEffect(() => {
    apiFetch('/pedidor/proveedores', {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setProveedores(d.proveedores)
        setCargandoProveedores(false)
        if (d.proveedores.length > 0) setProveedor(d.proveedores[0])
      })
      .catch((err) => {
        setError(err.message)
        setCargandoProveedores(false)
      })
  }, [])

  useEffect(() => {
    if (!proveedor) return
    setCargando(true)
    setError(null)
    apiFetch(`/pedidor/pendientes?proveedor=${encodeURIComponent(proveedor)}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setPendientes(d.pendientes)
        setCargando(false)
      })
      .catch((err) => {
        setError(err.message)
        setCargando(false)
      })
  }, [proveedor])

  useEffect(() => {
    if (!proveedor || vista !== 'metricas') return
    setCargandoMetricas(true)
    setErrorMetricas(null)
    const params = new URLSearchParams({ proveedor, desde: desdeMetricas })
    apiFetch(`/pedidor/metricas?${params}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setMetricas(d.items)
        setCargandoMetricas(false)
      })
      .catch((err) => {
        setErrorMetricas(err.message)
        setCargandoMetricas(false)
      })
  }, [proveedor, vista, desdeMetricas])

  function cargarCupos() {
    if (!proveedor) return
    setCargandoCupos(true)
    setErrorCupos(null)
    const params = new URLSearchParams({ proveedor, mes: mesCupos })
    Promise.all([
      apiFetch(`/pedidor/cupos?${params}`, {}, onUnauthorized).then((r) => r.json()),
      apiFetch(`/pedidor/gasto-marca?${params}`, {}, onUnauthorized).then((r) => r.json()),
    ])
      .then(([cuposData, gastosData]) => {
        setCupos(cuposData.cupos || [])
        setGastos(gastosData.gastos || [])
        setCargandoCupos(false)
      })
      .catch((err) => {
        setErrorCupos(err.message)
        setCargandoCupos(false)
      })
  }

  useEffect(() => {
    if (vista === 'cupos') cargarCupos()
  }, [proveedor, vista, mesCupos])

  function guardarCupo(e) {
    e.preventDefault()
    const tramosLimpios = nuevosTramos
      .filter((t) => t.monto !== '' && t.descuento_pct !== '')
      .map((t) => ({ monto: Number(t.monto), descuento_pct: Number(t.descuento_pct) }))
    if (!nuevaMarca.trim() || tramosLimpios.length === 0) return
    apiFetch('/pedidor/cupos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proveedor, marca: nuevaMarca.trim(), mes: mesCupos, tramos: tramosLimpios }),
    }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok || !d.ok) throw new Error(d.detail || 'Error')
        setNuevaMarca('')
        setNuevosTramos([{ monto: '', descuento_pct: '' }])
        cargarCupos()
      })
      .catch((err) => setErrorCupos(err.message))
  }

  function borrarCupo(id) {
    apiFetch(`/pedidor/cupos/${id}`, { method: 'DELETE' }, onUnauthorized)
      .then(() => cargarCupos())
      .catch((err) => setErrorCupos(err.message))
  }

  const marcasConDatos = [...new Set([...cupos.map((c) => c.marca), ...gastos.map((g) => g.marca)])].sort()

  const topeAutomatico = Math.max(
    ...gastos.map((g) => g.monto_gastado),
    ...cupos.flatMap((c) => c.tramos.map((t) => t.monto)),
    1,
  )
  const topeEfectivo = topeGlobal !== '' && Number(topeGlobal) > 0 ? Number(topeGlobal) : topeAutomatico * 1.05

  const metricasFiltradas = busquedaMetricas.trim()
    ? metricas.filter((m) => {
        const q = busquedaMetricas.trim().toLowerCase()
        return m.codigo.toLowerCase().includes(q) || m.descripcion.toLowerCase().includes(q)
      })
    : metricas

  function toggleEnCarrito(item, index) {
    const nuevoValor = !item.en_carrito
    setPendientes((prev) => prev.map((p, i) => (i === index ? { ...p, en_carrito: nuevoValor, planillaError: null } : p)))
    const ruta = nuevoValor ? '/pedidor/carrito/marcar' : '/pedidor/carrito/desmarcar'
    apiFetch(ruta, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        proveedor,
        codigo: item.codigo,
        fecha: item.fecha || '',
        fila: item.fila,
        descripcion: item.descripcion,
      }),
    }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok || !d.ok) throw new Error(d.detail || 'Error')
        if (nuevoValor && d.planilla_actualizada) {
          // se escribió "en carrito" en la planilla de verdad: el item
          // ya no es un pendiente, lo sacamos de la lista
          setPendientes((prev) => prev.filter((_, i) => i !== index))
        } else if (!d.planilla_actualizada) {
          // quedó marcado acá pero no se pudo escribir en la planilla real
          setPendientes((prev) => prev.map((p, i) => (i === index ? { ...p, planillaError: d.planilla_error } : p)))
        }
      })
      .catch(() => {
        // si falló por completo, revertimos el optimistic update
        setPendientes((prev) => prev.map((p, i) => (i === index ? { ...p, en_carrito: !nuevoValor } : p)))
      })
  }

  return (
    <>
      <div className="paste-box">
        <p style={{ fontSize: 13, color: 'var(--gray-muted)', margin: '0 0 10px' }}>
          Lee en vivo la planilla de pedidos - una pestaña por proveedor. Cargar el pedido en
          el sitio del proveedor se hace en una sesión aparte con Claude. Acá: pendientes de
          hoy (con marcado de "en carrito" que escribe directo en la planilla), y métricas -
          cada cuánto se pide un código, cuánto, y a qué destino.
        </p>
        {cargandoProveedores && <div className="loading-state">Cargando proveedores...</div>}
        {!cargandoProveedores && (
          <select
            className="search-input"
            value={proveedor}
            onChange={(e) => setProveedor(e.target.value)}
          >
            {proveedores.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}
        <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
          <button className={`tab ${vista === 'pendientes' ? 'active' : ''}`} onClick={() => setVista('pendientes')}>
            Pendientes
          </button>
          <button className={`tab ${vista === 'metricas' ? 'active' : ''}`} onClick={() => setVista('metricas')}>
            Métricas
          </button>
          <button className={`tab ${vista === 'cupos' ? 'active' : ''}`} onClick={() => setVista('cupos')}>
            Cupos por marca
          </button>
        </div>
      </div>

      {vista === 'pendientes' && (
      <>
      {error && <div className="error-state">Error: {error}</div>}

      <div className="list">
        {cargando && <div className="loading-state">Buscando pendientes de {proveedor}...</div>}
        {!cargando && !error && pendientes.length === 0 && (
          <div className="empty-state">Sin pendientes para {proveedor}. 🎉</div>
        )}
        {!cargando && pendientes.map((p, i) => (
          <div
            key={i}
            className="row"
            style={{ alignItems: 'flex-start', opacity: p.en_carrito ? 0.55 : 1 }}
          >
            <div className="title-cell">
              {p.descripcion || <span style={{ color: 'var(--gray-muted)' }}>(sin descripción)</span>}
              <span className="id-cell mono">
                Código: {p.codigo} · Cantidad: {p.cantidad}
                {p.fecha && ` · ${p.fecha}`}
              </span>
              {p.destino && <span className="id-cell">Destino: {p.destino}</span>}
              {p.planillaError && (
                <span className="id-cell" style={{ color: 'var(--red, #c0392b)' }}>
                  ⚠ No se pudo escribir en la planilla: {p.planillaError}
                </span>
              )}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, whiteSpace: 'nowrap' }}>
              <input
                type="checkbox"
                checked={!!p.en_carrito}
                onChange={() => toggleEnCarrito(p, i)}
              />
              {p.en_carrito ? 'En carrito' : 'Marcar'}
            </label>
          </div>
        ))}
      </div>
      </>
      )}

      {vista === 'metricas' && (
      <>
        <div className="paste-box" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input
            className="search-input"
            style={{ flex: '1 1 220px' }}
            placeholder="Buscar por código o descripción..."
            value={busquedaMetricas}
            onChange={(e) => setBusquedaMetricas(e.target.value)}
          />
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            Desde:
            <input
              type="date"
              className="search-input"
              style={{ width: 150 }}
              value={desdeMetricas}
              onChange={(e) => setDesdeMetricas(e.target.value)}
            />
          </label>
        </div>

        {errorMetricas && <div className="error-state">Error: {errorMetricas}</div>}

        <div className="list">
          {cargandoMetricas && <div className="loading-state">Calculando métricas de {proveedor}...</div>}
          {!cargandoMetricas && !errorMetricas && metricasFiltradas.length === 0 && (
            <div className="empty-state">Sin pedidos de {proveedor} desde {desdeMetricas}. 🎉</div>
          )}
          {!cargandoMetricas && metricasFiltradas.map((m) => {
            const badgeDestino = (destino) => {
              if (destino === 'ml') return 'badge-colecta'
              if (destino === 'full') return 'badge-full'
              if (destino.startsWith('ambos')) return 'badge-multi'
              if (destino === '(sin destino)') return 'badge-acordar'
              return 'badge-acordar'
            }
            return (
              <div key={m.codigo} className="row" style={{ alignItems: 'center', gap: 16 }}>
                <div style={{
                  fontSize: 26, fontWeight: 800, color: 'var(--navy)', lineHeight: 1,
                  minWidth: 46, textAlign: 'center',
                }}>
                  {m.veces}
                  <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--gray-muted)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                    {m.veces === 1 ? 'vez' : 'veces'}
                  </div>
                </div>
                <div className="title-cell" style={{ flex: 1 }}>
                  <span style={{ fontWeight: 700 }}>
                    {m.descripcion || <span style={{ color: 'var(--gray-muted)' }}>(sin descripción)</span>}
                  </span>
                  <span className="id-cell mono">{m.codigo}</span>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                    {m.cantidad_total != null && (
                      <span className="badge badge-acordar">📦 {m.cantidad_total} unidades</span>
                    )}
                    {m.destinos.map((d) => (
                      <span key={d.destino} className={`badge ${badgeDestino(d.destino)}`} title={d.ejemplos.join(' · ')}>
                        {d.destino} · {d.veces}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--gray-muted)', marginTop: 6 }}>
                    {m.primera_fecha === m.ultima_fecha
                      ? `Única vez: ${m.primera_fecha}`
                      : `De ${m.primera_fecha} a ${m.ultima_fecha}`}
                    {m.promedio_dias_entre_pedidos != null && ` · en promedio cada ~${m.promedio_dias_entre_pedidos} días`}
                    {m.cantidades_no_numericas.length > 0 && ` · también: ${m.cantidades_no_numericas.join(', ')}`}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </>
      )}

      {vista === 'cupos' && (
      <>
        <div className="paste-box" style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--gray-muted)', margin: 0, flex: '1 1 100%' }}>
            El gasto real no se actualiza solo (el sitio del proveedor exige login) - se
            actualiza a pedido, en una sesión con Claude. Los cupos (tramos de descuento que
            manda el corredor) se cargan acá a mano, una vez por mes.
          </p>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            Mes:
            <input
              type="month"
              className="search-input"
              style={{ width: 150 }}
              value={mesCupos}
              onChange={(e) => setMesCupos(e.target.value)}
            />
          </label>
          <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
            Escala de las barras ($):
            <input
              type="number"
              className="search-input"
              style={{ width: 150 }}
              placeholder={topeAutomatico.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
              value={topeGlobal}
              onChange={(e) => setTopeGlobal(e.target.value)}
            />
          </label>
        </div>

        {errorCupos && <div className="error-state">Error: {errorCupos}</div>}

        <div className="list">
          {cargandoCupos && <div className="loading-state">Cargando cupos de {proveedor}...</div>}
          {!cargandoCupos && marcasConDatos.length === 0 && (
            <div className="empty-state">Todavía no hay cupos ni gasto cargado para {proveedor} en {mesCupos}.</div>
          )}
          {!cargandoCupos && marcasConDatos.map((marca) => {
            const cupo = cupos.find((c) => c.marca === marca)
            const gastoInfo = gastos.find((g) => g.marca === marca)
            const gasto = gastoInfo ? gastoInfo.monto_gastado : 0
            const tramos = cupo ? cupo.tramos : []
            const tope = topeEfectivo
            const tramoAlcanzado = [...tramos].reverse().find((t) => gasto >= t.monto)
            const proximoTramo = tramos.find((t) => gasto < t.monto)
            return (
              <div key={marca} className="row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'baseline' }}>
                  <strong>{marca}</strong>
                  <span className="id-cell mono">
                    ${gasto.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                    {gastoInfo && ` · actualizado ${new Date(gastoInfo.actualizado_en).toLocaleDateString('es-AR')}`}
                  </span>
                </div>
                <div style={{ position: 'relative', width: '100%', height: 22, background: 'var(--gray-line)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    position: 'absolute', left: 0, top: 0, bottom: 0,
                    width: `${Math.min(100, (gasto / tope) * 100)}%`,
                    background: tramoAlcanzado ? 'var(--atencion, #c99a2e)' : 'var(--navy, #1b2a4a)',
                    transition: 'width 0.3s',
                  }} />
                  {tramos.map((t, i) => (
                    <div key={i} title={`$${t.monto.toLocaleString('es-AR')} → ${t.descuento_pct}% dto`} style={{
                      position: 'absolute', left: `${Math.min(100, (t.monto / tope) * 100)}%`, top: 0, bottom: 0,
                      width: 2, background: 'var(--charcoal, #333)',
                    }} />
                  ))}
                </div>
                <div style={{ fontSize: 13, color: 'var(--gray-muted)' }}>
                  {tramoAlcanzado
                    ? `Dto. actual: ${tramoAlcanzado.descuento_pct}%`
                    : tramos.length > 0 ? 'Todavía sin descuento' : 'Sin cupo cargado'}
                  {proximoTramo && ` · faltan $${(proximoTramo.monto - gasto).toLocaleString('es-AR', { maximumFractionDigits: 0 })} para ${proximoTramo.descuento_pct}%`}
                </div>
                {cupo && (
                  <button
                    className="tab"
                    style={{ fontSize: 12, padding: '4px 8px', alignSelf: 'flex-start' }}
                    onClick={() => borrarCupo(cupo.id)}
                  >
                    Borrar cupo de {marca}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <form onSubmit={guardarCupo} className="paste-box" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <strong style={{ fontSize: 14 }}>Cargar / actualizar cupo de una marca</strong>
          <input
            className="search-input"
            placeholder="Marca (ej: BOSCH)"
            value={nuevaMarca}
            onChange={(e) => setNuevaMarca(e.target.value)}
          />
          {nuevosTramos.map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                className="search-input" type="number" placeholder="Monto ($)" style={{ width: 160 }}
                value={t.monto}
                onChange={(e) => setNuevosTramos((prev) => prev.map((x, j) => (j === i ? { ...x, monto: e.target.value } : x)))}
              />
              <input
                className="search-input" type="number" placeholder="% dto." style={{ width: 100 }}
                value={t.descuento_pct}
                onChange={(e) => setNuevosTramos((prev) => prev.map((x, j) => (j === i ? { ...x, descuento_pct: e.target.value } : x)))}
              />
              {nuevosTramos.length > 1 && (
                <button type="button" className="tab" style={{ fontSize: 12, padding: '4px 8px' }}
                  onClick={() => setNuevosTramos((prev) => prev.filter((_, j) => j !== i))}>
                  Quitar
                </button>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="tab" style={{ fontSize: 12, padding: '4px 8px' }}
              onClick={() => setNuevosTramos((prev) => [...prev, { monto: '', descuento_pct: '' }])}>
              + Agregar tramo
            </button>
            <button type="submit" className="tab active" style={{ fontSize: 12, padding: '4px 8px' }}>
              Guardar
            </button>
          </div>
        </form>
      </>
      )}
    </>
  )
}
