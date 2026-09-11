import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

function Seccion({ titulo, items, seleccionados, toggleUno, toggleTodos, onImprimir, imprimiendo }) {
  const todosMarcados = items.length > 0 && items.every((it) => seleccionados.has(it.shipment_id))

  return (
    <div className="paste-box">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <label className="corte-label" style={{ marginBottom: 0 }}>{titulo} ({items.length})</label>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="sort-btn" onClick={() => toggleTodos(items)}>
            {todosMarcados ? 'Desmarcar todas' : 'Marcar todas'}
          </button>
          <button
            className="scan-btn"
            onClick={() => onImprimir(items.filter((it) => seleccionados.has(it.shipment_id)))}
            disabled={imprimiendo || items.every((it) => !seleccionados.has(it.shipment_id))}
          >
            🖨 Imprimir seleccionadas
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
        </div>
      ))}
    </div>
  )
}

function SeccionDespacho({ titulo, items }) {
  return (
    <div className="paste-box">
      <label className="corte-label" style={{ marginBottom: 10 }}>{titulo} ({items.length})</label>
      {items.length === 0 && <div className="empty-state">Nada para despachar acá ahora.</div>}
      {items.map((it) => (
        <div key={it.shipment_id} className="row">
          <div className="title-cell">
            {it.titulo}
            <span className="id-cell mono">{it.comprador} · Envío #{it.shipment_id}</span>
          </div>
          <span className="badge badge-explicada">🖨 Impresa</span>
        </div>
      ))}
    </div>
  )
}

export default function EtiquetasView({ onUnauthorized }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [seleccionados, setSeleccionados] = useState(new Set())
  const [imprimiendo, setImprimiendo] = useState(false)
  const [msg, setMsg] = useState(null)

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

  if (loading) return <div className="loading-state">Cargando etiquetas pendientes...</div>
  if (error) return <div className="error-state">Error: {error}</div>

  return (
    <>
      {msg && <div className="scan-result" style={{ margin: 'var(--pad)' }}>{msg}</div>}

      <Seccion
        titulo="📦 Colecta"
        items={data.colecta}
        seleccionados={seleccionados}
        toggleUno={toggleUno}
        toggleTodos={toggleTodos}
        onImprimir={imprimir}
        imprimiendo={imprimiendo}
      />
      <Seccion
        titulo="🚚 Flex"
        items={data.flex}
        seleccionados={seleccionados}
        toggleUno={toggleUno}
        toggleTodos={toggleTodos}
        onImprimir={imprimir}
        imprimiendo={imprimiendo}
      />

      <div style={{ margin: 'var(--pad) var(--pad) 4px', fontSize: 12, color: 'var(--gray-muted)', fontWeight: 700, textTransform: 'uppercase' }}>
        Ya impresas - listas para despachar
      </div>
      <SeccionDespacho titulo="📦 Colecta" items={data.despacho_colecta} />
      <SeccionDespacho titulo="🚚 Flex" items={data.despacho_flex} />
    </>
  )
}
