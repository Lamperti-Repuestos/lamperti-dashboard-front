import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'

const SpeechRecognitionAPI =
  typeof window !== 'undefined' && (window.SpeechRecognition || window.webkitSpeechRecognition)

export default function SubagenteView({ onUnauthorized }) {
  const [texto, setTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [historial, setHistorial] = useState([])
  const [cargandoHistorial, setCargandoHistorial] = useState(true)
  const [uso, setUso] = useState(null)
  const [escuchando, setEscuchando] = useState(false)
  const [leerRespuesta, setLeerRespuesta] = useState(true)
  const reconocimientoRef = useRef(null)

  const fetchUso = () => {
    apiFetch('/subagente/uso', {}, onUnauthorized)
      .then((res) => res.json())
      .then(setUso)
      .catch(() => {})
  }

  const fetchHistorial = () => {
    apiFetch('/subagente/historial', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setHistorial(d.comandos)
        setCargandoHistorial(false)
      })
      .catch(() => setCargandoHistorial(false))
  }

  useEffect(() => {
    fetchUso()
    fetchHistorial()
  }, [])

  const leerEnVozAlta = (texto) => {
    if (!leerRespuesta || !window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(texto)
    utterance.lang = 'es-AR'
    window.speechSynthesis.speak(utterance)
  }

  const enviarComando = (textoAEnviar) => {
    const comando = (textoAEnviar ?? texto).trim()
    if (!comando) return
    setEnviando(true)
    setError(null)
    apiFetch('/subagente/comando', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: comando }),
    }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setTexto('')
        setEnviando(false)
        leerEnVozAlta(d.respuesta)
        fetchUso()
        fetchHistorial()
      })
      .catch((err) => {
        setError(err.message)
        setEnviando(false)
      })
  }

  const toggleMicrofono = () => {
    if (!SpeechRecognitionAPI) return

    if (escuchando) {
      reconocimientoRef.current?.stop()
      return
    }

    const reconocimiento = new SpeechRecognitionAPI()
    reconocimiento.lang = 'es-AR'
    reconocimiento.interimResults = false
    reconocimiento.maxAlternatives = 1

    reconocimiento.onresult = (event) => {
      const dicho = event.results[0][0].transcript
      setTexto(dicho)
      enviarComando(dicho)
    }
    reconocimiento.onerror = () => setEscuchando(false)
    reconocimiento.onend = () => setEscuchando(false)

    reconocimientoRef.current = reconocimiento
    setEscuchando(true)
    reconocimiento.start()
  }

  return (
    <>
      <div className="paste-box">
        <label className="corte-label" style={{ marginBottom: 8 }}>Pedile algo al subagente</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="search-input"
            style={{ flex: 1 }}
            placeholder='Ej: "¿qué me falta separar hoy?"'
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') enviarComando() }}
            disabled={enviando}
          />
          {SpeechRecognitionAPI && (
            <button
              className={`sort-btn btn-toggle ${escuchando ? 'active' : ''}`}
              aria-pressed={escuchando}
              onClick={toggleMicrofono}
              disabled={enviando}
              title="Dictar por voz"
            >
              {escuchando ? '🔴 Escuchando...' : '🎙️'}
            </button>
          )}
          <button className="scan-btn" onClick={() => enviarComando()} disabled={enviando || !texto.trim()}>
            {enviando ? '⏳' : 'Enviar'}
          </button>
        </div>
        {!SpeechRecognitionAPI && (
          <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '6px 0 0' }}>
            Este navegador no soporta dictado por voz - probá desde Chrome.
          </p>
        )}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13 }}>
          <input type="checkbox" checked={leerRespuesta} onChange={(e) => setLeerRespuesta(e.target.checked)} />
          Leer la respuesta en voz alta
        </label>
        {error && <div className="error-state" style={{ marginTop: 8 }}>Error: {error}</div>}
      </div>

      {uso && (
        <div className="scan-result" style={{ marginTop: 12 }}>
          Este mes ({uso.mes}): ${uso.costo_usd_total.toFixed(2)} de {uso.comandos} comando(s).
        </div>
      )}

      <div className="list" style={{ marginTop: 12 }}>
        <h2 className="section-title">Historial</h2>
        {cargandoHistorial && <div className="loading-state">Cargando...</div>}
        {!cargandoHistorial && historial.length === 0 && (
          <div className="empty-state">Todavía no le pediste nada.</div>
        )}
        {historial.map((h) => (
          <div key={h.id} className="row" style={{ alignItems: 'flex-start' }}>
            <div className="title-cell">
              <span style={{ fontWeight: 600 }}>{h.texto_pedido}</span>
              <span style={{ display: 'block', fontWeight: 400, marginTop: 2, whiteSpace: 'pre-wrap' }}>
                {h.respuesta}
              </span>
              <span className="id-cell mono">
                {new Date(h.creado_en).toLocaleString('es-AR')} · ${h.costo_usd.toFixed(4)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
