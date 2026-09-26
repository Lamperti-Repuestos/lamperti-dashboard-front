import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'

function formatoTamano(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export default function NotasView({ onUnauthorized }) {
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [copiadoId, setCopiadoId] = useState(null)

  const [archivos, setArchivos] = useState([])
  const [cargandoArchivos, setCargandoArchivos] = useState(true)
  const [subiendo, setSubiendo] = useState(false)
  const [errorArchivo, setErrorArchivo] = useState(null)
  const [archivoPendiente, setArchivoPendiente] = useState(null)
  const [notaArchivo, setNotaArchivo] = useState('')
  const inputArchivoRef = useRef(null)

  const fetchNotas = () => {
    apiFetch('/notas', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setNotas(d.notas)
        setLoading(false)
      })
  }

  useEffect(fetchNotas, [])

  const guardar = () => {
    if (!texto.trim()) return
    setGuardando(true)
    apiFetch('/notas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto }),
    }, onUnauthorized).then(() => {
      setTexto('')
      setGuardando(false)
      fetchNotas()
    })
  }

  const copiar = (id, texto) => {
    navigator.clipboard.writeText(texto)
    setCopiadoId(id)
    setTimeout(() => setCopiadoId(null), 1500)
  }

  const borrar = (id) => {
    apiFetch(`/notas/${id}`, { method: 'DELETE' }, onUnauthorized).then(fetchNotas)
  }

  const fetchArchivos = () => {
    apiFetch('/notas/archivos', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setArchivos(d.archivos)
        setCargandoArchivos(false)
      })
  }

  useEffect(fetchArchivos, [])

  const elegirArchivo = () => inputArchivoRef.current?.click()

  const archivoElegido = (e) => {
    const archivo = e.target.files?.[0]
    e.target.value = '' // para poder elegir el mismo archivo dos veces seguidas si hace falta
    if (!archivo) return
    setErrorArchivo(null)
    setArchivoPendiente(archivo)
    setNotaArchivo('')
  }

  const cancelarSubida = () => {
    setArchivoPendiente(null)
    setNotaArchivo('')
  }

  const confirmarSubida = () => {
    if (!archivoPendiente) return
    setSubiendo(true)
    setErrorArchivo(null)
    const formData = new FormData()
    formData.append('archivo', archivoPendiente)
    if (notaArchivo.trim()) formData.append('nota', notaArchivo.trim())
    apiFetch('/notas/archivos', { method: 'POST', body: formData }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then(() => {
        setSubiendo(false)
        setArchivoPendiente(null)
        setNotaArchivo('')
        fetchArchivos()
      })
      .catch((err) => {
        setErrorArchivo(err.message)
        setSubiendo(false)
      })
  }

  const abrirArchivo = (id, nombre) => {
    apiFetch(`/notas/archivos/${id}/descargar`, {}, onUnauthorized)
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
        setTimeout(() => URL.revokeObjectURL(url), 30000)
      })
  }

  const borrarArchivo = (id) => {
    apiFetch(`/notas/archivos/${id}`, { method: 'DELETE' }, onUnauthorized).then(fetchArchivos)
  }

  return (
    <>
      <div className="paste-box">
        <label className="corte-label" style={{ marginBottom: 8 }}>Pegar / escribir una nota</label>
        <textarea
          className="paste-textarea"
          rows={4}
          placeholder="Pegá acá lo que necesites recuperar después, desde cualquier compu..."
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
        <button className="scan-btn" style={{ marginTop: 8 }} onClick={guardar} disabled={guardando}>
          💾 Guardar nota
        </button>
      </div>

      <div className="list">
        {loading && <div className="loading-state">Cargando notas...</div>}
        {!loading && notas.length === 0 && (
          <div className="empty-state">Sin notas guardadas todavía.</div>
        )}
        {notas.map((n) => (
          <div key={n.id} className="row" style={{ alignItems: 'flex-start' }}>
            <div className="title-cell">
              <span style={{ whiteSpace: 'pre-wrap', fontWeight: 400 }}>{n.texto}</span>
              <span className="id-cell mono">{new Date(n.creado_en).toLocaleString('es-AR')}</span>
            </div>
            <button className="sort-btn" onClick={() => copiar(n.id, n.texto)}>
              {copiadoId === n.id ? '✅ Copiado' : '📋 Copiar'}
            </button>
            <button className="revert-btn" onClick={() => borrar(n.id)}>✕</button>
          </div>
        ))}
      </div>

      <div className="paste-box" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <label className="corte-label" style={{ marginBottom: 0 }}>Archivos compartidos</label>
          <button className="scan-btn" onClick={elegirArchivo} disabled={subiendo || !!archivoPendiente}>
            📎 Subir archivo
          </button>
          <input
            ref={inputArchivoRef}
            type="file"
            style={{ display: 'none' }}
            onChange={archivoElegido}
            accept=".pdf,.jpg,.jpeg,.png,.webp"
          />
        </div>
        <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '6px 0 0' }}>
          PDF o foto, hasta 20 MB - para pasar algo (una etiqueta, una foto) de una compu a la otra.
        </p>

        {archivoPendiente && (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--gray-line)' }}>
            <p style={{ fontSize: 13, margin: '0 0 8px', fontWeight: 600 }}>{archivoPendiente.name}</p>
            <input
              className="search-input"
              placeholder="Nota opcional (ej: Etiqueta para el bulto 3)"
              value={notaArchivo}
              onChange={(e) => setNotaArchivo(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="scan-btn" onClick={confirmarSubida} disabled={subiendo}>
                {subiendo ? '⏳ Subiendo...' : '💾 Confirmar subida'}
              </button>
              <button className="revert-btn" onClick={cancelarSubida} disabled={subiendo}>Cancelar</button>
            </div>
          </div>
        )}

        {errorArchivo && <div className="error-state" style={{ marginTop: 8 }}>Error: {errorArchivo}</div>}
      </div>

      <div className="list">
        {cargandoArchivos && <div className="loading-state">Cargando archivos...</div>}
        {!cargandoArchivos && archivos.length === 0 && (
          <div className="empty-state">Sin archivos compartidos todavía.</div>
        )}
        {archivos.map((a) => (
          <div key={a.id} className="row" style={{ alignItems: 'flex-start' }}>
            <div className="title-cell">
              {a.nombre}
              {a.nota && <span style={{ display: 'block', fontWeight: 400, marginTop: 2 }}>{a.nota}</span>}
              <span className="id-cell mono">{formatoTamano(a.tamano_bytes)} · {new Date(a.creado_en).toLocaleString('es-AR')}</span>
            </div>
            <button className="sort-btn" onClick={() => abrirArchivo(a.id, a.nombre)}>👁 Abrir</button>
            <button className="revert-btn" onClick={() => borrarArchivo(a.id)}>✕</button>
          </div>
        ))}
      </div>
    </>
  )
}
