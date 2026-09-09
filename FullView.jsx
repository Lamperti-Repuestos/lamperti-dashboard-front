import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api.js'

const ETIQUETAS_NO_DISPONIBLE = {
  damage: 'Dañadas',
  lost: 'Perdidas',
  withdrawal: 'Reservadas p/retiro',
  internal_process: 'En control de calidad',
  transfer: 'En transferencia',
  noFiscalCoverage: 'Sin cobertura fiscal',
}

const ETIQUETAS_OPERACION = {
  inbound_reception: 'Ingreso de stock',
  sale_confirmation: 'Venta confirmada',
  sale_cancelation: 'Venta cancelada',
  STOCK_AUDIT: 'Auditoría de stock',
  withdrawal_delivery: 'Retiro por el vendedor',
  lost_refund: 'Pérdida (reembolsada)',
}

export default function FullView({ onUnauthorized }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [sortMode, setSortMode] = useState('stock_asc') // stock_asc | stock_desc | alpha
  const [ocultarSinStock, setOcultarSinStock] = useState(false)
  const [soloSinStock, setSoloSinStock] = useState(false)
  const [expandedId, setExpandedId] = useState(null)
  const [operaciones, setOperaciones] = useState({})
  const [loadingOps, setLoadingOps] = useState(false)

  useEffect(() => {
    apiFetch('/ml/full/stock', {}, onUnauthorized)
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

    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(
        (it) => it.title?.toLowerCase().includes(q) || it.sku?.toLowerCase().includes(q)
      )
    }

    if (soloSinStock) {
      result = result.filter((it) => it.available_quantity === 0)
    } else if (ocultarSinStock) {
      result = result.filter((it) => it.available_quantity > 0)
    }

    if (sortMode === 'stock_asc') {
      result = [...result].sort((a, b) => a.available_quantity - b.available_quantity)
    } else if (sortMode === 'stock_desc') {
      result = [...result].sort((a, b) => b.available_quantity - a.available_quantity)
    } else if (sortMode === 'alpha') {
      result = [...result].sort((a, b) => a.title.localeCompare(b.title, 'es'))
    }

    return result
  }, [items, query, sortMode, ocultarSinStock, soloSinStock])

  const [opsError, setOpsError] = useState({})

  const toggleExpand = (item) => {
    if (expandedId === item.item_id) {
      setExpandedId(null)
      return
    }
    setExpandedId(item.item_id)
    if (!operaciones[item.inventory_id] && !opsError[item.inventory_id]) {
      setLoadingOps(true)
      apiFetch(`/ml/full/operaciones/${item.inventory_id}`, {}, onUnauthorized)
        .then(async (res) => {
          const data = await res.json()
          if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
          return data
        })
        .then((data) => {
          setOperaciones((prev) => ({ ...prev, [item.inventory_id]: data.operaciones }))
          setLoadingOps(false)
        })
        .catch((err) => {
          setOpsError((prev) => ({ ...prev, [item.inventory_id]: err.message }))
          setLoadingOps(false)
        })
    }
  }

  const bajoStockCount = items.filter((it) => it.available_quantity <= 3).length

  return (
    <>
      <div className="controls">
        <input
          className="search-input"
          type="text"
          placeholder="Buscar por título o SKU (te muestra el SKU al toque)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="tabs">
          <button
            className={`tab ${sortMode === 'stock_asc' ? 'active' : ''}`}
            onClick={() => setSortMode('stock_asc')}
          >
            Stock ↑
          </button>
          <button
            className={`tab ${sortMode === 'stock_desc' ? 'active' : ''}`}
            onClick={() => setSortMode('stock_desc')}
          >
            Stock ↓
          </button>
          <button
            className={`tab ${sortMode === 'alpha' ? 'active' : ''}`}
            onClick={() => setSortMode('alpha')}
          >
            A-Z
          </button>
        </div>
        <div className="toggle-group">
          <button
            className={`sort-btn ${soloSinStock ? 'toggle-on-red' : ''}`}
            onClick={() => { setSoloSinStock((v) => !v); setOcultarSinStock(false) }}
          >
            {soloSinStock ? '✓ ' : ''}Solo sin stock
          </button>
          <button
            className={`sort-btn ${ocultarSinStock ? 'toggle-on-green' : ''}`}
            onClick={() => { setOcultarSinStock((v) => !v); setSoloSinStock(false) }}
          >
            {ocultarSinStock ? '✓ ' : ''}Ocultar sin stock
          </button>
        </div>
      </div>

      {!loading && !error && (
        <div className="summary">
          <div className="summary-item">
            <div className="value mono">{items.length}</div>
            <div className="label">Productos en Full</div>
          </div>
          <div className="summary-item warn">
            <div className="value mono">{bajoStockCount}</div>
            <div className="label">Con 3 o menos disponibles</div>
          </div>
        </div>
      )}

      <div className="list">
        {loading && <div className="loading-state">Cargando stock de Full...</div>}
        {error && <div className="error-state">Error: {error}</div>}

        {!loading && !error && (
          <>
            {filtered.length === 0 && (
              <div className="empty-state">
                No hay publicaciones en Full que coincidan con este filtro.
              </div>
            )}

            {filtered.map((item) => (
              <div key={item.item_id} className="pick-group">
                <div className="row" onClick={() => toggleExpand(item)} style={{ cursor: 'pointer' }}>
                  <div className="title-cell">
                    {item.title}
                    <span className="id-cell mono">{item.item_id} · SKU: {item.sku}</span>
                  </div>
                  <div className={`stock-cell mono ${item.available_quantity <= 3 ? 'low' : ''}`}>
                    {item.available_quantity} disp.
                  </div>
                  {item.not_available_quantity > 0 && (
                    <span className="badge badge-acordar">
                      {item.not_available_quantity} no disp.
                    </span>
                  )}
                  <span className="detail-toggle">
                    {expandedId === item.item_id ? '▲' : '▼ historial'}
                  </span>
                </div>

                {expandedId === item.item_id && (
                  <div className="sale-detail">
                    {item.not_available_detail.length > 0 && (
                      <div className="sale-together" style={{ marginBottom: 8 }}>
                        {item.not_available_detail.map((d, i) => (
                          <div key={i}>
                            {ETIQUETAS_NO_DISPONIBLE[d.status] || d.status}: {d.quantity}
                          </div>
                        ))}
                      </div>
                    )}

                    {loadingOps && !operaciones[item.inventory_id] && (
                      <div className="loading-state" style={{ padding: 12 }}>Cargando historial...</div>
                    )}

                    {opsError[item.inventory_id] && (
                      <div className="error-state" style={{ padding: 12 }}>
                        Error trayendo el historial: {opsError[item.inventory_id]}
                      </div>
                    )}

                    {operaciones[item.inventory_id]?.length === 0 && (
                      <div className="sale-together">Sin movimientos en los últimos 30 días.</div>
                    )}

                    {operaciones[item.inventory_id]?.map((op) => (
                      <div className="sale-line-wrap" key={op.id}>
                        <div className="sale-line">
                          <span className="mono">
                            {new Date(op.fecha).toLocaleDateString('es-AR')}
                          </span>
                          <span>{ETIQUETAS_OPERACION[op.tipo] || op.tipo}</span>
                          <span className="mono">
                            {op.detalle?.available_quantity > 0 ? '+' : ''}
                            {op.detalle?.available_quantity ?? ''}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>
    </>
  )
}
