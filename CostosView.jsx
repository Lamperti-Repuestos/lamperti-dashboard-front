import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { apiFetch } from './api.js'

const formatoPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const COLORES = ['#1A2B6B', '#2E4A9E', '#4A67B8', '#6B84C9', '#8CA1D8', '#ADBEE7', '#B8860B', '#2E7D46', '#B03A2E', '#6B4A9E']
const TOP_TORTA = 8

function colorPorRango(indice) {
  const i = indice < TOP_TORTA ? indice : TOP_TORTA
  return COLORES[i % COLORES.length]
}

function TooltipPersonalizado({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 8, padding: '8px 12px', fontSize: 12, boxShadow: '0 4px 16px rgba(0,0,0,0.15)' }}>
      <div style={{ fontWeight: 700, marginBottom: 2 }}>{d.nombre}</div>
      <div className="mono">{formatoPesos.format(d.valor)}</div>
    </div>
  )
}

export default function CostosView({ onUnauthorized }) {
  const [periodos, setPeriodos] = useState([])
  const [periodoElegido, setPeriodoElegido] = useState(null)
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    apiFetch('/metricas/costos/periodos', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => setPeriodos(d.periodos || []))
      .catch(() => {})
  }, [])

  const fetchCostos = (key) => {
    setCargando(true)
    const url = key ? `/metricas/costos?period_key=${key}` : '/metricas/costos'
    apiFetch(url, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setData(d)
        setCargando(false)
      })
      .catch((err) => {
        setData({ error: err.message })
        setCargando(false)
      })
  }

  useEffect(fetchCostos, [])

  const elegirPeriodo = (key) => {
    setPeriodoElegido(key)
    fetchCostos(key)
  }

  const cargosOrdenados = data?.cargos?.slice().sort((a, b) => b.monto - a.monto) || []

  let datosGrafico = cargosOrdenados
  if (cargosOrdenados.length > TOP_TORTA) {
    const top = cargosOrdenados.slice(0, TOP_TORTA)
    const restoMonto = cargosOrdenados.slice(TOP_TORTA).reduce((acc, c) => acc + c.monto, 0)
    datosGrafico = [...top, { label: `Otros (${cargosOrdenados.length - TOP_TORTA})`, monto: restoMonto }]
  }

  return (
    <>
      <div className="controls">
        <label className="corte-label" style={{ width: '100%' }}>
          Período de facturación
          <select
            className="corte-input"
            style={{ width: '100%', marginTop: 4 }}
            value={periodoElegido || ''}
            onChange={(e) => elegirPeriodo(e.target.value)}
          >
            {periodos.length === 0 && <option value="">Más reciente</option>}
            {periodos.map((p) => (
              <option key={p.key} value={p.key}>
                {p.desde} a {p.hasta} {p.estado === 'CLOSED' ? '(cerrado)' : '(en curso)'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {cargando && <div className="loading-state">Cargando...</div>}
      {data?.error && <div className="error-state">Error: {data.error}</div>}

      {data && !data.error && (
        <>
          <div className="summary">
            <div className="summary-item">
              <div className="value mono">{formatoPesos.format(data.total_cargos)}</div>
              <div className="label">Total de cargos</div>
            </div>
            {data.total_cobrado != null && (
              <div className="summary-item">
                <div className="value mono">{formatoPesos.format(data.total_cobrado)}</div>
                <div className="label">Total cobrado</div>
              </div>
            )}
            {data.total_deuda > 0 && (
              <div className="summary-item warn">
                <div className="value mono">{formatoPesos.format(data.total_deuda)}</div>
                <div className="label">Deuda pendiente</div>
              </div>
            )}
          </div>

          {datosGrafico.length > 0 && (
            <div className="paste-box">
              <label className="corte-label" style={{ marginBottom: 8 }}>
                Distribución de cargos - {data.period?.date_from} a {data.period?.date_to}
              </label>
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={datosGrafico.map((c) => ({ nombre: c.label, valor: c.monto }))}
                    dataKey="valor"
                    nameKey="nombre"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ percent }) => (percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : '')}
                  >
                    {datosGrafico.map((_, i) => (
                      <Cell key={i} fill={COLORES[i % COLORES.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<TooltipPersonalizado />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          <div className="list">
            {cargosOrdenados.map((c, indice) => (
              <div key={c.label} className="row">
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: colorPorRango(indice), flexShrink: 0 }} />
                <div className="title-cell">{c.label}</div>
                <span className="badge badge-flex">{formatoPesos.format(c.monto)}</span>
                <span className="id-cell mono">{c.porcentaje}%</span>
              </div>
            ))}
            {cargosOrdenados.length === 0 && (
              <div className="empty-state">Sin cargos en este período.</div>
            )}
          </div>

          {data.bonificaciones?.length > 0 && (
            <div className="list">
              <label className="corte-label" style={{ margin: '0 0 6px 12px' }}>Bonificaciones</label>
              {data.bonificaciones.map((b) => (
                <div key={b.label} className="row">
                  <div className="title-cell">{b.label}</div>
                  <span className="badge badge-explicada">- {formatoPesos.format(b.monto)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  )
}
