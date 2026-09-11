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

const VISTAS_CUSTOM = ['sobreventa', 'devoluciones', 'clientes', 'publicidad', 'stock_bajo_full']

export default function MetricasView({ onUnauthorized }) {
  const [dias, setDias] = useState(30)
  const [query, setQuery] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [vista, setVista] = useState('unidades') // unidades | monto | neto | sin_ventas | quiebres | reclamos
  const [fotos, setFotos] = useState({})
  const [quiebresData, setQuiebresData] = useState(null)
  const [cargandoQuiebres, setCargandoQuiebres] = useState(false)
  const [reclamosData, setReclamosData] = useState(null)
  const [cargandoReclamos, setCargandoReclamos] = useState(false)
  const [sobreventaData, setSobreventaData] = useState(null)
  const [cargandoSobreventa, setCargandoSobreventa] = useState(false)
  const [devolucionesData, setDevolucionesData] = useState(null)
  const [cargandoDevoluciones, setCargandoDevoluciones] = useState(false)
  const [clientesData, setClientesData] = useState(null)
  const [cargandoClientes, setCargandoClientes] = useState(false)
  const [publicidadData, setPublicidadData] = useState(null)
  const [cargandoPublicidad, setCargandoPublicidad] = useState(false)
  const [stockBajoFullData, setStockBajoFullData] = useState(null)
  const [cargandoStockBajoFull, setCargandoStockBajoFull] = useState(false)

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
    if (vista !== 'sobreventa') return
    setCargandoSobreventa(true)
    apiFetch('/metricas/sobreventa-48h', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setSobreventaData(d)
        setCargandoSobreventa(false)
      })
      .catch(() => setCargandoSobreventa(false))
  }, [vista])

  useEffect(() => {
    if (vista !== 'devoluciones') return
    setCargandoDevoluciones(true)
    apiFetch('/metricas/devoluciones-acumuladas', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setDevolucionesData(d)
        setCargandoDevoluciones(false)
      })
      .catch(() => setCargandoDevoluciones(false))
  }, [vista])

  useEffect(() => {
    if (vista !== 'clientes') return
    setCargandoClientes(true)
    apiFetch('/metricas/clientes-recurrentes', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setClientesData(d)
        setCargandoClientes(false)
      })
      .catch(() => setCargandoClientes(false))
  }, [vista])

  useEffect(() => {
    if (vista !== 'publicidad') return
    setCargandoPublicidad(true)
    apiFetch(`/metricas/publicidad?dias=${dias}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setPublicidadData(d)
        setCargandoPublicidad(false)
      })
      .catch((err) => {
        setPublicidadData({ error: err.message })
        setCargandoPublicidad(false)
      })
  }, [vista, dias])

  useEffect(() => {
    if (vista !== 'stock_bajo_full') return
    setCargandoStockBajoFull(true)
    apiFetch('/ml/full/stock-bajo', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setStockBajoFullData(d)
        setCargandoStockBajoFull(false)
      })
      .catch(() => setCargandoStockBajoFull(false))
  }, [vista])

  useEffect(() => {
    apiFetch('/ml/items', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        const mapa = {}
        ;(d.items || []).forEach((it) => { if (it.sku) mapa[it.sku] = it.foto_url })
        setFotos(mapa)
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
        {!VISTAS_CUSTOM.includes(vista) && (
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
          <button className={`tab ${vista === 'sobreventa' ? 'active' : ''}`} onClick={() => setVista('sobreventa')}>
            🔥 Sobreventa 48h
          </button>
          <button className={`tab ${vista === 'devoluciones' ? 'active' : ''}`} onClick={() => setVista('devoluciones')}>
            ↩ Devoluciones acumuladas
          </button>
          <button className={`tab ${vista === 'clientes' ? 'active' : ''}`} onClick={() => setVista('clientes')}>
            🔁 Clientes recurrentes
          </button>
          <button className={`tab ${vista === 'publicidad' ? 'active' : ''}`} onClick={() => setVista('publicidad')}>
            📢 Publicidad
          </button>
          <button className={`tab ${vista === 'stock_bajo_full' ? 'active' : ''}`} onClick={() => setVista('stock_bajo_full')}>
            🟡 Stock bajo en Full
          </button>
        </div>
        {!VISTAS_CUSTOM.includes(vista) && (
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

      {!loading && !error && data && !VISTAS_CUSTOM.includes(vista) && (
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

      {!loading && !error && datosGrafico.length > 0 && !VISTAS_CUSTOM.includes(vista) && (
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

      {vista === 'sobreventa' && (
        <div className="list">
          {cargandoSobreventa && <div className="loading-state">Cargando...</div>}
          {sobreventaData && sobreventaData.productos.length === 0 && (
            <div className="empty-state">Nada se agotó tan rápido en las últimas 48hs.</div>
          )}
          {sobreventaData?.productos.map((p, i) => (
            <div key={p.sku} className="row">
              {fotos[p.sku] && <img src={fotos[p.sku]} alt="" className="pick-thumb" />}
              <div className="title-cell">
                {p.titulo || p.sku}
                <span className="id-cell mono">SKU: {p.sku} · #{i + 1}</span>
              </div>
              <span className="badge badge-sin-explicar">🔥 {p.ventas_48h} vendidos en 48h</span>
              <span className="badge badge-acordar">Stock actual: {p.stock_actual ?? 0}</span>
            </div>
          ))}
        </div>
      )}

      {vista === 'devoluciones' && (
        <div className="list">
          {cargandoDevoluciones && <div className="loading-state">Cargando...</div>}
          {devolucionesData && devolucionesData.productos.length === 0 && (
            <div className="empty-state">Sin devoluciones registradas todavía - arranca a acumularse desde ahora.</div>
          )}
          {devolucionesData?.productos.map((p, i) => (
            <div key={p.sku} className="row">
              {fotos[p.sku] && <img src={fotos[p.sku]} alt="" className="pick-thumb" />}
              <div className="title-cell">
                {p.titulo || p.sku}
                <span className="id-cell mono">SKU: {p.sku} · #{i + 1}</span>
              </div>
              <span className="badge badge-sin-explicar">↩ {p.cantidad} devuelto(s)</span>
              <span className="badge badge-acordar">{formatoPesos.format(p.monto)} acumulado</span>
            </div>
          ))}
        </div>
      )}

      {vista === 'clientes' && (
        <div className="list">
          {cargandoClientes && <div className="loading-state">Cargando...</div>}
          {clientesData && clientesData.clientes.length === 0 && (
            <div className="empty-state">Todavía no hay clientes con 2+ compras registradas - se va armando con el tiempo.</div>
          )}
          {clientesData?.clientes.map((c, i) => (
            <div key={i} className="row">
              <div className="title-cell">
                {c.nickname}
                <span className="id-cell mono">
                  Primera: {c.primera_compra ? new Date(c.primera_compra).toLocaleDateString('es-AR') : '—'}
                  {' · '}Última: {c.ultima_compra ? new Date(c.ultima_compra).toLocaleDateString('es-AR') : '—'}
                </span>
              </div>
              <span className="badge badge-colecta">🔁 {c.cantidad_compras} compras</span>
              <span className="badge badge-flex">{formatoPesos.format(c.monto_total)} total</span>
            </div>
          ))}
        </div>
      )}

      {vista === 'publicidad' && (
        <div className="list">
          {cargandoPublicidad && <div className="loading-state">Cargando...</div>}
          {publicidadData?.error && <div className="error-state">Error: {publicidadData.error}</div>}
          {publicidadData?.sin_publicidad && (
            <div className="empty-state">{publicidadData.mensaje}</div>
          )}
          {publicidadData?.campañas?.length === 0 && !publicidadData.sin_publicidad && (
            <div className="empty-state">No hay campañas en este período.</div>
          )}
          {publicidadData?.sin_retorno?.length > 0 && (
            <div className="summary">
              <div className="summary-item warn">
                <div className="value mono">{publicidadData.sin_retorno.length}</div>
                <div className="label">Campaña(s) gastando sin retorno</div>
              </div>
            </div>
          )}
          {publicidadData?.campañas?.map((c) => (
            <div key={c.id} className="row">
              <div className="title-cell">
                {c.nombre}
                <span className="id-cell mono">{c.status} · {c.clicks} clicks</span>
              </div>
              <span className="badge badge-flex">{formatoPesos.format(c.gasto)} gastado</span>
              <span className={`badge ${c.ventas_atribuidas === 0 ? 'badge-sin-explicar' : 'badge-explicada'}`}>
                {c.ventas_atribuidas} venta(s) atribuida(s)
              </span>
              {c.roas != null && <span className="id-cell mono">ROAS: {c.roas}</span>}
            </div>
          ))}
        </div>
      )}

      {vista === 'stock_bajo_full' && (
        <div className="list">
          {cargandoStockBajoFull && <div className="loading-state">Cargando...</div>}
          {stockBajoFullData && stockBajoFullData.items.length === 0 && (
            <div className="empty-state">Nada entre 1 y 3 unidades en Full ahora mismo.</div>
          )}
          {stockBajoFullData?.items.map((it, i) => (
            <div key={it.item_id} className="row">
              {fotos[it.sku] && <img src={fotos[it.sku]} alt="" className="pick-thumb" />}
              <div className="title-cell">
                {it.title}
                <span className="id-cell mono">SKU: {it.sku} · #{i + 1}</span>
              </div>
              <span className="badge badge-sin-explicar">🟡 {it.available_quantity} disponible(s) en Full</span>
            </div>
          ))}
        </div>
      )}

      {!VISTAS_CUSTOM.includes(vista) && (
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
            {vista !== 'sin_ventas' && vista !== 'quiebres' && vista !== 'reclamos' && (
              <>
                <span className="badge badge-colecta">×{p.ventas_unidades} u.</span>
                <span className="badge badge-flex">{formatoPesos.format(p.ventas_monto)} bruto</span>
                <span className="badge badge-acordar">{formatoPesos.format(p.ventas_monto_neto)} neto</span>
              </>
            )}
            {vista === 'sin_ventas' && (
              <>
                <span className="badge badge-sin-explicar">Stock: {p.stock_actual}</span>
                <span className="id-cell mono">
                  {p.ultima_venta
                    ? `Última venta: ${new Date(p.ultima_venta).toLocaleDateString('es-AR')} (hace ${p.dias_desde_ultima_venta} día(s))`
                    : 'Sin ventas registradas en el historial'}
                </span>
              </>
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
