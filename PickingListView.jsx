import { useCallback, useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api.js'
import ImageLightbox from './ImageLightbox.jsx'

const REFRESH_MS = 3 * 60 * 1000 // se actualiza sola cada 3 minutos

const TIPO_LABELS = {
  cross_docking: 'Colecta',
  self_service: 'Flex',
  acordar: 'Acordar entrega',
}

function ItemRow({ item, onToggleChecked, onToggleFaltante, onZoom }) {
  return (
    <div
      className={`pick-row ${item.checked ? 'pick-row-checked' : ''} ${item.faltante ? 'pick-row-faltante' : ''}`}
    >
      <input
        type="checkbox"
        className="pick-checkbox"
        checked={item.checked}
        onChange={() => onToggleChecked(item)}
      />
      {item.foto_url && (
        <img
          src={item.foto_url}
          alt=""
          className="pick-thumb"
          loading="lazy"
          onClick={() => onZoom(item.foto_grande || item.foto_url)}
        />
      )}
      <div className="pick-title">
        {item.title}
        <span className="id-cell mono">SKU: {item.sku}</span>
        {item.ya_separado > 0 && (
          <span className="id-cell" style={{ color: '#2E7D46' }}>
            Ya separaste {item.ya_separado} - falta {item.pendiente ?? item.total}
          </span>
        )}
      </div>
      <div className="pick-badges">
        {item.cross_docking > 0 && (
          <span className="badge badge-colecta">Colecta ×{item.cross_docking}</span>
        )}
        {item.self_service > 0 && (
          <span className="badge badge-flex">Flex ×{item.self_service}</span>
        )}
        {item.acordar > 0 && (
          <span className="badge badge-acordar">Acordar ×{item.acordar}</span>
        )}
      </div>
      <button
        type="button"
        className={`faltante-btn ${item.faltante ? 'faltante-btn-active' : ''}`}
        onClick={() => onToggleFaltante(item)}
        title="Marcar como faltante en el local"
      >
        {item.faltante ? '⚠ Faltante' : 'Faltante'}
      </button>
      <div className="pick-total mono">{item.pendiente ?? item.total}</div>
    </div>
  )
}

export default function PickingListView({ onUnauthorized }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [typeFilter, setTypeFilter] = useState('all') // all | cross_docking | self_service | acordar
  const [corteFlex, setCorteFlex] = useState('14:00')
  const [corteColecta, setCorteColecta] = useState('11:00')
  const [hideChecked, setHideChecked] = useState(false)
  const [onlyChecked, setOnlyChecked] = useState(false)
  const [onlyFaltantes, setOnlyFaltantes] = useState(false)
  const [expanded, setExpanded] = useState(() => new Set())
  const [zoomUrl, setZoomUrl] = useState(null)

  const toggleExpanded = (itemId) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      return next
    })
  }

  const fetchList = useCallback(() => {
    const params = new URLSearchParams({
      corte_flex: corteFlex,
      corte_colecta: corteColecta,
    })
    apiFetch(`/ml/picking-list?${params}`, {}, onUnauthorized)
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
  }, [corteFlex, corteColecta, onUnauthorized])

  useEffect(() => {
    setLoading(true)
    fetchList()
  }, [fetchList])

  useEffect(() => {
    const id = setInterval(fetchList, REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchList])

  // Actualiza un producto (suelto o dentro de un grupo) en el estado local.
  // Matchea por estado_id + period_key juntos: el mismo producto puede
  // aparecer en dos filas distintas (una por cada ventana de corte
  // pendiente), y no queremos tocar las dos a la vez por error.
  const patchItem = (estadoId, periodKey, patch) => {
    const coincide = (x) => x.estado_id === estadoId && x.period_key === periodKey
    setData((prev) => ({
      ...prev,
      items: prev.items.map((it) => (coincide(it) ? { ...it, ...patch } : it)),
      grupos: prev.grupos.map((g) => ({
        ...g,
        productos: g.productos.map((p) => (coincide(p) ? { ...p, ...patch } : p)),
      })),
    }))
  }

  const toggleChecked = (item) => {
    const newChecked = !item.checked
    if (newChecked) {
      patchItem(item.estado_id, item.period_key, { checked: true, pendiente: 0, ya_separado: item.total })
    } else {
      patchItem(item.estado_id, item.period_key, { checked: false, pendiente: item.total, ya_separado: 0 })
    }
    apiFetch('/ml/picking-list/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_key: item.period_key,
        item_id: item.estado_id,
        checked: newChecked,
        cantidad_actual: newChecked ? item.total : null,
      }),
    }).catch(() => patchItem(item.estado_id, item.period_key, { checked: !newChecked }))
  }

  const toggleFaltante = (item) => {
    const newFaltante = !item.faltante
    patchItem(item.estado_id, item.period_key, { faltante: newFaltante })
    apiFetch('/ml/picking-list/faltante', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period_key: item.period_key,
        item_id: item.estado_id,
        faltante: newFaltante,
      }),
    }).catch(() => patchItem(item.estado_id, item.period_key, { faltante: !newFaltante }))
  }

  const filtered = useMemo(() => {
    if (!data) return { items: [], grupos: [] }

    let items = data.items
    let grupos = data.grupos

    if (typeFilter !== 'all') {
      items = items.filter((it) => it[typeFilter] > 0)
      grupos = grupos.filter((g) => g.tipo === typeFilter)
    }

    if (onlyChecked) {
      items = items.filter((it) => it.checked)
      grupos = grupos
        .map((g) => ({ ...g, productos: g.productos.filter((p) => p.checked) }))
        .filter((g) => g.productos.length > 0)
    } else if (hideChecked) {
      items = items.filter((it) => !it.checked)
      grupos = grupos.filter((g) => g.productos.some((p) => !p.checked))
    }

    if (onlyFaltantes) {
      items = items.filter((it) => it.faltante)
      grupos = grupos.filter((g) => g.productos.some((p) => p.faltante))
    }

    return { items, grupos }
  }, [data, typeFilter, hideChecked, onlyChecked, onlyFaltantes])

  // Mezclamos grupos e items sueltos en una sola lista, ordenada por lo
  // último vendido primero - lo ya separado se hunde al final. Así, al
  // entrar, arriba de todo siempre está lo más nuevo, sea multiproducto
  // o no.
  const entradasOrdenadas = useMemo(() => {
    const entradas = [
      ...filtered.grupos.map((g) => ({
        tipo: 'grupo',
        data: g,
        completado: g.completado,
        fecha: g.fecha_iso,
      })),
      ...filtered.items.map((it) => ({
        tipo: 'item',
        data: it,
        completado: it.checked,
        fecha: it.ultima_venta,
      })),
    ]
    entradas.sort((a, b) => {
      if (a.completado !== b.completado) return a.completado ? 1 : -1
      return new Date(b.fecha) - new Date(a.fecha)
    })
    return entradas
  }, [filtered])

  const pendingCount = data
    ? data.items.filter((it) => !it.checked).length +
      data.grupos.reduce((acc, g) => acc + g.productos.filter((p) => !p.checked).length, 0)
    : 0

  const faltantesCount = data
    ? data.items.filter((it) => it.faltante).length +
      data.grupos.reduce((acc, g) => acc + g.productos.filter((p) => p.faltante).length, 0)
    : 0

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
          <button className={`tab ${typeFilter === 'all' ? 'active' : ''}`} onClick={() => setTypeFilter('all')}>
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
          <button
            className={`tab tab-acordar ${typeFilter === 'acordar' ? 'active' : ''}`}
            onClick={() => setTypeFilter('acordar')}
          >
            Acordar
          </button>
        </div>

        <div className="toggle-group">
          <button
            className={`sort-btn ${onlyChecked ? 'toggle-on-green' : ''}`}
            onClick={() => { setOnlyChecked((v) => !v); setHideChecked(false) }}
          >
            {onlyChecked ? '✓ ' : ''}Ver separados
          </button>
          <button
            className={`sort-btn ${hideChecked ? 'toggle-on-green' : ''}`}
            onClick={() => { setHideChecked((v) => !v); setOnlyChecked(false) }}
          >
            {hideChecked ? '✓ ' : ''}Ocultar separados
          </button>
          <button
            className={`sort-btn ${onlyFaltantes ? 'toggle-on-red' : ''}`}
            onClick={() => setOnlyFaltantes((v) => !v)}
          >
            {onlyFaltantes ? '✓ ' : ''}Solo faltantes
          </button>
        </div>
      </div>

      {!loading && !error && data && (
        <div className="summary">
          <div className="summary-item">
            <div className="value mono">{data.total_productos + data.grupos.length}</div>
            <div className="label">Productos / grupos</div>
          </div>
          <div className="summary-item warn">
            <div className="value mono">{pendingCount}</div>
            <div className="label">Sin separar</div>
          </div>
          <div className="summary-item warn">
            <div className="value mono">{faltantesCount}</div>
            <div className="label">Faltantes</div>
          </div>
        </div>
      )}

      <div className="list">
        {loading && <div className="loading-state">Buscando ventas pendientes...</div>}
        {error && <div className="error-state">Error: {error}</div>}

        {!loading && !error && data && (
          <>
            {filtered.items.length === 0 && filtered.grupos.length === 0 && (
              <div className="empty-state">No hay nada para separar con este filtro. 🎉</div>
            )}

            {entradasOrdenadas.map((entrada) =>
              entrada.tipo === 'grupo' ? (
                <div key={entrada.data.pack_id} className="multi-group">
                  <div className="multi-group-header">
                    <span className="badge badge-multi">Multiproducto</span>
                    <span className="multi-meta mono">{entrada.data.fecha_hora}</span>
                    <span className="multi-meta">{entrada.data.comprador}</span>
                    <span className={`badge badge-${entrada.data.tipo === 'cross_docking' ? 'colecta' : entrada.data.tipo === 'self_service' ? 'flex' : 'acordar'}`}>
                      {TIPO_LABELS[entrada.data.tipo]}
                    </span>
                  </div>
                  {entrada.data.productos.map((p) => (
                    <ItemRow
                      key={p.estado_id}
                      item={{ ...p, cross_docking: 0, self_service: 0, acordar: 0, total: p.cantidad }}
                      onToggleChecked={() => toggleChecked(p)}
                      onToggleFaltante={() => toggleFaltante(p)}
                      onZoom={setZoomUrl}
                    />
                  ))}
                </div>
              ) : (
                <div key={`${entrada.data.estado_id}-${entrada.data.period_key}`} className="pick-group">
                  <ItemRow
                    item={entrada.data}
                    onToggleChecked={toggleChecked}
                    onToggleFaltante={toggleFaltante}
                    onZoom={setZoomUrl}
                  />

                  <button
                    type="button"
                    className="detail-toggle"
                    onClick={() => toggleExpanded(entrada.data.item_id)}
                  >
                    {expanded.has(entrada.data.item_id) ? '▲ ocultar ventas' : `▼ ver ${entrada.data.ventas.length} venta(s)`}
                  </button>

                  {expanded.has(entrada.data.item_id) && (
                    <div className="sale-detail">
                      {entrada.data.ventas.map((venta, i) => (
                        <div className="sale-line" key={i}>
                          <span className="mono">{venta.fecha_hora}</span>
                          <span>{venta.comprador}</span>
                          <span className="mono">×{venta.cantidad}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}
          </>
        )}
      </div>

      <ImageLightbox url={zoomUrl} onClose={() => setZoomUrl(null)} />
    </>
  )
}
