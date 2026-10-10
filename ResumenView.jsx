import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'
import TicketPromedioView from './TicketPromedioView.jsx'
import ValorFullView from './ValorFullView.jsx'

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
    const meta = Number(nuevaMeta)
    if (!meta || meta <= 0 || !nuevoPremio.trim()) return
    setGuardandoObjetivo(true)
    apiFetch('/ventas/objetivo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meta, premio: nuevoPremio.trim() }),
    }, onUnauthorized)
      .then((res) => res.json())
      .then(() => {
        setVentas((prev) => ({ ...prev, proximo_objetivo: { meta, premio: nuevoPremio.trim() } }))
        setEditandoObjetivo(false)
        setGuardandoObjetivo(false)
      })
      .catch(() => setGuardandoObjetivo(false))
  }

  return (
    <>
      {ventas && (
        <div className="hero-ventas" style={{ textAlign: 'center' }}>
          {!editandoObjetivo && (
            <button
              className="hero-ventas-menu"
              onClick={() => {
                setNuevaMeta(ventas.proximo_objetivo?.meta || '')
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

          {ventas.proximo_objetivo && ventas.total < ventas.proximo_objetivo.meta && (
            <div style={{ marginTop: 14, fontSize: 13, color: 'var(--charcoal)' }}>
              Faltan <strong>{ventas.proximo_objetivo.meta - ventas.total}</strong> para llegar a{' '}
              <strong>{ventas.proximo_objetivo.meta}</strong> → {ventas.proximo_objetivo.premio} 🎉
            </div>
          )}
          {ventas.proximo_objetivo && ventas.total >= ventas.proximo_objetivo.meta && (
            <div style={{ marginTop: 14, fontSize: 13, color: 'var(--charcoal)', fontWeight: 700 }}>
              🏆 ¡Objetivo de {ventas.proximo_objetivo.meta} alcanzado! → {ventas.proximo_objetivo.premio}
            </div>
          )}
          {!ventas.proximo_objetivo && !editandoObjetivo && (
            <div style={{ marginTop: 14, fontSize: 13, color: 'var(--gray-muted)' }}>
              Todavía no hay un objetivo cargado.
            </div>
          )}

          {editandoObjetivo && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8, maxWidth: 260, marginInline: 'auto' }}>
              <input
                type="number"
                className="corte-input"
                placeholder="Objetivo (ej: 200)"
                value={nuevaMeta}
                onChange={(e) => setNuevaMeta(e.target.value)}
              />
              <input
                type="text"
                className="corte-input"
                placeholder="Premio (ej: Asado en el patio)"
                value={nuevoPremio}
                onChange={(e) => setNuevoPremio(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                <button className="scan-btn" onClick={guardarObjetivo} disabled={guardandoObjetivo}>
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
      <ValorFullView onUnauthorized={onUnauthorized} />
    </>
  )
}
