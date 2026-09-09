import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api.js'
import ImageLightbox from './ImageLightbox.jsx'

function formatPrice(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 0,
  }).format(value)
}

export default function PublicationsView({ onUnauthorized }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [soloSinStock, setSoloSinStock] = useState(false)
  const [sortMode, setSortMode] = useState('none') // none | stock | price | alpha
  const [zoomUrl, setZoomUrl] = useState(null)
  const [selected, setSelected] = useState(() => new Set())
  const [copiedId, setCopiedId] = useState(null)
  const [bulkWorking, setBulkWorking] = useState(false)
  const [bulkMsg, setBulkMsg] = useState(null)

  const fetchItems = () => {
    setLoading(true)
    apiFetch('/ml/items', {}, onUnauthorized)
      .then((res) => {
        if (!res.ok) throw new Error(`El backend respondió ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setItems(data.items || [])
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(fetchItems, [])

  const filtered = useMemo(() => {
    let result = items

    if (statusFilter !== 'all') {
      result = result.filter((it) => it.status === statusFilter)
    }

    if (soloSinStock) {
      result = result.filter((it) => it.available_quantity === 0)
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(
        (it) => it.title?.toLowerCase().includes(q) || it.sku?.toLowerCase().includes(q)
      )
    }

    if (sortMode === 'stock') {
      result = [...result].sort((a, b) => a.available_quantity - b.available_quantity)
    } else if (sortMode === 'price') {
      result = [...result].sort((a, b) => a.price - b.price)
    } else if (sortMode === 'alpha') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title, 'es'))
    }

    return result
  }, [items, query, statusFilter, soloSinStock, sortMode])

  // Sin búsqueda, mostramos solo las primeras 20 para no abrumar.
  // Apenas escriben algo en el buscador, se busca sobre TODAS las publicaciones.
  const visible = query.trim() ? filtered : filtered.slice(0, 20)

  const activeCount = items.filter((it) => it.status === 'active').length
  const pausedCount = items.filter((it) => it.status === 'paused').length
  const sinStockCount = items.filter((it) => it.available_quantity === 0).length

  const toggleSelected = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const copySku = (item) => {
    navigator.clipboard.writeText(item.sku).then(() => {
      setCopiedId(item.id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  const cambiarEstado = (item, nuevoEstado) => {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, status: nuevoEstado } : it))
    )
    apiFetch(`/ml/items/${item.id}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nuevoEstado }),
    }, onUnauthorized)
      .then((res) => {
        if (!res.ok) throw new Error()
      })
      .catch(() => {
        // revertimos si falló
        setItems((prev) =>
          prev.map((it) => (it.id === item.id ? { ...it, status: item.status } : it))
        )
      })
  }

  const accionEnLote = (nuevoEstado) => {
    const ids = Array.from(selected)
    if (ids.length === 0) return
    setBulkWorking(true)
    setBulkMsg(null)
    apiFetch('/ml/items/bulk-status', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_ids: ids, status: nuevoEstado }),
    }, onUnauthorized)
      .then((res) => res.json())
      .then((data) => {
        setItems((prev) =>
          prev.map((it) =>
            data.exitosos.includes(it.id) ? { ...it, status: nuevoEstado } : it
          )
        )
        setBulkMsg(
          `${data.exitosos.length} actualizadas` +
          (data.fallidos.length > 0 ? `, ${data.fallidos.length} fallaron` : '')
        )
        setSelected(new Set())
        setBulkWorking(false)
      })
      .catch(() => {
        setBulkMsg('Error al aplicar los cambios.')
        setBulkWorking(false)
      })
  }

  return (
    <>
      <div className="controls">
        <input
          className="search-input"
          type="text"
          placeholder="Buscar por título o SKU..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="tabs">
          <button
            className={`tab ${statusFilter === 'all' ? 'active' : ''}`}
            onClick={() => setStatusFilter('all')}
          >
            Todas
          </button>
          <button
            className={`tab ${statusFilter === 'active' ? 'active' : ''}`}
            onClick={() => setStatusFilter('active')}
          >
            Activas
          </button>
          <button
            className={`tab ${statusFilter === 'paused' ? 'active' : ''}`}
            onClick={() => setStatusFilter('paused')}
          >
            Pausadas
          </button>
        </div>
        <button
          className={`sort-btn ${soloSinStock ? 'active-outline' : ''}`}
          onClick={() => setSoloSinStock((v) => !v)}
        >
          {soloSinStock ? '✓ ' : ''}Sin stock
        </button>
        <div className="tabs">
          <button
            className={`tab ${sortMode === 'stock' ? 'active' : ''}`}
            onClick={() => setSortMode((m) => (m === 'stock' ? 'none' : 'stock'))}
          >
            Stock ↑
          </button>
          <button
            className={`tab ${sortMode === 'price' ? 'active' : ''}`}
            onClick={() => setSortMode((m) => (m === 'price' ? 'none' : 'price'))}
          >
            Precio ↑
          </button>
          <button
            className={`tab ${sortMode === 'alpha' ? 'active' : ''}`}
            onClick={() => setSortMode((m) => (m === 'alpha' ? 'none' : 'alpha'))}
          >
            A-Z
          </button>
        </div>
      </div>

      {!loading && !error && (
        <div className="summary">
          <div className="summary-item">
            <div className="value mono">{items.length}</div>
            <div className="label">Total publicaciones</div>
          </div>
          <div className="summary-item">
            <div className="value mono">{activeCount}</div>
            <div className="label">Activas</div>
          </div>
          <div className="summary-item">
            <div className="value mono">{pausedCount}</div>
            <div className="label">Pausadas</div>
          </div>
          <div className="summary-item warn">
            <div className="value mono">{sinStockCount}</div>
            <div className="label">Sin stock</div>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span>{selected.size} seleccionada(s)</span>
          <button className="scan-btn" disabled={bulkWorking} onClick={() => accionEnLote('paused')}>
            Pausar seleccionadas
          </button>
          <button className="scan-btn" disabled={bulkWorking} onClick={() => accionEnLote('active')}>
            Activar seleccionadas
          </button>
          <button className="sort-btn" onClick={() => setSelected(new Set())}>
            Cancelar
          </button>
          {bulkMsg && <span className="bulk-msg">{bulkMsg}</span>}
        </div>
      )}

      <div className="list">
        {loading && <div className="loading-state">Cargando publicaciones...</div>}
        {error && <div className="error-state">Error: {error}</div>}

        {!loading && !error && (
          <>
            {visible.length === 0 && (
              <div className="empty-state">No hay publicaciones para este filtro.</div>
            )}

            {!query.trim() && filtered.length > 20 && (
              <div className="hint-more">
                Mostrando 20 de {filtered.length}. Escribí en el buscador para encontrar cualquier otra.
              </div>
            )}

            {visible.map((item) => (
              <div className="row" key={item.id}>
                <input
                  type="checkbox"
                  className="pick-checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelected(item.id)}
                />
                {item.foto_url && (
                  <img
                    src={item.foto_url}
                    alt=""
                    className="row-thumb"
                    loading="lazy"
                    onClick={() => setZoomUrl(item.foto_url)}
                  />
                )}
                <div className="title-cell">
                  {item.permalink ? (
                    <a href={item.permalink} target="_blank" rel="noopener noreferrer">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                  <span className="id-cell mono">
                    {item.id} · SKU: {item.sku}
                    <button className="copy-sku-btn" onClick={() => copySku(item)}>
                      {copiedId === item.id ? '✓' : '⧉'}
                    </button>
                  </span>
                </div>
                <div className="price-cell mono">{formatPrice(item.price)}</div>
                <div className={`stock-cell mono ${item.available_quantity <= 3 ? 'low' : ''}`}>
                  {item.available_quantity}
                </div>
                <button
                  type="button"
                  className={`pause-btn ${item.status === 'paused' ? 'pause-btn-paused' : ''}`}
                  onClick={() => cambiarEstado(item, item.status === 'active' ? 'paused' : 'active')}
                >
                  {item.status === 'active' ? 'Pausar' : 'Activar'}
                </button>
                <div className="status-badge">
                  <span className={`status-dot ${item.status}`}></span>
                  {item.status === 'active' ? 'Activa' : 'Pausada'}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      <ImageLightbox url={zoomUrl} onClose={() => setZoomUrl(null)} />
    </>
  )
}
