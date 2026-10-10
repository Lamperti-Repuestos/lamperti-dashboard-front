import { useEffect, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { apiFetch } from './api.js'

const RANGOS = [7, 14, 30, 60]
const DIAS_SEM = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

const pesos = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`)
const millones = (n) => `$${(n / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`
const corta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const conDia = (iso) => `${DIAS_SEM[new Date(`${iso}T12:00:00`).getDay()]} ${corta(iso)}`

function TooltipDia({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--charcoal)' }}>
      <div style={{ fontWeight: 700 }}>{conDia(d.fecha)}</div>
      <div>En Full: <strong>{pesos(d.valor)}</strong></div>
      {d.valor != null && <div style={{ color: 'var(--gray-muted)' }}>{d.unidades} unidades · {d.publicaciones} publicaciones</div>}
    </div>
  )
}

export default function ValorFullView({ onUnauthorized }) {
  const [dias, setDias] = useState(14)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [fecha, setFecha] = useState('')
  const [tabla, setTabla] = useState(false)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)
    apiFetch(`/metricas/valor-stock-full?dias=${dias}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => vivo && setData(d))
      .catch((e) => vivo && setError(e.message))
      .finally(() => vivo && setCargando(false))
    return () => { vivo = false }
  }, [dias])

  const filas = data?.dias || []
  const elegido = filas.find((f) => f.fecha === fecha)

  const elegirFecha = (valor) => {
    setFecha(valor)
    if (!valor) return
    const necesarios = Math.floor((Date.now() - new Date(`${valor}T12:00:00`).getTime()) / 86400000) + 1
    const rango = RANGOS.find((r) => r >= necesarios)
    if (rango && rango > dias) setDias(rango)
  }

  return (
    <div style={{ margin: '28px 24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h3 style={{ margin: 0, color: 'var(--charcoal)' }}>📦 Plata en Full (a precio de publicación)</h3>
        <div style={{ display: 'flex', gap: 6 }}>
          {RANGOS.map((r) => (
            <button key={r} type="button" className={`sort-btn ${r === dias ? 'active-outline' : ''}`} aria-pressed={r === dias} onClick={() => setDias(r)}>
              {r} días
            </button>
          ))}
        </div>
        <label style={{ fontSize: 13, color: 'var(--gray-muted)' }}>
          Ver un día:{' '}
          <input type="date" value={fecha} max={new Date().toLocaleDateString('en-CA')} onChange={(e) => elegirFecha(e.target.value)} />
        </label>
      </div>

      {error && <div className="error-state">No pude calcular lo que hay en Full: {error}</div>}
      {cargando && !data && <div className="loading-state">Calculando lo que hay en Full…</div>}

      {data && (
        <>
          {fecha && (
            <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-activo)', color: 'var(--charcoal)' }}>
              {elegido
                ? elegido.valor == null
                  ? <>📅 <strong>{conDia(elegido.fecha)}</strong>: ese día no quedó guardada la foto del stock, no hay dato.</>
                  : <>📅 <strong>{conDia(elegido.fecha)}</strong>: <strong>{pesos(elegido.valor)}</strong> en Full · {elegido.unidades} unidades · {elegido.publicaciones} publicaciones</>
                : cargando ? 'Buscando ese día…' : 'Ese día queda fuera de los últimos 60 días.'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <div style={{ flex: '1 1 220px', background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-muted)', textTransform: 'uppercase' }}>Hoy en Full</div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--charcoal)' }}>{pesos(data.hoy.valor)}</div>
              <div style={{ fontSize: 12, color: 'var(--gray-muted)' }}>{data.hoy.unidades} unidades · {data.hoy.publicaciones} publicaciones</div>
            </div>
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 'var(--radius)', padding: '12px 8px 4px', opacity: cargando ? 0.6 : 1 }}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={filas} margin={{ top: 12, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="var(--gray-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="fecha" tickFormatter={corta} tick={{ fontSize: 12, fill: 'var(--gray-muted)' }} stroke="var(--gray-line)" minTickGap={18} />
                <YAxis tickFormatter={millones} tick={{ fontSize: 12, fill: 'var(--gray-muted)' }} stroke="var(--gray-line)" width={64} domain={['auto', 'auto']} />
                <Tooltip content={<TooltipDia />} />
                <Line type="linear" dataKey="valor" stroke="var(--navy)" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: 'var(--card-bg)', fill: 'var(--navy)' }}
                  activeDot={{ r: 5 }} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 12, color: 'var(--gray-muted)', padding: '0 8px 8px' }}>
              Unidades disponibles en Full × precio de la publicación. Los días anteriores salen de la foto diaria del stock y solo cuentan las publicaciones que hoy están en Full; si falta un día, queda un hueco en la línea.
            </div>
          </div>

          <button type="button" className="sort-btn" style={{ marginTop: 8 }} onClick={() => setTabla(!tabla)}>
            {tabla ? 'Ocultar la tabla' : 'Ver como tabla'}
          </button>
          {tabla && (
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, color: 'var(--charcoal)' }}>
                <thead>
                  <tr>{['Día', 'Unidades', 'Publicaciones', 'En Full'].map((t) => <th key={t} style={{ textAlign: 'right', padding: '4px 10px', borderBottom: '1px solid var(--gray-line)' }}>{t}</th>)}</tr>
                </thead>
                <tbody>
                  {[...filas].reverse().map((f) => (
                    <tr key={f.fecha}>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{conDia(f.fecha)}{f.fuente === 'en vivo' ? ' (hoy)' : ''}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{f.unidades ?? '—'}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{f.valor == null ? '—' : f.publicaciones}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px', fontWeight: 700 }}>{f.valor == null ? 'sin foto' : pesos(f.valor)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}
