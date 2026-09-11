import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api.js'
import ImageLightbox from './ImageLightbox.jsx'

const normalizarBusqueda = (s) =>
  (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s-]+/g, '')

export default function PedidosFullView({ onUnauthorized }) {
  const [envios, setEnvios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [enviandoId, setEnviandoId] = useState(null)
  const [zoomUrl, setZoomUrl] = useState(null)

  // Buscar y agregar un producto suelto
  const [catalogo, setCatalogo] = useState([])
  const [catalogoCargado, setCatalogoCargado] = useState(false)
  const [buscarQuery, setBuscarQuery] = useState('')
  const [cantidades, setCantidades] = useState({})
  const [agregando, setAgregando] = useState(null)
  const [pedidoDestino, setPedidoDestino] = useState('nuevo')
  const [editandoCantidadId, setEditandoCantidadId] = useState(null)
  const [cantidadDraft, setCantidadDraft] = useState('')
  const [vistaGrande, setVistaGrande] = useState({})
  const [filtro, setFiltro] = useState('todos') // todos | sin_pedir | pedidos | en_stock | embalados
  const [queryProducto, setQueryProducto] = useState('')
  const [editandoParcialId, setEditandoParcialId] = useState(null)
  const [parcialDraft, setParcialDraft] = useState('')

  const fetchPipeline = () => {
    apiFetch('/full/pipeline', {}, onUnauthorized)
      .then((res) => res.json())
      .then((data) => {
        setEnvios(data.envios)
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
    cargarCatalogo()
  }, [])

  const cargarCatalogo = () => {
    if (catalogoCargado) return
    apiFetch('/ml/items', {}, onUnauthorized)
      .then((res) => res.json())
      .then((data) => {
        setCatalogo(data.items || [])
        setCatalogoCargado(true)
      })
  }

  const coincidencias = useMemo(() => {
    if (!buscarQuery.trim()) return []
    const q = buscarQuery.trim().toLowerCase()
    return catalogo
      .filter((it) => it.title?.toLowerCase().includes(q) || it.sku?.toLowerCase().includes(q))
      .slice(0, 15)
  }, [catalogo, buscarQuery])

  const fotoPorSku = useMemo(() => {
    const mapa = {}
    catalogo.forEach((it) => {
      if (it.sku) mapa[it.sku] = { chica: it.foto_url, grande: it.foto_grande || it.foto_url }
    })
    return mapa
  }, [catalogo])

  const agregarProducto = (item) => {
    const cantidad = cantidades[item.id] || 1
    setAgregando(item.id)
    apiFetch('/full/pipeline/agregar-lote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pedido_id: pedidoDestino === 'nuevo' ? null : Number(pedidoDestino),
        items: [{ sku: item.sku, titulo: item.title, cantidad: Number(cantidad) }],
      }),
    }, onUnauthorized)
      .then(() => {
        setAgregando(null)
        setBuscarQuery('')
        fetchPipeline()
      })
      .catch(() => setAgregando(null))
  }

  const toggleEmbalado = (envioIdx, item) => {
    const direccion = item.estado === 'embalado' ? 'atras' : 'adelante'
    setEnvios((prev) => {
      const copia = [...prev]
      copia[envioIdx] = {
        ...copia[envioIdx],
        items: copia[envioIdx].items.map((it) =>
          it.id === item.id
            ? {
                ...it,
                estado: direccion === 'adelante' ? 'embalado' : 'por_embalar',
                en_stock_local: direccion === 'adelante' ? true : it.en_stock_local,
              }
            : it
        ),
      }
      return copia
    })
    apiFetch(`/full/pipeline/${item.id}/avanzar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direccion }),
    }, onUnauthorized)
      .then(() => fetchPipeline())
      .catch(() => fetchPipeline())
  }

  const toggleCampoBooleano = (envioIdx, item, campo, endpoint) => {
    const nuevoValor = !item[campo]
    setEnvios((prev) => {
      const copia = [...prev]
      copia[envioIdx] = {
        ...copia[envioIdx],
        items: copia[envioIdx].items.map((it) => (it.id === item.id ? { ...it, [campo]: nuevoValor } : it)),
      }
      return copia
    })
    apiFetch(`/full/pipeline/${item.id}/${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ valor: nuevoValor }),
    }, onUnauthorized).catch(() => fetchPipeline())
  }

  const empezarEdicionParcial = (item) => {
    setEditandoParcialId(item.id)
    setParcialDraft(String(item.cantidad_embalada || ''))
  }

  const guardarParcial = (envioIdx, item) => {
    const cantidad = Number(parcialDraft)
    if (Number.isNaN(cantidad) || cantidad < 0 || cantidad > item.cantidad_total) return
    apiFetch(`/full/pipeline/${item.id}/marcar-parcial`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad }),
    }, onUnauthorized)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Error')
        return data
      })
      .then((data) => {
        setEnvios((prev) => {
          const copia = [...prev]
          copia[envioIdx] = {
            ...copia[envioIdx],
            items: copia[envioIdx].items.map((it) =>
              it.id === item.id
                ? { ...it, cantidad_embalada: data.cantidad_embalada, estado: data.nuevo_estado, en_stock_local: data.en_stock_local }
                : it
            ),
          }
          return copia
        })
        setEditandoParcialId(null)
      })
      .catch((err) => alert(`Error: ${err.message}`))
  }

  const empezarEdicionCantidad = (item) => {
    setEditandoCantidadId(item.id)
    setCantidadDraft(String(item.cantidad_total))
  }

  const guardarCantidad = (envioIdx, item) => {
    const nuevoValor = parseInt(cantidadDraft, 10)
    setEditandoCantidadId(null)
    if (Number.isNaN(nuevoValor) || nuevoValor < 0) return

    setEnvios((prev) => {
      const copia = [...prev]
      copia[envioIdx] = {
        ...copia[envioIdx],
        items: copia[envioIdx].items.map((it) =>
          it.id === item.id ? { ...it, cantidad_total: nuevoValor } : it
        ),
      }
      return copia
    })

    apiFetch(`/full/pipeline/${item.id}/cantidad`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad: nuevoValor }),
    }, onUnauthorized).catch(() => fetchPipeline())
  }

  const borrarEnvio = (envio) => {
    if (!confirm(`¿Borrar "${envio.nombre}" entero (${envio.items.length} productos)? No se puede deshacer.`)) return
    apiFetch(`/full/envios/${envio.pedido_id}`, { method: 'DELETE' }, onUnauthorized)
      .then(() => fetchPipeline())
  }

  const marcarEnviado = (envio) => {
    const faltan = envio.items.filter((it) => it.estado !== 'embalado').length
    if (faltan > 0) {
      alert(`Todavía hay ${faltan} producto(s) sin embalar en "${envio.nombre}".`)
      return
    }
    if (!confirm(`¿Marcar "${envio.nombre}" (${envio.items.length} productos) como enviado?`)) return

    setEnviandoId(envio.pedido_id)
    apiFetch(`/full/envios/${envio.pedido_id}/enviar`, { method: 'POST' }, onUnauthorized)
      .then(() => {
        setEnviandoId(null)
        fetchPipeline()
      })
      .catch(() => setEnviandoId(null))
  }

  return (
    <>
      <div className="paste-box">
        <label className="corte-label" style={{ marginBottom: 8 }}>
          Agregar producto suelto
        </label>
        <input
          className="search-input"
          type="text"
          placeholder="Buscar por título o SKU..."
          value={buscarQuery}
          onFocus={cargarCatalogo}
          onChange={(e) => setBuscarQuery(e.target.value)}
        />

        {envios.length > 1 && (
          <div style={{ marginTop: 8 }}>
            <label className="corte-label" style={{ display: 'inline-flex', marginBottom: 0 }}>
              Agregar a:
              <select
                className="corte-input"
                value={pedidoDestino}
                onChange={(e) => setPedidoDestino(e.target.value)}
              >
                {envios.map((e) => (
                  <option key={e.pedido_id} value={e.pedido_id}>{e.nombre}</option>
                ))}
                <option value="nuevo">+ Envío nuevo</option>
              </select>
            </label>
          </div>
        )}

        {coincidencias.length > 0 && (
          <div className="paste-result">
            {coincidencias.map((it) => (
              <div key={it.id} className="paste-result-row">
                <div className="title-cell">
                  {it.title}
                  <span className="id-cell mono">SKU: {it.sku}</span>
                </div>
                <input
                  type="number"
                  min={1}
                  className="stock-input"
                  value={cantidades[it.id] || 1}
                  onChange={(e) => setCantidades((prev) => ({ ...prev, [it.id]: e.target.value }))}
                />
                <button
                  className="scan-btn"
                  onClick={() => agregarProducto(it)}
                  disabled={agregando === it.id}
                >
                  {agregando === it.id ? 'Agregando...' : '+ Agregar'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="controls">
        <input
          className="search-input"
          type="text"
          placeholder="Buscar producto por título o SKU..."
          value={queryProducto}
          onChange={(e) => setQueryProducto(e.target.value)}
        />
        <div className="tabs">
          <button className={`tab ${filtro === 'todos' ? 'active' : ''}`} onClick={() => setFiltro('todos')}>
            Todos
          </button>
          <button className={`tab ${filtro === 'sin_pedir' ? 'active' : ''}`} onClick={() => setFiltro('sin_pedir')}>
            Sin pedir
          </button>
          <button className={`tab ${filtro === 'pedidos' ? 'active' : ''}`} onClick={() => setFiltro('pedidos')}>
            Pedidos
          </button>
          <button className={`tab ${filtro === 'en_stock' ? 'active' : ''}`} onClick={() => setFiltro('en_stock')}>
            En stock
          </button>
          <button className={`tab ${filtro === 'embalados' ? 'active' : ''}`} onClick={() => setFiltro('embalados')}>
            Embalados
          </button>
          <button className={`tab ${filtro === 'parciales' ? 'active' : ''}`} onClick={() => setFiltro('parciales')}>
            Parciales
          </button>
        </div>
      </div>

      <div className="list">
        {loading && <div className="loading-state">Cargando envíos...</div>}
        {error && <div className="error-state">Error: {error}</div>}

        {!loading && !error && envios.length === 0 && (
          <div className="empty-state">
            No hay ningún envío Full en curso. Agregá un producto arriba para arrancar uno.
          </div>
        )}

        {!loading && !error && envios.map((envio, idx) => {
          const embalados = envio.items.filter((it) => it.estado === 'embalado').length
          const grande = vistaGrande[envio.pedido_id]
          const itemsFiltrados = envio.items.filter((it) => {
            if (filtro === 'sin_pedir' && it.pedido_al_proveedor) return false
            if (filtro === 'pedidos' && !it.pedido_al_proveedor) return false
            if (filtro === 'en_stock' && !it.en_stock_local) return false
            if (filtro === 'embalados' && it.estado !== 'embalado') return false
            if (filtro === 'parciales' && it.estado !== 'parcial') return false
            if (queryProducto.trim()) {
              const q = normalizarBusqueda(queryProducto)
              if (!normalizarBusqueda(it.titulo).includes(q) && !normalizarBusqueda(it.sku).includes(q)) return false
            }
            return true
          })
          if (itemsFiltrados.length === 0) return null
          return (
            <div key={envio.pedido_id} className="multi-group">
              <div className="multi-group-header">
                <span className="badge badge-multi">{envio.nombre}</span>
                <span className="multi-meta mono">{embalados}/{envio.items.length} embalados</span>
                <button
                  className="sort-btn"
                  onClick={() => setVistaGrande((prev) => ({ ...prev, [envio.pedido_id]: !prev[envio.pedido_id] }))}
                >
                  {grande ? '↙ Vista normal' : '🔍 Vista grande'}
                </button>
                <button
                  className="scan-btn"
                  style={{ marginLeft: 'auto' }}
                  disabled={enviandoId === envio.pedido_id}
                  onClick={() => marcarEnviado(envio)}
                >
                  🚚 Marcar como enviado
                </button>
                <button className="revert-btn" onClick={() => borrarEnvio(envio)}>
                  🗑 Borrar
                </button>
              </div>

              {itemsFiltrados.map((item) => (
                <div
                  key={item.id}
                  className={`pick-row ${item.estado === 'embalado' ? 'pick-row-checked' : ''} ${item.estado === 'parcial' ? 'pick-row-parcial' : ''} ${grande ? 'pick-row-grande' : ''}`}
                >
                  <input
                    type="checkbox"
                    className={`pick-checkbox ${grande ? 'pick-checkbox-grande' : ''}`}
                    checked={item.estado === 'embalado'}
                    onChange={() => toggleEmbalado(idx, item)}
                  />
                  {fotoPorSku[item.sku] && (
                    <img
                      src={fotoPorSku[item.sku].chica}
                      alt=""
                      className={grande ? 'pick-thumb-grande' : 'pick-thumb'}
                      onClick={() => setZoomUrl(fotoPorSku[item.sku].grande)}
                    />
                  )}
                  <div className="pick-title">
                    {item.titulo}
                    <span className="id-cell mono">
                      SKU: {item.sku} · Cantidad:{' '}
                      {editandoCantidadId === item.id ? (
                        <span className="stock-edit">
                          <input
                            type="number"
                            min="0"
                            className="stock-input"
                            value={cantidadDraft}
                            autoFocus
                            onChange={(e) => setCantidadDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') guardarCantidad(idx, item)
                              if (e.key === 'Escape') setEditandoCantidadId(null)
                            }}
                          />
                          <button className="stock-save-btn" onClick={() => guardarCantidad(idx, item)}>✓</button>
                        </span>
                      ) : (
                        <span
                          className="stock-value"
                          onClick={(e) => { e.preventDefault(); empezarEdicionCantidad(item) }}
                        >
                          {item.cantidad_total} ✎
                        </span>
                      )}
                    </span>
                  </div>

                  <label className="corte-label" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={item.pedido_al_proveedor}
                      onChange={() => toggleCampoBooleano(idx, item, 'pedido_al_proveedor', 'marcar-pedido')}
                    />
                    Pedido
                  </label>
                  <label className="corte-label" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      type="checkbox"
                      checked={item.en_stock_local}
                      onChange={() => toggleCampoBooleano(idx, item, 'en_stock_local', 'marcar-en-stock')}
                    />
                    En stock
                  </label>

                  <span className="corte-label" style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 4 }}>
                    {editandoParcialId === item.id ? (
                      <>
                        <input
                          type="number"
                          min="0"
                          max={item.cantidad_total}
                          className="stock-input"
                          style={{ width: 50 }}
                          value={parcialDraft}
                          autoFocus
                          onChange={(e) => setParcialDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') guardarParcial(idx, item)
                            if (e.key === 'Escape') setEditandoParcialId(null)
                          }}
                        />
                        <button className="stock-save-btn" onClick={() => guardarParcial(idx, item)}>✓</button>
                      </>
                    ) : (
                      <button className="sort-btn" style={{ padding: '2px 8px', fontSize: 10 }} onClick={() => empezarEdicionParcial(item)}>
                        {item.estado === 'parcial'
                          ? `Parcial: ${item.cantidad_embalada}/${item.cantidad_total} ✎`
                          : 'Marcar parcial'}
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <ImageLightbox url={zoomUrl} onClose={() => setZoomUrl(null)} />
    </>
  )
}
