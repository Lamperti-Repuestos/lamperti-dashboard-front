import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api.js'

export default function PedidosFullView({ onUnauthorized }) {
  const [envios, setEnvios] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [enviandoId, setEnviandoId] = useState(null)

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
    catalogo.forEach((it) => { if (it.sku) mapa[it.sku] = it.foto_url })
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
          it.id === item.id ? { ...it, estado: direccion === 'adelante' ? 'embalado' : 'por_embalar' } : it
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
              </div>

              {envio.items.map((item) => (
                <div
                  key={item.id}
                  className={`pick-row ${item.estado === 'embalado' ? 'pick-row-checked' : ''} ${grande ? 'pick-row-grande' : ''}`}
                >
                  <input
                    type="checkbox"
                    className={`pick-checkbox ${grande ? 'pick-checkbox-grande' : ''}`}
                    checked={item.estado === 'embalado'}
                    onChange={() => toggleEmbalado(idx, item)}
                  />
                  {fotoPorSku[item.sku] && (
                    <img
                      src={fotoPorSku[item.sku]}
                      alt=""
                      className={grande ? 'pick-thumb-grande' : 'pick-thumb'}
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
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </>
  )
}
