import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

function Tile({ valor, label, color, onClick, alerta }) {
  return (
    <div
      className="resumen-tile"
      style={{ background: color, cursor: onClick ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      {alerta && <div className="resumen-tile-alerta">⚠</div>}
      <div className="resumen-tile-valor">{valor}</div>
      <div className="resumen-tile-label">{label}</div>
    </div>
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
        <div className="paste-box" style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--navy)', lineHeight: 1 }}>
            {ventas.total}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--gray-muted)', textTransform: 'uppercase', marginTop: 4 }}>
            Ventas hoy
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            <span className="badge badge-colecta">📦 Colecta: {ventas.colecta}</span>
            <span className="badge badge-flex">🚚 Flex: {ventas.flex}</span>
            <span className="badge badge-acordar">🏭 Full: {ventas.full}</span>
            <span className="badge badge-multi">🤝 Acordar: {ventas.acordar}</span>
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
          {!ventas.proximo_objetivo && (
            <div style={{ marginTop: 14, fontSize: 13, color: 'var(--gray-muted)' }}>
              Todavía no hay un objetivo cargado.
            </div>
          )}

          {!editandoObjetivo && (
            <button className="sort-btn" style={{ marginTop: 12 }} onClick={() => {
              setNuevaMeta(ventas.proximo_objetivo?.meta || '')
              setNuevoPremio(ventas.proximo_objetivo?.premio || '')
              setEditandoObjetivo(true)
            }}>
              ✏️ {ventas.proximo_objetivo ? 'Cambiar objetivo' : 'Cargar objetivo'}
            </button>
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
          color="#1A2B6B"
          onClick={() => onIrA?.('picking')}
        />
        <Tile
          valor={data.productos_sobreventa}
          label="Producto(s) en sobreventa (48h)"
          color={data.productos_sobreventa > 0 ? '#B03A2E' : '#2E7D46'}
          alerta={data.productos_sobreventa > 0}
          onClick={() => onIrA?.('metricas')}
        />
        <Tile
          valor={data.reclamos_con_deadline_hoy.length}
          label="Reclamo(s) con vencimiento hoy"
          color={data.reclamos_con_deadline_hoy.length > 0 ? '#B8860B' : '#2E7D46'}
          alerta={data.reclamos_con_deadline_hoy.length > 0}
          onClick={() => onIrA?.('postventa')}
        />
        <Tile
          valor={data.reclamos_abiertos_total}
          label="Reclamos abiertos (total)"
          color="#4A67B8"
          onClick={() => onIrA?.('postventa')}
        />
      </div>
    </>
  )
}
