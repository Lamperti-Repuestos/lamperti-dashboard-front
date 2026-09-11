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
  const [query, setQuery] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vista, setVista] = useState('unidades') // unidades | monto | neto | sin_ventas | quiebres
  const [fotos, setFotos] = useState({})
  const [quiebresData, setQuiebresData] = useState(null)
  const [cargandoQuiebres, setCargandoQuiebres] = useState(false)
  const [reclamosData, setReclamosData] = useState(null)
  const [cargandoReclamos, setCargandoReclamos] = useState(false)
  const [catalogo, setCatalogo] = useState([])
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [productoElegido, setProductoElegido] = useState(null)
  const [queryCompetencia, setQueryCompetencia] = useState('')
  const [competenciaData, setCompetenciaData] = useState(null)
  const [cargandoCompetencia, setCargandoCompetencia] = useState(false)

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
    if (vista !== 'quiebres') return
    setCargandoQuiebres(true)
    apiFetch(`/metricas/quiebres-stock?dias=${dias}`, {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setQuiebresData(d)
        setCargandoQuiebres(false)
      })
      .catch(() => setCargandoQuiebres(false))
  }, [vista, dias])

  useEffect(() => {
    if (vista !== 'reclamos') return
    setCargandoReclamos(true)
    apiFetch(`/metricas/reclamos-producto?dias=${dias}`, {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setReclamosData(d)
        setCargandoReclamos(false)
      })
      .catch(() => setCargandoReclamos(false))
  }, [vista, dias])

  useEffect(() => {
    apiFetch('/ml/items', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        const mapa = {}
        ;(d.items || []).forEach((it) => { if (it.sku) mapa[it.sku] = it.foto_url })
        setFotos(mapa)
        setCatalogo(d.items || [])
      })
  }, [])

  const lista = vista === 'quiebres'
    ? (quiebresData?.productos || [])
    : vista === 'reclamos'
      ? (reclamosData?.productos || [])
      : data
        ? vista === 'unidades' ? data.top_unidades : vista === 'monto' ? data.top_monto : vista === 'neto' ? data.top_neto : data.sin_ventas
        : []

  const normalizar = (s) =>
    (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '')

  const coincidenciasPropias = busquedaProducto.trim()
    ? catalogo.filter((it) => {
        const q = normalizar(busquedaProducto)
        return normalizar(it.title).includes(q) || normalizar(it.sku).includes(q)
      }).slice(0, 10)
    : []

  const elegirProducto = (item) => {
    setProductoElegido(item)
    setQueryCompetencia(item.title)
    setBusquedaProducto('')
    setCompetenciaData(null)
  }

  const buscarCompetencia = () => {
    if (!productoElegido) return
    setCargandoCompetencia(true)
    const params = new URLSearchParams({ item_id: productoElegido.id })
    if (queryCompetencia && queryCompetencia !== productoElegido.title) {
      params.set('query', queryCompetencia)
    }
    apiFetch(`/metricas/competencia?${params.toString()}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setCompetenciaData(d)
        setCargandoCompetencia(false)
      })
      .catch((err) => {
        setCompetenciaData({ error: err.message })
        setCargandoCompetencia(false)
      })
  }

  const listaFiltrada = query.trim()
    ? lista.filter((p) => {
        const q = normalizar(query)
        return normalizar(p.titulo).includes(q) || normalizar(p.sku).includes(q)
      })
    : lista

  const datosGrafico = useMemo(() => {
    if (vista === 'sin_ventas') return []
    if (vista === 'quiebres') {
      return listaFiltrada.slice(0, 10).map((p) => ({
        nombre: p.titulo?.length > 28 ? p.titulo.slice(0, 28) + '…' : (p.titulo || p.sku),
        valor: p.veces_sin_stock,
      }))
    }
    if (vista === 'reclamos') {
      return listaFiltrada.slice(0, 10).map((p) => ({
        nombre: p.titulo?.length > 28 ? p.titulo.slice(0, 28) + '…' : (p.titulo || p.sku),
        valor: p.reclamos_abiertos,
      }))
    }
    return listaFiltrada.slice(0, 10).map((p) => ({
      nombre: p.titulo?.length > 28 ? p.titulo.slice(0, 28) + '…' : (p.titulo || p.sku),
      valor: vista === 'unidades' ? p.ventas_unidades : vista === 'neto' ? p.ventas_monto_neto : p.ventas_monto,
    }))
  }, [listaFiltrada, vista])

  return (
    <>
      <div className="controls">
        {vista !== 'competencia' && (
          <input
            className="search-input"
            type="text"
            placeholder="Buscar por título o SKU..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
        <div className="tabs">
          <button className={`tab ${vista === 'unidades' ? 'active' : ''}`} onClick={() => setVista('unidades')}>
            🏆 Top unidades
          </button>
          <button className={`tab ${vista === 'monto' ? 'active' : ''}`} onClick={() => setVista('monto')}>
            💰 Top $
          </button>
          <button className={`tab ${vista === 'neto' ? 'active' : ''}`} onClick={() => setVista('neto')}>
            💵 Neto real
          </button>
          <button className={`tab tab-acordar ${vista === 'sin_ventas' ? 'active' : ''}`} onClick={() => setVista('sin_ventas')}>
            😴 Sin ventas
          </button>
          <button className={`tab tab-colecta ${vista === 'quiebres' ? 'active' : ''}`} onClick={() => setVista('quiebres')}>
            📉 Quiebres de stock
          </button>
          <button className={`tab tab-flex ${vista === 'reclamos' ? 'active' : ''}`} onClick={() => setVista('reclamos')}>
            ⚠ Reclamos por producto
          </button>
          <button className={`tab ${vista === 'competencia' ? 'active' : ''}`} onClick={() => setVista('competencia')}>
            🥊 Precio vs competencia
          </button>
        </div>
        {vista !== 'competencia' && (
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
        )}
      </div>

      {!loading && !error && data && vista !== 'competencia' && (
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

      {!loading && !error && datosGrafico.length > 0 && vista !== 'competencia' && (
        <div className="paste-box">
          <ResponsiveContainer width="100%" height={Math.max(220, datosGrafico.length * 34)}>
            <BarChart data={datosGrafico} layout="vertical" margin={{ left: 10, right: 20 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="nombre"
                width={210}
                tick={{ fontSize: 13, fontFamily: 'Archivo, sans-serif', fill: 'var(--charcoal)' }}
              />
              <Tooltip
                formatter={(value) => (vista === 'quiebres' || vista === 'reclamos') ? `${value}` : vista === 'unidades' ? `${value} unidades` : formatoPesos.format(value)}
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

      {vista === 'competencia' && (
        <div className="paste-box">
          <label className="corte-label" style={{ marginBottom: 8 }}>Buscar tu producto</label>
          <input
            className="search-input"
            type="text"
            placeholder="Título o SKU de tu publicación..."
            value={busquedaProducto}
            onChange={(e) => setBusquedaProducto(e.target.value)}
          />
          {coincidenciasPropias.length > 0 && (
            <div className="paste-result">
              {coincidenciasPropias.map((it) => (
                <div key={it.id} className="paste-result-row" style={{ cursor: 'pointer' }} onClick={() => elegirProducto(it)}>
                  {it.foto_url && <img src={it.foto_url} alt="" className="pick-thumb" />}
                  <div className="title-cell">
                    {it.title}
                    <span className="id-cell mono">SKU: {it.sku}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          {productoElegido && (
            <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--gray-line)' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 8 }}>
                {productoElegido.foto_url && <img src={productoElegido.foto_url} alt="" className="pick-thumb" />}
                <div className="title-cell">
                  {productoElegido.title}
                  <span className="id-cell mono">Tu precio: {formatoPesos.format(productoElegido.price)}</span>
                </div>
              </div>

              <label className="corte-label" style={{ fontSize: 12 }}>
                Texto de búsqueda (ajustalo si no trae buenos resultados)
              </label>
              <input
                className="search-input"
                type="text"
                value={queryCompetencia}
                onChange={(e) => setQueryCompetencia(e.target.value)}
              />
              <button className="scan-btn" style={{ marginTop: 8 }} onClick={buscarCompetencia} disabled={cargandoCompetencia}>
                {cargandoCompetencia ? 'Buscando...' : '🥊 Comparar contra la competencia'}
              </button>
            </div>
          )}
        </div>
      )}

      {vista === 'competencia' && competenciaData && !competenciaData.error && (
        <div className="summary">
          <div className="summary-item">
            <div className="value mono">{competenciaData.total_competidores_encontrados}</div>
            <div className="label">Competidores encontrados</div>
          </div>
          <div className="summary-item">
            <div className="value mono">
              {competenciaData.precio_minimo_competencia != null ? formatoPesos.format(competenciaData.precio_minimo_competencia) : '—'}
            </div>
            <div className="label">Precio más bajo de otros</div>
          </div>
          <div className="summary-item">
            <div className="value mono">{competenciaData.soy_mas_barato_que}</div>
            <div className="label">Soy más barato que</div>
          </div>
        </div>
      )}

      {vista === 'competencia' && competenciaData?.error && (
        <div className="error-state">Error: {competenciaData.error}</div>
      )}

      {vista === 'competencia' && competenciaData && !competenciaData.error && (
        <div className="list">
          {competenciaData.competidores.length === 0 && (
            <div className="empty-state">No encontré otros vendedores con algo parecido - probá ajustando el texto de búsqueda.</div>
          )}
          {competenciaData.competidores.map((c, i) => (
            <div key={i} className="row">
              <div className="title-cell">
                {c.titulo}
                <span className="id-cell mono">{c.vendedor}</span>
              </div>
              <span className={`badge ${c.precio < competenciaData.mi_precio ? 'badge-sin-explicar' : 'badge-explicada'}`}>
                {formatoPesos.format(c.precio)}
              </span>
              {c.permalink && (
                <a href={c.permalink} target="_blank" rel="noreferrer" className="id-cell mono">Ver ↗</a>
              )}
            </div>
          ))}
        </div>
      )}

      {vista !== 'competencia' && (
      <div className="list">
        {(loading || (vista === 'quiebres' && cargandoQuiebres) || (vista === 'reclamos' && cargandoReclamos)) && (
          <div className="loading-state">Cargando métricas...</div>
        )}
        {error && <div className="error-state">Error: {error}</div>}
        {!loading && !error && listaFiltrada.length === 0 && (
          <div className="empty-state">Sin datos todavía para este período - esperá a que se acumulen más días.</div>
        )}

        {!loading && !error && listaFiltrada.map((p, i) => (
          <div key={p.sku} className="row">
            {MEDALLA[i] && <span style={{ fontSize: 22 }}>{MEDALLA[i]}</span>}
            {fotos[p.sku] && <img src={fotos[p.sku]} alt="" className="pick-thumb" />}
            <div className="title-cell">
              {p.titulo || p.sku}
              <span className="id-cell mono">SKU: {p.sku} · #{i + 1}</span>
            </div>
            {vista !== 'sin_ventas' && vista !== 'quiebres' && (
              <>
                <span className="badge badge-colecta">×{p.ventas_unidades} u.</span>
                <span className="badge badge-flex">{formatoPesos.format(p.ventas_monto)} bruto</span>
                <span className="badge badge-acordar">{formatoPesos.format(p.ventas_monto_neto)} neto</span>
              </>
            )}
            {vista === 'sin_ventas' && (
              <span className="badge badge-sin-explicar">Stock: {p.stock_actual}</span>
            )}
            {vista === 'sin_ventas' && (
              <span className="id-cell mono">
                {p.ultima_venta
                  ? `Última venta: ${new Date(p.ultima_venta).toLocaleDateString('es-AR')} (hace ${p.dias_desde_ultima_venta} día(s))`
                  : 'Sin ventas registradas en el historial'}
              </span>
            )}
            {vista === 'quiebres' && (
              <>
                <span className="badge badge-sin-explicar">{p.veces_sin_stock}x sin stock</span>
                <span className="badge badge-acordar">{p.dias_totales_sin_stock} día(s) totales</span>
                <span className="id-cell mono">~{p.promedio_dias_por_quiebre} días/vez</span>
              </>
            )}
            {vista === 'reclamos' && (
              <>
                <span className="badge badge-sin-explicar">{p.reclamos_abiertos} reclamo(s) abierto(s)</span>
                <span className="badge badge-acordar">{p.ventas_unidades} vendidos en el período</span>
                <span className="id-cell mono">{p.reclamos_cada_100_ventas} cada 100 ventas</span>
              </>
            )}
            {p.precio != null && <span className="id-cell mono">Precio: {formatoPesos.format(p.precio)}</span>}
          </div>
        ))}
      </div>
      )}
    </>
  )
}
