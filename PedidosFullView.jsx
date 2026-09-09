import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

const ETAPAS = [
  { key: 'por_pedir', label: 'Por pedir', color: '#4A4A44' },
  { key: 'pedido', label: 'Pedido', color: '#B8860B' },
  { key: 'llego', label: 'Llegó', color: '#1A2B6B' },
  { key: 'embalado', label: 'Embalado', color: '#B23A2E' },
]

export default function PedidosFullView({ onUnauthorized }) {
  const [items, setItems] = useState([])
  const [resumen, setResumen] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [importando, setImportando] = useState(false)
  const [importMsg, setImportMsg] = useState(null)
  const [enviandoTodo, setEnviandoTodo] = useState(false)

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

  const importar = () => {
    setImportando(true)
    setImportMsg(null)
    apiFetch('/full/pipeline/importar', { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Error')
        return data
      })
      .then((data) => {
        let msg = `${data.nuevos_agregados} producto(s) nuevo(s) importado(s)` +
          (data.para_revisar_a_mano > 0 ? ` (${data.para_revisar_a_mano} para revisar a mano)` : '')

        const raros = data.estados_raros_por_proveedor || {}
        const proveedoresConRaros = Object.keys(raros)
        if (proveedoresConRaros.length > 0) {
          msg += '. ⚠ Estados raros encontrados (revisá el typo en el Sheet): ' +
            proveedoresConRaros.map((p) => `${p}: "${raros[p].join('", "')}"`).join(' · ')
        }

        setImportMsg(msg)
        setImportando(false)
        fetchPipeline()
      })
      .catch((err) => {
        setImportMsg(`Error: ${err.message}`)
        setImportando(false)
      })
  }

  const avanzar = (item, direccion = 'adelante') => {
    setItems((prev) => prev.filter((it) => it.id !== item.id || direccion === 'atras'))
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

  const etapaInfo = (key) => ETAPAS.find((e) => e.key === key) || ETAPAS[0]

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
        <button className="scan-btn" onClick={importar} disabled={importando}>
          {importando ? 'Importando...' : '📥 Importar del Sheet'}
        </button>
        <button
          className="scan-btn"
          onClick={enviarTodo}
          disabled={enviandoTodo || !resumen.embalado}
        >
          🚚 Enviar todo lo embalado ({resumen.embalado || 0})
        </button>
      </div>

      {importMsg && <div className="scan-result">{importMsg}</div>}

      {!loading && !error && (
        <div className="summary">
          {ETAPAS.map((etapa) => (
            <div className="summary-item" key={etapa.key}>
              <div className="value mono">{resumen[etapa.key] || 0}</div>
              <div className="label">{etapa.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="list">
        {loading && <div className="loading-state">Cargando tablero...</div>}
        {error && <div className="error-state">Error: {error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            No hay nada en el tablero. Importá del Sheet para arrancar.
          </div>
        )}

        {!loading && !error && filtered.map((item) => {
          const etapa = etapaInfo(item.estado)
          return (
            <div key={item.id} className="row">
              <div className="title-cell">
                {item.titulo}
                <span className="id-cell mono">
                  SKU: {item.sku} · Total: {item.cantidad_total}
                  {item.proveedor && ` · ${item.proveedor}`}
                  {item.cantidad_full != null && ` (${item.cantidad_full} Full / ${item.cantidad_local} local)`}
                  {item.revisar_manual && ' · ⚠ revisar reparto Full/local a mano'}
                </span>
              </div>
              <span className="badge" style={{ background: etapa.color }}>{etapa.label}</span>
              {item.estado !== 'por_pedir' && (
                <button className="sort-btn" onClick={() => avanzar(item, 'atras')}>← Atrás</button>
              )}
              {item.estado !== 'embalado' && (
                <button className="pause-btn" onClick={() => avanzar(item, 'adelante')}>
                  Siguiente →
                </button>
              )}
            </div>
          )
        })}
      </div>
    </>
  )
}
