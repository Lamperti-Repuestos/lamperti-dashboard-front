import { useEffect, useState } from 'react'
import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ReferenceDot, ResponsiveContainer } from 'recharts'

// Gráfico de velas tipo TradingView. Las velas vienen armadas del backend (open/high/low/close por día o por semana).
// Verde: cerró más arriba que donde abrió. Roja: cerró más abajo. Gris: quedó igual. La vela del día o la semana en
// curso va hueca y gris: todavía se puede mover, así que no se pinta como si hubiera subido o bajado.

const VERDE = 'var(--ok)'
const ROJA = 'var(--alerta)'
const NEUTRA = 'var(--gray-muted)'

const colorDe = (v) => (v.parcial ? NEUTRA : v.close > v.open ? VERDE : v.close < v.open ? ROJA : NEUTRA)

// Nombre corto de cada patrón de velas, para la etiqueta que va arriba de la vela.
const CORTO = {
  'envolvente alcista': 'Envolv. ↑',
  'envolvente bajista': 'Envolv. ↓',
  'tres soldados blancos': '3 soldados',
  'tres cuervos negros': '3 cuervos',
  doji: 'Doji',
}
const ROL_CORTO = {
  'hombro izquierdo': 'HI', cabeza: 'C', 'hombro derecho': 'HD',
  'primer techo': 'T1', 'segundo techo': 'T2', 'primer piso': 'P1', 'segundo piso': 'P2',
  'inicio del mástil': '', 'punta del mástil': '',
}
const colorFigura = (f) => (f.tipo === 'alcista' ? VERDE : f.tipo === 'bajista' ? ROJA : 'var(--info)')

// Recharts dibuja una barra de `low` a `high` (la mecha); acá se le agrega el cuerpo de `open` a `close`.
function Vela({ x, y, width, height, payload }) {
  if (x == null || !payload) return null
  const { open, close, high, low } = payload
  const rango = high - low
  const px = (valor) => (rango > 0 ? y + ((high - valor) / rango) * height : y)
  const arriba = px(Math.max(open, close))
  const abajo = px(Math.min(open, close))
  const cuerpo = Math.max(abajo - arriba, 1.5)            // una vela que no se movió igual se ve como una raya
  const ancho = Math.max(Math.min(width * 0.7, 18), 3)
  const centro = x + width / 2
  const color = colorDe(payload)
  return (
    <g opacity={payload.parcial ? 0.8 : 1}>
      <line x1={centro} x2={centro} y1={y} y2={y + Math.max(height, 0)} stroke={color} strokeWidth={1.5} />
      <rect x={centro - ancho / 2} y={arriba} width={ancho} height={cuerpo} fill={payload.parcial ? 'none' : color}
        stroke={color} strokeWidth={payload.parcial ? 1.5 : 1} strokeDasharray={payload.parcial ? '3 2' : undefined} rx={1} />
    </g>
  )
}

function Puente({ active, payload, onVela }) {
  const vela = active && payload?.length ? payload[0].payload : null
  useEffect(() => { onVela(vela) }, [vela?.fecha])
  return null
}

// `patrones`: los de velas (se marcan arriba de la vela donde terminan). `figuras` y `media` (media de 7 días) son
// las figuras chartistas y la línea sobre la que se buscaron: van solo en las velas por día.
export default function VelasChart({ velas, formatoEje, formatoFecha, hitos = [], lector, patrones = [], figuras = [], media = null }) {
  const [señalada, setSeñalada] = useState(null)
  const mediaPorFecha = Object.fromEntries((media || []).map((m) => [m.fecha, m.valor]))
  const datos = velas.map((v) => ({ ...v, rango: [v.low, v.high], media: mediaPorFecha[v.fecha] ?? null }))
  const fechas = new Set(datos.map((v) => v.fecha))
  const etiquetas = {}
  for (const p of patrones) {
    if (!fechas.has(p.fecha) || !CORTO[p.nombre]) continue
    etiquetas[p.fecha] = [...(etiquetas[p.fecha] || []), CORTO[p.nombre]]
  }
  const actual = señalada || datos[datos.length - 1]

  return (
    <div>
      {lector(actual, !!señalada)}
      <div role="img" aria-label="Gráfico de velas">
      <ResponsiveContainer width="100%" height={290}>
        <ComposedChart data={datos} margin={{ top: 30, right: 16, left: 4, bottom: 4 }} barCategoryGap="20%">
          <CartesianGrid stroke="var(--gray-line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="fecha" tickFormatter={formatoFecha} tick={{ fontSize: 12, fill: 'var(--gray-muted)' }} stroke="var(--gray-line)" minTickGap={8} />
          <YAxis tickFormatter={formatoEje} tick={{ fontSize: 12, fill: 'var(--gray-muted)' }} stroke="var(--gray-line)" width={56} domain={['auto', 'auto']} />
          <Tooltip content={<Puente onVela={setSeñalada} />} cursor={{ fill: 'var(--gray-line)', opacity: 0.35 }} isAnimationActive={false} />
          {hitos.filter((h) => fechas.has(h.fecha)).map((h) => (
            <ReferenceLine key={h.fecha} x={h.fecha} stroke="var(--charcoal)" strokeWidth={1.5} strokeDasharray="5 4"
              label={{ value: '⚑', position: 'top', fill: 'var(--charcoal)', fontSize: 12 }} />
          ))}
          <Bar dataKey="rango" shape={<Vela />} isAnimationActive={false} />
          {media && (
            <Line dataKey="media" stroke="var(--charcoal)" strokeWidth={1.5} strokeDasharray="2 3" dot={false} activeDot={false}
              connectNulls isAnimationActive={false} name="Media 7 días" />
          )}
          {figuras.flatMap((f, i) => [
            // el nombre de la figura va en la lista de abajo del gráfico: arriba de la línea se mezclaba con las velas
            ...f.lineas.filter((l) => fechas.has(l.desde.fecha) && fechas.has(l.hasta.fecha)).map((l, j) => (
              <ReferenceLine key={`f${i}l${j}`} ifOverflow="extendDomain" stroke={colorFigura(f)} strokeWidth={2} strokeDasharray="6 3"
                segment={[{ x: l.desde.fecha, y: l.desde.valor }, { x: l.hasta.fecha, y: l.hasta.valor }]} />
            )),
            ...f.puntos.filter((p) => fechas.has(p.fecha)).map((p, j) => (
              <ReferenceDot key={`f${i}p${j}`} x={p.fecha} y={p.valor} r={4} fill={colorFigura(f)} stroke="var(--card-bg)" ifOverflow="extendDomain"
                label={ROL_CORTO[p.rol] ? { value: ROL_CORTO[p.rol], position: 'top', fill: colorFigura(f), fontSize: 11, fontWeight: 700 } : undefined} />
            )),
          ])}
          {datos.filter((v) => etiquetas[v.fecha]).map((v) => (
            <ReferenceDot key={`e${v.fecha}`} x={v.fecha} y={v.high} r={0} ifOverflow="extendDomain"
              label={{ value: etiquetas[v.fecha].join(' · '), position: 'top', fill: 'var(--charcoal)', fontSize: 10, fontWeight: 600 }} />
          ))}
        </ComposedChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}

export { colorDe }
