import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'

/**
 * Reduce la foto a un tamaño manejable ANTES de subirla - una foto de
 * cámara moderna puede pesar varios MB / tener resolución enorme, y
 * armar el FormData con eso tal cual puede quedarse sin memoria en el
 * navegador del celular y refrescar la página sola. Si algo falla acá
 * (navegador viejo sin createImageBitmap, etc.), seguimos con el
 * archivo original en vez de trabar la carga.
 */
async function comprimirFoto(archivo, maxDim = 1600, calidad = 0.8) {
  try {
    const bitmap = await createImageBitmap(archivo)
    let { width, height } = bitmap
    if (width > maxDim || height > maxDim) {
      const escala = maxDim / Math.max(width, height)
      width = Math.round(width * escala)
      height = Math.round(height * escala)
    }
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    canvas.getContext('2d').drawImage(bitmap, 0, 0, width, height)
    bitmap.close?.()
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', calidad))
    if (!blob) return archivo
    return new File([blob], archivo.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return archivo
  }
}

export default function DevolucionesProveedoresView({ onUnauthorized }) {
  const [devoluciones, setDevoluciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [proveedores, setProveedores] = useState([])
  const [filtroProveedor, setFiltroProveedor] = useState('')
  const [filtroEstado, setFiltroEstado] = useState('pendiente')

  const [mostrarForm, setMostrarForm] = useState(false)
  const [proveedor, setProveedor] = useState('')
  const [sugerenciasProveedor, setSugerenciasProveedor] = useState([])
  const [producto, setProducto] = useState('')
  const [skuElegido, setSkuElegido] = useState(null)
  const [sugerencias, setSugerencias] = useState([])
  const debounceRef = useRef(null)
  const [motivo, setMotivo] = useState('')
  const [nota, setNota] = useState('')
  const [fotoElegida, setFotoElegida] = useState(null)
  const [comprimiendoFoto, setComprimiendoFoto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorForm, setErrorForm] = useState(null)
  const inputFotoRef = useRef(null)

  const [mostrarStats, setMostrarStats] = useState(false)
  const [stats, setStats] = useState(null)

  const [resolucionAbiertaId, setResolucionAbiertaId] = useState(null)
  const [resolucionTipo, setResolucionTipo] = useState('nota_credito')
  const [resolucionDetalle, setResolucionDetalle] = useState('')
  const [guardandoResolucion, setGuardandoResolucion] = useState(false)

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
    setSugerenciasProveedor([])
    setProducto('')
    setSkuElegido(null)
    setSugerencias([])
    setMotivo('')
    setNota('')
    setFotoElegida(null)
    setErrorForm(null)
  }

  const cambiarProveedor = (valor) => {
    setProveedor(valor)
    if (!valor.trim()) {
      setSugerenciasProveedor([])
      return
    }
    const q = valor.trim().toLowerCase()
    setSugerenciasProveedor(
      proveedores.filter((p) => p.toLowerCase().includes(q) && p.toLowerCase() !== q)
    )
  }

  const elegirProveedor = (p) => {
    setProveedor(p)
    setSugerenciasProveedor([])
  }

  const cambiarProducto = (valor) => {
    setProducto(valor)
    setSkuElegido(null) // si edita el texto a mano, ya no vale el SKU que tenía asociado
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (valor.trim().length < 2) {
      setSugerencias([])
      return
    }
    debounceRef.current = setTimeout(() => {
      apiFetch(`/contabilium/buscar-producto?q=${encodeURIComponent(valor.trim())}`, {}, onUnauthorized)
        .then((res) => (res.ok ? res.json() : { resultados: [] }))
        .then((d) => setSugerencias(d.resultados || []))
        .catch(() => setSugerencias([])) // si Contabilium falla, seguimos con carga a mano sin trabar nada
    }, 400)
  }

  const elegirSugerencia = (s) => {
    setProducto(s.nombre ? `${s.codigo} - ${s.nombre}` : s.codigo)
    setSkuElegido(s.codigo)
    setSugerencias([])
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
    if (skuElegido) formData.append('sku', skuElegido)
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
    apiFetch(`/devoluciones-proveedores/${id}/devuelto`, { method: 'POST' }, onUnauthorized).then(() => {
      // si el filtro estaba en "Pendientes", el ítem desaparecería de la
      // vista justo antes de poder cargarle la resolución (o borrarlo si
      // era una prueba) - lo evitamos mostrando todas
      if (filtroEstado === 'pendiente') setFiltroEstado('')
      else fetchDevoluciones()
      setResolucionAbiertaId(id)
      setResolucionTipo('nota_credito')
      setResolucionDetalle('')
    })
  }

  const borrar = (id) => {
    apiFetch(`/devoluciones-proveedores/${id}`, { method: 'DELETE' }, onUnauthorized).then(fetchDevoluciones)
  }

  const verFoto = (id) => {
    apiFetch(`/devoluciones-proveedores/${id}/foto`, {}, onUnauthorized)
      .then((res) => res.blob())
      .then((blob) => window.open(URL.createObjectURL(blob), '_blank'))
  }

  const abrirResolucion = (d) => {
    setResolucionAbiertaId(d.id)
    setResolucionTipo(d.resolucion_tipo || 'nota_credito')
    setResolucionDetalle(d.resolucion_detalle || '')
  }

  const guardarResolucion = (id) => {
    setGuardandoResolucion(true)
    const formData = new FormData()
    formData.append('tipo', resolucionTipo)
    if (resolucionDetalle.trim()) formData.append('detalle', resolucionDetalle.trim())
    apiFetch(`/devoluciones-proveedores/${id}/resolucion`, { method: 'POST', body: formData }, onUnauthorized)
      .then(() => {
        setGuardandoResolucion(false)
        setResolucionAbiertaId(null)
        fetchDevoluciones()
      })
      .catch(() => setGuardandoResolucion(false))
  }

  const ETIQUETAS_RESOLUCION = {
    nota_credito: '🧾 Nota de crédito',
    reemplazo: '🔁 Reemplazo de producto',
    reembolso: '💵 Reembolso',
    rechazado: '❌ Rechazado por el proveedor',
    otro: 'Otro',
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
              {stats.por_resolucion?.length > 0 && (
                <>
                  <label className="corte-label" style={{ margin: '10px 0 6px 12px' }}>Cómo se resolvieron</label>
                  {stats.por_resolucion.map((r) => (
                    <div key={r.tipo} className="row">
                      <div className="title-cell">{ETIQUETAS_RESOLUCION[r.tipo] || r.tipo}</div>
                      <span className="badge badge-flex">{r.cantidad}</span>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {mostrarForm && (
        <div className="paste-box">
          <label className="corte-label" style={{ marginBottom: 8 }}>Nueva devolución</label>
          <input className="search-input" placeholder="Proveedor" value={proveedor} onChange={(e) => cambiarProveedor(e.target.value)} style={{ marginBottom: sugerenciasProveedor.length > 0 ? 2 : 8 }} />
          {sugerenciasProveedor.length > 0 && (
            <div className="list" style={{ marginBottom: 8 }}>
              {sugerenciasProveedor.map((p) => (
                <div key={p} className="row" style={{ cursor: 'pointer' }} onClick={() => elegirProveedor(p)}>
                  <div className="title-cell">{p}</div>
                </div>
              ))}
            </div>
          )}
          <input className="search-input" placeholder="Producto (ej: Depósito 20L)" value={producto} onChange={(e) => cambiarProducto(e.target.value)} style={{ marginBottom: skuElegido ? 2 : 8 }} />
          {skuElegido && (
            <div style={{ fontSize: 11, color: 'var(--gray-muted)', margin: '0 0 8px 2px' }}>
              ✅ Asociado al SKU {skuElegido} de Contabilium
            </div>
          )}
          {sugerencias.length > 0 && (
            <div className="list" style={{ marginBottom: 8 }}>
              {sugerencias.map((s) => (
                <div key={s.codigo} className="row" style={{ cursor: 'pointer' }} onClick={() => elegirSugerencia(s)}>
                  <div className="title-cell">{s.nombre || '(sin nombre)'}</div>
                  <span className="id-cell mono">{s.codigo}</span>
                </div>
              ))}
            </div>
          )}
          <input className="search-input" placeholder="Motivo (ej: Pico roto)" value={motivo} onChange={(e) => setMotivo(e.target.value)} style={{ marginBottom: 8 }} />
          <input className="search-input" placeholder="Nota opcional" value={nota} onChange={(e) => setNota(e.target.value)} style={{ marginBottom: 8 }} />

          <button className="sort-btn" onClick={elegirFoto} style={{ marginBottom: 8 }} disabled={comprimiendoFoto}>
            📷 {comprimiendoFoto ? 'Procesando foto...' : fotoElegida ? fotoElegida.name : 'Agregar foto (opcional)'}
          </button>
          <input
            ref={inputFotoRef}
            type="file"
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const archivo = e.target.files?.[0]
              e.target.value = ''
              if (!archivo) return
              setComprimiendoFoto(true)
              const comprimida = await comprimirFoto(archivo)
              setFotoElegida(comprimida)
              setComprimiendoFoto(false)
            }}
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
          <div key={d.id}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="title-cell">
                {d.producto}
                <span style={{ display: 'block', fontWeight: 400, marginTop: 2 }}>
                  {d.proveedor}{d.motivo && ` · ${d.motivo}`}
                </span>
                {d.sku && <span className="id-cell mono" style={{ display: 'block' }}>SKU {d.sku}</span>}
                {d.nota && <span style={{ display: 'block', fontWeight: 400, fontSize: 12, marginTop: 2 }}>{d.nota}</span>}
                {d.resolucion_tipo && (
                  <span style={{ display: 'block', fontWeight: 400, fontSize: 12, marginTop: 4, color: 'var(--navy)' }}>
                    {ETIQUETAS_RESOLUCION[d.resolucion_tipo] || d.resolucion_tipo}
                    {d.resolucion_detalle && ` — ${d.resolucion_detalle}`}
                  </span>
                )}
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
              {d.estado === 'devuelto' && resolucionAbiertaId !== d.id && (
                <button className="sort-btn" onClick={() => abrirResolucion(d)}>
                  📝 {d.resolucion_tipo ? 'Editar resolución' : 'Cargar resolución'}
                </button>
              )}
              <button className="revert-btn" onClick={() => borrar(d.id)}>✕</button>
            </div>

            {resolucionAbiertaId === d.id && (
              <div className="paste-box" style={{ marginTop: -8, marginBottom: 8 }}>
                <select
                  className="corte-input"
                  style={{ width: '100%', marginBottom: 8 }}
                  value={resolucionTipo}
                  onChange={(e) => setResolucionTipo(e.target.value)}
                >
                  {Object.entries(ETIQUETAS_RESOLUCION).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>{etiqueta}</option>
                  ))}
                </select>
                <input
                  className="search-input"
                  placeholder="Detalle (ej: NC por $15.000, o qué producto te mandaron)"
                  value={resolucionDetalle}
                  onChange={(e) => setResolucionDetalle(e.target.value)}
                  style={{ marginBottom: 8 }}
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="scan-btn" onClick={() => guardarResolucion(d.id)} disabled={guardandoResolucion}>
                    {guardandoResolucion ? '⏳ Guardando...' : '💾 Guardar'}
                  </button>
                  <button className="revert-btn" onClick={() => setResolucionAbiertaId(null)} disabled={guardandoResolucion}>Cancelar</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
