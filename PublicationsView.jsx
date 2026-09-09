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
  const [sortByStockAsc, setSortByStockAsc] = useState(false)
  const [zoomUrl, setZoomUrl] = useState(null)

  useEffect(() => {
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
  }, [])

  const filtered = useMemo(() => {
    let result = items

    if (statusFilter !== 'all') {
      result = result.filter((it) => it.status === statusFilter)
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(
        (it) => it.title?.toLowerCase().includes(q) || it.sku?.toLowerCase().includes(q)
      )
    }

    if (sortByStockAsc) {
      result = [...result].sort(
        (a, b) => a.available_quantity - b.available_quantity
      )
    }

    return result
  }, [items, query, statusFilter, sortByStockAsc])

  // Sin búsqueda, mostramos solo las primeras 20 para no abrumar.
  // Apenas escriben algo en el buscador, se busca sobre TODAS las publicaciones.
  const visible = query.trim() ? filtered : filtered.slice(0, 20)

  const activeCount = items.filter((it) => it.status === 'active').length
  const pausedCount = items.filter((it) => it.status === 'paused').length
  const lowStockCount = items.filter((it) => it.available_quantity <= 3).length

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
          className="sort-btn"
          onClick={() => setSortByStockAsc((v) => !v)}
        >
          {sortByStockAsc ? '✓ ' : ''}Ordenar por stock ↑
        </button>
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
            <div className="value mono">{lowStockCount}</div>
            <div className="label">Stock ≤ 3 unidades</div>
          </div>
        </div>
      )}

      <div className="list">
        {loading && <div className="loading-state">Cargando publicaciones...</div>}
        {error && <div className="error-state">Error: {error}</div>}

        {!loading && !error && (
          <>
            <div className="row row-head">
              <span>Publicación</span>
              <span style={{ textAlign: 'right' }}>Precio</span>
              <span style={{ textAlign: 'right' }}>Stock</span>
              <span></span>
            </div>

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
                  <span className="id-cell mono">{item.id} · SKU: {item.sku}</span>
                </div>
                <div className="price-cell mono">{formatPrice(item.price)}</div>
                <div className={`stock-cell mono ${item.available_quantity <= 3 ? 'low' : ''}`}>
                  {item.available_quantity}
                </div>
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
