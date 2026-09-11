import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api.js'
import ImageLightbox from './ImageLightbox.jsx'

export default function ControlEmbalajeView({ onUnauthorized }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [zoomUrl, setZoomUrl] = useState(null)
  const [catalogo, setCatalogo] = useState([])
  const [ocultarEmbalados, setOcultarEmbalados] = useState(false)
  const [horasCruce, setHorasCruce] = useState(24)
  const [filtroTipo, setFiltroTipo] = useState('todos') // todos | colecta | flex
  const [escuchando, setEscuchando] = useState(false)
  const [finalizando, setFinalizando] = useState(false)
  const [mostrarHistorial, setMostrarHistorial] = useState(false)
  const [historial, setHistorial] = useState(null)

  const [textoPegado, setTextoPegado] = useState('')
  const [procesando, setProcesando] = useState(false)
  const [msg, setMsg] = useState(null)
  const [limpiando, setLimpiando] = useState(false)

  const fetchLista = () => {
    apiFetch(`/control-embalaje?horas_cruce=${horasCruce}`, {}, onUnauthorized)
      .then((res) => res.json())
      .then((data) => {
        setItems(data.items)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(() => {
    setLoading(true)
    fetchLista()
  }, [horasCruce])

  useEffect(() => {
    apiFetch('/ml/items', {}, onUnauthorized)
      .then((res) => res.json())
      .then((data) => setCatalogo(data.items || []))
  }, [])

  const fotoPorSku = useMemo(() => {
    const mapa = {}
    catalogo.forEach((it) => {
      if (it.sku) mapa[it.sku] = { chica: it.foto_url, grande: it.foto_grande || it.foto_url }
    })
    return mapa
  }, [catalogo])

  const procesarTexto = () => {
    if (!textoPegado.trim()) return
    setProcesando(true)
    setMsg(null)
    apiFetch('/control-embalaje/importar-texto', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto: textoPegado }),
    }, onUnauthorized)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
        return data
      })
      .then((data) => {
        let texto = `${data.productos_nuevos} producto(s) nuevo(s) de ${data.pedidos_detectados} pedido(s) detectado(s).`
        if (data.pedidos_fallidos.length > 0) {
          const motivos = {}
          data.pedidos_fallidos.forEach((f) => {
            motivos[f.motivo] = (motivos[f.motivo] || 0) + 1
          })
          const resumenMotivos = Object.entries(motivos)
            .map(([motivo, cant]) => `${cant}x ${motivo}`)
            .join(', ')
          const ids = data.pedidos_fallidos.map((f) => f.order_id).join(', ')
          texto += ` ⚠ No pude traer ${data.pedidos_fallidos.length} pedido(s): ${resumenMotivos}.\n\nIDs: ${ids}`
        }
        setMsg(texto)
        setTextoPegado('')
        setProcesando(false)
        fetchLista()
      })
      .catch((err) => {
        setMsg(`Error: ${err.message}`)
        setProcesando(false)
      })
  }

  const toggleChecked = (item) => {
    const nuevo = !item.checked
    setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, checked: nuevo } : it)))
    apiFetch(`/control-embalaje/${item.id}/toggle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ checked: nuevo }),
    }, onUnauthorized).catch(() => fetchLista())
  }

  const toggleFaltante = (item) => {
    const nuevo = !item.faltante_en_picking
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, faltante_en_picking: nuevo } : it))
    )
    apiFetch(`/control-embalaje/${item.id}/faltante`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ faltante: nuevo }),
    }, onUnauthorized)
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json()
          throw new Error(data.detail || 'Error')
        }
      })
      .catch((err) => {
        setMsg(`Error al marcar faltante: ${err.message}`)
        fetchLista()
      })
  }

  const finalizarEmbalaje = () => {
    const sinEmbalar = items.filter((it) => !it.checked).length
    const confirmMsg = sinEmbalar > 0
      ? `Todavía hay ${sinEmbalar} sin embalar. ¿Finalizar igual? Se guarda todo en el historial y se vacía la lista.`
      : '¿Finalizar el embalaje de hoy? Se guarda en el historial y se vacía la lista.'
    if (!confirm(confirmMsg)) return

    setFinalizando(true)
    apiFetch('/control-embalaje/finalizar', { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Error')
        return data
      })
      .then((data) => {
        const lineas = [
          `✅ Embalaje finalizado y guardado`,
          `Total: ${data.total} · Embalados: ${data.embalados} · Sin embalar: ${data.sin_embalar}`,
          `Faltantes (cruzado con "Para separar"): ${data.faltantes}`,
          `Colecta: ${data.colecta} · Flex: ${data.flex}`,
        ]
        setMsg(lineas.join('\n'))
        setFinalizando(false)
        fetchLista()
      })
      .catch((err) => {
        setMsg(`Error: ${err.message}`)
        setFinalizando(false)
      })
  }

  const toggleHistorial = () => {
    const abrir = !mostrarHistorial
    setMostrarHistorial(abrir)
    if (abrir && !historial) {
      apiFetch('/control-embalaje/historial', {}, onUnauthorized)
        .then((res) => res.json())
        .then((data) => setHistorial(data.registros))
    }
  }

  const limpiarTodo = () => {
    if (!confirm('¿Vaciar todo el checklist? Se borra todo lo que hay, embalado o no.')) return
    setLimpiando(true)
    apiFetch('/control-embalaje', { method: 'DELETE' }, onUnauthorized)
      .then(() => {
        setLimpiando(false)
        fetchLista()
      })
      .catch(() => setLimpiando(false))
  }

  const buscarPorVoz = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Este navegador no tiene reconocimiento de voz (probá con Chrome).')
      return
    }
    const recognition = new SpeechRecognition()
    recognition.lang = 'es-AR'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setEscuchando(true)
    recognition.onend = () => setEscuchando(false)
    recognition.onerror = () => setEscuchando(false)
    recognition.onresult = (event) => {
      const texto = event.results[0][0].transcript

      const filtro = extraerComandoFiltro(texto)
      if (filtro) {
        setFiltroTipo(filtro)
        setQuery('')
        hablar(filtro === 'todos' ? 'Mostrando todos' : `Mostrando ${filtro}`)
        return
      }

      const comando = extraerComandoMarcar(texto)
      if (comando) {
        const textoBusqueda = comando.busqueda || query
        setQuery(textoBusqueda)
        if (comando.indice === 'todos') {
          ejecutarMarcadoTodos(textoBusqueda)
        } else {
          ejecutarMarcado(textoBusqueda, comando.indice)
        }
      } else {
        setQuery(texto)
      }
    }

    recognition.start()
  }

  // Reconoce frases como "mangueras gol marcarlo", "marcar segundo",
  // "marcar el tres", "juan gomez marcar todos" - separa la búsqueda (si
  // hay) del comando.
  // Reconoce "traer colecta" / "traer flex" / "traer todos" - cambia el
  // filtro de tipo de envío por voz, para después poder decir "marcar
  // todos" sobre lo que quedó filtrado.
  const extraerComandoFiltro = (textoOriginal) => {
    const texto = textoOriginal.toLowerCase().trim()
    if (/^(traer|mostrar)\s+colecta$/.test(texto)) return 'colecta'
    if (/^(traer|mostrar)\s+flex$/.test(texto)) return 'flex'
    if (/^(traer|mostrar)\s+todos?$/.test(texto)) return 'todos'
    return null
  }

  const extraerComandoMarcar = (textoOriginal) => {
    const texto = textoOriginal.toLowerCase().trim()
    const patrones = [
      { patron: /\s*marca(r)?(los)?\s+todos?$/, indice: 'todos' },
      { patron: /\s*marca(r)?(lo)?\s*(el\s+)?(primero|uno)?$/, indice: 0 },
      { patron: /\s*marca(r)?\s+(el\s+)?(segundo|dos)$/, indice: 1 },
      { patron: /\s*marca(r)?\s+(el\s+)?(tercero|tres)$/, indice: 2 },
    ]
    for (const { patron, indice } of patrones) {
      const m = texto.match(patron)
      if (m && m.index !== undefined) {
        return { busqueda: texto.slice(0, m.index).trim(), indice }
      }
    }
    return null
  }

  const hablar = (texto) => {
    if (!window.speechSynthesis) return
    const utter = new SpeechSynthesisUtterance(texto)
    utter.lang = 'es-AR'
    window.speechSynthesis.speak(utter)
  }

  // Misma lógica de filtrado que usa la lista en pantalla, pero
  // reutilizable para calcular sobre qué actuar cuando llega un comando
  // de voz (no puede depender del estado 'filtered' porque todavía no
  // se actualizó cuando llega el comando).
  const aplicarFiltros = (lista, textoQuery, tipo, ocultar) => {
    let result = lista
    if (ocultar) result = result.filter((it) => !it.checked)
    if (tipo !== 'todos') result = result.filter((it) => it.tipo_envio === tipo)
    if (textoQuery.trim()) {
      const q = normalizarTexto(textoQuery)
      result = result.filter(
        (it) =>
          normalizarTexto(it.titulo).includes(q) ||
          normalizarTexto(it.sku).includes(q) ||
          normalizarTexto(it.comprador).includes(q)
      )
    }
    return result
  }

  const ejecutarMarcado = (textoBusqueda, indice) => {
    const resultado = aplicarFiltros(items, textoBusqueda, filtroTipo, ocultarEmbalados)
    const item = resultado[indice]
    if (!item) {
      hablar(`No encontré ningún producto en esa posición para "${textoBusqueda}"`)
      return
    }
    if (item.checked) {
      hablar(`${item.titulo} ya estaba marcado`)
      return
    }
    toggleChecked(item)
    hablar(`Marqué: ${item.titulo}`)
  }

  const ejecutarMarcadoTodos = (textoBusqueda) => {
    const resultado = aplicarFiltros(items, textoBusqueda, filtroTipo, ocultarEmbalados)
    const pendientes = resultado.filter((it) => !it.checked)
    if (resultado.length === 0) {
      hablar(`No encontré ningún producto para "${textoBusqueda}"`)
      return
    }
    if (pendientes.length === 0) {
      hablar('Ya estaban todos marcados')
      return
    }
    pendientes.forEach((item) => toggleChecked(item))
    hablar(`Marqué ${pendientes.length} producto${pendientes.length === 1 ? '' : 's'}`)
  }

  // Ignora espacios de más o de menos al buscar - "juan gomez" tiene que
  // encontrar "JuanGomez" y viceversa, sin importar de qué lado falta
  // el espacio (pasa seguido con el reconocimiento de voz).
  // Ignora espacios de más o de menos, y también tildes/acentos - "bujia"
  // tiene que encontrar "Bujía" y viceversa, sin importar de qué lado
  // falta la tilde (pasa seguido con el reconocimiento de voz).
  const normalizarTexto = (s) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '')

  const filtered = useMemo(
    () => aplicarFiltros(items, query, filtroTipo, ocultarEmbalados),
    [items, query, ocultarEmbalados, filtroTipo]
  )

  const embalados = items.filter((it) => it.checked).length

  return (
    <>
      <div className="paste-box">
        <label className="corte-label" style={{ marginBottom: 8 }}>
          Pegá el texto de "Listo para recolección/envío" de ML
        </label>
        <textarea
          className="paste-textarea"
          rows={4}
          placeholder="Copiá y pegá toda la pantalla acá..."
          value={textoPegado}
          onChange={(e) => setTextoPegado(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
          <button className="scan-btn" onClick={procesarTexto} disabled={procesando}>
            {procesando ? 'Procesando...' : '📋 Agregar al control'}
          </button>
        </div>
        {msg && <div className="scan-result" style={{ padding: '10px 0', whiteSpace: 'pre-wrap' }}>{msg}</div>}
      </div>

      <div className="controls">
        <input
          className="search-input"
          type="text"
          placeholder="Buscar por título o SKU..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          className={`sort-btn ${escuchando ? 'toggle-on-red' : ''}`}
          onClick={buscarPorVoz}
          title="Buscar por voz"
        >
          {escuchando ? '🔴 Escuchando...' : '🎤 Voz'}
        </button>
        <div className="tabs">
          <button
            className={`tab ${filtroTipo === 'todos' ? 'active' : ''}`}
            onClick={() => setFiltroTipo('todos')}
          >
            Todos
          </button>
          <button
            className={`tab tab-colecta ${filtroTipo === 'colecta' ? 'active' : ''}`}
            onClick={() => setFiltroTipo('colecta')}
          >
            Colecta
          </button>
          <button
            className={`tab tab-flex ${filtroTipo === 'flex' ? 'active' : ''}`}
            onClick={() => setFiltroTipo('flex')}
          >
            Flex
          </button>
        </div>
        <button
          className={`sort-btn ${ocultarEmbalados ? 'toggle-on-green' : ''}`}
          onClick={() => setOcultarEmbalados((v) => !v)}
        >
          {ocultarEmbalados ? '✓ ' : ''}Ocultar embalados
        </button>
        <label className="corte-label">
          Cruce (hs)
          <input
            type="number"
            className="corte-input"
            value={horasCruce}
            onChange={(e) => setHorasCruce(Number(e.target.value))}
            min={1}
            style={{ width: 60 }}
          />
        </label>
        <button className="sort-btn" onClick={limpiarTodo} disabled={limpiando}>
          🗑 Vaciar todo
        </button>
        <button className="scan-btn" onClick={finalizarEmbalaje} disabled={finalizando || items.length === 0}>
          ✅ Finalizar embalaje
        </button>
        <button className="sort-btn" onClick={toggleHistorial}>
          📜 {mostrarHistorial ? 'Ocultar' : 'Ver'} historial
        </button>
      </div>

      {mostrarHistorial && (
        <div className="paste-box">
          {!historial && <div className="loading-state">Cargando historial...</div>}
          {historial && historial.length === 0 && (
            <div className="empty-state">Todavía no finalizaste ningún embalaje.</div>
          )}
          {historial && historial.map((reg) => (
            <div key={reg.id} className="paste-result-row" style={{ display: 'block' }}>
              <strong>{new Date(reg.fecha).toLocaleString('es-AR')}</strong>
              <span className="id-cell mono" style={{ display: 'block' }}>
                {reg.embalados}/{reg.total_productos} embalados
              </span>
            </div>
          ))}
        </div>
      )}

      {!loading && !error && (
        <div className="summary">
          <div className="summary-item">
            <div className="value mono">{items.length}</div>
            <div className="label">Total en control</div>
          </div>
          <div className="summary-item">
            <div className="value mono">{embalados}</div>
            <div className="label">Embalados</div>
          </div>
          <div className="summary-item warn">
            <div className="value mono">{items.length - embalados}</div>
            <div className="label">Sin embalar</div>
          </div>
        </div>
      )}

      <div className="list">
        {loading && <div className="loading-state">Cargando...</div>}
        {error && <div className="error-state">Error: {error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div className="empty-state">
            No hay nada en el control. Pegá el texto de ML arriba para arrancar.
          </div>
        )}

        {!loading && !error && filtered.map((item) => (
          <div key={item.id} className={`pick-row ${item.checked ? 'pick-row-checked' : ''}`}>
            <input
              type="checkbox"
              className="pick-checkbox"
              checked={item.checked}
              onChange={() => toggleChecked(item)}
            />
            {fotoPorSku[item.sku] && (
              <img
                src={fotoPorSku[item.sku].chica}
                alt=""
                className="pick-thumb"
                onClick={() => setZoomUrl(fotoPorSku[item.sku].grande)}
              />
            )}
            <div className="pick-title">
              {item.titulo}
              <span className="id-cell mono">
                SKU: {item.sku} · Cantidad: {item.cantidad}
                {item.comprador && ` · Comprador: ${item.comprador}`}
              </span>
              {item.tipo_envio && (
                <span className={`badge badge-${item.tipo_envio === 'colecta' ? 'colecta' : 'flex'}`}>
                  {item.tipo_envio === 'colecta' ? 'Colecta' : 'Flex'}
                </span>
              )}
              {item.combo_con && (
                <span className="sale-together">También se vendió con: {item.combo_con}</span>
              )}
              {item.faltante_en_picking && (
                <span className="badge badge-sin-explicar">⚠ Marcado como faltante en "Para separar"</span>
              )}
              {!item.faltante_en_picking && item.separado_en_picking && (
                <span className="badge badge-explicada">✅ Ya está separado (visto en "Para separar")</span>
              )}
              {item.etiqueta_impresa && (
                <span className="badge badge-explicada">🖨 Etiqueta impresa - listo para despachar</span>
              )}
              <button
                type="button"
                className={`faltante-btn ${item.faltante_en_picking ? 'faltante-btn-active' : ''}`}
                onClick={() => toggleFaltante(item)}
                title="Marcar como faltante en el local"
              >
                {item.faltante_en_picking ? '⚠ Faltante' : 'Faltante'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <ImageLightbox url={zoomUrl} onClose={() => setZoomUrl(null)} />
    </>
  )
}
