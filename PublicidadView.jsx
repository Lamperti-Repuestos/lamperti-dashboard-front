import { useEffect, useState } from 'react'
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { apiFetch } from './api.js'

const formatoPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

const COLORES = ['#1A2B6B', '#2E4A9E', '#4A67B8', '#6B84C9', '#8CA1D8', '#ADBEE7', '#B8860B', '#2E7D46', '#B03A2E', '#6B4A9E']

const METRICAS = [
  { id: 'ingresos', label: 'Ingresos ($)', formato: 'pesos' },
  { id: 'gasto', label: 'Inversión ($)', formato: 'pesos' },
  { id: 'ventas_atribuidas', label: 'Ventas atribuidas (u.)', formato: 'numero' },
  { id: 'ventas_directas', label: 'Ventas directas (u.)', formato: 'numero' },
  { id: 'ventas_indirectas', label: 'Ventas indirectas (u.)', formato: 'numero' },
  { id: 'ventas_organicas', label: 'Ventas orgánicas (u.)', formato: 'numero' },
  { id: 'clicks', label: 'Clicks', formato: 'numero' },
  { id: 'impresiones', label: 'Impresiones', formato: 'numero' },
  { id: 'acos', label: 'ACOS (%) - ver aviso abajo', formato: 'porcentaje' },
]

const RANGOS = [
  { dias: 1, label: '1 día' },
  { dias: 7, label: '7 días' },
  { dias: 30, label: '30 días' },
]

function formatearValor(valor, formato) {
  if (valor == null) return '—'
  if (formato === 'pesos') return formatoPesos.format(valor)
  if (formato === 'porcentaje') return `${valor.toFixed(1)}%`
  return valor.toLocaleString('es-AR')
}

function GraficoTorta({ datos, metricaId, formato }) {
  const metrica = METRICAS.find((m) => m.id === metricaId)
  const crudo = datos
    .map((d) => ({ nombre: d.nombre, valor: d[metricaId] || 0 }))
    .filter((d) => d.valor > 0)
    .sort((a, b) => b.valor - a.valor)

  if (crudo.length === 0) {
    return <div className="empty-state">Sin datos de "{metrica.label}" para graficar en este período.</div>
  }

  // Con muchos artículos la torta queda ilegible (porciones finitas,
  // etiquetas superpuestas) - agrupamos todo lo que no entre en el
  // top 8 bajo "Otros", así se puede leer de verdad. El detalle
  // completo sigue disponible en la lista de abajo.
  const TOP = 8
  let datosGrafico = crudo
  if (crudo.length > TOP) {
    const top = crudo.slice(0, TOP)
    const restoValor = crudo.slice(TOP).reduce((acc, d) => acc + d.valor, 0)
    datosGrafico = [...top, { nombre: `Otros (${crudo.length - TOP})`, valor: restoValor }]
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <PieChart>
        <Pie
          data={datosGrafico}
          dataKey="valor"
          nameKey="nombre"
          cx="50%"
          cy="50%"
          outerRadius={110}
          label={({ percent }) => (percent > 0.04 ? `${(percent * 100).toFixed(0)}%` : '')}
        >
          {datosGrafico.map((_, i) => (
            <Cell key={i} fill={COLORES[i % COLORES.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(valor) => formatearValor(valor, formato)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
      </PieChart>
    </ResponsiveContainer>
  )
}

export default function PublicidadView({ onUnauthorized }) {
  const [dias, setDias] = useState(30)
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [metrica, setMetrica] = useState('ingresos')

  const [campaniaAbierta, setCampaniaAbierta] = useState(null)
  const [articulosData, setArticulosData] = useState(null)
  const [cargandoArticulos, setCargandoArticulos] = useState(false)

  const fetchDatos = () => {
    setCargando(true)
    apiFetch(`/metricas/publicidad?dias=${dias}`, {}, onUnauthorized)
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

  useEffect(fetchDatos, [dias])

  const abrirCampania = (campania) => {
    if (campaniaAbierta?.id === campania.id) {
      setCampaniaAbierta(null)
      setArticulosData(null)
      return
    }
    setCampaniaAbierta(campania)
    setArticulosData(null)
    setCargandoArticulos(true)
    apiFetch(`/metricas/publicidad/campanas/${campania.id}/articulos?dias=${dias}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setArticulosData(d)
        setCargandoArticulos(false)
      })
      .catch((err) => {
        setArticulosData({ error: err.message })
        setCargandoArticulos(false)
      })
  }

  const metricaActual = METRICAS.find((m) => m.id === metrica)

  return (
    <>
      <div className="controls">
        <div className="tabs">
          {RANGOS.map((r) => (
            <button key={r.dias} className={`tab ${dias === r.dias ? 'active' : ''}`} onClick={() => setDias(r.dias)}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      <div className="controls">
        <label className="corte-label" style={{ width: '100%' }}>
          Métrica del gráfico
          <select className="corte-input" style={{ width: '100%', marginTop: 4 }} value={metrica} onChange={(e) => setMetrica(e.target.value)}>
            {METRICAS.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </label>
      </div>

      {cargando && <div className="loading-state">Cargando...</div>}
      {data?.error && <div className="error-state">Error: {data.error}</div>}
      {data?.sin_publicidad && <div className="empty-state">{data.mensaje}</div>}
      {data?.campañas?.length === 0 && !data.sin_publicidad && (
        <div className="empty-state">No hay campañas en este período.</div>
      )}

      {data?.sin_retorno?.length > 0 && (
        <div className="summary">
          <div className="summary-item warn">
            <div className="value mono">{data.sin_retorno.length}</div>
            <div className="label">Campaña(s) gastando sin retorno</div>
          </div>
        </div>
      )}

      {data?.campañas?.length > 0 && (
        <div className="paste-box">
          {metrica === 'acos' && (
            <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '0 0 10px' }}>
              ⚠ El ACOS es un porcentaje, no una cantidad - una torta no representa bien "cuánto pesa" cada campaña en el ACOS total. Sirve más para comparar barras que para ver proporción.
            </p>
          )}
          <label className="corte-label" style={{ marginBottom: 8 }}>
            {metricaActual.label} por campaña
          </label>
          <GraficoTorta datos={data.campañas} metricaId={metrica} formato={metricaActual.formato} />
        </div>
      )}

      <div className="list">
        {data?.campañas?.map((c) => (
          <div key={c.id}>
            <div className="row" style={{ cursor: 'pointer' }} onClick={() => abrirCampania(c)}>
              <div className="title-cell">
                {c.nombre}
                <span className="id-cell mono">{c.status} · {c.clicks} clicks · {c.impresiones} impresiones</span>
              </div>
              <span className="badge badge-flex">{formatoPesos.format(c.gasto)} gastado</span>
              <span className={`badge ${c.ventas_atribuidas === 0 ? 'badge-sin-explicar' : 'badge-explicada'}`}>
                {c.ventas_atribuidas} venta(s) atribuida(s)
              </span>
              {c.roas != null && <span className="id-cell mono">ROAS: {c.roas}</span>}
              <span className="detail-toggle">{campaniaAbierta?.id === c.id ? '▲' : '▼ ver artículos'}</span>
            </div>

            {campaniaAbierta?.id === c.id && (
              <div className="sale-detail">
                {cargandoArticulos && <div className="loading-state">Cargando artículos...</div>}
                {articulosData?.error && <div className="error-state">Error: {articulosData.error}</div>}

                {articulosData?.articulos?.length > 0 && (
                  <div className="paste-box">
                    <label className="corte-label" style={{ marginBottom: 8 }}>
                      {metricaActual.label} por artículo - "{c.nombre}"
                    </label>
                    <GraficoTorta datos={articulosData.articulos.map((a) => ({ ...a, nombre: a.titulo || a.item_id }))} metricaId={metrica} formato={metricaActual.formato} />
                  </div>
                )}
                {articulosData?.articulos?.length === 0 && (
                  <div className="empty-state">Sin artículos con datos en esta campaña en el período.</div>
                )}

                {articulosData?.articulos?.map((a) => (
                  <div key={a.item_id} className="row">
                    <div className="title-cell">
                      {a.titulo || a.item_id}
                      <span className="id-cell mono">{a.item_id} · {a.status}</span>
                    </div>
                    <span className="badge badge-flex">{formatoPesos.format(a.gasto)}</span>
                    <span className="badge badge-colecta">{a.ventas_atribuidas} venta(s)</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
