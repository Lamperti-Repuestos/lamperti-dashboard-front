import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

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
      <div className="summary">
        <div
          className="summary-item"
          style={{ cursor: 'pointer' }}
          onClick={() => onIrA?.('picking')}
        >
          <div className="value mono">{data.total_pendiente_separar}</div>
          <div className="label">Unidades pendientes de separar</div>
        </div>

        <div
          className={`summary-item ${data.productos_sobreventa > 0 ? 'warn' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => onIrA?.('metricas')}
        >
          <div className="value mono">{data.productos_sobreventa}</div>
          <div className="label">Producto(s) en sobreventa (48h)</div>
        </div>

        <div
          className={`summary-item ${data.reclamos_con_deadline_hoy.length > 0 ? 'warn' : ''}`}
          style={{ cursor: 'pointer' }}
          onClick={() => onIrA?.('postventa')}
        >
          <div className="value mono">{data.reclamos_con_deadline_hoy.length}</div>
          <div className="label">Reclamo(s) con vencimiento hoy</div>
        </div>

        <div
          className="summary-item"
          style={{ cursor: 'pointer' }}
          onClick={() => onIrA?.('postventa')}
        >
          <div className="value mono">{data.reclamos_abiertos_total}</div>
          <div className="label">Reclamos abiertos (total)</div>
        </div>
      </div>

      {data.reclamos_con_deadline_hoy.length > 0 && (
        <div className="list">
          <label className="corte-label" style={{ margin: '0 0 6px 12px' }}>Vencen hoy</label>
          {data.reclamos_con_deadline_hoy.map((r) => (
            <div key={r.id} className="row" style={{ cursor: 'pointer' }} onClick={() => onIrA?.('postventa')}>
              <div className="title-cell">
                {r.titulo}
                <span className="id-cell mono">#{r.id}</span>
              </div>
              <span className="badge badge-sin-explicar">
                ⏰ {new Date(r.due_date).toLocaleString('es-AR')}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
