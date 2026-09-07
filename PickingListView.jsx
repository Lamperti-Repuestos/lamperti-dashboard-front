import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const API_URL = import.meta.env.VITE_API_URL
const REFRESH_MS = 3 * 60 * 1000 // se actualiza sola cada 3 minutos

export default function PickingListView() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all') // all | cross_docking | self_service
  const [corteFlex, setCorteFlex] = useState('14:00')
  const [corteColecta, setCorteColecta] = useState('11:00')
  const [hideChecked, setHideChecked] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set())

  const toggleExpanded = (itemId) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const fetchList = useCallback(() => {
    if (!API_URL) {
      setError('Falta configurar VITE_API_URL.')
      setLoading(false)
      return
    }
    const params = new URLSearchParams({
      corte_flex: corteFlex,
      corte_colecta: corteColecta,
    })
    fetch(`${API_URL}/ml/picking-list?${params}`)
      .then((res) => {
        if (!res.ok) throw new Error(`El backend respondió ${res.status}`)
        return res.json()
      })
      .then((json) => {
        setData(json)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [corteFlex, corteColecta])

  useEffect(() => {
    setLoading(true)
    fetchList()
  }, [fetchList])

  useEffect(() => {
    const id = setInterval(fetchList, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchList])

  const toggleChecked = (item) => {
    if (!data) return
    const newChecked = !item.checked

    // Optimista: lo actualizamos en pantalla ya mismo
    setData((prev) => ({
      ...prev,
      items: prev.items.map((it) =>
        it.item_id === item.item_id ? { ...it, checked: newChecked } : it
      ),
    }))

    fetch(`${API_URL}/ml/picking-list/check`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_key: data.period_key,
        item_id: item.item_id,
        checked: newChecked,
      }),
    }).catch(() => {
      // si falla, lo revertimos
      setData((prev) => ({
        ...prev,
        items: prev.items.map((it) =>
          it.item_id === item.item_id ? { ...it, checked: !newChecked } : it
        ),
      }))
    })
  }

  const filtered = useMemo(() => {
    if (!data) return []
    let result = data.items

    if (typeFilter === 'cross_docking') {
      result = result.filter((it) => it.cross_docking > 0)
    } else if (typeFilter === 'self_service') {
      result = result.filter((it) => it.self_service > 0)
    }

    if (hideChecked) {
      result = result.filter((it) => !it.checked)
    }

    return result
  }, [data, typeFilter, hideChecked])

  const pendingCount = data ? data.items.filter((it) => !it.checked).length : 0

  return (
    <>
      <div className="controls">
        <div className="corte-inputs">
          <label className="corte-label">
            Corte Flex
            <input
              type="time"
              value={corteFlex}
              onChange={(e) => setCorteFlex(e.target.value)}
              className="corte-input"
            />
          </label>
          <label className="corte-label">
            Corte Colecta
            <input
              type="time"
              value={corteColecta}
              onChange={(e) => setCorteColecta(e.target.value)}
              className="corte-input"
            />
          </label>
        </div>

        <div className="tabs">
          <button
            className={`tab ${typeFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTypeFilter('all')}
          >
            Todos
          </button>
          <button
            className={`tab tab-colecta ${typeFilter === 'cross_docking' ? 'active' : ''}`}
            onClick={() => setTypeFilter('cross_docking')}
          >
            Colecta
          </button>
          <button
            className={`tab tab-flex ${typeFilter === 'self_service' ? 'active' : ''}`}
            onClick={() => setTypeFilter('self_service')}
          >
            Flex
          </button>
        </div>

        <button
          className="sort-btn"
          onClick={() => setHideChecked((v) => !v)}
        >
          {hideChecked ? '✓ ' : ''}Ocultar separados
        </button>
      </div>

      {!loading && !error && data && (
        <div className="summary">
          <div className="summary-item">
            <div className="value mono">{data.total_productos}</div>
            <div className="label">Productos en esta tanda</div>
          </div>
          <div className="summary-item warn">
            <div className="value mono">{pendingCount}</div>
            <div className="label">Sin separar</div>
          </div>
        </div>
      )}

      <div className="list">
        {loading && <div className="loading-state">Buscando ventas pendientes...</div>}
        {error && <div className="error-state">Error: {error}</div>}

        {!loading && !error && data && (
          <>
            {filtered.length === 0 && (
              <div className="empty-state">
                No hay nada para separar con este filtro. 🎉
              </div>
            )}

            {filtered.map((item) => (
              <div key={item.item_id} className="pick-group">
                <label
                  className={`pick-row ${item.checked ? 'pick-row-checked' : ''}`}
                >
                  <input
                    type="checkbox"
                    className="pick-checkbox"
                    checked={item.checked}
                    onChange={() => toggleChecked(item)}
                  />
                  <div className="pick-title">
                    {item.title}
                    <span className="id-cell mono">SKU: {item.sku}</span>
                  </div>
                  <div className="pick-badges">
                    {item.cross_docking > 0 && (
                      <span className="badge badge-colecta">
                        Colecta ×{item.cross_docking}
                      </span>
                    )}
                    {item.self_service > 0 && (
                      <span className="badge badge-flex">
                        Flex ×{item.self_service}
                      </span>
                    )}
                  </div>
                  <div className="pick-total mono">{item.total}</div>
                </label>

                <button
                  type="button"
                  className="detail-toggle"
                  onClick={() => toggleExpanded(item.item_id)}
                >
                  {expanded.has(item.item_id) ? '▲ ocultar ventas' : `▼ ver ${item.ventas.length} venta(s)`}
                </button>

                {expanded.has(item.item_id) && (
                  <div className="sale-detail">
                    {item.ventas.map((venta, i) => (
                      <div className="sale-line" key={i}>
                        <span className="mono">{venta.fecha_hora}</span>
                        <span>{venta.comprador}</span>
                        <span className="mono">×{venta.cantidad}</span>
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
