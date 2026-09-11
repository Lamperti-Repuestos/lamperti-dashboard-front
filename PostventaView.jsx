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
  returns: 'Devolución',
  cancel_sale: 'Cancelación',
  cancel_purchase: 'Cancelación de compra',
  fulfillment: 'Reclamo Full',
}

const ETIQUETAS_RECURSO = {
  order: 'Pedido',
  shipment: 'Envío',
  payment: 'Pago',
  purchase: 'Compra',
}

const ETIQUETAS_ETAPA = {
  claim: 'Entre comprador/vendedor',
  dispute: 'En mediación de ML',
  recontact: 'Recontacto',
}

const ETIQUETAS_ESTADO_HIST = {
  opened: 'Abierto',
  closed: 'Cerrado',
}

const ETIQUETAS_ESTADO_ORDEN = {
  paid: 'Pagada',
  confirmed: 'Confirmada',
  cancelled: 'Cancelada',
  invalid: 'Inválida',
}

const ETIQUETAS_ESTADO_PUB = {
  active: 'Activa',
  paused: 'Pausada',
  closed: 'Cerrada',
}

const ETIQUETAS_ACCION = {
  send_message_to_complainant: 'Responder al comprador',
  send_message_to_mediator: 'Responder al mediador',
  recontact: 'Recontacto (plazo posterior al cierre)',
  refund: 'Reembolso',
  allow_partial_refund: 'Ofrecer reembolso parcial',
  return_review_ok: 'Aprobar la devolución',
  return_review_fail: 'Reportar problema con la devolución',
  open_dispute: 'Abrir mediación',
}

function diasRestantes(fechaISO) {
  const dif = new Date(fechaISO) - new Date()
  return Math.ceil(dif / (1000 * 60 * 60 * 24))
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
  const [archivoAdjunto, setArchivoAdjunto] = useState(null)
  const [enviando, setEnviando] = useState(false)
  const [msgEnvio, setMsgEnvio] = useState(null)
  const [aprobando, setAprobando] = useState(false)

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

  const recargarDetalle = (id) => {
    apiFetch(`/postventa/reclamos/${id}`, {}, onUnauthorized)
      .then((res) => res.json())
      .then((data) => setDetalle(data))
  }

  const enviarRespuesta = (id) => {
    if (!respuesta.trim()) return
    setEnviando(true)
    const formData = new FormData()
    formData.append('mensaje', respuesta)
    if (archivoAdjunto) formData.append('adjunto', archivoAdjunto)

    apiFetch(`/postventa/reclamos/${id}/responder`, { method: 'POST', body: formData }, onUnauthorized)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Error')
      })
      .then(() => {
        setMsgEnvio('✅ Mensaje enviado.')
        setRespuesta('')
        setArchivoAdjunto(null)
        setEnviando(false)
        recargarDetalle(id)
      })
      .catch((err) => {
        setMsgEnvio(`Error: ${err.message}`)
        setEnviando(false)
      })
  }

  const aprobarDevolucion = (returnId, claimId) => {
    if (!confirm('¿Confirmás que el producto devuelto llegó en las condiciones esperadas?')) return
    setAprobando(true)
    apiFetch(`/postventa/devoluciones/${returnId}/aprobar`, { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Error')
      })
      .then(() => {
        setMsgEnvio('✅ Devolución aprobada.')
        setAprobando(false)
        recargarDetalle(claimId)
      })
      .catch((err) => {
        setMsgEnvio(`Error: ${err.message}`)
        setAprobando(false)
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
                {r.titulo || `Reclamo sobre ${ETIQUETAS_RECURSO[r.resource] || r.resource} #${r.resource_id} (sin producto identificado)`}
                <span className="id-cell mono">
                  #{r.id}{r.comprador && ` · ${r.comprador}`}
                </span>
              </div>
              <span className="badge badge-multi">{ETIQUETAS_TIPO[r.tipo] || r.tipo}</span>
              {r.etapa && r.etapa !== 'none' && <span className="badge badge-acordar">{ETIQUETAS_ETAPA[r.etapa] || r.etapa}</span>}
              <span className="detail-toggle">{abiertoId === r.id ? '▲' : '▼ ver'}</span>
            </div>

            {abiertoId === r.id && (
              <div className="sale-detail">
                {cargandoDetalle && <div className="loading-state">Cargando detalle...</div>}

                {detalle && (
                  <>
                    {/* Fecha límite de acciones obligatorias */}
                    {detalle.claim.players
                      ?.flatMap((p) => p.available_actions || [])
                      .filter((a) => a.mandatory && a.due_date)
                      .map((a, i) => {
                        const dias = diasRestantes(a.due_date)
                        return (
                          <div key={i} className="badge badge-sin-explicar" style={{ marginBottom: 4, display: 'inline-block' }}>
                            ⏰ {ETIQUETAS_ACCION[a.action] || a.action}: antes del {new Date(a.due_date).toLocaleString('es-AR')}
                            {dias >= 0 ? ` (quedan ${dias} día(s))` : ' (¡vencido!)'}
                          </div>
                        )
                      })}
                    {detalle.claim.players?.some((p) => (p.available_actions || []).some((a) => a.mandatory && a.due_date)) && (
                      <p style={{ fontSize: 11, color: 'var(--gray-muted)', marginTop: 2, marginBottom: 10 }}>
                        ⚠ Esta es la fecha de esa acción puntual - si el mensaje del mediador (abajo) menciona otra fecha para la decisión, esa es la que vale.
                      </p>
                    )}

                    {/* Motivo en criollo */}
                    {detalle.motivo && (
                      <div style={{ marginBottom: 10, fontSize: 13 }}>
                        <strong>Motivo:</strong> {detalle.motivo.detail || detalle.motivo.name || detalle.motivo.id}
                      </div>
                    )}

                    {/* Ficha de la venta puntual */}
                    {detalle.orden && (
                      <div className="paste-box" style={{ margin: '0 0 12px' }}>
                        <label className="corte-label" style={{ marginBottom: 8 }}>Detalle de la venta</label>
                        <div style={{ fontSize: 13, lineHeight: 1.7 }}>
                          <div><strong>Pedido:</strong> #{detalle.orden.id}</div>
                          <div>
                            <strong>Estado:</strong>{' '}
                            <span className="badge badge-explicada">{ETIQUETAS_ESTADO_ORDEN[detalle.orden.status] || detalle.orden.status}</span>
                          </div>
                          <div><strong>Fecha:</strong> {new Date(detalle.orden.date_created).toLocaleString('es-AR')}</div>
                          <div><strong>Comprador:</strong> {detalle.orden.buyer?.nickname}</div>
                          <div><strong>Total:</strong> ${detalle.orden.total_amount}</div>
                        </div>
                      </div>
                    )}

                    {/* Ficha de cada publicación involucrada */}
                    {detalle.orden?.order_items?.map((oi, i) => (
                      <a
                        key={i}
                        href={oi.item.permalink}
                        target="_blank"
                        rel="noreferrer"
                        className="paste-box"
                        style={{ margin: '0 0 12px', display: 'flex', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit' }}
                      >
                        {oi.item.foto_url && <img src={oi.item.foto_url} alt="" className="pick-thumb" />}
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700 }}>{oi.item.title}</div>
                          <div className="id-cell mono">
                            Vendidos acá: ×{oi.quantity}
                            {oi.item.precio_actual != null && ` · Precio actual: $${oi.item.precio_actual}`}
                          </div>
                          {oi.item.estado_publicacion && (
                            <span className="badge badge-acordar" style={{ marginTop: 4 }}>
                              {ETIQUETAS_ESTADO_PUB[oi.item.estado_publicacion] || oi.item.estado_publicacion}
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 20 }}>↗</span>
                      </a>
                    ))}

                    {/* Devolución */}
                    {detalle.devolucion && (
                      <div style={{ marginBottom: 12 }}>
                        <strong>Devolución:</strong> estado del envío de vuelta: {detalle.devolucion.shipping?.status || 'sin dato'}
                        {detalle.devolucion.shipping?.tracking_number && ` · seguimiento: ${detalle.devolucion.shipping.tracking_number}`}

                        {detalle.claim.players?.some((p) =>
                          (p.available_actions || []).some((a) => a.action === 'return_review_ok')
                        ) && (
                          <div style={{ marginTop: 8 }}>
                            <button
                              className="scan-btn"
                              disabled={aprobando}
                              onClick={() => aprobarDevolucion(detalle.devolucion.id, r.id)}
                            >
                              ✅ Aprobar devolución (llegó bien)
                            </button>
                          </div>
                        )}
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

                    {detalle.claim.type === 'return' && (
                      <p className="sale-together">Las devoluciones no tienen chat - se gestionan por acciones, no por mensajes.</p>
                    )}
                    {detalle.claim.status === 'closed' && detalle.claim.type !== 'return' && (
                      <p className="sale-together">Este reclamo ya está cerrado - no se pueden mandar más mensajes.</p>
                    )}

                    {detalle.claim.type !== 'return' && detalle.claim.status !== 'closed' && (
                      <div style={{ marginTop: 12 }}>
                        <textarea
                          className="paste-textarea"
                          rows={2}
                          placeholder="Escribí tu respuesta..."
                          value={respuesta}
                          onChange={(e) => setRespuesta(e.target.value)}
                        />
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, flexWrap: 'wrap' }}>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => setArchivoAdjunto(e.target.files[0] || null)}
                          />
                          <button
                            className="scan-btn"
                            onClick={() => enviarRespuesta(r.id)}
                            disabled={enviando}
                          >
                            {enviando ? 'Enviando...' : '✉ Responder'}
                          </button>
                        </div>
                        {msgEnvio && <div className="scan-result" style={{ padding: '8px 0' }}>{msgEnvio}</div>}
                      </div>
                    )}

                    {/* Historial de estados */}
                    {detalle.historial_estados?.length > 0 && (
                      <div style={{ marginTop: 16 }}>
                        <label className="corte-label" style={{ marginBottom: 6 }}>Historial</label>
                        {detalle.historial_estados.map((h, i) => (
                          <div key={i} className="sale-line" style={{ fontSize: 12 }}>
                            <span className="mono">{new Date(h.date).toLocaleString('es-AR')}</span>
                            <span>{h.stage ? `${ETIQUETAS_ETAPA[h.stage] || h.stage} - ` : ''}{ETIQUETAS_ESTADO_HIST[h.status] || h.status}</span>
                            {h.change_by && <span style={{ color: 'var(--gray-muted)' }}>({ETIQUETAS_ROL[h.change_by] || h.change_by})</span>}
                          </div>
                        ))}
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
