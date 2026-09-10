import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

const ETIQUETAS_ROL = {
  complainant: 'Comprador',
  respondent: 'Vendedor (nosotros)',
  mediator: 'Mediador ML',
}

const COLOR_ROL = {
  complainant: '#1A2B6B',
  respondent: '#2E7D46',
  mediator: '#B8860B',
}

function renderConNegrita(texto) {
  const partes = (texto || '').split(/\*\*(.+?)\*\*/g)
  return partes.map((parte, i) =>
    i % 2 === 1 ? <strong key={i}>{parte}</strong> : <span key={i}>{parte}</span>
  )
}

const ETIQUETAS_TIPO = {
  mediations: 'Reclamo',
  return: 'Devolución',
  cancel_sale: 'Cancelación',
  fulfillment: 'Reclamo Full',
}

const ETIQUETAS_ETAPA = {
  claim: 'Entre comprador/vendedor',
  dispute: 'En mediación de ML',
  recontact: 'Recontacto',
}

export default function PostventaView({ onUnauthorized }) {
  const [reclamos, setReclamos] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filtroEstado, setFiltroEstado] = useState('opened')

  const [abiertoId, setAbiertoId] = useState(null)
  const [detalle, setDetalle] = useState(null)
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [respuesta, setRespuesta] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [msgEnvio, setMsgEnvio] = useState(null)

  const fetchLista = () => {
    setLoading(true)
    apiFetch(`/postventa/reclamos?status=${filtroEstado}`, {}, onUnauthorized)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Error')
        return data
      })
      .then((data) => {
        setReclamos(data.reclamos)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(fetchLista, [filtroEstado])

  const abrirReclamo = (id) => {
    if (abiertoId === id) {
      setAbiertoId(null)
      setDetalle(null)
      return
    }
    setAbiertoId(id)
    setDetalle(null)
    setCargandoDetalle(true)
    setMsgEnvio(null)
    apiFetch(`/postventa/reclamos/${id}`, {}, onUnauthorized)
      .then((res) => res.json())
      .then((data) => {
        setDetalle(data)
        setCargandoDetalle(false)
      })
      .catch(() => setCargandoDetalle(false))
  }

  const enviarRespuesta = (id) => {
    if (!respuesta.trim()) return
    setEnviando(true)
    apiFetch(`/postventa/reclamos/${id}/responder`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mensaje: respuesta }),
    }, onUnauthorized)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Error')
      })
      .then(() => {
        setMsgEnvio('✅ Mensaje enviado.')
        setRespuesta('')
        setEnviando(false)
        abrirReclamo(id) // recarga el hilo con el mensaje nuevo
        setTimeout(() => abrirReclamo(id), 50)
      })
      .catch((err) => {
        setMsgEnvio(`Error: ${err.message}`)
        setEnviando(false)
      })
  }

  return (
    <>
      <div className="controls">
        <div className="tabs">
          <button
            className={`tab ${filtroEstado === 'opened' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('opened')}
          >
            Abiertos
          </button>
          <button
            className={`tab ${filtroEstado === 'closed' ? 'active' : ''}`}
            onClick={() => setFiltroEstado('closed')}
          >
            Cerrados
          </button>
        </div>
      </div>

      <div className="list">
        {loading && <div className="loading-state">Cargando reclamos...</div>}
        {error && <div className="error-state">Error: {error}</div>}
        {!loading && !error && reclamos.length === 0 && (
          <div className="empty-state">No hay reclamos {filtroEstado === 'opened' ? 'abiertos' : 'cerrados'}. 🎉</div>
        )}

        {!loading && !error && reclamos.map((r) => (
          <div key={r.id} className="pick-group">
            <div className="row" onClick={() => abrirReclamo(r.id)} style={{ cursor: 'pointer' }}>
              <div className="title-cell">
                {r.titulo || `Recurso: ${r.resource} #${r.resource_id}`}
                <span className="id-cell mono">
                  #{r.id}{r.comprador && ` · ${r.comprador}`}
                </span>
              </div>
              <span className="badge badge-multi">{ETIQUETAS_TIPO[r.tipo] || r.tipo}</span>
              {r.etapa && <span className="badge badge-acordar">{ETIQUETAS_ETAPA[r.etapa] || r.etapa}</span>}
              <span className="detail-toggle">{abiertoId === r.id ? '▲' : '▼ ver'}</span>
            </div>

            {abiertoId === r.id && (
              <div className="sale-detail">
                {cargandoDetalle && <div className="loading-state">Cargando detalle...</div>}

                {detalle && (
                  <>
                    {detalle.devolucion && (
                      <div style={{ marginBottom: 12 }}>
                        <strong>Devolución:</strong> estado del envío de vuelta: {detalle.devolucion.shipping?.status || 'sin dato'}
                        {detalle.devolucion.shipping?.tracking_number && ` · seguimiento: ${detalle.devolucion.shipping.tracking_number}`}
                      </div>
                    )}

                    {detalle.mensajes.length === 0 && !detalle.devolucion && (
                      <div className="sale-together">Sin mensajes en este reclamo.</div>
                    )}

                    {detalle.mensajes.map((m, i) => (
                      <div
                        key={i}
                        className="mensaje-burbuja"
                        style={{ borderLeft: `4px solid ${COLOR_ROL[m.sender_role] || 'var(--gray-line)'}` }}
                      >
                        <div className="mensaje-remitente" style={{ color: COLOR_ROL[m.sender_role] || 'inherit' }}>
                          {ETIQUETAS_ROL[m.sender_role] || m.sender_role}
                        </div>
                        <div className="mensaje-texto">{renderConNegrita(m.message)}</div>
                      </div>
                    ))}

                    {detalle.claim.type !== 'return' && (
                      <div style={{ marginTop: 12 }}>
                        <textarea
                          className="paste-textarea"
                          rows={2}
                          placeholder="Escribí tu respuesta..."
                          value={respuesta}
                          onChange={(e) => setRespuesta(e.target.value)}
                        />
                        <button
                          className="scan-btn"
                          style={{ marginTop: 6 }}
                          onClick={() => enviarRespuesta(r.id)}
                          disabled={enviando}
                        >
                          {enviando ? 'Enviando...' : '✉ Responder'}
                        </button>
                        {msgEnvio && <div className="scan-result" style={{ padding: '8px 0' }}>{msgEnvio}</div>}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
