import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts'

// Gráfico de velas tipo TradingView. Las velas vienen armadas del backend (open/high/low/close por día o por semana).
// Verde: cerró más arriba que donde abrió. Roja: cerró más abajo. Gris: quedó igual. La vela del día o la semana en
// curso va hueca y gris: todavía se puede mover, así que no se pinta como si hubiera subido o bajado.

const VERDE = 'var(--ok)'
const ROJA = 'var(--alerta)'
const NEUTRA = 'var(--gray-muted)'

const colorDe = (v) => (v.parcial ? NEUTRA : v.close > v.open ? VERDE : v.close < v.open ? ROJA : NEUTRA)

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

export default function VelasChart({ velas, formatoEje, formatoFecha, hitos = [], lector }) {
  const [señalada, setSeñalada] = useState(null)
  const datos = velas.map((v) => ({ ...v, rango: [v.low, v.high] }))
  const fechas = new Set(datos.map((v) => v.fecha))
  const actual = señalada || datos[datos.length - 1]

  return (
    <div>
      {lector(actual, !!señalada)}
      <div role="img" aria-label="Gráfico de velas">
      <ResponsiveContainer width="100%" height={290}>
        <BarChart data={datos} margin={{ top: 22, right: 16, left: 4, bottom: 4 }} barCategoryGap="20%">
          <CartesianGrid stroke="var(--gray-line)" strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="fecha" tickFormatter={formatoFecha} tick={{ fontSize: 12, fill: 'var(--gray-muted)' }} stroke="var(--gray-line)" minTickGap={8} />
          <YAxis tickFormatter={formatoEje} tick={{ fontSize: 12, fill: 'var(--gray-muted)' }} stroke="var(--gray-line)" width={56} domain={['auto', 'auto']} />
          <Tooltip content={<Puente onVela={setSeñalada} />} cursor={{ fill: 'var(--gray-line)', opacity: 0.35 }} isAnimationActive={false} />
          {hitos.filter((h) => fechas.has(h.fecha)).map((h) => (
            <ReferenceLine key={h.fecha} x={h.fecha} stroke="var(--charcoal)" strokeWidth={1.5} strokeDasharray="5 4"
              label={{ value: '⚑', position: 'top', fill: 'var(--charcoal)', fontSize: 12 }} />
          ))}
          <Bar dataKey="rango" shape={<Vela />} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
      </div>
    </div>
  )
}

export { colorDe }
