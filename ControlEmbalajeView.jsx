import { useEffect, useMemo, useState } from 'react'
import { apiFetch } from './api.js'

export default function ControlEmbalajeView({ onUnauthorized }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [ocultarEmbalados, setOcultarEmbalados] = useState(false)
  const [horasCruce, setHorasCruce] = useState(24)

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
          texto += ` ⚠ No pude traer ${data.pedidos_fallidos.length} pedido(s).`
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

  const filtered = useMemo(() => {
    let result = items
    if (ocultarEmbalados) result = result.filter((it) => !it.checked)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      result = result.filter(
        (it) => it.titulo?.toLowerCase().includes(q) || it.sku?.toLowerCase().includes(q)
      )
    }
    return result
  }, [items, query, ocultarEmbalados])

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
        {msg && <div className="scan-result" style={{ padding: '10px 0' }}>{msg}</div>}
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
      </div>

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
            <div className="pick-title">
              {item.titulo}
              <span className="id-cell mono">SKU: {item.sku} · Cantidad: {item.cantidad}</span>
              {item.combo_con && (
                <span className="sale-together">También se vendió con: {item.combo_con}</span>
              )}
              {item.faltante_en_picking && (
                <span className="badge badge-sin-explicar">⚠ Marcado como faltante en "Para separar"</span>
              )}
              {!item.faltante_en_picking && item.separado_en_picking && (
                <span className="badge badge-explicada">✅ Ya está separado (visto en "Para separar")</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
