import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'

const MAX_FOTOS = 6
const LADO_MAX = 1600

// Medidas del paquete: ML las exige para el envío. Se recuerdan por categoría (y las últimas usadas)
// para no volver a escribirlas en cada producto parecido.
const PAQUETE_VACIO = { alto: '', ancho: '', largo: '', peso: '' }
// Tamaños de siempre, para elegir con un toque (alto = la profundidad del paquete)
const PAQUETES_TIPO = [
  { nombre: 'Chico', medidas: { ancho: '20', largo: '30', alto: '10', peso: '500' } },
  { nombre: 'Mediano', medidas: { ancho: '40', largo: '60', alto: '10', peso: '1000' } },
  { nombre: 'Grande', medidas: { ancho: '100', largo: '100', alto: '30', peso: '2000' } },
]
const esPaqueteTipo = (p, tipo) => Object.keys(tipo).every((k) => parseFloat(p[k]) === parseFloat(tipo[k]))
const leerPaquetes = () => {
  try { return JSON.parse(localStorage.getItem('alta_paquete')) || { por: {}, ultimo: null } } catch { return { por: {}, ultimo: null } }
}
const recordarPaquete = (categoria, paquete) => {
  try {
    const d = leerPaquetes()
    d.ultimo = paquete
    if (categoria) d.por[categoria] = paquete
    localStorage.setItem('alta_paquete', JSON.stringify(d))
  } catch { /* sin storage: no se recuerda */ }
}
const paqueteCompleto = (p) => [p.alto, p.ancho, p.largo, p.peso].every((x) => parseFloat(x) > 0)
const atributosPaquete = (p) => [
  { id: 'SELLER_PACKAGE_HEIGHT', value_name: `${parseFloat(p.alto)} cm` },
  { id: 'SELLER_PACKAGE_WIDTH', value_name: `${parseFloat(p.ancho)} cm` },
  { id: 'SELLER_PACKAGE_LENGTH', value_name: `${parseFloat(p.largo)} cm` },
  { id: 'SELLER_PACKAGE_WEIGHT', value_name: `${parseFloat(p.peso)} g` },
]
// Datos fiscales: no se le piden a la persona (en Contabilium nunca los toca).
//  - IVA: siempre 21 %.
//  - El resto (impuesto de importación, etc.): el valor de siempre de tus publicaciones (el más usado),
//    o el que ya se eligió alguna vez. Quedan elegidos y ocultos; "cambiar" los muestra.
const FISCALES = ['VALUE_ADDED_TAX', 'IMPORT_DUTY']
const leerFiscales = () => { try { return JSON.parse(localStorage.getItem('alta_fiscales')) || {} } catch { return {} } }
const recordarFiscales = (atributos) => {
  try {
    const d = leerFiscales()
    atributos.filter((a) => FISCALES.includes(a.id) && (a.value_id || a.valor)).forEach((a) => { d[a.id] = { value_id: a.value_id, valor: a.valor } })
    localStorage.setItem('alta_fiscales', JSON.stringify(d))
  } catch { /* sin storage */ }
}
const conPredeterminados = (a) => {
  const vals = a.valores || []
  const vacio = !a.value_id && !a.valor
  if (a.id === 'VALUE_ADDED_TAX' && vacio) {
    const v = vals.find((x) => /^21([.,]0+)?\s*%?$/.test(x.name.trim()))
    if (v) return { ...a, value_id: v.id, oculto: true, pedido: true }
    if (!vals.length) return { ...a, valor: '21 %', oculto: true, pedido: true }
  }
  if (FISCALES.includes(a.id) && vacio) {
    const recordado = leerFiscales()[a.id]
    if (recordado && (recordado.value_id || recordado.valor)) return { ...a, ...recordado, oculto: true, pedido: true }
    if (a.aprendido && vals.length) return { ...a, value_id: vals[0].id, oculto: true, pedido: true }
  }
  return { ...a, pedido: !a.valor && !a.value_id }
}

// Borrador: lo que se está cargando se guarda en el celular (IndexedDB, que sí admite fotos) para
// recuperarlo si Android cierra la página mientras se mira la competencia en la app de ML u otra app.
const BD_NOMBRE = 'lamperti_alta_rapida'
const BORRADOR_VIGENCIA_MS = 24 * 60 * 60 * 1000
const abrirBD = () => new Promise((ok, mal) => {
  const r = indexedDB.open(BD_NOMBRE, 1)
  r.onupgradeneeded = () => r.result.createObjectStore('borrador')
  r.onsuccess = () => ok(r.result)
  r.onerror = () => mal(r.error)
})
async function conBD(modo, fn) {
  const bd = await abrirBD()
  try {
    return await new Promise((ok, mal) => {
      const t = bd.transaction('borrador', modo)
      const pedido = fn(t.objectStore('borrador'))
      t.oncomplete = () => ok(pedido && pedido.result)
      t.onerror = () => mal(t.error)
      t.onabort = () => mal(t.error)
    })
  } finally {
    bd.close()
  }
}
const guardarBorrador = (dato) => conBD('readwrite', (a) => a.put(dato, 'actual'))
const borrarBorrador = () => conBD('readwrite', (a) => a.delete('actual'))
const leerBorrador = () => conBD('readonly', (a) => a.get('actual'))

// Ancho y alto de un JPEG/PNG leyendo solo el encabezado (sin decodificar la foto).
async function dimensiones(file) {
  const buf = new Uint8Array(await file.slice(0, 131072).arrayBuffer())
  if (buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) { i++; continue }
      const m = buf[i + 1]
      if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
        return { h: (buf[i + 5] << 8) | buf[i + 6], w: (buf[i + 7] << 8) | buf[i + 8] }
      }
      i += 2 + ((buf[i + 2] << 8) | buf[i + 3])
    }
  } else if (buf[0] === 0x89 && buf[1] === 0x50) {
    const v = new DataView(buf.buffer)
    return { w: v.getUint32(16), h: v.getUint32(20) }
  }
  return null
}

// Una foto de cámara de 50-100 MP decodificada completa son cientos de MB de RAM y el
// navegador se queda sin memoria. Se pide ya reducida, así nunca existe entera en memoria.
async function abrirChica(file) {
  const dim = await dimensiones(file).catch(() => null)
  if (dim && Math.max(dim.w, dim.h) <= LADO_MAX) return createImageBitmap(file)
  try {
    const mini = await createImageBitmap(file, { resizeWidth: 64, resizeQuality: 'low' })
    const ratio = mini.width / mini.height
    mini.close()
    const w = ratio >= 1 ? LADO_MAX : Math.round(LADO_MAX * ratio)
    const h = ratio >= 1 ? Math.round(LADO_MAX / ratio) : LADO_MAX
    return await createImageBitmap(file, { resizeWidth: w, resizeHeight: h, resizeQuality: 'high' })
  } catch {
    return createImageBitmap(file) // navegador sin opciones de resize
  }
}

// Por encima de esto el celular no abre la foto: la decodificada ocupa más de ~65 MB y en
// celulares con poca RAM el navegador se queda sin memoria. Esas se reducen en el servidor.
const MAX_MP_EN_CELULAR = 16e6
const MAX_BYTES_SIN_DIMENSIONES = 6 * 1024 * 1024

async function achicarEnServidor(file, onUnauthorized) {
  const fd = new FormData()
  fd.append('foto', file) // el original, sin abrirlo
  const res = await apiFetch('/publicador/rapido/foto-chica', { method: 'POST', body: fd }, onUnauthorized)
  if (!res.ok) throw new Error('el servidor no pudo reducir la foto')
  return new File([await res.blob()], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' })
}

// Las fotos del celular pesan varios MB: se achican para que subir por datos móviles sea
// rápido (ML pide mínimo 500px, 1600 sobra).
async function achicar(file, onUnauthorized) {
  const dim = await dimensiones(file).catch(() => null)
  const enorme = dim ? dim.w * dim.h > MAX_MP_EN_CELULAR : file.size > MAX_BYTES_SIN_DIMENSIONES
  if (enorme) return achicarEnServidor(file, onUnauthorized)
  const bmp = await abrirChica(file)
  const canvas = document.createElement('canvas')
  canvas.width = bmp.width
  canvas.height = bmp.height
  canvas.getContext('2d').drawImage(bmp, 0, 0)
  bmp.close() // libera ya la imagen decodificada
  const blob = await new Promise((ok) => canvas.toBlob(ok, 'image/jpeg', 0.85))
  canvas.width = canvas.height = 0 // y el lienzo
  if (!blob) throw new Error('sin memoria')
  return new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' })
}

// Búsqueda pública de ML (se abre en ML: ahí se ve la competencia con los ojos)
const slugML = (texto) => texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const urlML = (texto) => `https://listado.mercadolibre.com.ar/${slugML(texto)}`
// Un link por modelo ("grifo de calefacción Ford EcoSport", "… Ford Ka"); sin perfil, uno con el título
const linksCompetencia = (titulo, perfil) => (perfil && perfil.modelos && perfil.modelos.length)
  ? perfil.modelos.map((m) => ({ etiqueta: m, url: urlML([perfil.tipo, perfil.marca, m].filter(Boolean).join(' ')) }))
  : [{ etiqueta: '', url: urlML(titulo) }]

const soltar = (lista) => lista.forEach((f) => {
  URL.revokeObjectURL(f.url)
  if (f.original) URL.revokeObjectURL(f.original.url)
})
const MSG_MEMORIA = 'No pude abrir la foto. Si el celular se queda sin memoria, cerrá otras apps o pestañas y probá de nuevo.'

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
  // Cámara dentro de la página: evita salir a la app de cámara, que en celulares con poca RAM
  // hace que Android cierre la pestaña del navegador ("memoria insuficiente") y se pierda la foto.
  const [paquete, setPaquete] = useState(PAQUETE_VACIO)
  const [reintento, setReintento] = useState(false) // al completarse solos los datos fiscales, se vuelve a probar sin pedir nada
  const reintentoUsado = useRef(false)
  const [paqueteDeAntes, setPaqueteDeAntes] = useState(false) // cargado de la última vez: conviene revisarlo
  const [restaurado, setRestaurado] = useState(false) // ya se intentó recuperar el borrador
  const [avisoBorrador, setAvisoBorrador] = useState(false)
  const [camara, setCamara] = useState(false)
  const [tomadas, setTomadas] = useState([]) // fotos sacadas en esta sesión de cámara, todavía no incorporadas
  const [flash, setFlash] = useState(false)
  const [soportaFlash, setSoportaFlash] = useState(false)
  const videoCamRef = useRef(null)
  const streamCamRef = useRef(null)
  const [escuchando, setEscuchando] = useState(null) // id de lo que se está dictando ('titulo', 'attr-ID') o null
  const reconocedor = useRef(null)
  // Fondo blanco automático (es el estándar de las publicaciones de Lamperti): se recuerda por celular
  const [fondoAuto, setFondoAuto] = useState(() => {
    try { return localStorage.getItem('alta_fondo_auto') !== 'no' } catch { return true }
  })
  const cambiarFondoAuto = () => {
    const nuevo = !fondoAuto
    setFondoAuto(nuevo)
    try { localStorage.setItem('alta_fondo_auto', nuevo ? 'si' : 'no') } catch { /* sin storage: queda para esta sesión */ }
  }
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
    // Deja lista la lista de publicaciones propias (para la referencia de precios) sin hacer esperar
    apiFetch('/publicador/rapido/calentar', { method: 'POST' }, onUnauthorized).catch(() => {})
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
      setAtributos((data.atributos || []).map(conPredeterminados))
      if (data.codigo_visible && !codigo) setSku(data.codigo_visible)
    } catch (e) {
      setError(`No pude sugerir el título: ${e.message}. Lo podés escribir a mano.`)
    } finally {
      setPensando(false)
    }
  }

  // Al conocer la categoría, si no hay medidas puestas se cargan las de la última vez
  useEffect(() => {
    const cat = sugerencia && sugerencia.categoria
    if (!cat || paquete.alto || paquete.ancho || paquete.largo || paquete.peso) return
    const d = leerPaquetes()
    const previo = d.por[cat] || d.ultimo
    if (previo) { setPaquete(previo); setPaqueteDeAntes(true) }
  }, [sugerencia])

  // Recupera lo que se estaba cargando (si la página se cerró por memoria o por cambiar de app)
  useEffect(() => {
    leerBorrador()
      .then((d) => {
        if (!d || Date.now() - d.t > BORRADOR_VIGENCIA_MS) return
        setSku(d.sku || ''); setPrecio(d.precio || ''); setCantidad(d.cantidad || '1'); setTitulo(d.titulo || '')
        setSugerencia(d.sugerencia || null); setAtributos(d.atributos || []); setRef(d.ref || null)
        setPaquete(d.paquete || PAQUETE_VACIO)
        setFotos((d.fotos || []).map((f) => ({
          file: f.file, url: URL.createObjectURL(f.file), blanco: !!f.blanco,
          original: f.original ? { file: f.original, url: URL.createObjectURL(f.original) } : undefined,
        })))
        setCola(d.cola || [])
        setAvisoBorrador(true)
      })
      .catch(() => { /* sin IndexedDB: simplemente no hay borrador */ })
      .finally(() => setRestaurado(true))
  }, [])

  // Guarda el borrador (con pausa, para no escribir en cada letra); si no hay nada o ya se publicó, lo borra
  useEffect(() => {
    if (!restaurado) return undefined
    const terminado = resultado && resultado.estado !== 'error'
    const vacio = !fotos.length && !cola.length && !sku && !precio && !titulo
    if (terminado || vacio) {
      borrarBorrador().catch(() => {})
      return undefined
    }
    const t = setTimeout(() => {
      guardarBorrador({
        t: Date.now(), sku, precio, cantidad, titulo, sugerencia, atributos, paquete,
        ref: ref === 'cargando' ? null : ref,
        fotos: fotos.map((f) => ({ file: f.file, blanco: !!f.blanco, original: f.original ? f.original.file : null })),
        cola,
      }).catch(() => { /* sin lugar o sin permiso: se sigue sin borrador */ })
    }, 400)
    return () => clearTimeout(t)
  }, [restaurado, sku, precio, cantidad, titulo, sugerencia, atributos, paquete, ref, fotos, cola, resultado])

  const descartarBorrador = () => {
    setFotos((prev) => { soltar(prev); return [] })
    setSku(''); setPrecio(''); setCantidad('1'); setTitulo('')
    setSugerencia(null); setAtributos([]); setRef(null); setCola([]); setResultado(null); setError(null)
    setPaquete(PAQUETE_VACIO); setPaqueteDeAntes(false)
    setAvisoBorrador(false)
    borrarBorrador().catch(() => {})
  }

  // Si la foto trae un código de barras legible, se carga solo (ahorra tipear con fotos viejas)
  const leerCodigoDeFoto = async (file) => {
    if (!('BarcodeDetector' in window)) return
    try {
      const bmp = await createImageBitmap(file)
      const codigos = await new window.BarcodeDetector().detect(bmp)
      bmp.close()
      if (codigos.length) setSku((prev) => prev || codigos[0].rawValue)
    } catch { /* sin código legible: se escribe o escanea */ }
  }

  // Arranca un producto nuevo con esta foto: sugerencia de título + lectura de código
  const cargarProducto = (foto) => {
    setFotos((prev) => { soltar(prev); return [foto] })
    fondoAutomatico([foto])
    setSku(''); setPrecio(''); setCantidad('1'); setTitulo('')
    setSugerencia(null); setAtributos([]); setResultado(null); setError(null); setEditandoTitulo(false); setRef(null); setPaquete(PAQUETE_VACIO); setPaqueteDeAntes(false)
    window.scrollTo({ top: 0 })
    leerCodigoDeFoto(foto.file)
    sugerir(foto.file, '')
  }

  // Achica una foto y arma el producto con ella (las de la cola se achican recién cuando les toca)
  const cargarDesdeArchivo = async (archivo) => {
    setPensando(true)
    try {
      const chica = await achicar(archivo, onUnauthorized)
      cargarProducto({ file: chica, url: URL.createObjectURL(chica) })
    } catch {
      setError(MSG_MEMORIA)
    } finally {
      setPensando(false)
    }
  }

  const procesarArchivos = async (archivos, desdeGaleria) => {
    if (!archivos.length) return
    if (desdeGaleria && archivos.length > 1 && fotos.length === 0) {
      setDecision(archivos) // archivos tal cual: no se achica ninguno hasta saber qué hacer
      return
    }
    setPensando(true)
    const nuevas = []
    try {
      for (const f of archivos.slice(0, MAX_FOTOS - fotos.length)) {
        const chica = await achicar(f, onUnauthorized)
        nuevas.push({ file: chica, url: URL.createObjectURL(chica) })
      }
    } catch {
      setError(MSG_MEMORIA)
    } finally {
      setPensando(false)
    }
    if (nuevas.length) incorporar(nuevas)
  }

  // Suma fotos ya achicadas al producto actual (vengan de la cámara, la galería o el celular)
  const incorporar = (nuevas) => {
    setFotos((prev) => [...prev, ...nuevas])
    fondoAutomatico(nuevas)
    // La primera foto dispara la sugerencia sola (si todavía no hay título)
    if (fotos.length === 0 && !titulo) {
      leerCodigoDeFoto(nuevas[0].file)
      sugerir(nuevas[0].file, sku)
    }
  }

  useEffect(() => {
    if (!camara) return undefined
    let stream = null
    let cancelado = false
    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1440 } },
          audio: false,
        })
        if (cancelado) return stream.getTracks().forEach((t) => t.stop())
        streamCamRef.current = stream
        videoCamRef.current.srcObject = stream
        await videoCamRef.current.play()
        const pista = stream.getVideoTracks()[0]
        setSoportaFlash(!!(pista.getCapabilities && pista.getCapabilities().torch))
      } catch {
        setCamara(false)
        setError('No pude abrir la cámara dentro de la página. Probá con "Cámara del celular".')
      }
    })()
    return () => {
      cancelado = true
      if (stream) stream.getTracks().forEach((t) => t.stop())
      streamCamRef.current = null
      setFlash(false)
    }
  }, [camara])

  const disparar = async () => {
    const v = videoCamRef.current
    if (!v || !v.videoWidth) return
    const escala = Math.min(1, LADO_MAX / Math.max(v.videoWidth, v.videoHeight))
    const lienzo = document.createElement('canvas')
    lienzo.width = Math.round(v.videoWidth * escala)
    lienzo.height = Math.round(v.videoHeight * escala)
    lienzo.getContext('2d').drawImage(v, 0, 0, lienzo.width, lienzo.height)
    const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/jpeg', 0.88))
    lienzo.width = lienzo.height = 0
    if (!blob) return setError(MSG_MEMORIA)
    const file = new File([blob], `foto-${Date.now()}.jpg`, { type: 'image/jpeg' })
    setTomadas((prev) => [...prev, { file, url: URL.createObjectURL(file) }])
    if (navigator.vibrate) navigator.vibrate(30)
  }

  const cerrarCamara = (conservar) => {
    const lista = tomadas
    setCamara(false)
    setTomadas([])
    if (conservar && lista.length) incorporar(lista)
    else soltar(lista)
  }

  const alternarFlash = async () => {
    const pista = streamCamRef.current && streamCamRef.current.getVideoTracks()[0]
    if (!pista) return
    try {
      await pista.applyConstraints({ advanced: [{ torch: !flash }] })
      setFlash(!flash)
    } catch { /* el celular no deja controlar la luz desde el navegador */ }
  }

  const abrirCamara = () => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) setCamara(true)
    else inputFoto.current.click() // navegador sin acceso directo a la cámara
  }

  const agregarFoto = (e) => {
    const archivos = Array.from(e.target.files || [])
    const galeria = e.target === inputGaleria.current
    e.target.value = ''
    procesarArchivos(archivos, galeria)
  }

  const elegirMismoProducto = async () => {
    const crudas = decision.slice(0, MAX_FOTOS)
    setDecision(null)
    setPensando(true)
    const nuevas = []
    try {
      for (const f of crudas) { // de a una, así nunca hay dos fotos grandes abiertas a la vez
        const chica = await achicar(f, onUnauthorized)
        nuevas.push({ file: chica, url: URL.createObjectURL(chica) })
      }
    } catch {
      setError(MSG_MEMORIA)
    } finally {
      setPensando(false)
    }
    if (!nuevas.length) return
    setFotos(nuevas)
    fondoAutomatico(nuevas)
    leerCodigoDeFoto(nuevas[0].file)
    sugerir(nuevas[0].file, sku)
  }

  const elegirUnoPorFoto = () => {
    const [primera, ...resto] = decision
    setDecision(null)
    setCola(resto)
    cargarDesdeArchivo(primera)
  }

  const saltarProducto = () => {
    if (!cola.length) return otro()
    const [siguiente, ...resto] = cola
    setCola(resto)
    cargarDesdeArchivo(siguiente)
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
      const chica = await achicar(f, onUnauthorized)
      const bmp = await createImageBitmap(chica)
      const codigos = await new window.BarcodeDetector().detect(bmp)
      bmp.close()
      if (codigos.length) setSku(codigos[0].rawValue)
      else setError('No se leyó ningún código de barras. Probá con más luz o escribilo.')
    } catch {
      setError('No se pudo leer el código. Escribilo a mano.')
    }
  }

  const cambiarCantidad = (d) => setCantidad(String(Math.max(1, (parseInt(cantidad, 10) || 1) + d)))
  const precioLindo = precio ? Number(precio).toLocaleString('es-AR') : ''

  // Fondo blanco: el backend recorta el producto y lo pone sobre blanco. Es por foto y reversible:
  // si el recorte sale mal (piezas brillantes u oscuras), se vuelve al original con un toque.
  const aplicarFondo = async (foto, auto = false) => {
    const url = foto.url
    setFotos((prev) => prev.map((f) => (f.url === url ? { ...f, procesando: true } : f)))
    if (!auto) setError(null)
    try {
      const fd = new FormData()
      fd.append('foto', foto.file)
      const res = await apiFetch('/publicador/rapido/fondo-blanco', { method: 'POST', body: fd }, onUnauthorized)
      if (!res.ok) throw new Error((await res.json()).detail || `Error ${res.status}`)
      const archivo = new File([await res.blob()], `fondo-blanco-${Date.now()}.jpg`, { type: 'image/jpeg' })
      setFotos((prev) => prev.map((f) => (f.url === url
        ? { file: archivo, url: URL.createObjectURL(archivo), blanco: true, original: f.original || { file: f.file, url: f.url } }
        : f)))
    } catch (e) {
      setFotos((prev) => prev.map((f) => (f.url === url ? { ...f, procesando: false } : f)))
      setError(auto ? `No pude sacar el fondo de una foto, quedó la original (${e.message})` : e.message)
    }
  }

  // Una por una: el backend recorta de a una foto por vez
  const fondoAutomatico = (lista) => {
    if (!fondoAuto) return
    lista.reduce((p, f) => p.then(() => aplicarFondo(f, true)), Promise.resolve())
  }

  const volverOriginal = (url) =>
    setFotos((prev) => prev.map((f) => (f.url === url && f.original ? { file: f.original.file, url: f.original.url } : f)))

  const sacarFoto = (i) => setFotos((prev) => { soltar([prev[i]]); return prev.filter((_, idx) => idx !== i) })

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

  const publicar = async (esReintento = false) => {
    const f = faltantes()
    if (f.length) return setError(`Falta ${f.join(', ')}.`)
    if (!esReintento) reintentoUsado.current = false
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
        JSON.stringify([
          ...atributos.map((a) => ({ id: a.id, value_name: a.valor, value_id: a.value_id })),
          ...(paqueteCompleto(paquete) ? atributosPaquete(paquete) : []),
        ])
      )
      fotos.forEach((x) => fd.append('fotos', x.file))
      const res = await apiFetch('/publicador/rapido/publicar', { method: 'POST', body: fd }, onUnauthorized)
      if (!res.ok) throw new Error((await res.json()).detail || `Error ${res.status}`)
      const data = await res.json()
      setResultado(data)
      if (data.estado !== 'error' && paqueteCompleto(paquete)) recordarPaquete(sugerencia && sugerencia.categoria, paquete)
      if (data.estado !== 'error') recordarFiscales(atributos)
      // Datos que ML pidió y no teníamos: aparecen en pantalla para completarlos
      if (data.faltantes && data.faltantes.length) {
        const nuevos = data.faltantes.filter((f) => !atributos.some((a) => a.id === f.id)).map((f) => conPredeterminados({ ...f, pedido: true }))
        setAtributos((prev) => [...prev, ...nuevos.filter((n) => !prev.some((a) => a.id === n.id))])
        // Si todo lo que ML pedía se completó solo (IVA, importación) y no faltan las medidas: se reintenta una vez
        if (nuevos.length && nuevos.every((n) => n.oculto) && !data.falta_paquete && !reintentoUsado.current) {
          reintentoUsado.current = true
          setReintento(true)
        }
      }
    } catch (e) {
      setError(e.message)
    } finally {
      setPublicando(false)
    }
  }

  useEffect(() => {
    if (!reintento) return
    setReintento(false)
    publicar(true)
  }, [reintento])

  const otro = () => {
    if (cola.length) {
      const [siguiente, ...resto] = cola
      setCola(resto)
      return cargarDesdeArchivo(siguiente)
    }
    setFotos((prev) => { soltar(prev); return [] }); setSku(''); setPrecio(''); setCantidad('1'); setTitulo('')
    setSugerencia(null); setAtributos([]); setResultado(null); setError(null); setEditandoTitulo(false); setRef(null); setPaquete(PAQUETE_VACIO); setPaqueteDeAntes(false)
    window.scrollTo({ top: 0 })
    // Ya con la cámara lista para el siguiente producto (el toque del botón habilita abrirla)
    setTimeout(abrirCamara, 50)
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
    try { fd.append('archivo', await achicar(f, onUnauthorized)) } catch { return setMsgConfig(MSG_MEMORIA) }
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
      {camara && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'flex', flexDirection: 'column' }}>
          <video ref={videoCamRef} playsInline muted style={{ flex: 1, minHeight: 0, width: '100%', objectFit: 'cover' }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', padding: 12 }}>
            <button onClick={() => cerrarCamara(false)} style={{ ...estiloSecundario, width: 'auto', minHeight: 44, padding: '0 16px', fontSize: 16 }}>Cancelar</button>
            {soportaFlash && <button onClick={alternarFlash} style={{ ...estiloChip(flash), minHeight: 44 }}>Luz {flash ? 'sí' : 'no'}</button>}
          </div>
          <div style={{ padding: '10px 16px 20px', background: 'rgba(0,0,0,0.6)' }}>
            {tomadas.length > 0 && (
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10 }}>
                {tomadas.map((t) => <img key={t.url} src={t.url} alt="" style={{ width: 52, height: 52, objectFit: 'cover', borderRadius: 6 }} />)}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 96, color: '#fff' }}>{tomadas.length}/{MAX_FOTOS - fotos.length}</div>
              <button onClick={disparar} disabled={fotos.length + tomadas.length >= MAX_FOTOS} aria-label="Sacar foto"
                style={{ width: 76, height: 76, borderRadius: 38, border: '5px solid #fff', background: 'var(--yellow)', cursor: 'pointer' }} />
              <button onClick={() => cerrarCamara(true)} disabled={!tomadas.length}
                style={{ ...estiloBoton, width: 96, minHeight: 48, fontSize: 16, opacity: tomadas.length ? 1 : 0.4 }}>Listo</button>
            </div>
          </div>
        </div>
      )}
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

      {avisoBorrador && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--card-bg)', border: '1px solid var(--gray-line)', padding: 10, borderRadius: 10, marginBottom: 12 }}>
          <div style={{ flex: 1, fontSize: 14 }}>Retomé lo que estabas cargando.</div>
          <button style={{ ...estiloSecundario, width: 'auto', minHeight: 40, padding: '0 14px', fontSize: 14 }} onClick={descartarBorrador}>Empezar de cero</button>
        </div>
      )}
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
          <button onClick={abrirCamara} style={{ width: '100%', height: 150, borderRadius: 14, border: '2px dashed var(--gray-line)', background: 'var(--card-bg)', color: 'var(--charcoal)', fontSize: 20, cursor: 'pointer' }}>
            Sacar foto
          </button>
          <button onClick={() => inputGaleria.current.click()} disabled={pensando} style={{ ...estiloSecundario, minHeight: 64, fontSize: 19 }}>
            {pensando ? 'Preparando fotos…' : 'Elegir de la galería'}
          </button>
          <button onClick={() => inputFoto.current.click()} style={{ ...estiloSecundario, minHeight: 44, fontSize: 14 }}>
            Cámara del celular (más calidad)
          </button>
        </div>
      ) : decision ? null : (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          {fotos.map((x, i) => (
            <div key={x.url} style={{ position: 'relative', flex: '0 0 auto' }}>
              <img src={x.url} alt="" style={{ width: 110, height: 110, objectFit: 'cover', borderRadius: 10 }} />
              <button onClick={() => sacarFoto(i)} aria-label="Quitar foto" style={{ position: 'absolute', top: -6, right: -6, width: 30, height: 30, borderRadius: 15, border: 'none', background: 'var(--alerta)', color: '#fff', fontSize: 18 }}>×</button>
              <button onClick={() => (x.blanco ? volverOriginal(x.url) : aplicarFondo(x))} disabled={x.procesando}
                style={{ display: 'block', width: 110, marginTop: 4, minHeight: 36, fontSize: 13, borderRadius: 8, cursor: 'pointer',
                  border: '1px solid var(--gray-line)', background: x.blanco ? 'var(--navy)' : 'var(--card-bg)', color: x.blanco ? '#fff' : 'var(--charcoal)' }}>
                {x.procesando ? 'Procesando…' : x.blanco ? 'Volver al original' : 'Fondo blanco'}
              </button>
            </div>
          ))}
          {fotos.length < MAX_FOTOS && (
            <>
              <button onClick={abrirCamara} aria-label="Sacar otra foto" style={{ flex: '0 0 auto', width: 110, height: 110, borderRadius: 10, border: '2px dashed var(--gray-line)', background: 'none', color: 'var(--charcoal)', fontSize: 16 }}>+ Cámara</button>
              <button onClick={() => inputGaleria.current.click()} aria-label="Agregar de la galería" style={{ flex: '0 0 auto', width: 110, height: 110, borderRadius: 10, border: '2px dashed var(--gray-line)', background: 'none', color: 'var(--charcoal)', fontSize: 16 }}>+ Galería</button>
            </>
          )}
        </div>
      )}

      <button onClick={cambiarFondoAuto} style={{ ...estiloChip(fondoAuto), minHeight: 40, fontSize: 14, margin: '10px 0 0' }}>
        Fondo blanco automático: {fondoAuto ? 'Sí' : 'No'}
      </button>

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
              {ref.perfil && (
                <div style={{ fontSize: 13, color: 'var(--gray-muted)', marginBottom: 4 }}>
                  Comparado con: <b>{ref.perfil.tipo}</b>{ref.perfil.marca ? ` · ${ref.perfil.marca}` : ''}{ref.perfil.modelos.length ? ` · ${ref.perfil.modelos.join(' / ')}` : ''}
                </div>
              )}
              <div style={{ fontSize: 14, color: 'var(--gray-muted)' }}>
                {ref.fuente === 'propias'
                  ? `Tus publicaciones parecidas (${ref.n})`
                  : ref.fuente === 'catalogo' ? `Catálogo de ML (${ref.n} precios)` : `Referencia en ML (${ref.n} publicaciones)`}
              </div>
              <div style={{ fontSize: 18, fontWeight: 600, margin: '4px 0 8px' }}>
                {ref.min === ref.max
                  ? `$${Number(ref.min).toLocaleString('es-AR')}`
                  : `$${Number(ref.min).toLocaleString('es-AR')} – $${Number(ref.max).toLocaleString('es-AR')}`}
              </div>
              {ref.perfil && ref.perfil.modelos.length > 0 && !ref.solo_exactas && (
                <div style={{ fontSize: 13, color: 'var(--atencion)', marginBottom: 8 }}>
                  Solo {ref.n_exactas} cubre{ref.n_exactas === 1 ? '' : 'n'} todos los modelos; el resto es de alguno de ellos (marcado abajo).
                </div>
              )}
              <button style={{ ...estiloChip(false), minHeight: 48, fontWeight: 600 }} onClick={() => setPrecio(String(Math.round(ref.mediana)))}>
                Usar {ref.n > 1 ? 'la mediana' : 'este precio'}: ${Number(ref.mediana).toLocaleString('es-AR')}
              </button>
              <details style={{ marginTop: 8 }}>
                <summary style={{ cursor: 'pointer', color: 'var(--gray-muted)', fontSize: 14 }}>Ver cuáles</summary>
                {ref.muestras.map((m, i) => (
                  <div key={i} style={{ fontSize: 14, marginTop: 6 }}>
                    ${Number(m.precio).toLocaleString('es-AR')}
                    {m.coincide && m.coincide.length > 0 && (
                      <span style={{ marginLeft: 6, padding: '1px 8px', borderRadius: 10, fontSize: 12, background: m.completo ? 'var(--ok)' : 'var(--paused-bg)', color: m.completo ? '#fff' : 'var(--charcoal)' }}>
                        {m.coincide.join(' + ')}
                      </span>
                    )} · {m.permalink ? <a href={m.permalink} target="_blank" rel="noreferrer">{(m.titulo || '').slice(0, 60)}</a> : (m.titulo || '').slice(0, 60)}
                  </div>
                ))}
                {ref.fuente === 'propias' && (
                  <div style={{ fontSize: 12, color: 'var(--gray-muted)', marginTop: 8 }}>
                    ML no deja ver los precios de otros vendedores, así que esto es lo que cobrás vos por el mismo repuesto para esos modelos.
                    {ref.diagnostico && ref.diagnostico.length > 0 && ` (${ref.diagnostico.join('; ')})`}
                  </div>
                )}
              </details>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--gray-muted)' }}>
              Sin precios de referencia{ref.perfil ? ` para ${ref.perfil.tipo}${ref.perfil.marca ? ' ' + ref.perfil.marca : ''}${ref.perfil.modelos.length ? ' ' + ref.perfil.modelos.join(' / ') : ''}` : ''}.
              <details>
                <summary style={{ cursor: 'pointer' }}>Por qué</summary>
                {(ref.diagnostico || [ref.motivo]).map((d, i) => <div key={i}>{d}</div>)}
              </details>
            </div>
          )}
        </div>
      )}

      {titulo.trim().length >= 4 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          {linksCompetencia(titulo, ref && ref !== 'cargando' ? ref.perfil : null).map((l) => (
            <a key={l.url} href={l.url} target="_blank" rel="noreferrer"
              style={{ flex: '1 1 auto', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, padding: '0 14px', borderRadius: 10,
                border: '1px solid var(--gray-line)', background: 'var(--card-bg)', color: 'var(--navy)', fontWeight: 600, textDecoration: 'none' }}>
              {l.etiqueta ? `Ver ${l.etiqueta} en Mercado Libre ↗` : 'Ver la competencia en Mercado Libre ↗'}
            </a>
          ))}
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

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 14, color: 'var(--gray-muted)', marginBottom: 4 }}>
          Paquete para el envío{paqueteDeAntes ? ' (las medidas de la última vez: revisalas)' : ''} · alto = profundidad
        </div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {PAQUETES_TIPO.map((t) => (
            <button key={t.nombre} onClick={() => { setPaquete(t.medidas); setPaqueteDeAntes(false) }}
              style={{ ...estiloChip(esPaqueteTipo(paquete, t.medidas)), flex: 1, minHeight: 64, padding: '4px 6px', borderRadius: 12, lineHeight: 1.25 }}>
              <div style={{ fontWeight: 600 }}>{t.nombre}</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{t.medidas.ancho}×{t.medidas.largo}×{t.medidas.alto} cm</div>
              <div style={{ fontSize: 12, opacity: 0.85 }}>{Number(t.medidas.peso) >= 1000 ? `${Number(t.medidas.peso) / 1000} kg` : `${t.medidas.peso} g`}</div>
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
          {[['alto', 'Alto cm'], ['ancho', 'Ancho cm'], ['largo', 'Largo cm'], ['peso', 'Peso g']].map(([k, et]) => (
            <label key={k} style={{ display: 'block' }}>
              <div style={{ fontSize: 12, color: 'var(--gray-muted)', marginBottom: 2 }}>{et}</div>
              <input style={{ ...estiloInput, fontSize: 18, padding: '10px 6px', textAlign: 'center',
                  borderColor: resultado && resultado.falta_paquete && !(parseFloat(paquete[k]) > 0) ? 'var(--alerta)' : undefined }}
                inputMode="decimal" value={paquete[k]}
                onChange={(e) => { setPaquete({ ...paquete, [k]: e.target.value.replace(',', '.').replace(/[^0-9.]/g, '') }); setPaqueteDeAntes(false) }} />
            </label>
          ))}
        </div>
      </div>

      {atributos.some((a) => a.pedido && !a.oculto) && (
        <div style={{ borderTop: '1px solid var(--gray-line)', paddingTop: 12, marginBottom: 8 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>ML pide estos datos</div>
          {atributos.map((a, i) => (!a.pedido || a.oculto) ? null : (
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
      {atributos.some((a) => a.oculto) && (
        <div style={{ fontSize: 13, color: 'var(--ok)', marginBottom: 8 }}>
          Datos fiscales automáticos: {atributos.filter((a) => a.oculto).map((a) => `${a.nombre} ${a.valor || (a.valores.find((v) => v.id === a.value_id) || {}).name || ''}`).join(' · ')}{' '}
          <button style={{ background: 'none', border: 'none', textDecoration: 'underline', padding: 0, fontSize: 'inherit', color: 'var(--navy)', cursor: 'pointer' }}
            onClick={() => setAtributos((prev) => prev.map((a) => (a.oculto ? { ...a, oculto: false } : a)))}>cambiar</button>
        </div>
      )}
      {atributos.some((a) => !a.pedido && !a.oculto) && (
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
        <button style={{ ...estiloBoton, opacity: publicando ? 0.6 : 1 }} onClick={publicar} disabled={publicando || pensando || fotos.some((f) => f.procesando)}>
          {publicando ? 'Publicando… (puede tardar unos segundos)' : fotos.some((f) => f.procesando) ? 'Preparando fotos…' : prueba ? 'Probar (no publica)' : 'Publicar'}
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
