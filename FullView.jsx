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
  const [textoPegado, setTextoPegado] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [resultadoPegado, setResultadoPegado] = useState(null)
  const [cantidadesEditables, setCantidadesEditables] = useState({})
  const [enviosEnCurso, setEnviosEnCurso] = useState(null)
  const [pedidoElegido, setPedidoElegido] = useState('nuevo')
  const [agregandoLote, setAgregandoLote] = useState(false)
  const [loteMsg, setLoteMsg] = useState(null)
  const [errorPegado, setErrorPegado] = useState(null)
  const [copiedSku, setCopiedSku] = useState(null)
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

  const cantidadDeSugerencia = (texto) => {
    if (!texto) return 1
    const m = texto.match(/(\d+)/)
    return m ? parseInt(m[1], 10) : 1
  }

  const iniciarAgregarAPedido = () => {
    setLoteMsg(null)
    apiFetch('/full/envios', {}, onUnauthorized)
      .then((res) => res.json())
      .then((data) => {
        setEnviosEnCurso(data.envios)
        if (data.envios.length <= 1) {
          // 0 -> se crea uno nuevo solo. 1 -> va directo ahí, sin preguntar.
          confirmarAgregarAPedido(data.envios.length === 1 ? data.envios[0].id : null)
        }
        // Si hay 2 o más, queda mostrado el selector para que el usuario elija
      })
  }

  const confirmarAgregarAPedido = (pedidoId) => {
    const items = resultadoPegado
      .filter((r) => r.encontrado && r.sku)
      .map((r) => ({
        sku: r.sku,
        titulo: r.titulo,
        cantidad: Number(cantidadesEditables[r.inventory_id]) || 1,
      }))

    if (items.length === 0) {
      setLoteMsg('No hay productos reconocidos para agregar.')
      return
    }

    setAgregandoLote(true)
    apiFetch('/full/pipeline/agregar-lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pedido_id: pedidoId, items }),
    }, onUnauthorized)
      .then((res) => res.json())
      .then((data) => {
        setLoteMsg(`✅ ${data.cantidad_agregada} producto(s) agregado(s) a "${data.nombre}".`)
        setEnviosEnCurso(null)
        setAgregandoLote(false)
      })
      .catch(() => {
        setLoteMsg('Error al agregar al pedido.')
        setAgregandoLote(false)
      })
  }

  const procesarTexto = () => {
    if (!textoPegado.trim()) return
    setProcesando(true)
    setErrorPegado(null)
    setResultadoPegado(null)
    apiFetch('/ml/full/parse-texto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: textoPegado }),
    }, onUnauthorized)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
        return data
      })
      .then((data) => {
        setResultadoPegado(data.items)
        const iniciales = {}
        data.items.forEach((r) => {
          iniciales[r.inventory_id] = cantidadDeSugerencia(r.sugerencia_enviar)
        })
        setCantidadesEditables(iniciales)
        setProcesando(false)
      })
      .catch((err) => {
        setErrorPegado(err.message)
        setProcesando(false)
      })
  }

  const copiarSku = (sku) => {
    if (!sku) return
    navigator.clipboard.writeText(sku).then(() => {
      setCopiedSku(sku)
      setTimeout(() => setCopiedSku(null), 1500)
    })
  }

  return (
    <>
      <div className="paste-box">
        <label className="corte-label" style={{ marginBottom: 8 }}>
          Pegá acá el texto copiado de la pantalla de reposición de Full en ML
        </label>
        <textarea
          className="paste-textarea"
          rows={4}
          placeholder="Seleccioná y copiá la tabla completa en ML, y pegala acá tal cual..."
          value={textoPegado}
          onChange={(e) => setTextoPegado(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 8, alignItems: 'center' }}>
          <button className="scan-btn" onClick={procesarTexto} disabled={procesando}>
            {procesando ? 'Procesando...' : '🔍 Sacar SKUs'}
          </button>
          {resultadoPegado && (
            <button className="sort-btn" onClick={() => { setResultadoPegado(null); setTextoPegado('') }}>
              Limpiar
            </button>
          )}
        </div>

        {errorPegado && <div className="error-state" style={{ padding: '12px 0' }}>{errorPegado}</div>}

        {resultadoPegado && (
          <div className="paste-result">
            {resultadoPegado.map((r) => (
              <div key={r.inventory_id} className="paste-result-row">
                <div className="title-cell">
                  {r.titulo}
                  <span className="id-cell mono">
                    Código ML: {r.inventory_id}
                    {!r.encontrado && ' · no encontrado en nuestros datos'}
                  </span>
                </div>
                {r.sku && (
                  <button className="copy-sku-btn-full" onClick={() => copiarSku(r.sku)}>
                    SKU: {r.sku} {copiedSku === r.sku ? '✓' : '⧉'}
                  </button>
                )}
                {r.encontrado && r.sku && (
                  <span className="stock-edit">
                    <span style={{ fontSize: 11, color: 'var(--gray-muted)' }}>Enviar:</span>
                    <input
                      type="number"
                      min={0}
                      className="stock-input"
                      value={cantidadesEditables[r.inventory_id] ?? 1}
                      onChange={(e) =>
                        setCantidadesEditables((prev) => ({ ...prev, [r.inventory_id]: e.target.value }))
                      }
                    />
                    {r.sugerencia_enviar && (
                      <span style={{ fontSize: 11, color: 'var(--gray-muted)' }}>
                        (ML sugería {r.sugerencia_enviar})
                      </span>
                    )}
                  </span>
                )}
              </div>
            ))}

            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--gray-line)' }}>
              {!enviosEnCurso && (
                <button className="scan-btn" onClick={iniciarAgregarAPedido} disabled={agregandoLote}>
                  📦 Agregar a pedido Full
                </button>
              )}

              {enviosEnCurso && enviosEnCurso.length > 1 && (
                <div>
                  <p style={{ margin: '0 0 8px', fontSize: 13 }}>
                    Tenés {enviosEnCurso.length} envíos en curso - ¿a cuál lo agrego?
                  </p>
                  <select
                    className="corte-input"
                    value={pedidoElegido}
                    onChange={(e) => setPedidoElegido(e.target.value)}
                    style={{ marginRight: 10 }}
                  >
                    {enviosEnCurso.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre} ({e.embalados}/{e.total_productos} embalados)
                      </option>
                    ))}
                    <option value="nuevo">+ Crear un envío nuevo</option>
                  </select>
                  <button
                    className="scan-btn"
                    disabled={agregandoLote}
                    onClick={() => confirmarAgregarAPedido(pedidoElegido === 'nuevo' ? null : Number(pedidoElegido))}
                  >
                    Confirmar
                  </button>
                </div>
              )}

              {loteMsg && <div className="scan-result" style={{ padding: '10px 0' }}>{loteMsg}</div>}
            </div>
          </div>
        )}
      </div>

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
