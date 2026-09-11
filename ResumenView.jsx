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
  }, [])

  if (loading) return <div className="loading-state">Cargando resumen...</div>
  if (error) return <div className="error-state">Error: {error}</div>

  return (
    <>
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
