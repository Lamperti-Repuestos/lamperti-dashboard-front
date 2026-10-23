// Aldo manejando según el ticket promedio del día. Mismo personaje en los 4 niveles
// (cara, pelo canoso, campera azul como en los stickers de Lamperti); solo cambia el vehículo.
// Para probar un nivel sin esperar ventas: agregar ?aldo=32000 a la URL.

const NIVELES = [
  { key: 'pata', desde: 0, titulo: '¡A PATA!', vehiculo: 'a pie y sin un peso' },
  { key: 'carreta', desde: 15000, titulo: '¡A LA ANTIGUA!', vehiculo: 'Carreta con caballos' },
  { key: 'cronos', desde: 25001, titulo: '¡ALGO ES ALGO!', vehiculo: 'Fiat Cronos' },
  { key: 'gla', desde: 30001, titulo: '¡ALGÚN DÍA LLEGÓ!', vehiculo: 'Mercedes-Benz GLA 200' },
  { key: 'bugatti', desde: 35001, titulo: '¡A OTRO NIVEL!', vehiculo: 'Bugatti Tourbillon' },
]

export function nivelPorTicket(ticket) {
  const t = Math.round(Number(ticket) || 0)
  let idx = 0
  NIVELES.forEach((n, i) => { if (t >= n.desde) idx = i })
  return idx
}

const T = '#3A2A22' // trazo
const PIEL = '#F2C6A0'
const CAMPERA = '#2E5E9E'

const CEJAS = {
  llorando: 'M-11,-5 Q-7,-6 -2,-10 M2,-10 Q7,-6 11,-5',
  triste: 'M-10,-5 Q-6,-6 -2,-8.5 M2,-8.5 Q6,-6 10,-5',
  neutral: 'M-10,-6.5 L-2,-6.5 M2,-6.5 L10,-6.5',
  contento: 'M-10,-6 Q-6,-9 -2,-6 M2,-6 Q6,-9 10,-6',
  euforico: 'M-10,-8 Q-6,-12 -2,-8 M2,-8 Q6,-12 10,-8',
}

function Boca({ animo }) {
  if (animo === 'llorando') return <path d="M-6,14 Q0,5 6,14 Z" fill="#5A1E1E" stroke="#6B3A2A" strokeWidth="1.5" strokeLinejoin="round" />
  if (animo === 'triste') return <path d="M-6,12.5 Q0,8 6,12.5" stroke="#6B3A2A" strokeWidth="1.8" fill="none" strokeLinecap="round" />
  if (animo === 'neutral') return <path d="M-5,11 L5,11" stroke="#6B3A2A" strokeWidth="1.8" strokeLinecap="round" />
  if (animo === 'euforico') return (
    <g>
      <path d="M-8,8 Q0,20 8,8 Z" fill="#5A1E1E" stroke="#6B3A2A" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M-7,8.5 L7,8.5 L6,10.5 L-6,10.5 Z" fill="#fff" />
    </g>
  )
  return <path d="M-7,10 Q0,15.5 7,10 Q0,12.5 -7,10 Z" fill="#fff" stroke="#6B3A2A" strokeWidth="1.5" strokeLinejoin="round" />
}

function Ojos({ animo }) {
  if (animo === 'llorando') return (
    <g>
      <path d="M-9,-1 Q-6,-3 -3,-1 M3,-1 Q6,-3 9,-1" stroke="#2B2B2B" strokeWidth="1.8" fill="none" strokeLinecap="round" />
      <path d="M-7,1 Q-9,8 -7,15 Q-5,8 -6,1 Z M7,1 Q9,8 7,15 Q5,8 6,1 Z" fill="#6EC1F0" stroke="#2F8FCB" strokeWidth="0.8" />
      <circle cx="-12" cy="17" r="1.8" fill="#6EC1F0" />
      <circle cx="13" cy="19" r="1.5" fill="#6EC1F0" />
    </g>
  )
  return (
    <g>
      <ellipse cx="-6" cy="-1" rx="1.8" ry={animo === 'triste' ? 1.6 : 2.2} fill="#2B2B2B" />
      <ellipse cx="6" cy="-1" rx="1.8" ry={animo === 'triste' ? 1.6 : 2.2} fill="#2B2B2B" />
      {animo === 'triste' && <path d="M-8.5,-2.5 L-3.5,-2.5 M3.5,-2.5 L8.5,-2.5" stroke="#B88A6A" strokeWidth="1" />}
    </g>
  )
}

function Aldo({ x, y, s = 1, animo = 'contento', lentes = false, mano = [36, 42], parado = false }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {parado && (
        <g stroke={T} strokeWidth="1.5">
          <path d="M-20,56 L-18,100 L-4,100 L-2,60 L2,60 L4,100 L18,100 L20,56 Z" fill="#244C82" />
          <path d="M-16,62 L-15,98 M16,62 L15,98" stroke="#8DB8E8" strokeWidth="2.5" />
          <path d="M-21,100 L-3,100 L-2,107 L-25,107 Q-26,102 -21,100 Z" fill="#F4F4F4" />
          <path d="M3,100 L21,100 Q26,102 25,107 L2,107 Z" fill="#F4F4F4" />
                    <path d="M-14,42 Q-38,50 -40,62" stroke={CAMPERA} strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M-40,66 Q-46,60 -42,56 Q-36,58 -36,64 Z" fill={PIEL} strokeWidth="1.2" />
        </g>
      )}
      <rect x="-5" y="10" width="10" height="10" fill={PIEL} stroke={T} strokeWidth="1.2" />
      <path d="M-24,60 Q-26,24 -10,17 L10,17 Q26,24 24,60 Z" fill={CAMPERA} stroke={T} strokeWidth="1.5" />
      <path d="M-20,26 L-22,60 M20,26 L22,60" stroke="#8DB8E8" strokeWidth="3" />
      <path d="M-8,17 L0,27 L8,17 Z" fill="#244C82" stroke={T} strokeWidth="1.2" />
      <path d="M0,27 L0,60" stroke="#D8E6F5" strokeWidth="1.5" />
      <path d={`M14,24 Q${(14 + mano[0]) / 2 + 6},${(24 + mano[1]) / 2 - 2} ${mano[0]},${mano[1]}`} stroke={CAMPERA} strokeWidth="9" strokeLinecap="round" fill="none" />
      <circle cx={mano[0]} cy={mano[1]} r="5" fill={PIEL} stroke={T} strokeWidth="1.2" />
      {/* cabeza */}
      <ellipse cx="-15" cy="2" rx="4" ry="5.5" fill={PIEL} stroke={T} strokeWidth="1.2" />
      <ellipse cx="15" cy="2" rx="4" ry="5.5" fill={PIEL} stroke={T} strokeWidth="1.2" />
      <ellipse cx="0" cy="0" rx="15" ry="18.5" fill={PIEL} stroke={T} strokeWidth="1.5" />
      {/* pelo canoso corto, pegado al cráneo, con flequillo cortito */}
      <path d="M-14.8,-3 C-16,-12 -10,-20 0,-19.8 C10,-20 16,-12 14.8,-3 L13.2,-5 Q12.5,-9 10,-11 L8,-10.2 L6.5,-12 L4,-11 L2,-12.6 L-0.5,-11.2 L-3,-12.6 L-5.5,-11 L-7.5,-12 L-9.5,-10.4 Q-12.5,-9 -13.2,-5 Z" fill="#D2D3D5" stroke="#A3A4A7" strokeWidth="0.7" strokeLinejoin="round" />
      <path d="M-7,-16.5 L-5.5,-14 M-2,-17.5 L-1,-14.5 M3,-17.5 L3.5,-14.5 M8,-16 L8.5,-13.5" stroke="#B4B5B8" strokeWidth="0.8" strokeLinecap="round" />
      <path d={CEJAS[animo] || CEJAS.contento} stroke="#6F6A66" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {lentes && (
        <g>
          <rect x="-11.5" y="-4.5" width="9.5" height="6.5" rx="2.5" fill="#111" />
          <rect x="2" y="-4.5" width="9.5" height="6.5" rx="2.5" fill="#111" />
          <path d="M-2,-2 L2,-2" stroke="#111" strokeWidth="1.5" />
          <path d="M-9.5,-3 L-6.5,-3" stroke="#fff" strokeWidth="1" opacity="0.6" />
        </g>
      )}
      {!lentes && <Ojos animo={animo} />}
      <path d="M0,-1 Q3.5,6 -1,7" stroke="#B07A55" strokeWidth="1.3" fill="none" strokeLinecap="round" />
      <circle cx="-9" cy="6" r="3" fill="#E9A38A" opacity="0.5" />
      <circle cx="9" cy="6" r="3" fill="#E9A38A" opacity="0.5" />
      <Boca animo={animo} />
      {parado && (
        <g stroke={T} strokeWidth="1.2">
          {/* bolsillos de la campera dados vuelta */}
          <path d="M-22,48 L-12,48 L-15,60 Q-19,62 -22,58 Z" fill="#F4F4F4" />
          <path d="M12,48 L22,48 L22,58 Q19,62 15,60 Z" fill="#F4F4F4" />
        </g>
      )}
    </g>
  )
}

function APata() {
  return (
    <g>
      <rect x="40" y="194" width="260" height="8" rx="4" fill="#9AA0A6" stroke={T} strokeWidth="1.2" />
      <Aldo x={170} y={66} s={1.2} animo="llorando" parado mano={[40, 62]} />
      {/* polilla saliendo del bolsillo */}
      <g transform="translate(222 128)" stroke={T} strokeWidth="1">
        <ellipse cx="0" cy="0" rx="2.5" ry="4" fill="#8A7A66" />
        <path d="M0,-1 Q-9,-10 -10,-1 Q-6,3 0,0 M0,-1 Q9,-10 10,-1 Q6,3 0,0" fill="#C9BBA6" />
      </g>
      <path d="M228,120 q4,-4 8,0 q4,4 8,0" stroke="#9AA0A6" strokeWidth="1.2" fill="none" strokeDasharray="2 2" />
    </g>
  )
}

function Rueda({ cx, cy, r, llanta = '#9AA0A6', rayos = 5 }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill="#1E1E1E" stroke={T} strokeWidth="1.5" />
      <circle cx={cx} cy={cy} r={r * 0.58} fill={llanta} stroke="#555" strokeWidth="1" />
      {Array.from({ length: rayos }, (_, i) => {
        const a = (i * 2 * Math.PI) / rayos
        return <line key={i} x1={cx} y1={cy} x2={cx + Math.cos(a) * r * 0.55} y2={cy + Math.sin(a) * r * 0.55} stroke="#555" strokeWidth="2" />
      })}
      <circle cx={cx} cy={cy} r={r * 0.14} fill="#444" />
    </g>
  )
}

function Caballo({ ox, oy = 0, color }) {
  return (
    <g transform={`translate(${ox} ${oy})`} stroke={T} strokeWidth="1.3">
      <path d="M10,140 Q-2,150 2,168" stroke="#3B2614" strokeWidth="5" fill="none" strokeLinecap="round" />
      {[18, 28, 58, 68].map((lx) => (
        <g key={lx}>
          <rect x={lx} y="150" width="7" height="36" fill={color} />
          <rect x={lx - 1} y="184" width="9" height="5" fill="#2B2B2B" />
        </g>
      ))}
      <ellipse cx="44" cy="146" rx="34" ry="16" fill={color} />
      <path d="M62,140 L76,136 L92,108 L80,104 Z" fill={color} />
      <path d="M78,104 Q70,118 62,138" stroke="#3B2614" strokeWidth="4" fill="none" />
      <ellipse cx="94" cy="114" rx="14" ry="7" fill={color} transform="rotate(35 94 114)" />
      <path d="M84,104 L86,96 L90,104 Z" fill={color} />
      <circle cx="90" cy="110" r="1.6" fill="#111" stroke="none" />
    </g>
  )
}

function Carreta() {
  return (
    <g>
      <rect x="0" y="188" width="340" height="10" rx="5" fill="#C9A36A" stroke={T} strokeWidth="1.2" />
      <Caballo ox={186} oy={-4} color="#6B4423" />
      <Caballo ox={200} color="#8B5A2B" />
      <path d="M160,150 L222,148" stroke="#5A3A1E" strokeWidth="5" strokeLinecap="round" />
      <Aldo x={138} y={88} s={1.2} animo="triste" mano={[38, 34]} />
      <rect x="40" y="124" width="124" height="38" rx="3" fill="#A0703C" stroke={T} strokeWidth="1.5" />
      <path d="M40,136 L164,136 M40,149 L164,149" stroke="#7A5228" strokeWidth="1.2" />
      <Rueda cx={100} cy={164} r={26} llanta="#C49A64" rayos={8} />
      <path d="M182,132 Q230,150 288,112" stroke="#3B2614" strokeWidth="1.5" fill="none" />
    </g>
  )
}

// Auto genérico visto de costado: carrocería, vidrio con Aldo adentro y ruedas.
function Auto({ id, cuerpo, vidrio, color, aldo, ruedas, extras, cintura, suelo = 192 }) {
  return (
    <g>
      <rect x="0" y={suelo} width="340" height="8" rx="4" fill="#5B5F66" stroke={T} strokeWidth="1.2" />
      <path d={`M30,${suelo + 4} L60,${suelo + 4} M110,${suelo + 4} L140,${suelo + 4} M190,${suelo + 4} L220,${suelo + 4} M270,${suelo + 4} L300,${suelo + 4}`} stroke="#E8E8E8" strokeWidth="1.5" />
      <defs>
        <clipPath id={`aldo-vidrio-${id}`}><rect x="0" y="0" width="340" height={cintura} /></clipPath>
      </defs>
      <path d={cuerpo} fill={color} stroke={T} strokeWidth="1.8" strokeLinejoin="round" />
      <path d={vidrio} fill="#CFE8F5" stroke={T} strokeWidth="1.5" />
      <g clipPath={`url(#aldo-vidrio-${id})`}>{aldo}</g>
      {extras}
      {ruedas.map(([cx, cy, r], i) => <Rueda key={i} cx={cx} cy={cy} r={r} />)}
    </g>
  )
}

function Cronos() {
  return (
    <Auto
      id="cronos"
      color="#C8102E"
      cuerpo="M30,172 L30,152 Q32,140 50,136 L96,131 L130,106 Q140,99 160,99 L214,99 Q232,99 246,112 L266,130 L296,136 Q312,140 312,154 L312,172 Z"
      vidrio="M104,130 L134,108 Q142,103 158,103 L211,103 Q227,103 239,114 L256,130 Z"
      cintura={131}
      aldo={<Aldo x={214} y={104} s={1.25} animo="neutral" mano={[30, 26]} />}
      extras={<g stroke={T} strokeWidth="1.2">
        <path d="M182,103 L180,130" strokeWidth="3" />
        <path d="M120,134 L118,170 M200,134 L198,170" fill="none" opacity="0.6" />
        <rect x="160" y="140" width="14" height="3" rx="1.5" fill="#7A0A1C" />
        <path d="M296,140 L310,144 L310,150 L298,148 Z" fill="#FFF4C2" />
        <path d="M30,146 L40,144 L40,152 L30,152 Z" fill="#FF5A5A" />
        <path d="M30,160 L312,160" stroke="#8E0B21" strokeWidth="1" />
      </g>}
      ruedas={[[86, 172, 20], [256, 172, 20]]}
    />
  )
}

function Gla() {
  return (
    <Auto
      id="gla"
      color="#C0C4C8"
      cuerpo="M28,174 L28,148 Q30,134 48,130 L90,125 L120,95 Q128,87 146,87 L232,87 Q250,87 260,101 L276,123 L298,129 Q314,133 314,150 L314,174 Z"
      vidrio="M98,124 L124,97 Q131,91 147,91 L229,91 Q244,91 252,103 L267,124 Z"
      cintura={125}
      aldo={<Aldo x={222} y={96} s={1.25} animo="contento" mano={[30, 26]} />}
      extras={<g stroke={T} strokeWidth="1.2">
        <path d="M190,91 L188,124" strokeWidth="3" />
        <path d="M28,166 L314,166 L314,174 L28,174 Z" fill="#3A3D42" />
        <rect x="170" y="138" width="14" height="3" rx="1.5" fill="#888" />
        <path d="M298,134 L312,138 L312,144 L300,142 Z" fill="#E8F4FF" />
        <path d="M28,144 L38,142 L38,150 L28,150 Z" fill="#FF5A5A" />
      </g>}
      ruedas={[[90, 174, 22], [256, 174, 22]]}
    />
  )
}

function Bugatti() {
  return (
    <g>
      <defs>
        <linearGradient id="aldo-bicolor" x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#141414" />
          <stop offset="0.46" stopColor="#141414" />
          <stop offset="0.46" stopColor="#1E4FA3" />
          <stop offset="1" stopColor="#1E4FA3" />
        </linearGradient>
      </defs>
      <path d="M0,140 L22,140 M4,152 L20,152 M0,164 L18,164" stroke="#9AA0A6" strokeWidth="2.5" strokeLinecap="round" />
      <Auto
        id="bugatti"
        color="url(#aldo-bicolor)"
        cuerpo="M26,176 L28,160 Q32,150 62,146 L122,138 Q152,118 186,114 Q216,112 240,124 L290,142 Q318,148 318,164 L316,176 Z"
        vidrio="M146,137 Q164,122 187,119 Q211,117 232,128 L240,137 Z"
        cintura={138}
        aldo={<Aldo x={196} y={110} s={1.25} animo="euforico" lentes mano={[30, 26]} />}
        extras={<g stroke={T} strokeWidth="1.2">
          <path d="M126,172 Q104,152 134,146 L178,146" stroke="#C9CDD2" strokeWidth="3" fill="none" />
          <path d="M30,140 L66,140 L62,146 L28,148 Z" fill="#141414" />
          <path d="M292,148 L314,154 L314,158 L296,156 Z" fill="#E8F4FF" />
          <path d="M28,162 L46,162" stroke="#FF3B3B" strokeWidth="2.5" />
        </g>}
        ruedas={[[82, 176, 20], [262, 176, 20]]}
      />
    </g>
  )
}

const ESCENAS = { pata: APata, carreta: Carreta, cronos: Cronos, gla: Gla, bugatti: Bugatti }

export default function AldoAvatar({ ticket }) {
  let valor = ticket
  try {
    const forzado = new URLSearchParams(window.location.search).get('aldo')
    if (forzado) valor = Number(forzado)
  } catch { /* sin URL, sigue con el ticket real */ }

  const idx = nivelPorTicket(valor)
  const nivel = NIVELES[idx]
  const siguiente = NIVELES[idx + 1]
  const Escena = ESCENAS[nivel.key]
  const pesos = (n) => `$${Math.round(n).toLocaleString('es-AR')}`

  return (
    <div className="aldo-avatar" key={nivel.key}>
      <svg viewBox="0 0 340 240" role="img" aria-label={`Aldo manejando: ${nivel.vehiculo}`} style={{ width: '100%', maxWidth: 280, display: 'block', margin: '0 auto' }}>
        <defs>
          <filter id="aldo-sticker" x="-8%" y="-8%" width="116%" height="116%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="4" result="grueso" />
            <feGaussianBlur in="grueso" stdDeviation="3" result="difuso" />
            <feOffset in="difuso" dx="0" dy="3" result="corrida" />
            <feFlood floodColor="#000" floodOpacity="0.25" />
            <feComposite in2="corrida" operator="in" result="sombra" />
            <feFlood floodColor="#fff" />
            <feComposite in2="grueso" operator="in" result="borde" />
            <feMerge>
              <feMergeNode in="sombra" />
              <feMergeNode in="borde" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <path id="aldo-arco" d="M40,58 A140,52 0 0 1 300,58" />
        </defs>
        <text fontFamily="'Arial Black', 'Arial', sans-serif" fontWeight="900" fontSize="22" fill="#FFD21F" stroke="#1F3A1F" strokeWidth="5" paintOrder="stroke" strokeLinejoin="round" textAnchor="middle">
          <textPath href="#aldo-arco" startOffset="50%">{nivel.titulo}</textPath>
        </text>
        <g filter="url(#aldo-sticker)" className="aldo-escena">
          <Escena />
        </g>
        <text x="170" y="232" fontFamily="'Arial Black', 'Arial', sans-serif" fontWeight="900" fontSize="26" fill="#FFD21F" stroke="#2B2B2B" strokeWidth="5" paintOrder="stroke" strokeLinejoin="round" textAnchor="middle">Lamperti</text>
      </svg>
      <div style={{ fontSize: 12, color: 'var(--gray-muted)', marginTop: 2 }}>
        Aldo en <strong style={{ color: 'var(--charcoal)' }}>{nivel.vehiculo}</strong>
        {siguiente
          ? <> · próximo: {siguiente.vehiculo} desde {pesos(siguiente.desde)} de ticket (faltan {pesos(siguiente.desde - Math.round(valor || 0))})</>
          : <> · tope de gama, no hay nada más arriba</>}
      </div>
    </div>
  )
}
