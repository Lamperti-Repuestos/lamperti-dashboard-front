import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api.js'

export default function PedidosFullView({ onUnauthorized }) {
  const [items, setItems] = useState([])
  const [resumen, setResumen] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [enviandoTodo, setEnviandoTodo] = useState(false)

  // Para buscar y agregar productos
  const [catalogo, setCatalogo] = useState([])
  const [catalogoCargado, setCatalogoCargado] = useState(false)
  const [buscarQuery, setBuscarQuery] = useState('')
  const [cantidades, setCantidades] = useState({})
  const [agregando, setAgregando] = useState(null)

  const fetchPipeline = () => {
    apiFetch('/full/pipeline', {}, onUnauthorized)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items)
        setResumen(data.resumen)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    setLoading(true)
    fetchPipeline()
  }, [])

  const cargarCatalogo = () => {
    if (catalogoCargado) return
    apiFetch('/ml/items', {}, onUnauthorized)
      .then((res) => res.json())
      .then((data) => {
        setCatalogo(data.items || [])
        setCatalogoCargado(true)
      })
  }

  const coincidencias = useMemo(() => {
    if (!buscarQuery.trim()) return []
    const q = buscarQuery.trim().toLowerCase()
    return catalogo
      .filter((it) => it.title?.toLowerCase().includes(q) || it.sku?.toLowerCase().includes(q))
      .slice(0, 15)
  }, [catalogo, buscarQuery])

  const agregarProducto = (item) => {
    const cantidad = cantidades[item.id] || 1
    setAgregando(item.id)
    apiFetch('/full/pipeline/agregar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_id: item.id,
        sku: item.sku,
        titulo: item.title,
        cantidad: Number(cantidad),
      }),
    }, onUnauthorized)
      .then(() => {
        setAgregando(null)
        setBuscarQuery('')
        fetchPipeline()
      })
      .catch(() => setAgregando(null))
  }

  const toggleEmbalado = (item) => {
    const direccion = item.estado === 'embalado' ? 'atras' : 'adelante'
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id ? { ...it, estado: direccion === 'adelante' ? 'embalado' : 'por_embalar' } : it
      )
    )
    apiFetch(`/full/pipeline/${item.id}/avanzar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direccion }),
    }, onUnauthorized)
      .then(() => fetchPipeline())
      .catch(() => fetchPipeline())
  }

  const enviarTodo = () => {
    if (!confirm(`¿Marcar los ${resumen.embalado || 0} productos embalados como enviados?`)) return
    setEnviandoTodo(true)
    apiFetch('/full/pipeline/enviar-todo', { method: 'POST' }, onUnauthorized)
      .then(() => {
        setEnviandoTodo(false)
        fetchPipeline()
      })
      .catch(() => setEnviandoTodo(false))
  }

  const filtered = items.filter((it) => {
    if (!query.trim()) return true
    const q = query.trim().toLowerCase()
    return it.titulo?.toLowerCase().includes(q) || it.sku?.toLowerCase().includes(q)
  })

  return (
    <>
      <div className="paste-box">
        <label className="corte-label" style={{ marginBottom: 8 }}>
          Agregar producto a la tanda de Full
        </label>
        <input
          className="search-input"
          type="text"
          placeholder="Buscar por título o SKU..."
          value={buscarQuery}
          onFocus={cargarCatalogo}
          onChange={(e) => setBuscarQuery(e.target.value)}
        />
        {!catalogoCargado && buscarQuery && (
          <div className="loading-state" style={{ padding: 12 }}>Cargando catálogo...</div>
        )}
        {coincidencias.length > 0 && (
          <div className="paste-result">
            {coincidencias.map((it) => (
              <div key={it.id} className="paste-result-row">
                <div className="title-cell">
                  {it.title}
                  <span className="id-cell mono">SKU: {it.sku}</span>
                </div>
                <input
                  type="number"
                  min={1}
                  className="stock-input"
                  value={cantidades[it.id] || 1}
                  onChange={(e) => setCantidades((prev) => ({ ...prev, [it.id]: e.target.value }))}
                />
                <button
                  className="scan-btn"
                  onClick={() => agregarProducto(it)}
                  disabled={agregando === it.id}
                >
                  {agregando === it.id ? 'Agregando...' : '+ Agregar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="controls">
        <input
          className="search-input"
          type="text"
          placeholder="Buscar en la lista..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className="scan-btn"
          onClick={enviarTodo}
          disabled={enviandoTodo || !resumen.embalado}
        >
          🚚 Enviar todo lo embalado ({resumen.embalado || 0})
        </button>
      </div>

      {!loading && !error && (
        <div className="summary">
          <div className="summary-item">
            <div className="value mono">{resumen.por_embalar || 0}</div>
            <div className="label">Por embalar</div>
          </div>
          <div className="summary-item">
            <div className="value mono">{resumen.embalado || 0}</div>
            <div className="label">Embalado</div>
          </div>
        </div>
      )}

      <div className="list">
        {loading && <div className="loading-state">Cargando lista...</div>}
        {error && <div className="error-state">Error: {error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            No hay nada en la lista todavía. Buscá un producto arriba y agregalo.
          </div>
        )}

        {!loading && !error && filtered.map((item) => (
          <div key={item.id} className={`pick-row ${item.estado === 'embalado' ? 'pick-row-checked' : ''}`}>
            <input
              type="checkbox"
              className="pick-checkbox"
              checked={item.estado === 'embalado'}
              onChange={() => toggleEmbalado(item)}
            />
            <div className="pick-title">
              {item.titulo}
              <span className="id-cell mono">SKU: {item.sku} · Cantidad: {item.cantidad_total}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
