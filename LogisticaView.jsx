import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

const formatoPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 2,
})

export default function LogisticaView({ onUnauthorized }) {
  const [insumos, setInsumos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [avisos, setAvisos] = useState([])
  const [mostrarAvisos, setMostrarAvisos] = useState(false)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editandoId, setEditandoId] = useState(null)

  const [nombre, setNombre] = useState('')
  const [unidad, setUnidad] = useState('')
  const [publicacionUrl, setPublicacionUrl] = useState('')
  const [rinde, setRinde] = useState('')
  const [guardando, setGuardando] = useState(false)

  const [precioDraftId, setPrecioDraftId] = useState(null)
  const [precioDraft, setPrecioDraft] = useState('')

  const [historialAbierto, setHistorialAbierto] = useState(null)
  const [historialData, setHistorialData] = useState(null)

  const fetchInsumos = () => {
    setLoading(true)
    apiFetch('/logistica/insumos', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setInsumos(d.insumos)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }

  const fetchAvisos = () => {
    apiFetch('/logistica/avisos?solo_pendientes=true', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => setAvisos(d.avisos))
  }

  useEffect(() => {
    fetchInsumos()
    fetchAvisos()
  }, [])

  const limpiarForm = () => {
    setNombre('')
    setUnidad('')
    setPublicacionUrl('')
    setRinde('')
    setEditandoId(null)
    setMostrarForm(false)
  }

  const editarInsumo = (i) => {
    setNombre(i.nombre)
    setUnidad(i.unidad || '')
    setPublicacionUrl(i.publicacion_url || '')
    setRinde(i.rinde_por_unidad != null ? String(i.rinde_por_unidad) : '')
    setEditandoId(i.id)
    setMostrarForm(true)
  }

  const guardarInsumo = () => {
    if (!nombre.trim()) return
    setGuardando(true)
    const body = {
      nombre: nombre.trim(),
      unidad: unidad.trim() || null,
      publicacion_url: publicacionUrl.trim() || null,
      rinde_por_unidad: rinde ? Number(rinde) : null,
    }
    const promesa = editandoId
      ? apiFetch(`/logistica/insumos/${editandoId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }, onUnauthorized)
      : apiFetch('/logistica/insumos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }, onUnauthorized)

    promesa
      .then(() => {
        limpiarForm()
        setGuardando(false)
        fetchInsumos()
      })
      .catch(() => setGuardando(false))
  }

  const borrarInsumo = (id) => {
    if (!confirm('¿Borrar este insumo? Se pierde su historial de precios también.')) return
    apiFetch(`/logistica/insumos/${id}`, { method: 'DELETE' }, onUnauthorized).then(fetchInsumos)
  }

  const guardarPrecio = (id) => {
    const precio = Number(precioDraft)
    if (!precio || precio <= 0) return
    apiFetch(`/logistica/insumos/${id}/precio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ precio }),
    }, onUnauthorized).then(() => {
      setPrecioDraftId(null)
      setPrecioDraft('')
      fetchInsumos()
    })
  }

  const avisarInsumo = (id, nombreInsumo) => {
    if (!confirm(`¿Avisar por Telegram que hace falta reponer "${nombreInsumo}"?`)) return
    apiFetch(`/logistica/insumos/${id}/avisar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }, onUnauthorized).then(() => {
      fetchInsumos()
      fetchAvisos()
    })
  }

  const atenderAviso = (id) => {
    apiFetch(`/logistica/avisos/${id}/atender`, { method: 'POST' }, onUnauthorized).then(() => {
      fetchAvisos()
      fetchInsumos()
    })
  }

  const verHistorial = (id) => {
    if (historialAbierto === id) {
      setHistorialAbierto(null)
      return
    }
    setHistorialAbierto(id)
    apiFetch(`/logistica/insumos/${id}/historial`, {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => setHistorialData(d.historial))
  }

  return (
    <>
      <div className="controls">
        <button className="sort-btn" onClick={() => setMostrarAvisos((v) => !v)}>
          🔔 {mostrarAvisos ? 'Ocultar' : 'Ver'} avisos pendientes {avisos.length > 0 && `(${avisos.length})`}
        </button>
        <button className="scan-btn" onClick={() => { limpiarForm(); setMostrarForm(true) }}>
          + Nuevo insumo
        </button>
      </div>

      {mostrarAvisos && (
        <div className="list">
          {avisos.length === 0 && <div className="empty-state">Sin avisos pendientes. 🎉</div>}
          {avisos.map((a) => (
            <div key={a.id} className="row">
              <div className="title-cell">
                {a.insumo_nombre}
                <span className="id-cell mono">{new Date(a.fecha).toLocaleString('es-AR')}{a.nota && ` · ${a.nota}`}</span>
              </div>
              <button className="scan-btn" onClick={() => atenderAviso(a.id)}>✅ Ya se compró</button>
            </div>
          ))}
        </div>
      )}

      {mostrarForm && (
        <div className="paste-box">
          <label className="corte-label" style={{ marginBottom: 8 }}>
            {editandoId ? 'Editar insumo' : 'Nuevo insumo'}
          </label>
          <input className="search-input" placeholder="Nombre (ej: Bolsas para embalar)" value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="search-input" placeholder="Unidad (ej: paquete x100)" value={unidad} onChange={(e) => setUnidad(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="search-input" placeholder="Link a la publicación de ML" value={publicacionUrl} onChange={(e) => setPublicacionUrl(e.target.value)} style={{ marginBottom: 8 }} />
          <input type="number" className="search-input" placeholder="Cuántos paquetes rinde una unidad" value={rinde} onChange={(e) => setRinde(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="scan-btn" onClick={guardarInsumo} disabled={guardando}>Guardar</button>
            <button className="sort-btn" onClick={limpiarForm}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="list">
        {loading && <div className="loading-state">Cargando insumos...</div>}
        {error && <div className="error-state">Error: {error}</div>}
        {!loading && !error && insumos.length === 0 && (
          <div className="empty-state">Sin insumos cargados todavía - tocá "+ Nuevo insumo" para arrancar.</div>
        )}

        {insumos.map((i) => (
          <div key={i.id}>
            <div className="row">
              <div className="title-cell">
                {i.nombre}
                <span className="id-cell mono">
                  {i.unidad || 'sin unidad'}
                  {i.ultimo_precio != null && ` · Último precio: ${formatoPesos.format(i.ultimo_precio)}`}
                </span>
              </div>
              {i.costo_por_paquete != null && (
                <span className="badge badge-explicada">{formatoPesos.format(i.costo_por_paquete)} / paquete</span>
              )}
              {i.aviso_pendiente && <span className="badge badge-sin-explicar">🔔 Aviso pendiente</span>}
              {i.publicacion_url && (
                <a href={i.publicacion_url} target="_blank" rel="noreferrer" className="id-cell mono">Ver publicación ↗</a>
              )}
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '0 0 12px 12px' }}>
              {precioDraftId === i.id ? (
                <>
                  <input
                    type="number"
                    className="corte-input"
                    style={{ width: 100 }}
                    placeholder="Precio"
                    value={precioDraft}
                    autoFocus
                    onChange={(e) => setPrecioDraft(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && guardarPrecio(i.id)}
                  />
                  <button className="sort-btn" onClick={() => guardarPrecio(i.id)}>✓ Guardar</button>
                </>
              ) : (
                <button className="sort-btn" onClick={() => { setPrecioDraftId(i.id); setPrecioDraft('') }}>
                  💲 Cargar precio nuevo
                </button>
              )}
              <button className="sort-btn" onClick={() => verHistorial(i.id)}>
                📈 {historialAbierto === i.id ? 'Ocultar' : 'Ver'} historial
              </button>
              <button className="sort-btn" onClick={() => avisarInsumo(i.id, i.nombre)}>
                📢 Avisar a Aldo
              </button>
              <button className="sort-btn" onClick={() => editarInsumo(i)}>✎ Editar</button>
              <button className="revert-btn" onClick={() => borrarInsumo(i.id)}>✕ Borrar</button>
            </div>

            {historialAbierto === i.id && historialData && (
              <div style={{ margin: '0 0 16px 24px' }}>
                {historialData.length === 0 && <p style={{ fontSize: 12, color: 'var(--gray-muted)' }}>Sin precios cargados todavía.</p>}
                {historialData.map((h, idx) => (
                  <div key={idx} className="sale-line" style={{ fontSize: 12 }}>
                    <span className="mono">{new Date(h.fecha).toLocaleDateString('es-AR')}</span>
                    <span>{formatoPesos.format(h.precio)}</span>
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
