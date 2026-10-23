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
const PIEL = '#E3A97E'
const CAMPERA = '#4F7DAF' // buzo polar azul acero de medio cierre
const CHOMBA = '#1F3F8F' // cuello de la chomba que asoma

const CEJAS = {
  llorando: 'M-10.5,-4.5 Q-7,-5.5 -2.5,-9 M2.5,-9 Q7,-5.5 10.5,-4.5',
  triste: 'M-10,-5 Q-6.5,-5.5 -2.5,-7.8 M2.5,-7.8 Q6.5,-5.5 10,-5',
  neutral: 'M-10,-6 Q-6,-6.8 -2.5,-6 M2.5,-6 Q6,-6.8 10,-6',
  contento: 'M-10,-6 Q-6,-8.5 -2.5,-6.5 M2.5,-6.5 Q6,-8.5 10,-6',
  euforico: 'M-10,-7.5 Q-6,-11 -2.5,-8 M2.5,-8 Q6,-11 10,-7.5',
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
  return (
    <g>
      <path d="M-8,9.5 Q0,17 8,9.5 Q0,12 -8,9.5 Z" fill="#fff" stroke="#6B3A2A" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M-7.5,10.4 Q0,12.6 7.5,10.4" stroke="#D9D2CC" strokeWidth="0.6" fill="none" />
    </g>
  )
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
  const caido = animo === 'triste'
  return (
    <g>
      {[-6, 6].map((ex) => (
        <g key={ex}>
          <ellipse cx={ex} cy="-0.8" rx="2.9" ry={caido ? 1.3 : 1.8} fill="#fff" stroke="#6B3A2A" strokeWidth="0.5" />
          <circle cx={ex + 0.2} cy="-0.7" r="1.4" fill="#5A3B26" />
          <circle cx={ex + 0.2} cy="-0.7" r="0.55" fill="#1D1D1D" />
          <path d={caido ? `M${ex - 3},-0.9 Q${ex},-2.4 ${ex + 3},-1.3` : `M${ex - 3},-1.4 Q${ex},-3.2 ${ex + 3},-1.4`} stroke={T} strokeWidth="0.9" fill="none" strokeLinecap="round" />
        </g>
      ))}
    </g>
  )
}

function Aldo({ x, y, s = 1, animo = 'contento', lentes = false, mano = [36, 42], parado = false, volante = false }) {
  const sonrie = animo === 'contento' || animo === 'euforico'
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      {parado && (
        <g stroke={T} strokeWidth="1.5">
          <path d="M-20,56 L-18,100 L-4,100 L-2,60 L2,60 L4,100 L18,100 L20,56 Z" fill="#5E645F" />
          <rect x="-19" y="74" width="7" height="9" rx="1.5" fill="#545A55" />
          <rect x="12" y="74" width="7" height="9" rx="1.5" fill="#545A55" />
          <path d="M-21,100 L-3,100 L-2,107 L-25,107 Q-26,102 -21,100 Z" fill="#F4F4F4" />
          <path d="M3,100 L21,100 Q26,102 25,107 L2,107 Z" fill="#F4F4F4" />
          <path d="M-14,42 Q-38,50 -40,62" stroke={CAMPERA} strokeWidth="9" strokeLinecap="round" fill="none" />
          <path d="M-40,66 Q-46,60 -42,56 Q-36,58 -36,64 Z" fill={PIEL} strokeWidth="1.2" />
        </g>
      )}
      <rect x="-5" y="12" width="10" height="9" fill={PIEL} stroke={T} strokeWidth="1.2" />
      {/* buzo celeste de medio cierre con banda azul abajo */}
      <path d="M-24,60 Q-26,26 -10,19 L10,19 Q26,26 24,60 Z" fill={CAMPERA} stroke={T} strokeWidth="1.5" />
      <path d="M-4,19.5 L0,26 L4,19.5 L2,18 L0,21 L-2,18 Z" fill={CHOMBA} stroke={T} strokeWidth="0.8" />
      <path d="M-9,19.5 L-8,13 Q0,16.5 8,13 L9,19.5 Q4,22 0,21.5 Q-4,22 -9,19.5 Z" fill={CAMPERA} stroke={T} strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M0,22 L0,36" stroke="#E8EEF5" strokeWidth="1.5" />
      <rect x="-1.2" y="34" width="2.4" height="3.5" rx="1" fill="#E8EEF5" />
      <g stroke="#B5262B" strokeWidth="1.2" fill="#2A2A2A" fillOpacity="0.35">
        <path d="M-0.5,27 L3,31" fill="none" />
        <rect x="1.5" y="30.5" width="5" height="3.5" rx="1.2" transform="rotate(35 4 32)" />
        <rect x="4.5" y="35" width="5" height="3.5" rx="1.2" transform="rotate(35 7 36.7)" />
      </g>
      {volante && (
        <ellipse cx={mano[0] + 2} cy={mano[1] + 2} rx="3.5" ry="11" fill="none" stroke="#222" strokeWidth="2.6" transform={`rotate(-18 ${mano[0] + 2} ${mano[1] + 2})`} />
      )}
      <path d={`M14,24 Q${(14 + mano[0]) / 2 + 6},${(24 + mano[1]) / 2 - 2} ${mano[0]},${mano[1]}`} stroke={CAMPERA} strokeWidth="9" strokeLinecap="round" fill="none" />
      <circle cx={mano[0]} cy={mano[1]} r="5" fill={PIEL} stroke={T} strokeWidth="1.2" />
      {volante && <circle cx={mano[0] + 3} cy={mano[1] + 9} r="4.5" fill={PIEL} stroke={T} strokeWidth="1.2" />}
      {/* cabeza: cara larga, mandíbula cuadrada */}
      <ellipse cx="-14.5" cy="1" rx="3.8" ry="5.5" fill={PIEL} stroke={T} strokeWidth="1.2" />
      <ellipse cx="14.5" cy="1" rx="3.8" ry="5.5" fill={PIEL} stroke={T} strokeWidth="1.2" />
      <path d="M-14.5,-4 Q-15,-17 0,-19.5 Q15,-17 14.5,-4 L13.8,6 Q12.5,15.5 6.5,19 Q0,21.5 -6.5,19 Q-12.5,15.5 -13.8,6 Z" fill={PIEL} stroke={T} strokeWidth="1.5" strokeLinejoin="round" />
      {/* pelo gris, frente alta con entradas, peinado para atrás */}
      {/* pelado arriba (con brillo); pelo gris corto a los costados y atrás */}
      {/* mechones grises a los costados, sobre las orejas (estilo pelado de dibujito) */}
      <path d="M-13,-10 Q-16.5,-10.5 -17.2,-6.8 Q-19,-4.6 -17.6,-2 Q-18.6,0.6 -16,1.9 Q-14.6,2.6 -13.5,1.4 Q-12.6,-4 -13,-10 Z" fill="#A3A3A6" stroke="#7A7A7D" strokeWidth="0.8" strokeLinejoin="round" />
      <path d="M13,-10 Q16.5,-10.5 17.2,-6.8 Q19,-4.6 17.6,-2 Q18.6,0.6 16,1.9 Q14.6,2.6 13.5,1.4 Q12.6,-4 13,-10 Z" fill="#A3A3A6" stroke="#7A7A7D" strokeWidth="0.8" strokeLinejoin="round" />
      <ellipse cx="-4" cy="-14.5" rx="5" ry="2.2" fill="#fff" opacity="0.35" transform="rotate(-15 -4 -14.5)" />
      <path d={CEJAS[animo] || CEJAS.contento} stroke="#6E6A66" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      {lentes && (
        <g>
          <rect x="-11.5" y="-4.5" width="9.5" height="6.5" rx="2.5" fill="#111" />
          <rect x="2" y="-4.5" width="9.5" height="6.5" rx="2.5" fill="#111" />
          <path d="M-2,-2 L2,-2" stroke="#111" strokeWidth="1.5" />
          <path d="M-9.5,-3 L-6.5,-3" stroke="#fff" strokeWidth="1" opacity="0.6" />
        </g>
      )}
      {!lentes && <Ojos animo={animo} />}
      <path d="M0.8,-3 L2.8,5.2 Q1.2,7.2 -1.8,6.4" stroke="#B27A55" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {sonrie && <path d="M-6.5,4.5 Q-9.5,8.5 -8,12 M6.5,4.5 Q9.5,8.5 8,12" stroke="#C9926C" strokeWidth="0.9" fill="none" strokeLinecap="round" />}
      <circle cx="-9" cy="6" r="2.8" fill="#E39A80" opacity="0.4" />
      <circle cx="9" cy="6" r="2.8" fill="#E39A80" opacity="0.4" />
      <Boca animo={animo} />
      {parado && (
        <g stroke={T} strokeWidth="1.2">
          {/* bolsillos del pantalón dados vuelta */}
          <path d="M-20,60 L-12,60 L-14,72 Q-18,74 -20,70 Z" fill="#F4F4F4" />
          <path d="M12,60 L20,60 L20,70 Q18,74 14,72 Z" fill="#F4F4F4" />
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
  // Sedán compacto: capot alto y corto, techo en arco, baúl corto y alto, tres vidrios laterales.
  return (
    <Auto
      id="cronos"
      color="#8D9298"
      cuerpo="M32,178 L30,146 Q30,132 40,128 L80,124 L118,99 Q160,88 204,95 L240,124 L288,131 Q308,135 311,146 L312,170 Q311,178 302,178 Z"
      vidrio="M90,123 L120,103 Q158,93 202,99 L230,123 Z"
      cintura={124}
      aldo={<Aldo x={194} y={103} s={1.05} animo="neutral" volante mano={[20, 16]} />}
      extras={<g stroke={T} strokeWidth="1.2">
        <path d="M172,95 L172,123" strokeWidth="3.5" />
        <path d="M106,123 L114,104" strokeWidth="2.5" />
        <path d="M88,124 L232,124" stroke="#D8DADC" strokeWidth="1.6" />
        <path d="M172,124 L172,170 M112,126 Q108,150 112,170 M238,125 Q228,150 230,170" fill="none" opacity="0.55" />
        <path d="M58,150 Q180,144 302,146" stroke="#B4B9BE" strokeWidth="1.4" fill="none" />
        <rect x="146" y="133" width="12" height="3" rx="1.5" fill="#5E6268" />
        <rect x="208" y="132" width="12" height="3" rx="1.5" fill="#5E6268" />
        <path d="M228,120 L240,118 L242,125 L232,126 Z" fill="#3A3D42" />
        <path d="M286,133 L306,137 Q309,140 308,142 L290,139 Z" fill="#EAF2F8" />
        <path d="M306,147 L312,148 L312,156 L306,155 Z" fill="#2B2B2B" />
        <path d="M30,134 L46,131 L46,139 L30,141 Z" fill="#D63A3A" />
        <path d="M32,166 L84,166 M282,166 L312,166" stroke="#3A3D42" strokeWidth="3" />
      </g>}
      ruedas={[[95, 176, 20], [258, 176, 20]]}
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
      aldo={<Aldo x={214} y={98} s={1.1} animo="contento" volante mano={[20, 18]} />}
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
        aldo={<Aldo x={192} y={114} s={1.05} animo="euforico" lentes volante mano={[20, 16]} />}
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
  const Escena = ESCENAS[nivel.key]

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
    </div>
  )
}
