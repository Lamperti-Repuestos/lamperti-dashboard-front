import { useEffect, useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { apiFetch } from './api.js'

const formatoPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const COLORES_BARRA = ['#1A2B6B', '#2E4A9E', '#4A67B8', '#6B84C9', '#8CA1D8', '#ADBEE7']

const MEDALLA = ['🥇', '🥈', '🥉']

export default function MetricasView({ onUnauthorized }) {
  const [dias, setDias] = useState(30)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vista, setVista] = useState('unidades') // unidades | monto | sin_ventas
  const [fotos, setFotos] = useState({})

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

  useEffect(() => {
    apiFetch('/ml/items', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        const mapa = {}
        ;(d.items || []).forEach((it) => { if (it.sku) mapa[it.sku] = it.foto_url })
        setFotos(mapa)
      })
  }, [])

  const lista = data
    ? vista === 'unidades' ? data.top_unidades : vista === 'monto' ? data.top_monto : data.sin_ventas
    : []

  const datosGrafico = useMemo(() => {
    if (vista === 'sin_ventas') return []
    return lista.slice(0, 10).map((p) => ({
      nombre: p.titulo?.length > 28 ? p.titulo.slice(0, 28) + '…' : (p.titulo || p.sku),
      valor: vista === 'unidades' ? p.ventas_unidades : p.ventas_monto,
    }))
  }, [lista, vista])

  return (
    <>
      <div className="controls">
        <div className="tabs">
          <button className={`tab ${vista === 'unidades' ? 'active' : ''}`} onClick={() => setVista('unidades')}>
            🏆 Top unidades
          </button>
          <button className={`tab ${vista === 'monto' ? 'active' : ''}`} onClick={() => setVista('monto')}>
            💰 Top $
          </button>
          <button className={`tab tab-acordar ${vista === 'sin_ventas' ? 'active' : ''}`} onClick={() => setVista('sin_ventas')}>
            😴 Sin ventas
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

      {!loading && !error && datosGrafico.length > 0 && (
        <div className="paste-box">
          <ResponsiveContainer width="100%" height={Math.max(220, datosGrafico.length * 34)}>
            <BarChart data={datosGrafico} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nombre"
                width={160}
                tick={{ fontSize: 11, fontFamily: 'IBM Plex Mono, monospace' }}
              />
              <Tooltip
                formatter={(value) => vista === 'monto' ? formatoPesos.format(value) : `${value} unidades`}
              />
              <Bar dataKey="valor" radius={[0, 6, 6, 0]}>
                {datosGrafico.map((_, i) => (
                  <Cell key={i} fill={COLORES_BARRA[Math.min(i, COLORES_BARRA.length - 1)]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
            {MEDALLA[i] && <span style={{ fontSize: 22 }}>{MEDALLA[i]}</span>}
            {fotos[p.sku] && <img src={fotos[p.sku]} alt="" className="pick-thumb" />}
            <div className="title-cell">
              {p.titulo || p.sku}
              <span className="id-cell mono">SKU: {p.sku} · #{i + 1}</span>
            </div>
            {vista !== 'sin_ventas' && (
              <>
                <span className="badge badge-colecta">×{p.ventas_unidades} u.</span>
                <span className="badge badge-flex">{formatoPesos.format(p.ventas_monto)}</span>
              </>
            )}
            {vista === 'sin_ventas' && (
              <span className="badge badge-sin-explicar">Stock: {p.stock_actual}</span>
            )}
            {p.precio != null && <span className="id-cell mono">Precio: {formatoPesos.format(p.precio)}</span>}
          </div>
        ))}
      </div>
    </>
  )
}
