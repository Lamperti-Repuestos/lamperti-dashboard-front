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
  const [porcentajeUso, setPorcentajeUso] = useState('100')
  const [guardando, setGuardando] = useState(false)

  const [precioDraftId, setPrecioDraftId] = useState(null)
  const [precioDraft, setPrecioDraft] = useState('')

  const [historialAbierto, setHistorialAbierto] = useState(null)
  const [historialData, setHistorialData] = useState(null)
  const [medicionesAbierto, setMedicionesAbierto] = useState(null)
  const [medicionesData, setMedicionesData] = useState(null)
  const [ultimoResultado, setUltimoResultado] = useState(null)

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
    setPorcentajeUso('100')
    setEditandoId(null)
    setMostrarForm(false)
  }

  const editarInsumo = (i) => {
    setNombre(i.nombre)
    setUnidad(i.unidad || '')
    setPublicacionUrl(i.publicacion_url || '')
    setRinde(i.rinde_por_unidad != null ? String(i.rinde_por_unidad) : '')
    setPorcentajeUso(String(i.porcentaje_uso ?? 100))
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
      porcentaje_uso: porcentajeUso ? Number(porcentajeUso) : 100,
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
    apiFetch(`/logistica/avisos/${id}/recibido`, { method: 'POST' }, onUnauthorized).then(() => {
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

  const verMediciones = (id) => {
    if (medicionesAbierto === id) {
      setMedicionesAbierto(null)
      return
    }
    setMedicionesAbierto(id)
    setUltimoResultado(null)
    apiFetch(`/logistica/insumos/${id}/mediciones`, {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => setMedicionesData(d.mediciones))
  }

  const empezarMedicion = (id) => {
    apiFetch(`/logistica/insumos/${id}/medicion/empezar`, { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        verMediciones(id)
        setMedicionesAbierto(id)
      })
      .catch((err) => alert(`Error: ${err.message}`))
  }

  const terminarMedicion = (id) => {
    apiFetch(`/logistica/insumos/${id}/medicion/terminar`, { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        setUltimoResultado({ insumoId: id, ...d })
        apiFetch(`/logistica/insumos/${id}/mediciones`, {}, onUnauthorized)
          .then((res) => res.json())
          .then((dd) => setMedicionesData(dd.mediciones))
      })
      .catch((err) => alert(`Error: ${err.message}`))
  }

  const aplicarComoRinde = (id, paquetes) => {
    apiFetch(`/logistica/insumos/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rinde_por_unidad: paquetes }),
    }, onUnauthorized).then(() => {
      setUltimoResultado(null)
      fetchInsumos()
    })
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
              {a.estado === 'pendiente' && <span className="badge badge-sin-explicar">⏳ Sin encargar</span>}
              {a.estado === 'encargado' && (
                <span className="badge badge-acordar">
                  📦 Encargado {a.fecha_encargado && `(${new Date(a.fecha_encargado).toLocaleDateString('es-AR')})`}
                </span>
              )}
              <button className="scan-btn" onClick={() => atenderAviso(a.id)}>✅ Ya llegó</button>
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
          <label className="corte-label" style={{ fontSize: 12 }}>
            % de los paquetes en los que se usa (100 si es universal como las bolsas; menos si es como cinta o cartón, que no van en todos)
          </label>
          <input type="number" min="0" max="100" className="search-input" value={porcentajeUso} onChange={(e) => setPorcentajeUso(e.target.value)} style={{ marginBottom: 8 }} />
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
                  {i.porcentaje_uso < 100 && ` · Se usa en ${i.porcentaje_uso}% de los paquetes`}
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
              <button className="sort-btn" onClick={() => verMediciones(i.id)}>
                📏 {medicionesAbierto === i.id ? 'Ocultar' : 'Medir'} rinde
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

            {medicionesAbierto === i.id && medicionesData && (
              <div className="paste-box" style={{ margin: '0 0 16px 24px' }}>
                <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '0 0 10px' }}>
                  Marcá cuándo empezás a usar una unidad nueva, y cuándo se termina - contamos solo
                  los paquetes embalados en el medio (con los datos de Control Embalaje).
                </p>

                {medicionesData.some((m) => m.en_curso) ? (
                  <button className="scan-btn" onClick={() => terminarMedicion(i.id)}>
                    ⏹ Se terminó ahora
                  </button>
                ) : (
                  <button className="scan-btn" onClick={() => empezarMedicion(i.id)}>
                    ▶ Empezar a medir (arranco a usar una unidad ahora)
                  </button>
                )}

                {ultimoResultado && ultimoResultado.insumoId === i.id && (
                  <div className="scan-result" style={{ marginTop: 10 }}>
                    Se embalaron <strong>{ultimoResultado.paquetes_calculados}</strong> paquete(s) entre{' '}
                    {new Date(ultimoResultado.fecha_inicio).toLocaleDateString('es-AR')} y{' '}
                    {new Date(ultimoResultado.fecha_fin).toLocaleDateString('es-AR')}.
                    {ultimoResultado.porcentaje_uso < 100 && (
                      <> Ajustado al {ultimoResultado.porcentaje_uso}% de uso: <strong>{ultimoResultado.paquetes_ajustados}</strong> paquete(s).</>
                    )}
                    <div style={{ marginTop: 8 }}>
                      <button className="sort-btn" onClick={() => aplicarComoRinde(i.id, ultimoResultado.paquetes_ajustados)}>
                        ✓ Usar {ultimoResultado.paquetes_ajustados} como el rinde de este insumo
                      </button>
                    </div>
                  </div>
                )}

                {medicionesData.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    {medicionesData.map((m) => (
                      <div key={m.id} className="sale-line" style={{ fontSize: 12 }}>
                        <span className="mono">
                          {new Date(m.fecha_inicio).toLocaleDateString('es-AR')}
                          {' → '}
                          {m.fecha_fin ? new Date(m.fecha_fin).toLocaleDateString('es-AR') : 'en curso'}
                        </span>
                        <span>{m.paquetes_calculados != null ? `${m.paquetes_calculados} paquete(s)` : '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
