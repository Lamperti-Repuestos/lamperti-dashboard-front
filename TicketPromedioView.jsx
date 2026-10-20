import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'
import { apiFetch } from './api.js'
import VelasChart, { colorDe } from './VelasChart.jsx'

const RANGOS = [7, 30, 60, 90]

// Líneas que se pueden prender y apagar debajo del gráfico (se irán sumando más).
const SERIES = [
  { key: 'ticket', nombre: 'Ticket promedio', color: 'var(--navy)', campo: 'ticket_promedio' },
  { key: 'ventas', nombre: 'Ventas', color: 'var(--atencion)', campo: 'ventas' },
  { key: 'full', nombre: 'Plata en Full', color: 'var(--serie-2)', campo: 'full_valor' },
]
const GUARDADO = 'dashboard_ticket_series'
const GUARDADO_GRAFICO = 'dashboard_ticket_grafico'   // { tipo: 'lineas'|'velas', campo, modo }

const leerGrafico = () => {
  const porDefecto = { tipo: 'lineas', campo: 'ticket_promedio', modo: 'diaria', patrones: true }
  try { return { ...porDefecto, ...JSON.parse(localStorage.getItem(GUARDADO_GRAFICO) || '{}') } } catch { return porDefecto }
}

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
const DIA_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']
const conDiaCorto = (iso) => `${DIA_CORTO[new Date(`${iso}T12:00:00`).getDay()]} ${corta(iso)}`
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
    <div role="status" aria-live="polite" style={{ minHeight: 98, padding: '2px 8px 6px 12px', fontSize: 13, lineHeight: 1.45, color: 'var(--charcoal)' }}>
      <div>
        <strong>{conDia(d.fecha)}</strong>{d.parcial ? ' (día en curso)' : ''}
        {!señalado && <span style={gris}> · pasá el mouse por un día</span>}
      </div>
      {activas.includes('ticket') && (
        <div>
          <span style={{ color: 'var(--navy)' }}>●</span> Ticket promedio: <strong>{pesos(d.ticket_promedio)}</strong>
          {indexado && d.ticket_promedio != null && bases.ticket ? <span style={gris}> ({variacion(d.ticket_promedio, bases.ticket)})</span> : null}
          <span style={gris}> · {d.ventas} ventas{d.ordenes > d.ventas ? ` (${d.ordenes} productos)` : ''}</span>
        </div>
      )}
      {activas.includes('ventas') && (
        <div>
          <span style={{ color: 'var(--atencion)' }}>●</span> Ventas: <strong>{d.ventas}</strong>
          {indexado && bases.ventas ? <span style={gris}> ({variacion(d.ventas, bases.ventas)})</span> : null}
          {d.ordenes > d.ventas && <span style={gris}> · {d.ordenes} contando cada producto</span>}
        </div>
      )}
      {activas.includes('ticket') && (
        <div style={gris}>
          {d.ventas > 0 ? <>Más alto: <strong style={{ color: 'var(--charcoal)' }}>{pesos(d.ticket_max)}</strong> · Más bajo: <strong style={{ color: 'var(--charcoal)' }}>{pesos(d.ticket_min)}</strong></> : 'Sin ventas ese día'}
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

// Cuadro del gráfico de velas con la vela señalada (o la última).
function LectorVela({ v, señalada, campo, modo }) {
  if (!v) return null
  const gris = { color: 'var(--gray-muted)' }
  const fmt = campo === 'ventas' ? (n) => n.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : pesos
  const cambio = v.open && !v.parcial ? ((v.close / v.open - 1) * 100) : null
  const periodo = modo === 'semanal' ? `Semana del ${conDia(v.fecha)}${v.fin !== v.fecha ? ` al ${corta(v.fin)}` : ''}` : conDia(v.fecha)
  return (
    <div role="status" aria-live="polite" style={{ minHeight: 98, padding: '2px 8px 6px 12px', fontSize: 13, lineHeight: 1.45, color: 'var(--charcoal)' }}>
      <div>
        <strong>{periodo}</strong>{v.parcial ? ' (en curso)' : ''}
        {!señalada && <span style={gris}> · pasá el mouse por una vela</span>}
      </div>
      <div>
        {modo === 'semanal' ? 'Semana anterior' : 'Día anterior'} <strong>{fmt(v.open)}</strong> · {modo === 'semanal' ? 'Esta semana' : 'Este día'} <strong style={{ color: colorDe(v) }}>{fmt(v.close)}</strong>
        {modo === 'semanal' && <span style={gris}>{campo === 'ventas' ? ' por día' : ''}</span>}
        {cambio != null && <span style={{ color: colorDe(v) }}> ({cambio > 0 ? '+' : ''}{cambio.toFixed(1)}%)</span>}
        {v.parcial && <span style={gris}> · {modo === 'semanal' ? 'sin contar hoy' : 'todavía no terminó'}</span>}
      </div>
      <div style={gris}>
        Máximo <strong style={{ color: 'var(--charcoal)' }}>{fmt(v.high)}</strong> · Mínimo <strong style={{ color: 'var(--charcoal)' }}>{fmt(v.low)}</strong>
        {v.media != null && <> · Media 7 días <strong style={{ color: 'var(--charcoal)' }}>{fmt(v.media)}</strong></>}
      </div>
    </div>
  )
}

// Las lecturas del análisis: líneas en MAYÚSCULAS como títulos, el resto como párrafo.
function TextoAnalisis({ texto }) {
  return texto.split('\n').map((linea, i) => (
    linea.trim() === '' ? <div key={i} style={{ height: 8 }} />
      : /^[A-ZÁÉÍÓÚÑ0-9 ()/:,.-]{4,}$/.test(linea.trim())
        ? <div key={i} style={{ fontWeight: 700, marginTop: 4 }}>{linea}</div>
        : <div key={i}>{linea}</div>
  ))
}

const LECTURAS = [
  { key: 'ventas', titulo: '📈 Ventas' },
  { key: 'ticket', titulo: '🎟️ Ticket promedio' },
  { key: 'relacion', titulo: '🔗 Cómo se relacionan' },
]

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
  const [analisis, setAnalisis] = useState(null)      // { texto, lecturas: {ventas, ticket, relacion}, generado_en, dias, en_cache }
  const [cargandoAnalisis, setCargandoAnalisis] = useState(false)
  const [errorAnalisis, setErrorAnalisis] = useState(null)
  const [señalado, setSeñalado] = useState(null)      // día sobre el que está el mouse (YYYY-MM-DD)
  const [activas, setActivas] = useState(leerActivas)
  const [grafico, setGrafico] = useState(leerGrafico)
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

  const cambiarGrafico = (cambio) => {
    const sig = { ...grafico, ...cambio }
    setGrafico(sig)
    try { localStorage.setItem(GUARDADO_GRAFICO, JSON.stringify(sig)) } catch { /* no es grave */ }
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
  // Lo que se dibuja sobre las velas: patrones de velas siempre; figuras y media de 7 días solo en las velas por día.
  const patronesDelGrafico = useMemo(() => {
    const p = data?.patrones?.[grafico.campo === 'ventas' ? 'ventas' : 'ticket']
    if (!p) return {}
    if (grafico.modo === 'semanal') return { patrones: p.velas_semanales.patrones }
    return {
      patrones: p.velas_diarias.patrones.filter((x) => !x.lo_explica_el_dia_de_la_semana),
      figuras: p.figuras,
      media: p.media_7,
    }
  }, [data, grafico.campo, grafico.modo])
  const hito = data?.hitos?.[0]
  const delta = hito?.antes?.ticket_promedio && hito?.desde?.ticket_promedio
    ? ((hito.desde.ticket_promedio - hito.antes.ticket_promedio) / hito.antes.ticket_promedio) * 100
    : null

  const pedirAnalisis = () => {
    setCargandoAnalisis(true)
    setErrorAnalisis(null)
    apiFetch(`/metricas/ticket-promedio/analisis?dias=${dias}`, { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then(setAnalisis)
      .catch((e) => setErrorAnalisis(e.message))
      .finally(() => setCargandoAnalisis(false))
  }

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
        <h3 style={{ margin: 0, color: 'var(--charcoal)' }}>🎟️ Ventas y ticket promedio por día</h3>
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
                ? <>📅 <strong>{conDia(elegido.fecha)}</strong>: ticket promedio <strong>{pesos(elegido.ticket_promedio)}</strong>{elegido.ventas > 0 && <> (más alto {pesos(elegido.ticket_max)} · más bajo {pesos(elegido.ticket_min)})</>} · {elegido.ventas} ventas · {pesos(elegido.facturacion)} vendidos{fullPrendida && <> · plata en Full <strong>{pesos(elegido.full_valor)}</strong>{elegido.full_valor == null ? ' (sin foto ese día)' : ''}</>}{elegido.parcial ? ' (día en curso)' : ''}</>
                : cargando ? 'Buscando ese día…' : 'Ese día queda fuera de los últimos 90 días que tengo cargados.'}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
            <Cifra titulo={`Ticket promedio ${dias} días`} valor={pesos(data.periodo.ticket_promedio)}
              detalle={`${data.periodo.ventas} ventas · sin contar hoy${data.periodo.ticket_por_orden != null && data.periodo.ordenes > data.periodo.ventas ? ` · por producto ${pesos(data.periodo.ticket_por_orden)}` : ''}`} />
            <Cifra titulo="Ventas por día" valor={data.periodo.dias ? (data.periodo.ventas / data.periodo.dias).toLocaleString('es-AR', { maximumFractionDigits: 1 }) : '—'}
              detalle={`${data.periodo.ventas} en ${data.periodo.dias} días${data.periodo.ordenes > data.periodo.ventas ? ` · ${data.periodo.ordenes} contando cada producto` : ''}`} />
            {hito && <Cifra titulo="Antes del cambio" valor={pesos(hito.antes.ticket_promedio)} detalle={`${hito.antes.dias} días · ${hito.antes.ventas} ventas`} />}
            {hito && <Cifra titulo="Desde el cambio" valor={pesos(hito.desde.ticket_promedio)} detalle={`${hito.desde.dias} ${hito.desde.dias === 1 ? 'día' : 'días'} · ${hito.desde.ventas} ventas${delta != null ? ` · ${delta > 0 ? '+' : ''}${delta.toFixed(1)}%` : ''}`} />}
          </div>

          <div style={{ background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 'var(--radius)', padding: '12px 8px 4px', opacity: cargando ? 0.6 : 1 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 8px 8px' }}>
              <div role="group" aria-label="Tipo de gráfico" style={{ display: 'flex', gap: 6 }}>
                {[['lineas', '〰 Líneas'], ['velas', '🕯 Velas']].map(([k, t]) => (
                  <button key={k} type="button" className={`sort-btn ${grafico.tipo === k ? 'active-outline' : ''}`} aria-pressed={grafico.tipo === k} onClick={() => cambiarGrafico({ tipo: k })}>{t}</button>
                ))}
              </div>
              {grafico.tipo === 'velas' && (
                <>
                  <div role="group" aria-label="Qué muestran las velas" style={{ display: 'flex', gap: 6 }}>
                    {[['ventas', 'Ventas'], ['ticket_promedio', 'Ticket']].map(([k, t]) => (
                      <button key={k} type="button" className={`sort-btn ${grafico.campo === k ? 'active-outline' : ''}`} aria-pressed={grafico.campo === k} onClick={() => cambiarGrafico({ campo: k })}>{t}</button>
                    ))}
                  </div>
                  <div role="group" aria-label="Cada vela es" style={{ display: 'flex', gap: 6 }}>
                    {[['diaria', 'Por día'], ['semanal', 'Por semana']].map(([k, t]) => (
                      <button key={k} type="button" className={`sort-btn ${grafico.modo === k ? 'active-outline' : ''}`} aria-pressed={grafico.modo === k} onClick={() => cambiarGrafico({ modo: k })}>{t}</button>
                    ))}
                  </div>
                  {data.patrones && (
                    <button type="button" className={`sort-btn ${grafico.patrones ? 'active-outline' : ''}`} aria-pressed={grafico.patrones} onClick={() => cambiarGrafico({ patrones: !grafico.patrones })}>
                      📐 Patrones
                    </button>
                  )}
                </>
              )}
            </div>
            {grafico.tipo === 'velas' && data.velas && (
              <>
                <VelasChart
                  key={`${grafico.campo}-${grafico.modo}-${dias}`}
                  velas={data.velas[grafico.modo][grafico.campo]}
                  {...(grafico.patrones ? patronesDelGrafico : {})}
                  formatoEje={grafico.campo === 'ventas' ? (v) => `${Math.round(v)}` : (v) => `$${Math.round(v / 1000)}k`}
                  formatoFecha={dias <= 30 && grafico.modo === 'diaria' ? conDiaCorto : corta}
                  hitos={data.hitos || []}
                  lector={(v, señalada) => <LectorVela v={v} señalada={señalada} campo={grafico.campo} modo={grafico.modo} />}
                />
                <div style={{ fontSize: 12, color: 'var(--gray-muted)', padding: '4px 8px 8px' }}>
                  {grafico.modo === 'diaria'
                    ? <div>Cada vela es un día: abre donde cerró el día anterior y cierra en el valor del día. <span style={{ color: 'var(--ok)' }}>Verde</span> = subió, <span style={{ color: 'var(--alerta)' }}>roja</span> = bajó.</div>
                    : <div>Cada vela es una semana (lunes a domingo): abre con el promedio {grafico.campo === 'ventas' ? 'de ventas por día' : 'del ticket'} de la semana anterior y cierra con el de esta. La mecha marca el mejor y el peor día. <span style={{ color: 'var(--ok)' }}>Verde</span> = mejor que la semana anterior, <span style={{ color: 'var(--alerta)' }}>roja</span> = peor.</div>}
                  {grafico.patrones && patronesDelGrafico.figuras?.length > 0 && (
                    <div style={{ margin: '4px 0', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {patronesDelGrafico.figuras.map((f) => (
                        <div key={f.nombre} style={{ color: 'var(--charcoal)' }}>
                          📐 <strong>{f.nombre[0].toUpperCase() + f.nombre.slice(1)}</strong> ({f.tipo}) · {f.estado} · desde {corta(f.desde)}
                        </div>
                      ))}
                    </div>
                  )}
                  {grafico.patrones && grafico.modo === 'diaria' && data.patrones && (
                    <div>📐 Las figuras se buscan sobre la <strong>media de 7 días</strong> (línea punteada), que saca el efecto del día de la semana. Arriba de las velas van los patrones de velas; no se marcan los que explica el día de la semana (por ejemplo, domingo flojo y lunes fuerte).</div>
                  )}
                  {grafico.patrones && grafico.modo === 'semanal' && data.patrones && (
                    <div>📐 En las velas por semana se marcan los patrones de velas; las figuras (cuñas, hombro-cabeza-hombro, etc.) se ven en "Por día".</div>
                  )}
                  <div>La vela hueca y gris es la que está en curso: puede cambiar hasta que termine{grafico.modo === 'semanal' ? ' (el día de hoy no se cuenta)' : ''}.</div>
                  {(data.hitos || []).map((h) => <div key={h.fecha}>⚑ {larga(h.fecha)} — {h.texto}</div>)}
                </div>
              </>
            )}
            {grafico.tipo === 'lineas' && (<>
            <div>
            <LectorDia d={filas.find((f) => f.fecha === señalado) || filas[filas.length - 1]} señalado={!!señalado} activas={activas} bases={bases} />
            <ResponsiveContainer width="100%" height={290}>
              <LineChart data={datos} margin={{ top: 22, right: 16, left: 4, bottom: 4 }}>
                <CartesianGrid stroke="var(--gray-line)" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="fecha" tickFormatter={dias <= 30 ? conDiaCorto : corta} tick={{ fontSize: 12, fill: 'var(--gray-muted)' }} stroke="var(--gray-line)" minTickGap={dias <= 30 ? 8 : 18} />
                <YAxis
                  tickFormatter={indexado || unico?.key === 'ventas' ? (v) => `${Math.round(v)}` : unico?.key === 'full' ? (v) => `$${(v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M` : (v) => `$${Math.round(v / 1000)}k`}
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
            </>)}
          </div>

          <div style={{ marginTop: 12 }}>
            <button type="button" className="scan-btn" onClick={pedirAnalisis} disabled={cargandoAnalisis} aria-busy={cargandoAnalisis}>
              {cargandoAnalisis ? '🧠 Analizando…' : analisis ? '🧠 Actualizar análisis técnico de hoy' : '🧠 Obtener análisis técnico de hoy'}
            </button>
            <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--gray-muted)' }}>Lee las ventas y el ticket de los últimos {dias} días</span>
            {errorAnalisis && <div role="alert" style={{ marginTop: 8, fontSize: 13, color: 'var(--alerta)' }}>No pude hacer el análisis: {errorAnalisis}</div>}
            {analisis && (
              <div style={{ marginTop: 10, background: 'var(--card-bg)', border: '1px solid var(--gray-line)', borderRadius: 'var(--radius)', padding: '12px 16px', opacity: cargandoAnalisis ? 0.6 : 1 }}>
                <div style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--charcoal)' }}>
                  {analisis.lecturas
                    ? LECTURAS.filter((l) => analisis.lecturas[l.key]).map((l, i) => (
                      <section key={l.key} style={i ? { marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--gray-line)' } : undefined}>
                        <h4 style={{ margin: '0 0 4px', fontSize: 15 }}>{l.titulo}</h4>
                        <TextoAnalisis texto={analisis.lecturas[l.key]} />
                      </section>
                    ))
                    : <TextoAnalisis texto={analisis.texto} />}
                </div>
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--gray-muted)' }}>
                  Generado a las {new Date(analisis.generado_en).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} · últimos {analisis.dias} días
                  {analisis.en_cache ? ' · es el de hace unos minutos' : ''}. Es una lectura automática de los números del gráfico, orientativa: no es una predicción.
                </div>
              </div>
            )}
          </div>

          <button type="button" className="sort-btn" style={{ marginTop: 8 }} onClick={() => setTabla(!tabla)}>
            {tabla ? 'Ocultar la tabla' : 'Ver como tabla'}
          </button>
          {tabla && (
            <div style={{ overflowX: 'auto', marginTop: 8 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 13, color: 'var(--charcoal)' }}>
                <thead>
                  <tr>{['Día', 'Ventas', 'Productos', 'Vendido', 'Ticket promedio', 'Por producto', 'Más alto', 'Más bajo', ...(fullPrendida ? ['Plata en Full'] : [])].map((t) => <th key={t} style={{ textAlign: 'right', padding: '4px 10px', borderBottom: '1px solid var(--gray-line)' }}>{t}</th>)}</tr>
                </thead>
                <tbody>
                  {[...filas].reverse().map((f) => (
                    <tr key={f.fecha}>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{conDia(f.fecha)}{f.parcial ? ' *' : ''}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{f.ventas}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px', color: 'var(--gray-muted)' }}>{f.ordenes}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{pesos(f.facturacion)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px', fontWeight: 700 }}>{pesos(f.ticket_promedio)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px', color: 'var(--gray-muted)' }}>{pesos(f.ticket_por_orden)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{pesos(f.ticket_max)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 10px' }}>{pesos(f.ticket_min)}</td>
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
