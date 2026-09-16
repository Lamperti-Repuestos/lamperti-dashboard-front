import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

export default function NotasView({ onUnauthorized }) {
  const [notas, setNotas] = useState([])
  const [loading, setLoading] = useState(true)
  const [texto, setTexto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [copiadoId, setCopiadoId] = useState(null)

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
    </>
  )
}
