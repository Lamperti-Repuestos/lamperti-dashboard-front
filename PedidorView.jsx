import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

export default function PedidorView({ onUnauthorized }) {
  const [vista, setVista] = useState('pendientes') // 'pendientes' | 'metricas'
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
          {!cargandoMetricas && metricasFiltradas.map((m) => (
            <div key={m.codigo} className="row" style={{ alignItems: 'flex-start' }}>
              <div className="title-cell">
                {m.descripcion || <span style={{ color: 'var(--gray-muted)' }}>(sin descripción)</span>}
                <span className="id-cell mono">Código: {m.codigo}</span>
                <span className="id-cell">
                  Pedido <strong>{m.veces}</strong> {m.veces === 1 ? 'vez' : 'veces'}
                  {m.cantidad_total != null && ` · ${m.cantidad_total} unidades en total`}
                  {m.cantidades_no_numericas.length > 0 && ` (+ ${m.cantidades_no_numericas.join(', ')})`}
                </span>
                <span className="id-cell">
                  {m.primera_fecha === m.ultima_fecha
                    ? `Única vez: ${m.primera_fecha}`
                    : `De ${m.primera_fecha} a ${m.ultima_fecha}`}
                  {m.promedio_dias_entre_pedidos != null && ` · cada ~${m.promedio_dias_entre_pedidos} días`}
                </span>
                <span className="id-cell">
                  Destinos: {m.destinos.map((d) => `${d.destino} (${d.veces})`).join(', ')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </>
      )}
    </>
  )
}
