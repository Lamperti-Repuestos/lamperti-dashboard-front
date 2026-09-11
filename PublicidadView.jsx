import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

const formatoPesos = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  maximumFractionDigits: 0,
})

export default function PublicidadView({ onUnauthorized }) {
  const [dias, setDias] = useState(30)
  const [data, setData] = useState(null)
  const [cargando, setCargando] = useState(true)

  const fetchDatos = () => {
    setCargando(true)
    apiFetch(`/metricas/publicidad?dias=${dias}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setData(d)
        setCargando(false)
      })
      .catch((err) => {
        setData({ error: err.message })
        setCargando(false)
      })
  }

  useEffect(fetchDatos, [dias])

  return (
    <>
      <div className="controls">
        <label className="corte-label">
          Período (días)
          <input
            type="number"
            className="corte-input"
            value={dias}
            onChange={(e) => setDias(Number(e.target.value))}
            min={1}
            style={{ width: 70 }}
          />
        </label>
      </div>

      <div className="list">
        {cargando && <div className="loading-state">Cargando...</div>}
        {data?.error && <div className="error-state">Error: {data.error}</div>}
        {data?.sin_publicidad && (
          <div className="empty-state">{data.mensaje}</div>
        )}
        {data?.campañas?.length === 0 && !data.sin_publicidad && (
          <div className="empty-state">No hay campañas en este período.</div>
        )}
        {data?.sin_retorno?.length > 0 && (
          <div className="summary">
            <div className="summary-item warn">
              <div className="value mono">{data.sin_retorno.length}</div>
              <div className="label">Campaña(s) gastando sin retorno</div>
            </div>
          </div>
        )}
        {data?.campañas?.map((c) => (
          <div key={c.id} className="row">
            <div className="title-cell">
              {c.nombre}
              <span className="id-cell mono">{c.status} · {c.clicks} clicks</span>
            </div>
            <span className="badge badge-flex">{formatoPesos.format(c.gasto)} gastado</span>
            <span className={`badge ${c.ventas_atribuidas === 0 ? 'badge-sin-explicar' : 'badge-explicada'}`}>
              {c.ventas_atribuidas} venta(s) atribuida(s)
            </span>
            {c.roas != null && <span className="id-cell mono">ROAS: {c.roas}</span>}
          </div>
        ))}
      </div>
    </>
  )
}
