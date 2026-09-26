import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'

export default function DevolucionesProveedoresView({ onUnauthorized }) {
  const [devoluciones, setDevoluciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [proveedores, setProveedores] = useState([])
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('pendiente')

  const [mostrarForm, setMostrarForm] = useState(false)
  const [proveedor, setProveedor] = useState('')
  const [producto, setProducto] = useState('')
  const [motivo, setMotivo] = useState('')
  const [nota, setNota] = useState('')
  const [fotoElegida, setFotoElegida] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const inputFotoRef = useRef(null)

  const [mostrarStats, setMostrarStats] = useState(false)
  const [stats, setStats] = useState(null)

  const fetchDevoluciones = () => {
    setCargando(true)
    const params = new URLSearchParams()
    if (filtroProveedor) params.set('proveedor', filtroProveedor)
    if (filtroEstado) params.set('estado', filtroEstado)
    apiFetch(`/devoluciones-proveedores?${params}`, {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setDevoluciones(d.devoluciones)
        setCargando(false)
      })
  }

  useEffect(fetchDevoluciones, [filtroProveedor, filtroEstado])

  useEffect(() => {
    apiFetch('/devoluciones-proveedores/proveedores', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => setProveedores(d.proveedores))
  }, [])

  const limpiarForm = () => {
    setProveedor('')
    setProducto('')
    setMotivo('')
    setNota('')
    setFotoElegida(null)
    setErrorForm(null)
  }

  const elegirFoto = () => inputFotoRef.current?.click()

  const guardar = () => {
    if (!proveedor.trim() || !producto.trim()) {
      setErrorForm('Proveedor y producto son obligatorios.')
      return
    }
    setGuardando(true)
    setErrorForm(null)
    const formData = new FormData()
    formData.append('proveedor', proveedor.trim())
    formData.append('producto', producto.trim())
    if (motivo.trim()) formData.append('motivo', motivo.trim())
    if (nota.trim()) formData.append('nota', nota.trim())
    if (fotoElegida) formData.append('foto', fotoElegida)

    apiFetch('/devoluciones-proveedores', { method: 'POST', body: formData }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then(() => {
        setGuardando(false)
        setMostrarForm(false)
        limpiarForm()
        // el proveedor puede ser nuevo - refrescamos la lista de filtros también
        apiFetch('/devoluciones-proveedores/proveedores', {}, onUnauthorized)
          .then((res) => res.json())
          .then((d) => setProveedores(d.proveedores))
        fetchDevoluciones()
      })
      .catch((err) => {
        setErrorForm(err.message)
        setGuardando(false)
      })
  }

  const marcarDevuelto = (id) => {
    apiFetch(`/devoluciones-proveedores/${id}/devuelto`, { method: 'POST' }, onUnauthorized).then(fetchDevoluciones)
  }

  const borrar = (id) => {
    apiFetch(`/devoluciones-proveedores/${id}`, { method: 'DELETE' }, onUnauthorized).then(fetchDevoluciones)
  }

  const verFoto = (id) => {
    apiFetch(`/devoluciones-proveedores/${id}/foto`, {}, onUnauthorized)
      .then((res) => res.blob())
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'))
  }

  const toggleStats = () => {
    const abrir = !mostrarStats
    setMostrarStats(abrir)
    if (abrir && !stats) {
      apiFetch('/devoluciones-proveedores/estadisticas', {}, onUnauthorized)
        .then((res) => res.json())
        .then(setStats)
    }
  }

  return (
    <>
      <div className="controls">
        <select className="corte-input" value={filtroProveedor} onChange={(e) => setFiltroProveedor(e.target.value)}>
          <option value="">Todos los proveedores</option>
          {proveedores.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select className="corte-input" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="pendiente">Pendientes</option>
          <option value="devuelto">Ya devueltas</option>
          <option value="">Todas</option>
        </select>
      </div>

      <div className="controls">
        <button className="sort-btn" onClick={toggleStats}>
          📊 {mostrarStats ? 'Ocultar' : 'Ver'} histórico
        </button>
        <button className="scan-btn" onClick={() => { limpiarForm(); setMostrarForm(true) }}>
          + Nueva devolución
        </button>
      </div>

      {mostrarStats && (
        <div className="list">
          {!stats && <div className="loading-state">Cargando histórico...</div>}
          {stats && (
            <>
              <div className="summary">
                <div className="summary-item">
                  <div className="value mono">{stats.total}</div>
                  <div className="label">Total histórico</div>
                </div>
                <div className="summary-item">
                  <div className="value mono">{stats.pendientes}</div>
                  <div className="label">Pendientes ahora</div>
                </div>
              </div>
              <label className="corte-label" style={{ margin: '10px 0 6px 12px' }}>Lo que más se devolvió</label>
              {stats.top_productos.map((p) => (
                <div key={p.producto} className="row">
                  <div className="title-cell">{p.producto}</div>
                  <span className="badge badge-flex">{p.cantidad}</span>
                </div>
              ))}
              <label className="corte-label" style={{ margin: '10px 0 6px 12px' }}>Por proveedor</label>
              {stats.top_proveedores.map((p) => (
                <div key={p.proveedor} className="row">
                  <div className="title-cell">{p.proveedor}</div>
                  <span className="badge badge-flex">{p.cantidad}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {mostrarForm && (
        <div className="paste-box">
          <label className="corte-label" style={{ marginBottom: 8 }}>Nueva devolución</label>
          <input className="search-input" placeholder="Proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} style={{ marginBottom: 8 }} list="lista-proveedores" />
          <datalist id="lista-proveedores">
            {proveedores.map((p) => <option key={p} value={p} />)}
          </datalist>
          <input className="search-input" placeholder="Producto (ej: Depósito 20L)" value={producto} onChange={(e) => setProducto(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="search-input" placeholder="Motivo (ej: Pico roto)" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="search-input" placeholder="Nota opcional" value={nota} onChange={(e) => setNota(e.target.value)} style={{ marginBottom: 8 }} />

          <button className="sort-btn" onClick={elegirFoto} style={{ marginBottom: 8 }}>
            📷 {fotoElegida ? fotoElegida.name : 'Agregar foto (opcional)'}
          </button>
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={(e) => setFotoElegida(e.target.files?.[0] || null)}
          />

          {errorForm && <div className="error-state" style={{ marginBottom: 8 }}>{errorForm}</div>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button className="scan-btn" onClick={guardar} disabled={guardando}>
              {guardando ? '⏳ Guardando...' : '💾 Guardar'}
            </button>
            <button className="revert-btn" onClick={() => setMostrarForm(false)} disabled={guardando}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="list">
        {cargando && <div className="loading-state">Cargando...</div>}
        {!cargando && devoluciones.length === 0 && (
          <div className="empty-state">Sin devoluciones acá.</div>
        )}
        {devoluciones.map((d) => (
          <div key={d.id} className="row" style={{ alignItems: 'flex-start' }}>
            <div className="title-cell">
              {d.producto}
              <span style={{ display: 'block', fontWeight: 400, marginTop: 2 }}>
                {d.proveedor}{d.motivo && ` · ${d.motivo}`}
              </span>
              {d.nota && <span style={{ display: 'block', fontWeight: 400, fontSize: 12, marginTop: 2 }}>{d.nota}</span>}
              <span className="id-cell mono">
                {new Date(d.creado_en).toLocaleDateString('es-AR')}
                {d.devuelto_en && ` · devuelto ${new Date(d.devuelto_en).toLocaleDateString('es-AR')}`}
              </span>
            </div>
            {d.tiene_foto && (
              <button className="sort-btn" onClick={() => verFoto(d.id)}>📷 Ver foto</button>
            )}
            {d.estado === 'pendiente' ? (
              <span className="badge badge-sin-explicar">⏳ Pendiente</span>
            ) : (
              <span className="badge badge-acordar">✅ Devuelto</span>
            )}
            {d.estado === 'pendiente' && (
              <button className="scan-btn" onClick={() => marcarDevuelto(d.id)}>✅ Ya lo devolví</button>
            )}
            <button className="revert-btn" onClick={() => borrar(d.id)}>✕</button>
          </div>
        ))}
      </div>
    </>
  )
}
