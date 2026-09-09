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
    if (!query.trim()) return items
    const q = query.trim().toLowerCase()
    return items.filter(
      (it) => it.title?.toLowerCase().includes(q) || it.sku?.toLowerCase().includes(q)
    )
  }, [items, query])

  const toggleExpand = (item) => {
    if (expandedId === item.item_id) {
      setExpandedId(null)
      return
    }
    setExpandedId(item.item_id)
    if (!operaciones[item.inventory_id]) {
      setLoadingOps(true)
      apiFetch(`/ml/full/operaciones/${item.inventory_id}`, {}, onUnauthorized)
        .then((res) => res.json())
        .then((data) => {
          setOperaciones((prev) => ({ ...prev, [item.inventory_id]: data.operaciones }))
          setLoadingOps(false)
        })
        .catch(() => setLoadingOps(false))
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
