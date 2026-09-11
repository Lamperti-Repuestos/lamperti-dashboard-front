import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

export default function MetricasView({ onUnauthorized }) {
  const [dias, setDias] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vista, setVista] = useState('unidades') // unidades | monto | sin_ventas

  const fetchDatos = () => {
    setLoading(true)
    apiFetch(`/metricas/ranking?dias=${dias}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(fetchDatos, [dias])

  const lista = data
    ? vista === 'unidades' ? data.top_unidades : vista === 'monto' ? data.top_monto : data.sin_ventas
    : []

  return (
    <>
      <div className="controls">
        <div className="tabs">
          <button className={`tab ${vista === 'unidades' ? 'active' : ''}`} onClick={() => setVista('unidades')}>
            Top unidades
          </button>
          <button className={`tab ${vista === 'monto' ? 'active' : ''}`} onClick={() => setVista('monto')}>
            Top $
          </button>
          <button className={`tab tab-acordar ${vista === 'sin_ventas' ? 'active' : ''}`} onClick={() => setVista('sin_ventas')}>
            Sin ventas
          </button>
        </div>
        <label className="corte-label">
          Período (días)
          <input
            type="number"
            className="corte-input"
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            min={1}
            style={{ width: 70 }}
          />
        </label>
      </div>

      {!loading && !error && data && (
        <div className="summary">
          <div className="summary-item">
            <div className="value mono">{data.total_skus_con_datos}</div>
            <div className="label">SKUs con datos</div>
          </div>
          <div className="summary-item warn">
            <div className="value mono">{data.sin_ventas.length}</div>
            <div className="label">Sin ventas (con stock)</div>
          </div>
        </div>
      )}

      <div className="list">
        {loading && <div className="loading-state">Cargando métricas...</div>}
        {error && <div className="error-state">Error: {error}</div>}
        {!loading && !error && lista.length === 0 && (
          <div className="empty-state">Sin datos todavía para este período - esperá a que se acumulen más días.</div>
        )}

        {!loading && !error && lista.map((p, i) => (
          <div key={p.sku} className="row">
            <div className="title-cell">
              {p.titulo || p.sku}
              <span className="id-cell mono">SKU: {p.sku} · #{i + 1}</span>
            </div>
            {vista !== 'sin_ventas' && (
              <>
                <span className="badge badge-colecta">×{p.ventas_unidades} unidades</span>
                <span className="badge badge-flex">${p.ventas_monto.toLocaleString('es-AR')}</span>
              </>
            )}
            {vista === 'sin_ventas' && (
              <span className="badge badge-sin-explicar">Stock: {p.stock_actual}</span>
            )}
            {p.precio != null && <span className="id-cell mono">Precio: ${p.precio}</span>}
          </div>
        ))}
      </div>
    </>
  )
}
