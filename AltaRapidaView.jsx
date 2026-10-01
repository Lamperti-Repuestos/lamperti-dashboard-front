import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'

const MAX_FOTOS = 6
const LADO_MAX = 1600

// Las fotos del celular pesan varios MB: se achican acá para que subir por
// datos móviles sea rápido (ML pide mínimo 500px, 1600 sobra).
async function achicar(file) {
  const bmp = await createImageBitmap(file)
  const escala = Math.min(1, LADO_MAX / Math.max(bmp.width, bmp.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bmp.width * escala)
  canvas.height = Math.round(bmp.height * escala)
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85))
  return new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' })
}

const estiloInput = {
  width: '100%', boxSizing: 'border-box', fontSize: 16, padding: '12px 10px', minHeight: 48,
  border: '1px solid var(--gray-line)', borderRadius: 8, background: 'var(--card-bg)', color: 'var(--charcoal)',
}
const estiloBoton = {
  width: '100%', minHeight: 52, fontSize: 17, fontWeight: 600, borderRadius: 10, border: 'none',
  background: 'var(--yellow)', color: '#2E2E2E', cursor: 'pointer',
}
const estiloChip = (activo) => ({
  minHeight: 44, padding: '0 16px', borderRadius: 22, fontSize: 16, cursor: 'pointer',
  border: `1px solid ${activo ? 'var(--navy)' : 'var(--gray-line)'}`,
  background: activo ? 'var(--navy)' : 'var(--card-bg)', color: activo ? '#fff' : 'var(--charcoal)',
})
const estiloMic = (activo) => ({
  minWidth: 56, minHeight: 56, borderRadius: 12, fontSize: 24, cursor: 'pointer',
  border: `2px solid ${activo ? 'var(--alerta)' : 'var(--gray-line)'}`,
  background: activo ? 'var(--alerta)' : 'var(--card-bg)', color: activo ? '#fff' : 'var(--charcoal)',
})
const estiloSecundario = { ...estiloBoton, background: 'var(--card-bg)', color: 'var(--charcoal)', border: '1px solid var(--gray-line)', fontWeight: 500 }

function Campo({ etiqueta, children, nota }) {
  return (
    <label style={{ display: 'block', marginBottom: 14 }}>
      <div style={{ fontSize: 14, color: 'var(--gray-muted)', marginBottom: 4 }}>{etiqueta}</div>
      {children}
      {nota && <div style={{ fontSize: 12, color: 'var(--gray-muted)', marginTop: 3 }}>{nota}</div>}
    </label>
  )
}

export default function AltaRapidaView({ onUnauthorized }) {
  const [status, setStatus] = useState(null)
  const [config, setConfig] = useState(null)
  const [fotos, setFotos] = useState([]) // [{ file, url }]
  const [sku, setSku] = useState('')
  const [precio, setPrecio] = useState('')
  const [cantidad, setCantidad] = useState('1')
  const [titulo, setTitulo] = useState('')
  const [sugerencia, setSugerencia] = useState(null) // { categoria, categoria_nombre, atributos }
  const [atributos, setAtributos] = useState([])
  const [pensando, setPensando] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [resultado, setResultado] = useState(null)
  const [error, setError] = useState(null)
  const [verConfig, setVerConfig] = useState(false)
  const [editandoTitulo, setEditandoTitulo] = useState(false)
  const [escaneando, setEscaneando] = useState(false)
  const videoRef = useRef(null)
  const [descripcion, setDescripcion] = useState('')
  const [placaUrl, setPlacaUrl] = useState(null)
  const [msgConfig, setMsgConfig] = useState(null)
  const inputFoto = useRef(null)
  const inputGaleria = useRef(null)
  const [escuchando, setEscuchando] = useState(null) // id de lo que se está dictando ('titulo', 'attr-ID') o null
  const reconocedor = useRef(null)
  const [ref, setRef] = useState(null) // precios de referencia de ML: null = sin pedir, 'cargando', o la respuesta
  const [cola, setCola] = useState([]) // fotos de galería que esperan su turno, una por producto
  const [decision, setDecision] = useState(null) // fotos elegidas esperando 'mismo producto / cada una un producto'
  const inputBarras = useRef(null)

  const cargarConfig = async () => {
    const res = await apiFetch('/publicador/config', {}, onUnauthorized)
    if (!res.ok) return
    const data = await res.json()
    setConfig(data)
    setDescripcion(data.descripcion)
    if (data.tiene_placa) {
      const img = await apiFetch('/publicador/config/placa', {}, onUnauthorized)
      if (img.ok) setPlacaUrl(URL.createObjectURL(await img.blob()))
    }
  }

  useEffect(() => {
    apiFetch('/publicador/status', {}, onUnauthorized).then((r) => (r.ok ? r.json() : null)).then(setStatus).catch(() => {})
    cargarConfig().catch(() => {})
  }, [])

  const buscarReferencia = async (tit, categoria) => {
    if (!tit || tit.trim().length < 4) return setRef(null)
    setRef('cargando')
    try {
      const q = new URLSearchParams({ titulo: tit.trim(), categoria: categoria || '' })
      const res = await apiFetch(`/publicador/rapido/precios?${q}`, {}, onUnauthorized)
      setRef(res.ok ? await res.json() : { disponible: false, motivo: `Error ${res.status}` })
    } catch {
      setRef({ disponible: false, motivo: 'sin conexión' })
    }
  }

  // Dictado por voz: reconocimiento del navegador (Chrome de Android), sin servidor.
  const SpeechRec = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null

  const dictar = (id, alTerminar) => {
    if (!SpeechRec) return
    if (escuchando) { // segundo toque: cortar
      reconocedor.current && reconocedor.current.stop()
      return
    }
    const rec = new SpeechRec()
    rec.lang = 'es-AR'
    rec.interimResults = false
    rec.maxAlternatives = 1
    rec.onresult = (ev) => {
      const texto = Array.from(ev.results).map((r) => r[0].transcript).join(' ').trim()
      if (texto) alTerminar(texto)
    }
    rec.onerror = (ev) => {
      if (ev.error === 'not-allowed') setError('Falta el permiso del micrófono. Tocá el candado de la barra del navegador y permitilo.')
      else if (ev.error !== 'aborted' && ev.error !== 'no-speech') setError('No pude escuchar. Probá de nuevo.')
    }
    rec.onend = () => setEscuchando(null)
    reconocedor.current = rec
    setError(null)
    setEscuchando(id)
    rec.start()
  }

  // Lo dictado reemplaza el título; después se actualizan los precios de referencia
  const dictarTitulo = () =>
    dictar('titulo', (texto) => {
      const t = (texto.charAt(0).toUpperCase() + texto.slice(1)).slice(0, 60)
      setTitulo(t)
      buscarReferencia(t, sugerencia && sugerencia.categoria)
    })

  const sugerir = async (fotoFile, codigo) => {
    setPensando(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('foto', fotoFile)
      fd.append('sku', codigo || '')
      const res = await apiFetch('/publicador/rapido/sugerir', { method: 'POST', body: fd }, onUnauthorized)
      if (!res.ok) throw new Error((await res.json()).detail || `Error ${res.status}`)
      const data = await res.json()
      setTitulo(data.titulo || '')
      setSugerencia({ categoria: data.categoria, categoria_nombre: data.categoria_nombre })
      buscarReferencia(data.titulo, data.categoria)
      // 'pedido' = vino vacío: se queda visible aunque la persona ya esté escribiendo
      setAtributos((data.atributos || []).map((a) => ({ ...a, pedido: !a.valor && !a.value_id })))
      if (data.codigo_visible && !codigo) setSku(data.codigo_visible)
    } catch (e) {
      setError(`No pude sugerir el título: ${e.message}. Lo podés escribir a mano.`)
    } finally {
      setPensando(false)
    }
  }

  // Si la foto trae un código de barras legible, se carga solo (ahorra tipear con fotos viejas)
  const leerCodigoDeFoto = async (file) => {
    if (!('BarcodeDetector' in window)) return
    try {
      const codigos = await new window.BarcodeDetector().detect(await createImageBitmap(file))
      if (codigos.length) setSku((prev) => prev || codigos[0].rawValue)
    } catch { /* sin código legible: se escribe o escanea */ }
  }

  // Arranca un producto nuevo con esta foto: sugerencia de título + lectura de código
  const cargarProducto = (foto) => {
    setFotos([foto])
    setSku(''); setPrecio(''); setCantidad('1'); setTitulo('')
    setSugerencia(null); setAtributos([]); setResultado(null); setError(null); setEditandoTitulo(false); setRef(null)
    window.scrollTo({ top: 0 })
    leerCodigoDeFoto(foto.file)
    sugerir(foto.file, '')
  }

  const procesarArchivos = async (archivos, desdeGaleria) => {
    if (!archivos.length) return
    setPensando(true)
    const nuevas = []
    try {
      // Desde la galería puede haber decenas: se achican todas (la cola se usa de a una)
      const limite = desdeGaleria && fotos.length === 0 ? archivos.length : MAX_FOTOS - fotos.length
      for (const f of archivos.slice(0, limite)) {
        const chica = await achicar(f)
        nuevas.push({ file: chica, url: URL.createObjectURL(chica) })
      }
    } finally {
      setPensando(false)
    }
    if (!nuevas.length) return
    if (desdeGaleria && nuevas.length > 1 && fotos.length === 0) {
      setDecision(nuevas) // ¿mismo producto o uno por foto? lo decide la persona
      return
    }
    setFotos([...fotos, ...nuevas])
    // La primera foto dispara la sugerencia sola (si todavía no hay título)
    if (fotos.length === 0 && !titulo) {
      leerCodigoDeFoto(nuevas[0].file)
      sugerir(nuevas[0].file, sku)
    }
  }

  const agregarFoto = (e) => {
    const archivos = Array.from(e.target.files || [])
    const galeria = e.target === inputGaleria.current
    e.target.value = ''
    procesarArchivos(archivos, galeria)
  }

  const elegirMismoProducto = () => {
    const nuevas = decision.slice(0, MAX_FOTOS)
    setDecision(null)
    setFotos(nuevas)
    leerCodigoDeFoto(nuevas[0].file)
    sugerir(nuevas[0].file, sku)
  }

  const elegirUnoPorFoto = () => {
    const [primera, ...resto] = decision
    setDecision(null)
    setCola(resto)
    cargarProducto(primera)
  }

  const saltarProducto = () => {
    if (!cola.length) return otro()
    const [siguiente, ...resto] = cola
    setCola(resto)
    cargarProducto(siguiente)
  }

  // Escáner en vivo: abre la cámara y lee el código de barras solo, sin sacar foto.
  useEffect(() => {
    if (!escaneando) return undefined
    let stream = null
    let timer = null
    let cancelado = false
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
        if (cancelado) return stream.getTracks().forEach((t) => t.stop())
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        const detector = new window.BarcodeDetector()
        timer = setInterval(async () => {
          try {
            const codigos = await detector.detect(videoRef.current)
            if (codigos.length) {
              if (navigator.vibrate) navigator.vibrate(80)
              setSku(codigos[0].rawValue)
              setEscaneando(false)
            }
          } catch { /* un cuadro que no se pudo leer: seguimos */ }
        }, 300)
      } catch {
        setEscaneando(false)
        setError('No pude abrir la cámara. Revisá el permiso del navegador o escribí el código.')
      }
    })()
    return () => {
      cancelado = true
      clearInterval(timer)
      if (stream) stream.getTracks().forEach((t) => t.stop())
    }
  }, [escaneando])

  const abrirEscaner = () => {
    if ('BarcodeDetector' in window && navigator.mediaDevices) setEscaneando(true)
    else inputBarras.current.click() // sin lector en vivo: foto del código
  }

  const leerBarras = async (e) => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    if (!('BarcodeDetector' in window)) return setError('Este celular no lee códigos de barras desde el navegador. Escribilo a mano.')
    try {
      const codigos = await new window.BarcodeDetector().detect(await createImageBitmap(f))
      if (codigos.length) setSku(codigos[0].rawValue)
      else setError('No se leyó ningún código de barras. Probá con más luz o escribilo.')
    } catch {
      setError('No se pudo leer el código. Escribilo a mano.')
    }
  }

  const cambiarCantidad = (d) => setCantidad(String(Math.max(1, (parseInt(cantidad, 10) || 1) + d)))
  const precioLindo = precio ? Number(precio).toLocaleString('es-AR') : ''

  const sacarFoto = (i) => setFotos((prev) => prev.filter((_, idx) => idx !== i))

  const editarAtributo = (i, cambios) =>
    setAtributos((prev) => prev.map((a, idx) => (idx === i ? { ...a, ...cambios } : a)))

  const faltantes = () => {
    const f = []
    if (!fotos.length) f.push('una foto')
    if (!sku.trim()) f.push('el código')
    if (!(parseFloat(precio) > 0)) f.push('el precio')
    if (!titulo.trim()) f.push('el título')
    return f
  }

  const publicar = async () => {
    const f = faltantes()
    if (f.length) return setError(`Falta ${f.join(', ')}.`)
    setPublicando(true)
    setError(null)
    setResultado(null)
    try {
      const fd = new FormData()
      fd.append('sku', sku.trim())
      fd.append('precio', precio)
      fd.append('cantidad', cantidad || '1')
      fd.append('titulo', titulo.trim())
      fd.append('categoria', (sugerencia && sugerencia.categoria) || '')
      fd.append(
        'atributos',
        JSON.stringify(atributos.map((a) => ({ id: a.id, value_name: a.valor, value_id: a.value_id })))
      )
      fotos.forEach((x) => fd.append('fotos', x.file))
      const res = await apiFetch('/publicador/rapido/publicar', { method: 'POST', body: fd }, onUnauthorized)
      if (!res.ok) throw new Error((await res.json()).detail || `Error ${res.status}`)
      setResultado(await res.json())
    } catch (e) {
      setError(e.message)
    } finally {
      setPublicando(false)
    }
  }

  const otro = () => {
    if (cola.length) {
      const [siguiente, ...resto] = cola
      setCola(resto)
      return cargarProducto(siguiente)
    }
    setFotos([]); setSku(''); setPrecio(''); setCantidad('1'); setTitulo('')
    setSugerencia(null); setAtributos([]); setResultado(null); setError(null); setEditandoTitulo(false); setRef(null)
    window.scrollTo({ top: 0 })
    // Ya con la cámara lista para el siguiente producto (el toque del botón habilita abrirla)
    setTimeout(() => inputFoto.current && inputFoto.current.click(), 50)
  }

  const guardarDescripcion = async () => {
    const res = await apiFetch('/publicador/config/descripcion', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: descripcion }),
    }, onUnauthorized)
    setMsgConfig(res.ok ? 'Descripción guardada.' : 'No se pudo guardar.')
    cargarConfig()
  }

  // Descripción desde un .txt: UTF-8, o Windows-1252 si el archivo viene de un Bloc de notas viejo
  const subirTxt = async (e) => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    const bytes = await f.arrayBuffer()
    let texto
    try {
      texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      texto = new TextDecoder('windows-1252').decode(bytes)
    }
    texto = texto.replace(/^\uFEFF/, '').trim()
    setDescripcion(texto)
    const res = await apiFetch('/publicador/config/descripcion', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto }),
    }, onUnauthorized)
    setMsgConfig(res.ok ? 'Descripción cargada desde el archivo.' : 'No se pudo guardar la descripción.')
    cargarConfig()
  }

  const subirPlaca = async (e) => {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f) return
    const fd = new FormData()
    fd.append('archivo', await achicar(f))
    const res = await apiFetch('/publicador/config/placa', { method: 'PUT', body: fd }, onUnauthorized)
    setMsgConfig(res.ok ? 'Placa guardada.' : 'No se pudo guardar la placa.')
    cargarConfig()
  }

  const prueba = status && status.dry_run
  const faltaConfig = config && (!config.descripcion || !config.tiene_placa)

  if (resultado && resultado.estado !== 'error') {
    return (
      <div style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '0 16px', boxSizing: 'border-box' }}>
        <h2>{resultado.estado === 'publicado' ? '¡Publicado!' : 'Prueba OK'}</h2>
        <p>{resultado.mensaje}</p>
        {(resultado.avisos || []).map((a) => <p key={a} style={{ color: 'var(--atencion)' }}>{a}</p>)}
        {resultado.permalink && <p><a href={resultado.permalink} target="_blank" rel="noreferrer">Ver publicación en ML</a></p>}
        <button style={estiloBoton} onClick={otro}>{cola.length ? `Siguiente producto (quedan ${cola.length})` : 'Siguiente producto'}</button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '0 16px 90px', boxSizing: 'border-box' }}>
      {escaneando && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'flex', flexDirection: 'column' }}>
          <video ref={videoRef} playsInline muted style={{ flex: 1, width: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', top: '40%', left: '10%', right: '10%', height: 120, border: '3px solid var(--yellow)', borderRadius: 12 }} />
          <div style={{ padding: 16 }}>
            <div style={{ color: '#fff', textAlign: 'center', marginBottom: 10 }}>Apuntá al código de barras</div>
            <button style={estiloBoton} onClick={() => setEscaneando(false)}>Cancelar</button>
          </div>
        </div>
      )}
      <h2 style={{ margin: '0 0 12px' }}>Alta rápida</h2>

      {prueba && (
        <div style={{ background: 'var(--bg-aviso)', color: '#2E2E2E', padding: 10, borderRadius: 10, marginBottom: 12 }}>
          Modo prueba: valida con ML pero no publica ni carga nada.
        </div>
      )}
      {faltaConfig && (
        <div style={{ background: 'var(--bg-faltante)', color: '#2E2E2E', padding: 10, borderRadius: 10, marginBottom: 12 }}>
          Falta cargar {!config.descripcion && 'la descripción fija'}{!config.descripcion && !config.tiene_placa && ' y '}{!config.tiene_placa && 'la placa gris'}.{' '}
          <button style={{ background: 'none', border: 'none', textDecoration: 'underline', padding: 0, fontSize: 'inherit', cursor: 'pointer' }} onClick={() => setVerConfig(true)}>Cargar ahora</button>
        </div>
      )}

      <input ref={inputFoto} type="file" accept="image/*" capture="environment" multiple onChange={agregarFoto} style={{ display: 'none' }} />
      <input ref={inputGaleria} type="file" accept="image/*" multiple onChange={agregarFoto} style={{ display: 'none' }} />
      {decision && (
        <div style={{ padding: 14, borderRadius: 12, border: '2px solid var(--navy)', background: 'var(--card-bg)', marginBottom: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 10 }}>Elegiste {decision.length} fotos</div>
          <button style={{ ...estiloBoton, marginBottom: 8 }} onClick={elegirUnoPorFoto}>Cada foto es un producto distinto</button>
          <button style={estiloSecundario} onClick={elegirMismoProducto}>Son del mismo producto</button>
        </div>
      )}
      {cola.length > 0 && fotos.length > 0 && !decision && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, color: 'var(--gray-muted)' }}>
          <div style={{ flex: 1 }}>Quedan {cola.length} fotos en la cola</div>
          <button style={{ ...estiloSecundario, width: 'auto', minHeight: 40, padding: '0 14px', fontSize: 15 }} onClick={saltarProducto}>Saltar este</button>
        </div>
      )}
      {fotos.length === 0 && !decision ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => inputFoto.current.click()} style={{ width: '100%', height: 150, borderRadius: 14, border: '2px dashed var(--gray-line)', background: 'var(--card-bg)', color: 'var(--charcoal)', fontSize: 20, cursor: 'pointer' }}>
            Sacar foto
          </button>
          <button onClick={() => inputGaleria.current.click()} disabled={pensando} style={{ ...estiloSecundario, minHeight: 64, fontSize: 19 }}>
            {pensando ? 'Preparando fotos…' : 'Elegir de la galería'}
          </button>
        </div>
      ) : decision ? null : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {fotos.map((x, i) => (
            <div key={x.url} style={{ position: 'relative', flex: '0 0 auto' }}>
              <img src={x.url} alt="" style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 10 }} />
              <button onClick={() => sacarFoto(i)} aria-label="Quitar foto" style={{ position: 'absolute', top: -6, right: -6, width: 30, height: 30, borderRadius: 15, border: 'none', background: 'var(--alerta)', color: '#fff', fontSize: 18 }}>×</button>
            </div>
          ))}
          {fotos.length < MAX_FOTOS && (
            <>
              <button onClick={() => inputFoto.current.click()} aria-label="Sacar otra foto" style={{ flex: '0 0 auto', width: 110, height: 110, borderRadius: 10, border: '2px dashed var(--gray-line)', background: 'none', color: 'var(--charcoal)', fontSize: 16 }}>+ Cámara</button>
              <button onClick={() => inputGaleria.current.click()} aria-label="Agregar de la galería" style={{ flex: '0 0 auto', width: 110, height: 110, borderRadius: 10, border: '2px dashed var(--gray-line)', background: 'none', color: 'var(--charcoal)', fontSize: 16 }}>+ Galería</button>
            </>
          )}
        </div>
      )}

      {fotos.length > 0 && (
        <div style={{ margin: '14px 0', padding: 12, borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--gray-line)' }}>
          {pensando ? (
            <div style={{ color: 'var(--gray-muted)' }}>Mirando la foto…</div>
          ) : editandoTitulo || !titulo ? (
            <>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea style={{ ...estiloInput, minHeight: 72 }} maxLength={60} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={escuchando === 'titulo' ? 'Escuchando…' : 'Título de la publicación'} />
                {SpeechRec && <button type="button" onClick={dictarTitulo} aria-label="Dictar título" style={estiloMic(escuchando === 'titulo')}>{escuchando === 'titulo' ? '■' : '🎤'}</button>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--gray-muted)' }}>{titulo.length}/60</div>
              <button style={{ ...estiloSecundario, minHeight: 44, marginTop: 8 }} onClick={() => { if (titulo) { setEditandoTitulo(false); buscarReferencia(titulo, sugerencia && sugerencia.categoria) } else sugerir(fotos[0].file, sku) }}>
                {titulo ? 'Listo' : 'Sugerir con la foto'}
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 17 }}>{titulo}</div>
                {sugerencia && sugerencia.categoria_nombre && <div style={{ fontSize: 13, color: 'var(--gray-muted)', marginTop: 4 }}>{sugerencia.categoria_nombre}</div>}
              </div>
              {SpeechRec && <button type="button" onClick={dictarTitulo} aria-label="Dictar título" style={estiloMic(escuchando === 'titulo')}>{escuchando === 'titulo' ? '■' : '🎤'}</button>}
              <button onClick={() => setEditandoTitulo(true)} aria-label="Editar título" style={{ minWidth: 44, minHeight: 44, border: '1px solid var(--gray-line)', borderRadius: 10, background: 'none', color: 'var(--charcoal)', fontSize: 18 }}>✎</button>
            </div>
          )}
        </div>
      )}

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, color: 'var(--gray-muted)', marginBottom: 4 }}>Código</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={{ ...estiloInput, fontSize: 20 }} value={sku} onChange={(e) => setSku(e.target.value)} autoCapitalize="characters" autoCorrect="off" placeholder="Escanear o escribir" />
          <button style={{ ...estiloBoton, width: 'auto', padding: '0 18px', fontSize: 16 }} onClick={abrirEscaner}>Escanear</button>
        </div>
        <input ref={inputBarras} type="file" accept="image/*" capture="environment" onChange={leerBarras} style={{ display: 'none' }} />
      </div>

      {ref && (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, background: 'var(--card-bg)', border: '1px solid var(--gray-line)' }}>
          {ref === 'cargando' ? (
            <div style={{ color: 'var(--gray-muted)' }}>Buscando precios de referencia…</div>
          ) : ref.disponible ? (
            <>
              <div style={{ fontSize: 14, color: 'var(--gray-muted)' }}>Referencia en ML ({ref.n} publicaciones{ref.fuente === 'catalogo' ? ', catálogo' : ''})</div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '4px 0 8px' }}>
                ${Number(ref.min).toLocaleString('es-AR')} – ${Number(ref.max).toLocaleString('es-AR')}
              </div>
              <button style={{ ...estiloChip(false), minHeight: 48, fontWeight: 600 }} onClick={() => setPrecio(String(Math.round(ref.mediana)))}>
                Usar la mediana: ${Number(ref.mediana).toLocaleString('es-AR')}
              </button>
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--gray-muted)', fontSize: 14 }}>Ver algunas</summary>
                {ref.muestras.map((m, i) => (
                  <div key={i} style={{ fontSize: 14, marginTop: 6 }}>
                    ${Number(m.precio).toLocaleString('es-AR')} · {m.permalink ? <a href={m.permalink} target="_blank" rel="noreferrer">{m.titulo.slice(0, 50)}</a> : m.titulo.slice(0, 50)}
                  </div>
                ))}
              </details>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--gray-muted)' }}>Sin precios de referencia ({ref.motivo}).</div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 14 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, color: 'var(--gray-muted)', marginBottom: 4 }}>Precio de venta</div>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 12, top: 13, fontSize: 22, color: 'var(--gray-muted)' }}>$</span>
            <input style={{ ...estiloInput, fontSize: 26, fontWeight: 600, paddingLeft: 32, minHeight: 58 }} inputMode="numeric" pattern="[0-9]*" value={precioLindo}
              onChange={(e) => setPrecio(e.target.value.replace(/\D/g, ''))} placeholder="0" />
          </div>
        </div>
        <div>
          <div style={{ fontSize: 14, color: 'var(--gray-muted)', marginBottom: 4, textAlign: 'center' }}>Cantidad</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button onClick={() => cambiarCantidad(-1)} style={{ ...estiloSecundario, width: 48, minHeight: 58, fontSize: 24 }}>−</button>
            <div style={{ minWidth: 30, textAlign: 'center', fontSize: 22, fontWeight: 600 }}>{cantidad || 1}</div>
            <button onClick={() => cambiarCantidad(1)} style={{ ...estiloSecundario, width: 48, minHeight: 58, fontSize: 24 }}>+</button>
          </div>
        </div>
      </div>

      {atributos.some((a) => a.pedido) && (
        <div style={{ borderTop: '1px solid var(--gray-line)', paddingTop: 12, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>ML pide estos datos</div>
          {atributos.map((a, i) => !a.pedido ? null : (
            <div key={a.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 14, color: 'var(--gray-muted)', marginBottom: 6 }}>{a.nombre}</div>
              {a.valores && a.valores.length > 0 && a.valores.length <= 12 ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {a.valores.map((v) => (
                    <button key={v.id} style={estiloChip(a.value_id === v.id)} onClick={() => editarAtributo(i, { value_id: a.value_id === v.id ? '' : v.id })}>{v.name}</button>
                  ))}
                </div>
              ) : a.valores && a.valores.length > 12 ? (
                <select style={estiloInput} value={a.value_id} onChange={(e) => editarAtributo(i, { value_id: e.target.value })}>
                  <option value="">Elegir…</option>
                  {a.valores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input style={estiloInput} value={a.valor} onChange={(e) => editarAtributo(i, { valor: e.target.value })} placeholder={escuchando === `attr-${a.id}` ? 'Escuchando…' : ''} />
                  {SpeechRec && <button type="button" onClick={() => dictar(`attr-${a.id}`, (t) => editarAtributo(i, { valor: t }))} aria-label={`Dictar ${a.nombre}`} style={{ ...estiloMic(escuchando === `attr-${a.id}`), minHeight: 48 }}>{escuchando === `attr-${a.id}` ? '■' : '🎤'}</button>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {atributos.some((a) => !a.pedido) && (
        <div style={{ fontSize: 13, color: 'var(--ok)', marginBottom: 8 }}>
          Completado desde la foto: {atributos.filter((a) => !a.pedido).map((a) => a.valor || (a.valores.find((v) => v.id === a.value_id) || {}).name).join(' · ')}
        </div>
      )}

      {error && <div style={{ color: 'var(--alerta)', margin: '8px 0' }}>{error}</div>}
      {resultado && resultado.estado === 'error' && (
        <div style={{ color: 'var(--alerta)', margin: '8px 0' }}>
          {resultado.mensaje} {resultado.permalink && <a href={resultado.permalink} target="_blank" rel="noreferrer">ver</a>}
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, padding: '10px 0', background: 'var(--cream)' }}>
        <button style={{ ...estiloBoton, opacity: publicando ? 0.6 : 1 }} onClick={publicar} disabled={publicando || pensando}>
          {publicando ? 'Publicando… (puede tardar unos segundos)' : prueba ? 'Probar (no publica)' : 'Publicar'}
        </button>
      </div>

      <button style={{ ...estiloSecundario, minHeight: 44, fontSize: 15, marginTop: 12 }} onClick={() => setVerConfig((v) => !v)}>
        {verConfig ? 'Cerrar configuración' : 'Configuración: descripción y placa'}
      </button>
      {verConfig && (
        <div style={{ marginTop: 12 }}>
          <Campo etiqueta="Descripción fija (va igual en todas las publicaciones)">
            <textarea style={{ ...estiloInput, minHeight: 200 }} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
          </Campo>
          <label style={{ ...estiloBoton, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box', marginBottom: 8 }}>
            Subir descripción desde archivo .txt
            <input type="file" accept=".txt,text/plain" onChange={subirTxt} style={{ display: 'none' }} />
          </label>
          <button style={estiloSecundario} onClick={guardarDescripcion}>Guardar lo que escribí arriba</button>
          <div style={{ height: 16 }} />
          <div style={{ fontSize: 14, color: 'var(--gray-muted)', marginBottom: 6 }}>Placa gris (va como última foto)</div>
          {placaUrl && <img src={placaUrl} alt="Placa" style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />}
          <label style={{ ...estiloSecundario, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            {placaUrl ? 'Cambiar placa (JPEG)' : 'Subir placa (JPEG)'}
            <input type="file" accept="image/*" onChange={subirPlaca} style={{ display: 'none' }} />
          </label>
          {msgConfig && <p style={{ color: 'var(--ok)' }}>{msgConfig}</p>}
        </div>
      )}
    </div>
  )
}
