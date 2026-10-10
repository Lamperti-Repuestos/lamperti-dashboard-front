import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { apiFetch } from './api.js'

const RANGOS = [7, 30, 60, 90]

// Líneas que se pueden prender y apagar debajo del gráfico (se irán sumando más).
const SERIES = [
  { key: 'ticket', nombre: 'Ticket promedio', color: 'var(--navy)', campo: 'ticket_promedio' },
  { key: 'full', nombre: 'Plata en Full', color: 'var(--serie-2)', campo: 'full_valor' },
]
const GUARDADO = 'dashboard_ticket_series'

const leerActivas = () => {
  try {
    const g = JSON.parse(localStorage.getItem(GUARDADO) || 'null')
    if (Array.isArray(g)) { const ok = g.filter((k) => SERIES.some((x) => x.key === k)); if (ok.length) return ok }
  } catch { /* sin almacenamiento: queda el valor por defecto */ }
  return ['ticket']
}

const pesos = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`)
const corta = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
const variacion = (v, base) => { const p = (v / base - 1) * 100; return `${p > 0 ? '+' : ''}${p.toFixed(1)}% vs. primer día` }
const larga = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

const DIAS_SEM = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const conDia = (iso) => `${DIAS_SEM[new Date(`${iso}T12:00:00`).getDay()]} ${larga(iso)}`

// Recharts avisa acá qué día está señalado (con el mouse o con las flechas del teclado); no dibuja nada.
function Puente({ active, payload, onDia }) {
  const fecha = active && payload?.length ? payload[0].payload.fecha : null
  useEffect(() => { onDia(fecha) }, [fecha])
  return null
}

// Cuadro fijo (arriba a la izquierda del gráfico) con el detalle del día señalado.
function LectorDia({ d, señalado, activas, bases }) {
  if (!d) return null
  const indexado = activas.length >= 2
  const gris = { color: 'var(--gray-muted)' }
  return (
    <div role="status" aria-live="polite" style={{ position: 'absolute', top: 10, left: 62, maxWidth: '62%', pointerEvents: 'none', fontSize: 13, lineHeight: 1.45, color: 'var(--charcoal)' }}>
      <div>
        <strong>{conDia(d.fecha)}</strong>{d.parcial ? ' (día en curso)' : ''}
        {!señalado && <span style={gris}> · pasá el mouse por un día</span>}
      </div>
      {activas.includes('ticket') && (
        <div>
          <span style={{ color: 'var(--navy)' }}>●</span> Ticket promedio: <strong>{pesos(d.ticket_promedio)}</strong>
          {indexado && d.ticket_promedio != null && bases.ticket ? <span style={gris}> ({variacion(d.ticket_promedio, bases.ticket)})</span> : null}
          <span style={gris}> · {d.ventas} ventas</span>
        </div>
      )}
      {activas.includes('full') && (
        <div>
          <span style={{ color: 'var(--serie-2)' }}>●</span> Plata en Full: <strong>{pesos(d.full_valor)}</strong>
          {indexado && d.full_valor != null && bases.full ? <span style={gris}> ({variacion(d.full_valor, bases.full)})</span> : null}
          {d.full_valor == null && <span style={gris}> (sin foto ese día)</span>}
        </div>
      )}
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
  const [señalado, setSeñalado] = useState(null)      // día sobre el que está el mouse (YYYY-MM-DD)
  const [activas, setActivas] = useState(leerActivas)
  const [full, setFull] = useState(null)         // { 'YYYY-MM-DD': {valor, unidades, publicaciones} }
  const [errorFull, setErrorFull] = useState(null)
  const [cargandoFull, setCargandoFull] = useState(false)
  const fullPrendida = activas.includes('full')

  const alternar = (key) => {
    const sig = activas.includes(key) ? activas.filter((k) => k !== key) : [...activas, key]
    if (!sig.length) return                    // siempre queda al menos una línea
    setActivas(sig)
    try { localStorage.setItem(GUARDADO, JSON.stringify(sig)) } catch { /* no es grave */ }
  }

  useEffect(() => {
    if (!fullPrendida) return undefined
    let vivo = true
    setCargandoFull(true)
    setErrorFull(null)
    apiFetch(`/metricas/valor-stock-full?dias=${dias}`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => vivo && setFull(Object.fromEntries(d.dias.map((x) => [x.fecha, x]))))
      .catch((e) => vivo && setErrorFull(e.message))
      .finally(() => vivo && setCargandoFull(false))
    return () => { vivo = false }
  }, [dias, fullPrendida])

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

  const filas = useMemo(
    () => (data?.dias || []).map((f) => ({
      ...f,
      full_valor: full?.[f.fecha]?.valor ?? null,
      full_unidades: full?.[f.fecha]?.unidades ?? null,
    })),
    [data, full],
  )
  // Con una sola línea se ve en plata real; con dos o más valen cosas muy distintas ($75 mil vs $48 millones),
  // así que se comparan como variación desde el primer día con dato (100 = ese primer día).
  const seriesActivas = SERIES.filter((x) => activas.includes(x.key))
  const indexado = seriesActivas.length >= 2
  const unico = seriesActivas.length === 1 ? seriesActivas[0] : null
  const bases = useMemo(() => {
    const b = {}
    for (const x of SERIES) b[x.key] = filas.find((f) => f[x.campo] != null && f[x.campo] > 0)?.[x.campo] ?? null
    return b
  }, [filas])
  const datos = useMemo(
    () => filas.map((f) => {
      const o = { ...f }
      for (const x of SERIES) o[`i_${x.key}`] = f[x.campo] != null && bases[x.key] ? (f[x.campo] / bases[x.key]) * 100 : null
      return o
    }),
    [filas, bases],
  )
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
                ? <>📅 <strong>{larga(elegido.fecha)}</strong>: ticket promedio <strong>{pesos(elegido.ticket_promedio)}</strong> · {elegido.ventas} ventas · {pesos(elegido.facturacion)} vendidos{fullPrendida && <> · plata en Full <strong>{pesos(elegido.full_valor)}</strong>{elegido.full_valor == null ? ' (sin foto ese día)' : ''}</>}{elegido.parcial ? ' (día en curso)' : ''}</>
                : cargando ? 'Buscando ese día…' : 'Ese día queda fuera de los últimos 90 días que tengo cargados.'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <Cifra titulo={`Promedio ${dias} días`} valor={pesos(data.periodo.ticket_promedio)} detalle={`${data.periodo.ventas} ventas · sin contar hoy`} />
            {hito && <Cifra titulo="Antes del cambio" valor={pesos(hito.antes.ticket_promedio)} detalle={`${hito.antes.dias} días · ${hito.antes.ventas} ventas`} />}
            {hito && <Cifra titulo="Desde el cambio" valor={pesos(hito.desde.ticket_promedio)} detalle={`${hito.desde.dias} ${hito.desde.dias === 1 ? 'día' : 'días'} · ${hito.desde.ventas} ventas${delta != null ? ` · ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : ''}`} />}
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 'var(--radius)', padding: '12px 8px 4px', opacity: cargando ? 0.6 : 1 }}>
            <div style={{ position: 'relative' }}>
            <LectorDia d={filas.find((f) => f.fecha === señalado) || filas[filas.length - 1]} señalado={!!señalado} activas={activas} bases={bases} />
            <ResponsiveContainer width="100%" height={330}>
              <LineChart data={datos} margin={{ top: 84, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="var(--gray-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="fecha" tickFormatter={corta} tick={{ fontSize: 12, fill: 'var(--gray-muted)' }} stroke="var(--gray-line)" minTickGap={18} />
                <YAxis
                  tickFormatter={indexado ? (v) => `${Math.round(v)}` : unico?.key === 'full' ? (v) => `$${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M` : (v) => `$${Math.round(v / 1000)}k`}
                  tick={{ fontSize: 12, fill: 'var(--gray-muted)' }} stroke="var(--gray-line)" width={indexado ? 40 : 56} domain={['auto', 'auto']}
                />
                <Tooltip content={<Puente onDia={setSeñalado} />} cursor={{ stroke: 'var(--gray-muted)', strokeWidth: 1 }} isAnimationActive={false} />
                {indexado && <ReferenceLine y={100} stroke="var(--gray-muted)" strokeDasharray="2 4" />}
                {(data.hitos || []).map((h) => (
                  <ReferenceLine key={h.fecha} x={h.fecha} stroke="var(--charcoal)" strokeWidth={1.5} strokeDasharray="5 4"
                    label={{ value: `⚑ ${corta(h.fecha)}`, position: 'top', fill: 'var(--charcoal)', fontSize: 12 }} />
                ))}
                {seriesActivas.map((x) => (
                  <Line key={x.key} type="linear" dataKey={indexado ? `i_${x.key}` : x.campo} stroke={x.color} strokeWidth={2}
                    dot={{ r: 3, strokeWidth: 2, stroke: 'var(--card-bg)', fill: x.color }} activeDot={{ r: 5 }}
                    connectNulls={x.key === 'ticket'} isAnimationActive={false} />
                ))}
              </LineChart>
            </ResponsiveContainer>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '4px 8px 8px' }} role="group" aria-label="Líneas del gráfico">
              {SERIES.map((x) => {
                const on = activas.includes(x.key)
                return (
                  <button key={x.key} type="button" className={`sort-btn ${on ? 'active-outline' : ''}`} aria-pressed={on} onClick={() => alternar(x.key)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    <span aria-hidden="true" style={{ width: 22, height: 0, borderTop: `3px ${on ? 'solid' : 'dashed'} ${x.color}`, opacity: on ? 1 : 0.5 }} />
                    {x.nombre}{x.key === 'full' && cargandoFull ? ' …' : ''}
                  </button>
                )
              })}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gray-muted)', padding: '0 8px 8px' }}>
              {indexado && <div>Con dos líneas juntas se comparan como <strong>variación desde el primer día</strong> (100 = primer día), porque valen cosas muy distintas. Arriba a la izquierda ves los valores reales del día que señales.</div>}
              {errorFull && <div>⚠ No pude traer la plata en Full: {errorFull}</div>}
              {fullPrendida && !errorFull && !cargandoFull && full && filas.some((f) => f.full_valor == null) && <div>Los días sin punto en "Plata en Full" no tienen foto del stock guardada.</div>}
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
                  <tr>{['Día', 'Ventas', 'Vendido', 'Ticket promedio', ...(fullPrendida ? ['Plata en Full'] : [])].map((t) => <th key={t} style={{ textAlign: 'right', padding: '4px 10px', borderBottom: '1px solid var(--gray-line)' }}>{t}</th>)}</tr>
                </thead>
                <tbody>
                  {[...filas].reverse().map((f) => (
                    <tr key={f.fecha}>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{larga(f.fecha)}{f.parcial ? ' *' : ''}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{f.ventas}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{pesos(f.facturacion)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px', fontWeight: 700 }}>{pesos(f.ticket_promedio)}</td>
                      {fullPrendida && <td style={{ textAlign: 'right', padding: '4px 10px' }}>{f.full_valor == null ? 'sin foto' : pesos(f.full_valor)}</td>}
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
