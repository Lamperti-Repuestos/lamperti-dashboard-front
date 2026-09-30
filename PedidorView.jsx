import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

export default function PedidorView({ onUnauthorized }) {
  const [proveedores, setProveedores] = useState([])
  const [proveedor, setProveedor] = useState('')
  const [pendientes, setPendientes] = useState([])
  const [cargandoProveedores, setCargandoProveedores] = useState(true)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)

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
          Lee en vivo la planilla de pedidos - una pestaña por proveedor.
          Cargar el pedido en el sitio del proveedor sigue siendo manual (o pedíselo a Claude
          en una sesión, que lo arma asistido por navegador). Marcá "En carrito" a medida que
          los vayas cargando - escribe "en carrito" en la planilla real y el ítem sale de la
          lista de pendientes, para poder retomar en otro momento del día sin repasar todo de
          nuevo.
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
      </div>

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
  )
}
