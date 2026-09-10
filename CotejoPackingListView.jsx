import { useRef, useState } from 'react'
import { apiFetch } from './api.js'

const normalizar = (s) =>
  (s || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s-]+/g, '')

function nuevaFila(extra = {}) {
  return { id: `${Date.now()}-${Math.random()}`, codigo: '', cantidad: '', descripcion: '', ...extra }
}

function parsearLineaManual(lineaOriginal) {
  const partes = lineaOriginal.trim().split(/\s+/).filter(Boolean)
  if (partes.length === 0) return null

  const codigo = partes[0]
  const ultima = partes[partes.length - 1]
  const ultimaEsNumero = /^\d+([.,]\d+)?$/.test(ultima)

  if (ultimaEsNumero && partes.length > 1) {
    return nuevaFila({ codigo, cantidad: ultima, descripcion: partes.slice(1, -1).join(' ') })
  }
  return nuevaFila({ codigo, descripcion: partes.slice(1).join(' ') })
}

function TablaEditable({ titulo, filas, setFilas, onDictar, onDetener, dictando, mostrarPrecio }) {
  const [textoCarga, setTextoCarga] = useState('')

  const actualizarFila = (id, campo, valor) => {
    setFilas((prev) => prev.map((f) => (f.id === id ? { ...f, [campo]: valor } : f)))
  }
  const eliminarFila = (id) => {
    setFilas((prev) => prev.filter((f) => f.id !== id))
  }

  const cargarEnBloque = () => {
    const nuevas = textoCarga
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map(parsearLineaManual)
      .filter(Boolean)

    if (nuevas.length === 0) return
    setFilas((prev) => [...prev, ...nuevas])
    setTextoCarga('')
  }

  return (
    <div className="paste-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexWrap: 'wrap', gap: 8 }}>
        <label className="corte-label" style={{ marginBottom: 0 }}>{titulo}</label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {onDictar && (
            <button
              className={`sort-btn ${dictando ? 'toggle-on-red' : ''}`}
              onClick={dictando ? onDetener : onDictar}
            >
              {dictando ? '🔴 Detener dictado' : '🎤 Dictar (manos libres)'}
            </button>
          )}
          <button className="sort-btn" onClick={() => setFilas((prev) => [...prev, nuevaFila()])}>
            + Fila manual
          </button>
        </div>
      </div>

      {dictando && (
        <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '0 0 8px' }}>
          Escuchando... decí "código, cantidad, número, descripción" por línea. Ej: "cuatro cero cero uno cantidad diez tapa de aceite".
        </p>
      )}

      {onDictar && (
        <div style={{ marginBottom: 14 }}>
          <label className="corte-label" style={{ fontSize: 12 }}>
            O escribí varias líneas juntas (una por producto: código, descripción, cantidad al final)
          </label>
          <textarea
            className="paste-textarea"
            rows={3}
            placeholder={'1192w00i caño venteo 10\n209936 tapa deposito 1'}
            value={textoCarga}
            onChange={(e) => setTextoCarga(e.target.value)}
          />
          <button className="sort-btn" style={{ marginTop: 6 }} onClick={cargarEnBloque}>
            📥 Cargar
          </button>
        </div>
      )}

      {filas.length === 0 && (
        <div className="empty-state">Sin filas todavía.</div>
      )}

      {filas.map((f, i) => (
        <div key={f.id} className="cotejo-card">
          <div className="cotejo-card-header">
            <span className="mono" style={{ color: 'var(--gray-muted)', fontSize: 12 }}>#{i + 1}</span>
            <button className="revert-btn" onClick={() => eliminarFila(f.id)}>✕ Borrar fila</button>
          </div>

          <label className="cotejo-field">
            Código
            <input
              className="cotejo-input"
              value={f.codigo}
              onChange={(e) => actualizarFila(f.id, 'codigo', e.target.value)}
            />
          </label>

          <label className="cotejo-field">
            Cantidad
            <input
              className="cotejo-input"
              value={f.cantidad}
              onChange={(e) => actualizarFila(f.id, 'cantidad', e.target.value)}
            />
          </label>

          {mostrarPrecio && (
            <label className="cotejo-field">
              P. Unitario
              <input
                className="cotejo-input"
                value={f.precio_unitario || ''}
                onChange={(e) => actualizarFila(f.id, 'precio_unitario', e.target.value)}
              />
            </label>
          )}

          <label className="cotejo-field">
            Descripción
            <input
              className="cotejo-input"
              value={f.descripcion}
              onChange={(e) => actualizarFila(f.id, 'descripcion', e.target.value)}
            />
          </label>
        </div>
      ))}
    </div>
  )
}

export default function CotejoPackingListView({ onUnauthorized }) {
  const [filasB, setFilasB] = useState([])
  const [filasOficial, setFilasOficial] = useState([])
  const [filasA, setFilasA] = useState([])

  const [dictando, setDictando] = useState(null) // 'ladoB' | 'oficial' | null
  const dictandoRef = useRef(null)
  const recognitionRef = useRef(null)

  const [subiendoPdf, setSubiendoPdf] = useState(false)
  const [msgPdf, setMsgPdf] = useState(null)

  const [resultado, setResultado] = useState(null)

  const agregarFilaDesdeVoz = (destino, textoOriginal) => {
    const texto = textoOriginal.toLowerCase().trim()
    const partes = texto.split(/\bcantidad\b/)
    let fila
    if (partes.length >= 2) {
      const codigo = partes[0].trim()
      const resto = partes[1].trim()
      const m = resto.match(/^(\d+)\s*(.*)$/)
      fila = m
        ? nuevaFila({ codigo, cantidad: m[1], descripcion: m[2].trim() })
        : nuevaFila({ codigo, descripcion: resto })
    } else {
      // No reconocí el patrón "código cantidad N descripción" - lo dejo
      // como texto crudo en la descripción para corregir a mano.
      fila = nuevaFila({ descripcion: `⚠ revisar: "${textoOriginal}"` })
    }
    if (destino === 'ladoB') setFilasB((prev) => [...prev, fila])
    else setFilasOficial((prev) => [...prev, fila])
  }

  const iniciarDictado = (destino) => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Este navegador no tiene reconocimiento de voz (probá con Chrome).')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-AR'
    recognition.continuous = true
    recognition.interimResults = false

    recognition.onresult = (event) => {
      const idx = event.results.length - 1
      const texto = event.results[idx][0].transcript
      agregarFilaDesdeVoz(destino, texto)
    }
    recognition.onend = () => {
      // Si seguimos en modo dictado (no se cortó a mano), reinicia solo -
      // el reconocimiento del navegador se corta solo cada tanto.
      if (dictandoRef.current === destino) recognition.start()
    }
    recognition.onerror = () => {}

    recognitionRef.current = recognition
    dictandoRef.current = destino
    setDictando(destino)
    recognition.start()
  }

  const detenerDictado = () => {
    dictandoRef.current = null
    setDictando(null)
    recognitionRef.current?.stop()
  }

  const subirPdf = (e) => {
    const archivo = e.target.files[0]
    if (!archivo) return
    setSubiendoPdf(true)
    setMsgPdf(null)

    const formData = new FormData()
    formData.append('archivo', archivo)

    apiFetch('/cotejo/parse-pdf', { method: 'POST', body: formData }, onUnauthorized)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Error')
        return data
      })
      .then((data) => {
        setFilasA(data.filas.map((f) => nuevaFila({
          codigo: f.codigo,
          cantidad: f.cantidad ?? '',
          precio_unitario: f.precio_unitario || '',
          descripcion: f.descripcion || '',
        })))
        setMsgPdf(`✅ ${data.filas.length} fila(s) reconocida(s) del PDF.`)
        setSubiendoPdf(false)
      })
      .catch((err) => {
        setMsgPdf(`Error: ${err.message}`)
        setSubiendoPdf(false)
      })
  }

  const cotejar = () => {
    const codigos = new Set([
      ...filasB.map((f) => normalizar(f.codigo)),
      ...filasOficial.map((f) => normalizar(f.codigo)),
      ...filasA.map((f) => normalizar(f.codigo)),
    ])
    codigos.delete('')

    const filas = [...codigos].map((cod) => {
      const enB = filasB.find((f) => normalizar(f.codigo) === cod)
      const enOf = filasOficial.find((f) => normalizar(f.codigo) === cod)
      const enA = filasA.find((f) => normalizar(f.codigo) === cod)

      const cantB = enB && enB.cantidad !== '' ? Number(enB.cantidad) : null
      const cantOf = enOf && enOf.cantidad !== '' ? Number(enOf.cantidad) : null
      const cantA = enA && enA.cantidad !== '' ? Number(enA.cantidad) : null

      // La cuenta real es: lo que anotamos a mano (B) + lo que ya está
      // facturado (Digital) tiene que sumar el total declarado en la
      // oficial del proveedor - no que las tres sean iguales entre sí.
      const coincide = cantOf !== null && (cantB || 0) + (cantA || 0) === cantOf

      return {
        codigo: enB?.codigo || enOf?.codigo || enA?.codigo || cod,
        descripcion: enB?.descripcion || enOf?.descripcion || enA?.descripcion || '',
        cantB, cantOf, cantA, coincide,
      }
    })

    filas.sort((a, b) => (a.coincide === b.coincide ? 0 : a.coincide ? 1 : -1))
    setResultado(filas)
  }

  return (
    <>
      <TablaEditable
        titulo="Lado B (packing list en papel, no oficial)"
        filas={filasB}
        setFilas={setFilasB}
        onDictar={() => iniciarDictado('ladoB')}
        onDetener={detenerDictado}
        dictando={dictando === 'ladoB'}
      />

      <TablaEditable
        titulo="Packing list oficial del proveedor (papel, puede ser varias hojas)"
        filas={filasOficial}
        setFilas={setFilasOficial}
        onDictar={() => iniciarDictado('oficial')}
        onDetener={detenerDictado}
        dictando={dictando === 'oficial'}
      />

      <div className="paste-box">
        <label className="corte-label" style={{ marginBottom: 8 }}>
          Lado A (factura digital - PDF)
        </label>
        <input type="file" accept=".pdf" onChange={subirPdf} disabled={subiendoPdf} />
        {subiendoPdf && <div className="loading-state" style={{ padding: 12 }}>Leyendo PDF...</div>}
        {msgPdf && <div className="scan-result" style={{ padding: '10px 0' }}>{msgPdf}</div>}
      </div>

      {filasA.length > 0 && (
        <TablaEditable
          titulo="Lado A - filas leídas del PDF (revisá antes de cotejar)"
          filas={filasA}
          setFilas={setFilasA}
          mostrarPrecio
        />
      )}

      <div className="controls">
        <button className="scan-btn" onClick={cotejar}>
          🔍 Cotejar las tres listas
        </button>
      </div>

      {resultado && (
        <div className="list">
          {resultado.map((r, i) => (
            <div key={i} className={`row ${r.coincide ? '' : 'pick-row-faltante'}`}>
              <div className="title-cell">
                {r.descripcion || r.codigo}
                <span className="id-cell mono">Código: {r.codigo}</span>
              </div>
              <span className="badge badge-colecta">B: {r.cantB ?? '—'}</span>
              <span className="badge badge-acordar">Digital: {r.cantA ?? '—'}</span>
              <span style={{ fontWeight: 700 }}>=</span>
              <span className="badge badge-flex">Oficial: {r.cantOf ?? '—'}</span>
              {r.coincide ? (
                <span className="badge badge-explicada">✅ Coincide</span>
              ) : (
                <span className="badge badge-sin-explicar">⚠ No coincide</span>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
