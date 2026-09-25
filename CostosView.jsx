import { useEffect, useRef, useState } from 'react'
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
    setPorPublicacionData(null) // el período cambió, lo que teníamos cargado ya no aplica
  }

  // --- Costos por publicación ---
  const periodQuery = periodoElegido ? `?period_key=${periodoElegido}` : ''
  const [mostrarPorPublicacion, setMostrarPorPublicacion] = useState(false)
  const [porPublicacionData, setPorPublicacionData] = useState(null)
  const [cargandoPorPublicacion, setCargandoPorPublicacion] = useState(false)
  const [errorPorPublicacion, setErrorPorPublicacion] = useState(null)
  const [progresoPorPublicacion, setProgresoPorPublicacion] = useState(null)
  const [actualizandoPorPublicacion, setActualizandoPorPublicacion] = useState(false)
  const [msgActualizarPorPublicacion, setMsgActualizarPorPublicacion] = useState(null)
  const yaRefresquePorPublicacion = useRef(true)

  useEffect(() => {
    if (!mostrarPorPublicacion) return
    let cancelado = false

    const consultarProgreso = () => {
      apiFetch('/metricas/costos/publicaciones/progreso', {}, onUnauthorized)
        .then((res) => res.json())
        .then((d) => {
          if (cancelado) return
          setProgresoPorPublicacion(d)
          if (d.corriendo) {
            yaRefresquePorPublicacion.current = false
          } else if (!yaRefresquePorPublicacion.current) {
            yaRefresquePorPublicacion.current = true
            apiFetch(`/metricas/costos/publicaciones${periodQuery}`, {}, onUnauthorized)
              .then((res) => res.json())
              .then(setPorPublicacionData)
          }
        })
        .catch(() => {})
    }

    consultarProgreso()
    const intervalo = setInterval(consultarProgreso, 2000)
    return () => {
      cancelado = true
      clearInterval(intervalo)
    }
  }, [mostrarPorPublicacion, periodQuery, onUnauthorized])

  const togglePorPublicacion = () => {
    const abrir = !mostrarPorPublicacion
    setMostrarPorPublicacion(abrir)
    if (abrir && !porPublicacionData) {
      setCargandoPorPublicacion(true)
      setErrorPorPublicacion(null)
      apiFetch(`/metricas/costos/publicaciones${periodQuery}`, {}, onUnauthorized)
        .then(async (res) => {
          const d = await res.json()
          if (!res.ok) throw new Error(d.detail || 'Error')
          return d
        })
        .then((d) => {
          setPorPublicacionData(d)
          setCargandoPorPublicacion(false)
        })
        .catch((err) => {
          setErrorPorPublicacion(err.message)
          setCargandoPorPublicacion(false)
        })
    }
  }

  const actualizarPorPublicacionAhora = () => {
    setActualizandoPorPublicacion(true)
    setMsgActualizarPorPublicacion(null)
    apiFetch(`/metricas/costos/publicaciones/actualizar${periodQuery}`, { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setMsgActualizarPorPublicacion(
          d.ya_estaba_corriendo
            ? '⏳ Ya había una actualización en curso - esperá a que termine.'
            : '✅ Calculando... ML solo deja 5 pedidos/minuto a este endpoint, puede tardar varios minutos. Se actualiza solo cuando termina.'
        )
        setActualizandoPorPublicacion(false)
      })
      .catch((err) => {
        setMsgActualizarPorPublicacion(`❌ ${err.message}`)
        setActualizandoPorPublicacion(false)
      })
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
              <div className="value mono">{formatoPesos.format(data.ventas_concretadas)}</div>
              <div className="label">Ventas concretadas</div>
            </div>
            <div className="summary-item">
              <div className="value mono">{formatoPesos.format(data.total_cargos)}</div>
              <div className="label">Cargos e inversiones</div>
            </div>
            <div className="summary-item">
              <div className="value mono">{formatoPesos.format(data.total_percepciones)}</div>
              <div className="label">Impuestos</div>
            </div>
            <div className="summary-item">
              <div className="value mono">{formatoPesos.format(data.recibiste)}</div>
              <div className="label">Recibiste{data.rentabilidad_pct != null && ` (${data.rentabilidad_pct}%)`}</div>
            </div>
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

          <button className="sort-btn" onClick={togglePorPublicacion} style={{ marginTop: 12 }}>
            📦 {mostrarPorPublicacion ? 'Ocultar' : 'Ver'} costos por publicación
          </button>

          {mostrarPorPublicacion && (
            <div className="list">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, margin: '0 0 6px 12px' }}>
                <label className="corte-label" style={{ marginBottom: 0 }}>
                  Desglose por SKU - {periodoElegido || 'período más reciente'}
                </label>
                <button
                  className="sort-btn"
                  onClick={actualizarPorPublicacionAhora}
                  disabled={actualizandoPorPublicacion || progresoPorPublicacion?.corriendo}
                >
                  {(actualizandoPorPublicacion || progresoPorPublicacion?.corriendo) ? '🔄 Calculando...' : '🔄 Calcular / actualizar'}
                </button>
              </div>

              {msgActualizarPorPublicacion && (
                <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '0 0 8px 12px' }}>
                  {msgActualizarPorPublicacion}
                </p>
              )}

              {progresoPorPublicacion?.corriendo && (
                <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '0 0 8px 12px' }}>
                  Página {progresoPorPublicacion.paginas} · {progresoPorPublicacion.lineas_procesadas} líneas · {progresoPorPublicacion.publicaciones_encontradas} publicaciones hasta ahora (ML limita a 5 pedidos/minuto, puede tardar)
                </p>
              )}

              {cargandoPorPublicacion && <div className="loading-state">Cargando...</div>}
              {errorPorPublicacion && <div className="error-state">Error: {errorPorPublicacion}</div>}

              {porPublicacionData && !porPublicacionData.disponible && !progresoPorPublicacion?.corriendo && (
                <div className="empty-state">Todavía no se calculó para este período. Tocá "Calcular / actualizar".</div>
              )}

              {porPublicacionData?.disponible && (
                <>
                  <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '0 0 8px 12px' }}>
                    Actualizado hace {Math.round(porPublicacionData.actualizado_hace_seg / 60)} min
                  </p>
                  {porPublicacionData.publicaciones.map((p) => (
                    <div key={p.item_id} className="row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                      <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8 }}>
                        <div className="title-cell">{p.titulo}</div>
                        <span className="badge badge-flex">{formatoPesos.format(p.total)}</span>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--gray-muted)' }}>
                        {Object.entries(p.por_subtipo).map(([k, v]) => `${k}: ${formatoPesos.format(v)}`).join(' · ')}
                      </div>
                    </div>
                  ))}
                  {porPublicacionData.publicaciones.length === 0 && (
                    <div className="empty-state">Sin cargos asignables a publicaciones en este período.</div>
                  )}
                  {porPublicacionData.no_asignable?.total > 0 && (
                    <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '8px 0 0 12px' }}>
                      No asignable a una publicación puntual (ej: envíos combinados): {formatoPesos.format(porPublicacionData.no_asignable.total)}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </>
      )}
    </>
  )
}
