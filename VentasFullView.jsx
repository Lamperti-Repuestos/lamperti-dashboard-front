import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

const formatoPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const MEDALLA = ['🥇', '🥈', '🥉']

export default function VentasFullView({ onUnauthorized }) {
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(null)
  const [dias, setDias] = useState(7)
  const [fotos, setFotos] = useState({})

  useEffect(() => {
    setCargando(true)
    setError(null)
    apiFetch(`/metricas/ventas-full?dias=${dias}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        setData(d)
        setCargando(false)
      })
      .catch((err) => {
        setError(err.message)
        setCargando(false)
      })
  }, [dias])

  useEffect(() => {
    apiFetch('/ml/items', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        const mapa = {}
        ;(d.items || []).forEach((it) => { if (it.sku) mapa[it.sku] = it.foto_url })
        setFotos(mapa)
      })
  }, [])

  return (
    <>
      <div className="controls">
        <label className="corte-label">
          Período (días)
          <input
            type="number"
            className="corte-input"
            value={dias}
            onChange={(e) => setDias(Math.max(1, Math.min(60, Number(e.target.value) || 1)))}
            min={1}
            max={60}
            style={{ width: 70 }}
          />
        </label>
      </div>

      {cargando && <div className="loading-state">Cargando ventas Full...</div>}
      {error && <div className="error-state">Error: {error}</div>}
      {!cargando && data && (
        <>
          <div className="id-cell mono" style={{ margin: '8px 0' }}>
            Del {new Date(data.desde).toLocaleDateString('es-AR')} al {new Date(data.hasta).toLocaleDateString('es-AR')}
            {' · '}{data.ordenes_revisadas} órdenes revisadas en total
          </div>
          <div className="summary">
            <div className="summary-item">
              <div className="value mono">{data.total_ventas}</div>
              <div className="label">Ventas Full</div>
            </div>
            <div className="summary-item">
              <div className="value mono">{data.total_unidades}</div>
              <div className="label">Unidades</div>
            </div>
            <div className="summary-item">
              <div className="value mono">{formatoPesos.format(data.total_monto)}</div>
              <div className="label">Facturado bruto</div>
            </div>
          </div>

          <h3 style={{ margin: '16px 0 8px' }}>🏆 Ranking de lo que más se vende en Full</h3>
          <div className="list">
            {data.ranking.length === 0 && (
              <div className="empty-state">Sin ventas Full en este período.</div>
            )}
            {data.ranking.map((p, i) => (
              <div key={p.sku} className="row">
                {MEDALLA[i] && <span style={{ fontSize: 22 }}>{MEDALLA[i]}</span>}
                {fotos[p.sku] && <img src={fotos[p.sku]} alt="" className="pick-thumb" />}
                <div className="title-cell">
                  {p.titulo || p.sku}
                  <span className="id-cell mono">SKU: {p.sku} · #{i + 1}</span>
                </div>
                <span className="badge badge-colecta">×{p.unidades} u.</span>
                <span className="badge badge-flex">{formatoPesos.format(p.monto)}</span>
                <span className="id-cell mono">{p.ventas} venta(s)</span>
              </div>
            ))}
          </div>

          <h3 style={{ margin: '16px 0 8px' }}>🧾 Detalle de cada venta Full</h3>
          <div className="list">
            {data.ventas.map((v) => (
              <div key={v.order_id} className="row">
                <div className="title-cell">
                  {v.items.map((it) => `${it.cantidad}× ${it.titulo || it.sku}`).join(' · ')}
                  <span className="id-cell mono">
                    {v.fecha ? new Date(v.fecha).toLocaleString('es-AR') : '—'}
                    {' · '}#{v.order_id}{v.comprador ? ` · ${v.comprador}` : ''}
                  </span>
                </div>
                <span className="badge badge-acordar">{formatoPesos.format(v.total || 0)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  )
}
