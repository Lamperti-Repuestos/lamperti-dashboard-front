import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { apiFetch } from './api.js'

const RANGOS = [7, 30, 60, 90]

const pesos = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`)
const corta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const larga = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

function TooltipDia({ active, payload }) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 8, padding: '8px 12px', fontSize: 13, color: 'var(--charcoal)' }}>
      <div style={{ fontWeight: 700 }}>{larga(d.fecha)}{d.parcial ? ' (día en curso)' : ''}</div>
      <div>Ticket promedio: <strong>{pesos(d.ticket_promedio)}</strong></div>
      <div style={{ color: 'var(--gray-muted)' }}>{d.ventas} ventas · {pesos(d.facturacion)}</div>
    </div>
  )
}

function Cifra({ titulo, valor, detalle }) {
  return (
    <div style={{ flex: '1 1 150px', background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 'var(--radius)', padding: '10px 14px' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-muted)', textTransform: 'uppercase' }}>{titulo}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace', color: 'var(--charcoal)' }}>{valor}</div>
      {detalle && <div style={{ fontSize: 12, color: 'var(--gray-muted)' }}>{detalle}</div>}
    </div>
  )
}

export default function TicketPromedioView({ onUnauthorized }) {
  const [dias, setDias] = useState(30)
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [fecha, setFecha] = useState('')
  const [tabla, setTabla] = useState(false)

  useEffect(() => {
    let vivo = true
    setCargando(true)
    setError(null)
    apiFetch(`/metricas/ticket-promedio?dias=${dias}`, {}, onUnauthorized)
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
  const elegido = useMemo(() => filas.find((f) => f.fecha === fecha), [filas, fecha])
  const hito = data?.hitos?.[0]
  const delta = hito?.antes?.ticket_promedio && hito?.desde?.ticket_promedio
    ? ((hito.desde.ticket_promedio - hito.antes.ticket_promedio) / hito.antes.ticket_promedio) * 100
    : null

  const elegirFecha = (valor) => {
    setFecha(valor)
    if (!valor) return
    const necesarios = Math.floor((Date.now() - new Date(`${valor}T12:00:00`).getTime()) / 86400000) + 1
    const rango = RANGOS.find((r) => r >= necesarios)
    if (rango && rango > dias) setDias(rango)      // la fecha elegida es más vieja que lo cargado: se amplía el período
  }

  return (
    <div style={{ margin: '24px 24px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
        <h3 style={{ margin: 0, color: 'var(--charcoal)' }}>🎟️ Ticket promedio por día</h3>
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

      {error && <div className="error-state">No pude traer el ticket promedio: {error}</div>}
      {cargando && !data && <div className="loading-state">Calculando el ticket promedio…</div>}

      {data && (
        <>
          {fecha && (
            <div style={{ marginBottom: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-activo)', color: 'var(--charcoal)' }}>
              {elegido
                ? <>📅 <strong>{larga(elegido.fecha)}</strong>: ticket promedio <strong>{pesos(elegido.ticket_promedio)}</strong> · {elegido.ventas} ventas · {pesos(elegido.facturacion)} vendidos{elegido.parcial ? ' (día en curso)' : ''}</>
                : cargando ? 'Buscando ese día…' : 'Ese día queda fuera de los últimos 90 días que tengo cargados.'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <Cifra titulo={`Promedio ${dias} días`} valor={pesos(data.periodo.ticket_promedio)} detalle={`${data.periodo.ventas} ventas · sin contar hoy`} />
            {hito && <Cifra titulo="Antes del cambio" valor={pesos(hito.antes.ticket_promedio)} detalle={`${hito.antes.dias} días · ${hito.antes.ventas} ventas`} />}
            {hito && <Cifra titulo="Desde el cambio" valor={pesos(hito.desde.ticket_promedio)} detalle={`${hito.desde.dias} ${hito.desde.dias === 1 ? 'día' : 'días'} · ${hito.desde.ventas} ventas${delta != null ? ` · ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : ''}`} />}
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 'var(--radius)', padding: '12px 8px 4px', opacity: cargando ? 0.6 : 1 }}>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={filas} margin={{ top: 18, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="var(--gray-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="fecha" tickFormatter={corta} tick={{ fontSize: 12, fill: 'var(--gray-muted)' }} stroke="var(--gray-line)" minTickGap={18} />
                <YAxis tickFormatter={(v) => `$${Math.round(v / 1000)}k`} tick={{ fontSize: 12, fill: 'var(--gray-muted)' }} stroke="var(--gray-line)" width={52} domain={['auto', 'auto']} />
                <Tooltip content={<TooltipDia />} />
                {(data.hitos || []).map((h) => (
                  <ReferenceLine key={h.fecha} x={h.fecha} stroke="var(--atencion)" strokeWidth={2} strokeDasharray="5 4"
                    label={{ value: `⚑ ${corta(h.fecha)}`, position: 'top', fill: 'var(--charcoal)', fontSize: 12 }} />
                ))}
                <Line type="linear" dataKey="ticket_promedio" stroke="var(--navy)" strokeWidth={2} dot={{ r: 3, strokeWidth: 2, stroke: 'var(--card-bg)', fill: 'var(--navy)' }}
                  activeDot={{ r: 5 }} connectNulls isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
            <div style={{ fontSize: 12, color: 'var(--gray-muted)', padding: '0 8px 8px' }}>
              {(data.hitos || []).map((h) => <div key={h.fecha}>⚑ {larga(h.fecha)} — {h.texto}</div>)}
              <div>El último punto es el día en curso: puede moverse hasta que termine el día.</div>
              {data.hubo_truncado && <div>⚠ Algún período tuvo más de 2.000 ventas y ML devolvió solo parte: esos días pueden quedar bajos.</div>}
            </div>
          </div>

          <button type="button" className="sort-btn" style={{ marginTop: 8 }} onClick={() => setTabla(!tabla)}>
            {tabla ? 'Ocultar la tabla' : 'Ver como tabla'}
          </button>
          {tabla && (
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, color: 'var(--charcoal)' }}>
                <thead>
                  <tr>{['Día', 'Ventas', 'Vendido', 'Ticket promedio'].map((t) => <th key={t} style={{ textAlign: 'right', padding: '4px 10px', borderBottom: '1px solid var(--gray-line)' }}>{t}</th>)}</tr>
                </thead>
                <tbody>
                  {[...filas].reverse().map((f) => (
                    <tr key={f.fecha}>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{larga(f.fecha)}{f.parcial ? ' *' : ''}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{f.ventas}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{pesos(f.facturacion)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px', fontWeight: 700 }}>{pesos(f.ticket_promedio)}</td>
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
