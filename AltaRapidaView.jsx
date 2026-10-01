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
  const [descripcion, setDescripcion] = useState('')
  const [placaUrl, setPlacaUrl] = useState(null)
  const [msgConfig, setMsgConfig] = useState(null)
  const inputFoto = useRef(null)
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
      setAtributos(data.atributos || [])
      if (data.codigo_visible && !codigo) setSku(data.codigo_visible)
    } catch (e) {
      setError(`No pude sugerir el título: ${e.message}. Lo podés escribir a mano.`)
    } finally {
      setPensando(false)
    }
  }

  const agregarFoto = async (e) => {
    const archivos = Array.from(e.target.files || [])
    e.target.value = ''
    if (!archivos.length) return
    const nuevas = []
    for (const f of archivos.slice(0, MAX_FOTOS - fotos.length)) {
      const chica = await achicar(f)
      nuevas.push({ file: chica, url: URL.createObjectURL(chica) })
    }
    const todas = [...fotos, ...nuevas]
    setFotos(todas)
    // La primera foto dispara la sugerencia sola (si todavía no hay título)
    if (fotos.length === 0 && nuevas.length && !titulo) sugerir(nuevas[0].file, sku)
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
    setFotos([]); setSku(''); setPrecio(''); setCantidad('1'); setTitulo('')
    setSugerencia(null); setAtributos([]); setResultado(null); setError(null)
    window.scrollTo({ top: 0 })
  }

  const guardarDescripcion = async () => {
    const res = await apiFetch('/publicador/config/descripcion', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ texto: descripcion }),
    }, onUnauthorized)
    setMsgConfig(res.ok ? 'Descripción guardada.' : 'No se pudo guardar.')
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
        <button style={estiloBoton} onClick={otro}>Cargar otro producto</button>
      </div>
    )
  }

  return (
    <div style={{ width: '100%', maxWidth: 520, margin: '0 auto', padding: '0 16px 90px', boxSizing: 'border-box' }}>
      <h2 style={{ marginBottom: 4 }}>Alta rápida</h2>
      <p style={{ color: 'var(--gray-muted)', marginTop: 0 }}>Foto, código y precio. Se carga en Contabilium y se publica en ML.</p>

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

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        {fotos.map((x, i) => (
          <div key={x.url} style={{ position: 'relative' }}>
            <img src={x.url} alt="" style={{ width: 84, height: 84, objectFit: 'cover', borderRadius: 8 }} />
            <button onClick={() => sacarFoto(i)} aria-label="Quitar foto" style={{ position: 'absolute', top: -6, right: -6, width: 26, height: 26, borderRadius: 13, border: 'none', background: 'var(--alerta)', color: '#fff' }}>×</button>
          </div>
        ))}
      </div>
      <input ref={inputFoto} type="file" accept="image/*" capture="environment" multiple onChange={agregarFoto} style={{ display: 'none' }} />
      <button style={estiloBoton} onClick={() => inputFoto.current.click()} disabled={fotos.length >= MAX_FOTOS}>
        {fotos.length ? `Agregar otra foto (${fotos.length}/${MAX_FOTOS})` : 'Sacar foto'}
      </button>

      <div style={{ height: 18 }} />

      <Campo etiqueta="Código (el de Contabilium)">
        <div style={{ display: 'flex', gap: 8 }}>
          <input style={estiloInput} value={sku} onChange={(e) => setSku(e.target.value)} autoCapitalize="characters" autoCorrect="off" placeholder="Ej: BP-1234" />
          <input ref={inputBarras} type="file" accept="image/*" capture="environment" onChange={leerBarras} style={{ display: 'none' }} />
          <button style={{ ...estiloSecundario, width: 'auto', padding: '0 14px' }} onClick={() => inputBarras.current.click()} title="Leer código de barras">|||</button>
        </div>
      </Campo>

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 2 }}><Campo etiqueta="Precio de venta ($)"><input style={estiloInput} type="number" inputMode="decimal" value={precio} onChange={(e) => setPrecio(e.target.value)} /></Campo></div>
        <div style={{ flex: 1 }}><Campo etiqueta="Cantidad"><input style={estiloInput} type="number" inputMode="numeric" min="1" value={cantidad} onChange={(e) => setCantidad(e.target.value)} /></Campo></div>
      </div>

      <Campo etiqueta={`Título (${titulo.length}/60)`} nota={sugerencia && sugerencia.categoria_nombre ? `Categoría: ${sugerencia.categoria_nombre}` : null}>
        <textarea style={{ ...estiloInput, minHeight: 72 }} maxLength={60} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={pensando ? 'Mirando la foto…' : 'Se sugiere solo con la primera foto'} />
      </Campo>
      <button style={{ ...estiloSecundario, minHeight: 44, fontSize: 15, marginBottom: 16 }} onClick={() => fotos[0] && sugerir(fotos[0].file, sku)} disabled={!fotos.length || pensando}>
        {pensando ? 'Pensando…' : 'Sugerir título y datos con la foto'}
      </button>

      {atributos.length > 0 && (
        <div style={{ borderTop: '1px solid var(--gray-line)', paddingTop: 12 }}>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Datos que pide ML</div>
          {atributos.map((a, i) => (
            <Campo key={a.id} etiqueta={a.nombre}>
              {a.valores && a.valores.length > 0 ? (
                <select style={estiloInput} value={a.value_id} onChange={(e) => editarAtributo(i, { value_id: e.target.value })}>
                  <option value="">Elegir…</option>
                  {a.valores.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                </select>
              ) : (
                <input style={estiloInput} value={a.valor} onChange={(e) => editarAtributo(i, { valor: e.target.value })} />
              )}
            </Campo>
          ))}
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
          <button style={estiloSecundario} onClick={guardarDescripcion}>Guardar descripción</button>
          <div style={{ height: 16 }} />
          <div style={{ fontSize: 14, color: 'var(--gray-muted)', marginBottom: 6 }}>Placa gris (va como última foto)</div>
          {placaUrl && <img src={placaUrl} alt="Placa" style={{ width: '100%', borderRadius: 8, marginBottom: 8 }} />}
          <label style={{ ...estiloSecundario, display: 'flex', alignItems: 'center', justifyContent: 'center', boxSizing: 'border-box' }}>
            {placaUrl ? 'Cambiar placa' : 'Subir placa'}
            <input type="file" accept="image/*" onChange={subirPlaca} style={{ display: 'none' }} />
          </label>
          {msgConfig && <p style={{ color: 'var(--ok)' }}>{msgConfig}</p>}
        </div>
      )}
    </div>
  )
}
