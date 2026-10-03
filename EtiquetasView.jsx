import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

function Seccion({ titulo, items, seleccionados, toggleUno, toggleTodos, onImprimir, onImprimirLocal, imprimiendo }) {
  const todosMarcados = items.length > 0 && items.every((it) => seleccionados.has(it.shipment_id))

  return (
    <div className="paste-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h2 className="section-title" style={{ margin: 0 }}>{titulo} ({items.length})</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="sort-btn" onClick={() => toggleTodos(items)}>
            {todosMarcados ? 'Desmarcar todas' : 'Marcar todas'}
          </button>
          <button
            className="scan-btn"
            onClick={() => onImprimirLocal(items.filter((it) => seleccionados.has(it.shipment_id)))}
            disabled={imprimiendo || items.every((it) => !seleccionados.has(it.shipment_id))}
          >
            🖨 Imprimir en el local
          </button>
          <button
            className="sort-btn"
            onClick={() => onImprimir(items.filter((it) => seleccionados.has(it.shipment_id)))}
            disabled={imprimiendo || items.every((it) => !seleccionados.has(it.shipment_id))}
            title="Abre el PDF para imprimir desde esta compu"
          >
            PDF
          </button>
        </div>
      </div>

      {items.length === 0 && <div className="empty-state">Sin etiquetas pendientes acá. 🎉</div>}

      {items.map((it) => (
        <div key={it.shipment_id} className="row">
          <input
            type="checkbox"
            className="pick-checkbox"
            checked={seleccionados.has(it.shipment_id)}
            onChange={() => toggleUno(it.shipment_id)}
          />
          <div className="title-cell">
            {it.titulo}
            <span className="id-cell mono">{it.comprador} · Envío #{it.shipment_id}</span>
          </div>
          {it.multiproducto && <span className="badge badge-multi">📦 Multiproducto</span>}
          {it.demorada && <span className="badge badge-sin-explicar">⏰ Demorada</span>}
        </div>
      ))}
    </div>
  )
}

function SeccionDespacho({ titulo, items, onImportar, importando }) {
  return (
    <div className="paste-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h2 className="section-title" style={{ margin: 0 }}>{titulo} ({items.length})</h2>
        {items.length > 0 && (
          <button className="sort-btn" onClick={() => onImportar(items)} disabled={importando}>
            📥 Importar a Control Embalaje
          </button>
        )}
      </div>
      {items.length === 0 && <div className="empty-state">Nada para despachar acá ahora.</div>}
      {items.map((it) => (
        <div key={it.shipment_id} className="row">
          <div className="title-cell">
            {it.titulo}
            <span className="id-cell mono">{it.comprador} · Envío #{it.shipment_id}</span>
          </div>
          {it.multiproducto && <span className="badge badge-multi">📦 Multiproducto</span>}
          {it.demorada && <span className="badge badge-sin-explicar">⏰ Demorada</span>}
          <span className="badge badge-explicada">🖨 Impresa</span>
        </div>
      ))}
    </div>
  )
}

const ESTADO_TRABAJO = {
  pendiente: { texto: '⏳ En cola', clase: 'badge-multi' },
  imprimiendo: { texto: '🖨 Imprimiendo', clase: 'badge-multi' },
  impresa: { texto: '✅ Impresa', clase: 'badge-explicada' },
  error: { texto: '⚠ Error', clase: 'badge-sin-explicar' },
}

function hora(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function PanelImpresora({ estado, onReintentar }) {
  if (!estado) return null
  const { agente, trabajos } = estado
  return (
    <div className="paste-box">
      <h2 className="section-title" style={{ margin: '0 0 8px' }}>
        {agente.vivo && !agente.problema ? '🟢' : '🔴'} Impresora del local
      </h2>
      <div className="id-cell" style={{ marginBottom: 10 }}>
        {agente.problema
          ? `Problema: ${agente.problema}`
          : agente.vivo
            ? `Conectada${agente.impresora ? ` · ${agente.impresora}` : ''}`
            : agente.ultimo_latido
              ? `Sin conexión desde las ${hora(agente.ultimo_latido)}. Revisá que la PC del local esté prendida. Lo que mandes sale cuando vuelva.`
              : 'Todavía no se conectó el programa de la PC del local.'}
      </div>
      {trabajos.slice(0, 5).map((t) => {
        const e = ESTADO_TRABAJO[t.estado] || ESTADO_TRABAJO.pendiente
        return (
          <div key={t.id} className="row">
            <div className="title-cell">
              {t.cantidad} etiqueta(s) · {hora(t.creado)}
              {t.error && <span className="id-cell mono">{t.error}</span>}
            </div>
            <span className={`badge ${e.clase}`}>{e.texto}</span>
            {(t.estado === 'error' || t.estado === 'impresa') && (
              <button className="sort-btn" onClick={() => onReintentar(t.id)}>Reimprimir</button>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function EtiquetasView({ onUnauthorized, onImportado }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [imprimiendo, setImprimiendo] = useState(false)
  const [msg, setMsg] = useState(null)
  const [importando, setImportando] = useState(false)
  const [estadoImp, setEstadoImp] = useState(null)

  const fetchDatos = () => {
    setLoading(true)
    apiFetch('/ml/etiquetas/pendientes', {}, onUnauthorized)
      .then((res) => res.json())
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }

  useEffect(fetchDatos, [])

  const fetchEstadoImpresora = () =>
    apiFetch('/impresion/estado', {}, onUnauthorized)
      .then((res) => res.json())
      .then(setEstadoImp)
      .catch(() => {}) // si falla un chequeo, el próximo lo corrige

  useEffect(() => {
    fetchEstadoImpresora()
    const id = setInterval(fetchEstadoImpresora, 5000)
    return () => clearInterval(id)
  }, [])

  const imprimirEnElLocal = (items) => {
    if (items.length === 0) return
    setImprimiendo(true)
    setMsg(null)
    const ids = items.map((it) => it.shipment_id).join(',')
    apiFetch(`/impresion/encolar?shipment_ids=${ids}`, { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setMsg(
          d.agente_vivo
            ? `✅ ${d.cantidad} etiqueta(s) mandadas a la impresora del local.`
            : `⚠ ${d.cantidad} etiqueta(s) en cola, pero la PC del local no está conectada. Salen apenas vuelva.`
        )
        setSeleccionados(new Set())
        fetchEstadoImpresora()
        fetchDatos()
      })
      .catch((err) => setMsg(`Error: ${err.message}`))
      .finally(() => setImprimiendo(false))
  }

  const reintentarTrabajo = (id) => {
    apiFetch(`/impresion/trabajos/${id}/reintentar`, { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        if (!res.ok) throw new Error((await res.json()).detail || 'Error')
        setMsg('✅ Mandada de nuevo a la impresora.')
        fetchEstadoImpresora()
      })
      .catch((err) => setMsg(`Error: ${err.message}`))
  }

  const toggleUno = (id) => {
    setSeleccionados((prev) => {
      const nuevo = new Set(prev)
      if (nuevo.has(id)) nuevo.delete(id)
      else nuevo.add(id)
      return nuevo
    })
  }

  const toggleTodos = (items) => {
    setSeleccionados((prev) => {
      const todosMarcados = items.every((it) => prev.has(it.shipment_id))
      const nuevo = new Set(prev)
      items.forEach((it) => {
        if (todosMarcados) nuevo.delete(it.shipment_id)
        else nuevo.add(it.shipment_id)
      })
      return nuevo
    })
  }

  const imprimir = (items) => {
    if (items.length === 0) return
    setImprimiendo(true)
    setMsg(null)
    const ids = items.map((it) => it.shipment_id).join(',')

    apiFetch(`/ml/etiquetas/imprimir?shipment_ids=${ids}`, { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        if (!res.ok) {
          const d = await res.json()
          throw new Error(d.detail || 'Error')
        }
        return res.blob()
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob)
        window.open(url, '_blank')
        setMsg(`✅ ${items.length} etiqueta(s) enviada(s) a imprimir. Se abrió el PDF en una pestaña nueva.`)
        setImprimiendo(false)
        setSeleccionados(new Set())
        fetchDatos() // ya deberían salir de la lista de pendientes
      })
      .catch((err) => {
        setMsg(`Error: ${err.message}`)
        setImprimiendo(false)
      })
  }

  const importarAControlEmbalaje = (items) => {
    setImportando(true)
    setMsg(null)
    apiFetch('/control-embalaje/importar-order-ids', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_ids: items.map((it) => String(it.order_id)) }),
    }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setMsg(`✅ ${d.productos_nuevos} producto(s) nuevo(s) importado(s) a Control Embalaje.`)
        setImportando(false)
        onImportado?.()
      })
      .catch((err) => {
        setMsg(`Error: ${err.message}`)
        setImportando(false)
      })
  }

  if (loading) return <div className="loading-state">Cargando etiquetas pendientes...</div>
  if (error) return <div className="error-state">Error: {error}</div>

  return (
    <>
      {msg && <div className="scan-result" style={{ margin: 'var(--pad)' }}>{msg}</div>}

      <PanelImpresora estado={estadoImp} onReintentar={reintentarTrabajo} />

      <Seccion
        titulo="📦 Colecta"
        items={data.colecta}
        seleccionados={seleccionados}
        toggleUno={toggleUno}
        toggleTodos={toggleTodos}
        onImprimir={imprimir}
        onImprimirLocal={imprimirEnElLocal}
        imprimiendo={imprimiendo}
      />
      <Seccion
        titulo="🚚 Flex"
        items={data.flex}
        seleccionados={seleccionados}
        toggleUno={toggleUno}
        toggleTodos={toggleTodos}
        onImprimir={imprimir}
        onImprimirLocal={imprimirEnElLocal}
        imprimiendo={imprimiendo}
      />

      <div style={{ margin: 'var(--pad) var(--pad) 4px', fontSize: 12, color: 'var(--gray-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
        Ya impresas - listas para despachar
      </div>
      <SeccionDespacho titulo="📦 Colecta" items={data.despacho_colecta} onImportar={importarAControlEmbalaje} importando={importando} />
      <SeccionDespacho titulo="🚚 Flex" items={data.despacho_flex} onImportar={importarAControlEmbalaje} importando={importando} />
    </>
  )
}
