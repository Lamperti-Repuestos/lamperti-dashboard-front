import { useEffect, useRef, useState } from 'react'

const ANCHO = 340
const ALTO = 480
const GRAVEDAD = 0.45
const IMPULSO = -7.5
const VELOCIDAD = 2.3
const GAP = 140
const ANCHO_CONO = 46
const ESPACIO_ENTRE_COLUMNAS = 210
const AUTO_X = ANCHO / 2 - 24
const AUTO_ANCHO = 30
const AUTO_ALTO = 26

function dibujarCono(ctx, x, y, w, h) {
  const baseH = Math.max(4, h * 0.14)
  ctx.fillStyle = '#262626'
  ctx.fillRect(x, y + h - baseH, w, baseH)

  ctx.fillStyle = '#FF7A1A'
  ctx.beginPath()
  ctx.moveTo(x + w / 2, y)
  ctx.lineTo(x + w * 0.92, y + h - baseH)
  ctx.lineTo(x + w * 0.08, y + h - baseH)
  ctx.closePath()
  ctx.fill()

  ctx.fillStyle = '#ffffff'
  const franjaY = y + h * 0.58
  const franjaAlto = h * 0.1
  const progresoTope = (franjaY - y) / (h - baseH)
  const anchoEnFranja = w * (0.08 + progresoTope * 0.84)
  ctx.fillRect(x + (w - anchoEnFranja) / 2, franjaY, anchoEnFranja, franjaAlto)
}

function dibujarColumnaConos(ctx, x, desde, hasta) {
  if (hasta <= desde) return
  const alturaCono = ANCHO_CONO * 1.25
  let y = desde
  while (y < hasta) {
    const h = Math.min(alturaCono, hasta - y)
    dibujarCono(ctx, x, y, ANCHO_CONO, h)
    y += alturaCono
  }
}

function nuevaColumna(x) {
  const margen = 60
  const gapY = margen + Math.random() * (ALTO - 20 - GAP - margen * 2)
  return { x, gapY, contado: false }
}

export default function EasterEggGame({ onCerrar }) {
  const canvasRef = useRef(null)
  const [estado, setEstado] = useState('esperando') // esperando | jugando | terminado
  const [puntaje, setPuntaje] = useState(0)
  const [record, setRecord] = useState(() => Number(localStorage.getItem('flappy_mb_record') || 0))
  const estadoRef = useRef('esperando')

  const juegoRef = useRef({
    autoY: ALTO / 2,
    velocidadY: 0,
    columnas: [],
    puntaje: 0,
  })

  const reiniciar = () => {
    juegoRef.current = {
      autoY: ALTO / 2,
      velocidadY: 0,
      columnas: [nuevaColumna(ANCHO + 40)],
      puntaje: 0,
    }
    setPuntaje(0)
    estadoRef.current = 'jugando'
    setEstado('jugando')
  }

  const terminar = () => {
    estadoRef.current = 'terminado'
    setEstado('terminado')
    setRecord((r) => {
      const nuevo = Math.max(r, juegoRef.current.puntaje)
      localStorage.setItem('flappy_mb_record', String(nuevo))
      return nuevo
    })
  }

  const saltar = () => {
    if (estadoRef.current === 'esperando' || estadoRef.current === 'terminado') {
      reiniciar()
      return
    }
    juegoRef.current.velocidadY = IMPULSO
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animId

    const loop = () => {
      const j = juegoRef.current
      ctx.clearRect(0, 0, ANCHO, ALTO)

      ctx.fillStyle = '#BEE3F8'
      ctx.fillRect(0, 0, ANCHO, ALTO)
      ctx.fillStyle = '#4A4A4A'
      ctx.fillRect(0, ALTO - 18, ANCHO, 18)

      if (estadoRef.current === 'jugando') {
        j.velocidadY += GRAVEDAD
        j.autoY += j.velocidadY

        j.columnas.forEach((col) => { col.x -= VELOCIDAD })
        const ultima = j.columnas[j.columnas.length - 1]
        if (!ultima || ultima.x < ANCHO - ESPACIO_ENTRE_COLUMNAS) {
          j.columnas.push(nuevaColumna(ANCHO + 20))
        }
        j.columnas = j.columnas.filter((col) => col.x > -ANCHO_CONO)

        j.columnas.forEach((col) => {
          if (!col.contado && col.x + ANCHO_CONO < AUTO_X) {
            col.contado = true
            j.puntaje += 1
            setPuntaje(j.puntaje)
          }
        })

        if (j.autoY < 0 || j.autoY > ALTO - 18 - AUTO_ALTO) {
          terminar()
        }
        j.columnas.forEach((col) => {
          const chocaX = AUTO_X + AUTO_ANCHO > col.x && AUTO_X < col.x + ANCHO_CONO
          if (chocaX && (j.autoY < col.gapY || j.autoY + AUTO_ALTO > col.gapY + GAP)) {
            terminar()
          }
        })
      }

      j.columnas.forEach((col) => {
        dibujarColumnaConos(ctx, col.x, 0, col.gapY)
        dibujarColumnaConos(ctx, col.x, col.gapY + GAP, ALTO - 18)
      })

      ctx.save()
      ctx.font = '30px sans-serif'
      ctx.textBaseline = 'middle'
      ctx.fillText('🚗', AUTO_X - 3, j.autoY + AUTO_ALTO / 2)
      ctx.restore()

      animId = requestAnimationFrame(loop)
    }

    animId = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animId)
  }, [])

  useEffect(() => {
    const handler = (e) => {
      if (e.code === 'Space') {
        e.preventDefault()
        saltar()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <div className="easter-egg-overlay" onClick={saltar}>
      <div className="easter-egg-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <strong>🚗 El Mercedes que no fue</strong>
          <button className="revert-btn" onClick={onCerrar}>✕</button>
        </div>
        <canvas
          ref={canvasRef}
          width={ANCHO}
          height={ALTO}
          onClick={saltar}
          style={{ borderRadius: 10, cursor: 'pointer', display: 'block', margin: '0 auto', maxWidth: '100%' }}
        />
        <div style={{ textAlign: 'center', marginTop: 8, fontFamily: 'IBM Plex Mono, monospace' }}>
          Puntaje: {puntaje} · Récord: {record}
        </div>
        {estado === 'esperando' && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-muted)', padding: '0 12px' }}>
            Tocá o Espacio para arrancar. Esquivá los conos - a Aldo no se lo dieron en Neuquén (el fallo del auto), ¡pero acá lo manejás vos!
          </p>
        )}
        {estado === 'terminado' && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--gray-muted)' }}>
            Chocaste contra un cono. Tocá para volver a intentar.
          </p>
        )}
      </div>
    </div>
  )
}
