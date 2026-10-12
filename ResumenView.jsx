import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'
import TicketPromedioView from './TicketPromedioView.jsx'

function Tile({ valor, label, activo, colorActivo, onClick, alerta }) {
  return (
    <button
      type="button"
      className={`resumen-tile ${activo ? '' : 'resumen-tile-neutro'}`}
      style={activo ? { background: colorActivo } : undefined}
      onClick={onClick}
    >
      {alerta && <div className="resumen-tile-alerta">⚠</div>}
      <div className="resumen-tile-valor">{valor}</div>
      <div className="resumen-tile-label">{label}</div>
      {onClick && <span className="resumen-tile-flecha">›</span>}
    </button>
  )
}

export default function ResumenView({ onUnauthorized, onIrA }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [ventas, setVentas] = useState(null)
  const [editandoObjetivo, setEditandoObjetivo] = useState(false)
  const [nuevaMeta, setNuevaMeta] = useState('')
  const [nuevoTicket, setNuevoTicket] = useState('')
  const [errorObjetivo, setErrorObjetivo] = useState(null)
  const [nuevoPremio, setNuevoPremio] = useState('')
  const [guardandoObjetivo, setGuardandoObjetivo] = useState(false)

  useEffect(() => {
    apiFetch('/resumen-dia', {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })

    apiFetch('/ventas/hoy', {}, onUnauthorized)
      .then((res) => res.json())
      .then(setVentas)
      .catch(() => {})
  }, [])

  if (loading) return <div className="loading-state">Cargando resumen...</div>
  if (error) return <div className="error-state">Error: {error}</div>

  const guardarObjetivo = () => {
    const meta = Number(nuevaMeta) || 0
    const ticket = Number(nuevoTicket) || 0
    if ((meta <= 0 && ticket <= 0) || !nuevoPremio.trim()) return
    setGuardandoObjetivo(true)
    setErrorObjetivo(null)
    apiFetch('/ventas/objetivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta: meta > 0 ? meta : null, ticket_meta: ticket > 0 ? ticket : null, premio: nuevoPremio.trim() }),
    }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'No se pudo guardar el objetivo.')
        return d
      })
      .then((d) => {
        setVentas((prev) => ({ ...prev, proximo_objetivo: { meta: d.meta, ticket_meta: d.ticket_meta, premio: d.premio } }))
        setEditandoObjetivo(false)
        setGuardandoObjetivo(false)
      })
      .catch((err) => {
        setErrorObjetivo(err.message)
        setGuardandoObjetivo(false)
      })
  }

  const obj = ventas?.proximo_objetivo
  const pesos = (n) => `$${Math.round(n).toLocaleString('es-AR')}`
  const okVentas = obj && (!obj.meta || ventas.total >= obj.meta)
  const okTicket = obj && (!obj.ticket_meta || (ventas.total > 0 && ventas.ticket_promedio >= obj.ticket_meta))
  const cumplido = !!obj && okVentas && okTicket

  return (
    <>
      {ventas && (
        <div className="hero-ventas" style={{ textAlign: 'center' }}>
          {!editandoObjetivo && (
            <button
              className="hero-ventas-menu"
              onClick={() => {
                setNuevaMeta(ventas.proximo_objetivo?.meta || '')
                setNuevoTicket(ventas.proximo_objetivo?.ticket_meta || '')
                setErrorObjetivo(null)
                setNuevoPremio(ventas.proximo_objetivo?.premio || '')
                setEditandoObjetivo(true)
              }}
              aria-label={ventas.proximo_objetivo ? 'Cambiar objetivo' : 'Cargar objetivo'}
              title={ventas.proximo_objetivo ? 'Cambiar objetivo' : 'Cargar objetivo'}
            >
              ⋯
            </button>
          )}

          <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--navy)', lineHeight: 1 }}>
            {ventas.total}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-muted)', textTransform: 'uppercase', marginTop: 4 }}>
            Ventas hoy
          </div>

          {ventas.ticket_promedio !== undefined && (
            <div style={{ marginTop: 10, fontSize: 15, color: 'var(--navy)' }}>
              🎟️ Ticket promedio:{' '}
              <strong style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                {ventas.total > 0 ? `$${Math.round(ventas.ticket_promedio).toLocaleString('es-AR')}` : '—'}
              </strong>
              <span style={{ color: 'var(--gray-muted)', fontSize: 13 }}>
                {' '}· vendido hoy: ${Math.round(ventas.facturacion || 0).toLocaleString('es-AR')}
              </span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <span className="badge badge-colecta">📦 Colecta: {ventas.colecta}</span>
            <span className="badge badge-flex">🚚 Flex: {ventas.flex}</span>
            <span className="badge badge-full">🏭 Full: {ventas.full}</span>
            <span className="badge badge-acordar">🤝 Acordar: {ventas.acordar}</span>
          </div>

          {obj && (
            <div style={{ marginTop: 14, fontSize: 13, color: 'var(--charcoal)', display: 'flex', flexDirection: 'column', gap: 4 }}>
              {obj.meta && (
                <div>
                  {okVentas
                    ? <>✅ Ventas: <strong>{obj.meta}</strong> alcanzadas</>
                    : <>Faltan <strong>{obj.meta - ventas.total}</strong> ventas para llegar a <strong>{obj.meta}</strong></>}
                </div>
              )}
              {obj.ticket_meta && (
                <div>
                  {okTicket
                    ? <>✅ Ticket promedio: <strong>{pesos(ventas.ticket_promedio)}</strong> (objetivo {pesos(obj.ticket_meta)})</>
                    : ventas.total > 0
                      ? <>Ticket promedio: <strong>{pesos(ventas.ticket_promedio)}</strong> · faltan <strong>{pesos(obj.ticket_meta - ventas.ticket_promedio)}</strong> para llegar a <strong>{pesos(obj.ticket_meta)}</strong></>
                      : <>Ticket promedio objetivo: <strong>{pesos(obj.ticket_meta)}</strong></>}
                </div>
              )}
              {obj.meta && obj.ticket_meta && !cumplido && (
                <div style={{ color: 'var(--gray-muted)' }}>Hay que lograr las dos cosas juntas.</div>
              )}
              <div style={cumplido ? { fontWeight: 700 } : undefined}>
                {cumplido ? <>🏆 ¡Objetivo cumplido! → {obj.premio}</> : <>→ {obj.premio} 🎉</>}
              </div>
            </div>
          )}
          {!ventas.proximo_objetivo && !editandoObjetivo && (
            <div style={{ marginTop: 14, fontSize: 13, color: 'var(--gray-muted)' }}>
              Todavía no hay un objetivo cargado.
            </div>
          )}

          {editandoObjetivo && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 300, marginInline: 'auto' }}>
              <input
                type="number"
                className="corte-input"
                style={{ width: '100%', maxWidth: 'none', boxSizing: 'border-box' }}
                placeholder="Objetivo de ventas (ej: 250)"
                aria-label="Objetivo de cantidad de ventas"
                value={nuevaMeta}
                onChange={(e) => setNuevaMeta(e.target.value)}
              />
              <input
                type="number"
                className="corte-input"
                style={{ width: '100%', maxWidth: 'none', boxSizing: 'border-box' }}
                placeholder="Objetivo de ticket promedio (ej: 40000)"
                aria-label="Objetivo de ticket promedio en pesos"
                value={nuevoTicket}
                onChange={(e) => setNuevoTicket(e.target.value)}
              />
              <div style={{ fontSize: 12, color: 'var(--gray-muted)' }}>
                Podés cargar uno solo o los dos: con los dos, hay que lograr ambos.
              </div>
              <input
                type="text"
                className="corte-input"
                style={{ width: '100%', maxWidth: 'none', boxSizing: 'border-box' }}
                placeholder="Premio (ej: Asado en el patio)"
                value={nuevoPremio}
                onChange={(e) => setNuevoPremio(e.target.value)}
              />
              {errorObjetivo && <div role="alert" style={{ fontSize: 12, color: 'var(--alerta)' }}>{errorObjetivo}</div>}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button
                  className="scan-btn"
                  onClick={guardarObjetivo}
                  disabled={guardandoObjetivo || ((Number(nuevaMeta) || 0) <= 0 && (Number(nuevoTicket) || 0) <= 0) || !nuevoPremio.trim()}
                >
                  Guardar
                </button>
                <button className="sort-btn" onClick={() => setEditandoObjetivo(false)}>
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="resumen-grid">
        <Tile
          valor={data.total_pendiente_separar}
          label="Unidades pendientes de separar"
          activo={data.total_pendiente_separar > 0}
          colorActivo="var(--atencion)"
          onClick={() => onIrA?.('picking')}
        />
        <Tile
          valor={data.productos_sobreventa}
          label="Producto(s) en sobreventa (48h)"
          activo={data.productos_sobreventa > 0}
          colorActivo="var(--alerta)"
          alerta={data.productos_sobreventa > 0}
          onClick={() => onIrA?.('metricas')}
        />
        <Tile
          valor={data.reclamos_con_deadline_hoy.length}
          label="Reclamo(s) con vencimiento hoy"
          activo={data.reclamos_con_deadline_hoy.length > 0}
          colorActivo="var(--atencion)"
          alerta={data.reclamos_con_deadline_hoy.length > 0}
          onClick={() => onIrA?.('postventa')}
        />
        <Tile
          valor={data.reclamos_abiertos_total}
          label="Reclamos abiertos (total)"
          activo={false}
          onClick={() => onIrA?.('postventa')}
        />
      </div>

      <TicketPromedioView onUnauthorized={onUnauthorized} />
    </>
  )
}
