import { useCallback, useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'
import Modal from './Modal.jsx'
import ConfirmModal from './ConfirmModal.jsx'

export default function StockView({ onUnauthorized }) {
  const [umbral, setUmbral] = useState(15)
  const [alerts, setAlerts] = useState([])
  const [soloPendientes, setSoloPendientes] = useState(true)
  const [ordenMagnitud, setOrdenMagnitud] = useState('desc') // desc | asc | ninguno
  const [magnitudMinima, setMagnitudMinima] = useState(0)
  const [mostrarFiltros, setMostrarFiltros] = useState(false)
  const [direccionFiltro, setDireccionFiltro] = useState('todos') // todos | positiva | negativa
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState(null)
  const [lastScan, setLastScan] = useState(null)
  const [mostrarQuiebres, setMostrarQuiebres] = useState(false)
  const [quiebresData, setQuiebresData] = useState(null)
  const [cargandoQuiebres, setCargandoQuiebres] = useState(false)
  const [mostrarDiscrepancias, setMostrarDiscrepancias] = useState(false)
  const [discrepanciasData, setDiscrepanciasData] = useState(null)
  const [cargandoDiscrepancias, setCargandoDiscrepancias] = useState(false)
  const [errorDiscrepancias, setErrorDiscrepancias] = useState(null)
  const [progreso, setProgreso] = useState(null)
  const yaRefresqueTrasTerminar = useRef(true)

  useEffect(() => {
    if (!mostrarDiscrepancias) return
    let cancelado = false

    const consultarProgreso = () => {
      apiFetch('/stock/discrepancias-contabilium/progreso', {}, onUnauthorized)
        .then((res) => res.json())
        .then((d) => {
          if (cancelado) return
          setProgreso(d)
          if (d.corriendo) {
            yaRefresqueTrasTerminar.current = false
          } else if (!yaRefresqueTrasTerminar.current) {
            yaRefresqueTrasTerminar.current = true
            apiFetch('/stock/discrepancias-contabilium', {}, onUnauthorized)
              .then((res) => res.json())
              .then(setDiscrepanciasData)
          }
        })
        .catch(() => {})
    }

    consultarProgreso()
    const intervalo = setInterval(consultarProgreso, 1500)
    return () => {
      cancelado = true
      clearInterval(intervalo)
    }
  }, [mostrarDiscrepancias, onUnauthorized])

  const toggleQuiebres = () => {
    const abrir = !mostrarQuiebres
    setMostrarQuiebres(abrir)
    if (abrir) setMostrarDiscrepancias(false)
    if (abrir && !quiebresData) {
      setCargandoQuiebres(true)
      apiFetch('/metricas/quiebres-stock?dias=90', {}, onUnauthorized)
        .then((res) => res.json())
        .then((d) => {
          setQuiebresData(d)
          setCargandoQuiebres(false)
        })
        .catch(() => setCargandoQuiebres(false))
    }
  }

  const toggleDiscrepancias = () => {
    const abrir = !mostrarDiscrepancias
    setMostrarDiscrepancias(abrir)
    if (abrir) setMostrarQuiebres(false)
    if (abrir && !discrepanciasData) {
      setCargandoDiscrepancias(true)
      setErrorDiscrepancias(null)
      apiFetch('/stock/discrepancias-contabilium', {}, onUnauthorized)
        .then(async (res) => {
          const d = await res.json()
          if (!res.ok) throw new Error(d.detail || 'Error')
          return d
        })
        .then((d) => {
          setDiscrepanciasData(d)
          setCargandoDiscrepancias(false)
        })
        .catch((err) => {
          setErrorDiscrepancias(err.message)
          setCargandoDiscrepancias(false)
        })
    }
  }

  const [actualizandoDiscrepancias, setActualizandoDiscrepancias] = useState(false)
  const [msgActualizarDiscrepancias, setMsgActualizarDiscrepancias] = useState(null)

  const actualizarDiscrepanciasAhora = () => {
    setActualizandoDiscrepancias(true)
    setMsgActualizarDiscrepancias(null)
    apiFetch('/stock/discrepancias-contabilium/actualizar', { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setMsgActualizarDiscrepancias(
          d.ya_estaba_corriendo
            ? '⏳ Ya había una actualización en curso - esperá a que termine.'
            : '✅ Actualización disparada. Corre en el servidor y puede tardar varios minutos (por el límite de Contabilium) - volvé a entrar acá en un rato para ver el resultado.'
        )
        setActualizandoDiscrepancias(false)
      })
      .catch((err) => {
        setMsgActualizarDiscrepancias(`Error: ${err.message}`)
        setActualizandoDiscrepancias(false)
      })
  }


  const fetchAlerts = useCallback(() => {
    const params = new URLSearchParams({
      horas: '72',
      solo_pendientes: soloPendientes ? 'true' : 'false',
    })
    apiFetch(`/ml/stock/alerts?${params}`, {}, onUnauthorized)
      .then((res) => {
        if (!res.ok) throw new Error(`El backend respondió ${res.status}`)
        return res.json()
      })
      .then((json) => {
        setAlerts(json.alertas)
        setError(null)
        setLoading(false)
      })
      .catch((err) => {
        setError(err.message)
        setLoading(false)
      })
  }, [soloPendientes, onUnauthorized])

  useEffect(() => {
    setLoading(true)
    fetchAlerts()
  }, [fetchAlerts])

  const handleScan = () => {
    setScanning(true)
    setError(null)
    apiFetch(`/ml/stock/scan?umbral=${umbral}`, { method: 'POST' }, onUnauthorized)
      .then((res) => {
        if (!res.ok) throw new Error(`El backend respondió ${res.status}`)
        return res.json()
      })
      .then((json) => {
        setLastScan(json)
        setScanning(false)
        fetchAlerts()
      })
      .catch((err) => {
        setError(err.message)
        setScanning(false)
      })
  }

  const toggleRevisado = (alerta) => {
    const nuevoValor = !alerta.revisado
    setAlerts((prev) =>
      prev.map((a) => (a.id === alerta.id ? { ...a, revisado: nuevoValor } : a))
    )
    apiFetch(`/ml/stock/alerts/${alerta.id}/revisar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ revisado: nuevoValor }),
    }, onUnauthorized).catch(() => {
      setAlerts((prev) =>
        prev.map((a) => (a.id === alerta.id ? { ...a, revisado: !nuevoValor } : a))
      )
    })
  }

  const [revirtiendoId, setRevirtiendoId] = useState(null)
  const [confirmacion, setConfirmacion] = useState(null)
  const [revertirError, setRevertirError] = useState(null)

  const [revertirInfo, setRevertirInfo] = useState(null)

  const revertirCambio = (alerta) => {
    setConfirmacion({
      mensaje: `¿Devolver el stock de "${alerta.title}" a ${alerta.stock_anterior} unidades (el valor de antes del cambio)?`,
      peligroso: true,
      onConfirmar: () => ejecutarRevertirCambio(alerta),
    })
  }

  const ejecutarRevertirCambio = (alerta) => {
    setRevirtiendoId(alerta.id)
    setRevertirError(null)
    setRevertirInfo(null)
    apiFetch(`/ml/stock/alerts/${alerta.id}/revertir`, { method: 'POST' }, onUnauthorized)
      .then((res) => {
        if (!res.ok) return res.json().then((data) => { throw new Error(data.detail || 'Error') })
        return res.json()
      })
      .then((data) => {
        setAlerts((prev) =>
          prev.map((a) => (a.id === alerta.id ? { ...a, revisado: true, revertido: true } : a))
        )
        setRevirtiendoId(null)

        const c = data.contabilium
        if (!c || !c.intentado) {
          setRevertirInfo('Revertido en ML. Contabilium no está conectado todavía - actualizalo a mano ahí.')
        } else if (c.ok && c.simulado) {
          setRevertirInfo(`Revertido en ML. Contabilium en modo simulación (no escribió nada real).`)
        } else if (c.ok) {
          setRevertirInfo('Revertido en ML y en Contabilium. ✅')
        } else {
          setRevertirInfo(`Revertido en ML, pero Contabilium dio error: ${c.error}`)
        }
      })
      .catch((err) => {
        setRevertirError(`No se pudo revertir "${alerta.title}": ${err.message}`)
        setRevirtiendoId(null)
      })
  }

  const [mostrarModalFull, setMostrarModalFull] = useState(false)
  const [enviosFull, setEnviosFull] = useState(null)
  const [cargandoEnviosFull, setCargandoEnviosFull] = useState(false)
  const [errorEnviosFull, setErrorEnviosFull] = useState(null)
  const [envioSeleccionado, setEnvioSeleccionado] = useState(null)
  const [descuadreData, setDescuadreData] = useState(null)
  const [cargandoDescuadre, setCargandoDescuadre] = useState(false)
  const [chequeandoAhora, setChequeandoAhora] = useState(false)
  const [errorDescuadre, setErrorDescuadre] = useState(null)

  const abrirModalFull = () => {
    setMostrarModalFull(true)
    setEnvioSeleccionado(null)
    setDescuadreData(null)
    setErrorDescuadre(null)
    setCargandoEnviosFull(true)
    setErrorEnviosFull(null)
    apiFetch('/full/envios/enviados', {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setEnviosFull(d.envios)
        setCargandoEnviosFull(false)
      })
      .catch((err) => {
        setErrorEnviosFull(err.message)
        setCargandoEnviosFull(false)
      })
  }

  const elegirEnvioFull = (envio) => {
    setEnvioSeleccionado(envio)
    setDescuadreData(null)
    setErrorDescuadre(null)
    setCargandoDescuadre(true)
    apiFetch(`/full/envios/${envio.id}/descuadre`, {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setDescuadreData(d)
        setCargandoDescuadre(false)
      })
      .catch((err) => {
        setErrorDescuadre(err.message)
        setCargandoDescuadre(false)
      })
  }

  const chequearAhoraFull = () => {
    if (!envioSeleccionado) return
    setChequeandoAhora(true)
    setErrorDescuadre(null)
    apiFetch(`/full/envios/${envioSeleccionado.id}/chequear-descuadre`, { method: 'POST' }, onUnauthorized)
      .then(async (res) => {
        const d = await res.json()
        if (!res.ok) throw new Error(d.detail || 'Error')
        return d
      })
      .then((d) => {
        setDescuadreData(d)
        setChequeandoAhora(false)
      })
      .catch((err) => {
        setErrorDescuadre(err.message)
        setChequeandoAhora(false)
      })
  }

  const cerrarModalFull = () => {
    setMostrarModalFull(false)
    setEnvioSeleccionado(null)
    setDescuadreData(null)
  }

  const filtrosActivos = (umbral !== 15 ? 1 : 0) + (magnitudMinima > 0 ? 1 : 0) + (ordenMagnitud !== 'desc' ? 1 : 0) + (mostrarQuiebres ? 1 : 0) + (mostrarDiscrepancias ? 1 : 0)

  const alertsFiltradas = (() => {
    let resultado = alerts.filter((a) => {
      if (Math.abs(a.diferencia) < magnitudMinima) return false
      if (direccionFiltro === 'positiva' && a.diferencia <= 0) return false
      if (direccionFiltro === 'negativa' && a.diferencia >= 0) return false
      return true
    })
    if (ordenMagnitud === 'desc') {
      resultado = [...resultado].sort((a, b) => Math.abs(b.diferencia) - Math.abs(a.diferencia))
    } else if (ordenMagnitud === 'asc') {
      resultado = [...resultado].sort((a, b) => Math.abs(a.diferencia) - Math.abs(b.diferencia))
    }
    return resultado
  })()

  return (
    <>
      <div className="controls">
        <button className="scan-btn" onClick={handleScan} disabled={scanning}>
          {scanning ? 'Escaneando...' : '🔍 Escanear ahora'}
        </button>

        <button className="sort-btn btn-toggle" aria-pressed={soloPendientes} onClick={() => setSoloPendientes((v) => !v)}>
          Solo pendientes
        </button>

        <div className="tabs">
          <button className={`tab ${direccionFiltro === 'todos' ? 'active' : ''}`} onClick={() => setDireccionFiltro('todos')}>
            Todos
          </button>
          <button className={`tab ${direccionFiltro === 'positiva' ? 'active' : ''}`} onClick={() => setDireccionFiltro('positiva')}>
            ↑ Subieron
          </button>
          <button className={`tab ${direccionFiltro === 'negativa' ? 'active' : ''}`} onClick={() => setDireccionFiltro('negativa')}>
            ↓ Bajaron
          </button>
        </div>

        <button className="sort-btn" onClick={() => setMostrarFiltros((v) => !v)}>
          Filtros {filtrosActivos > 0 ? `(${filtrosActivos}) ` : ''}{mostrarFiltros ? '▲' : '▼'}
        </button>

        <button className="sort-btn" onClick={abrirModalFull}>
          📦 Chequear discrepancias por Full
        </button>
      </div>

      {mostrarFiltros && (
        <div className="controls">
          <label className="corte-label">
            Umbral (unidades)
            <input
              type="number"
              className="corte-input"
              value={umbral}
              onChange={(e) => setUmbral(Number(e.target.value))}
              min={1}
              style={{ width: 90 }}
            />
          </label>
          <span className="umbral-hint">
            Las pausas por quedar en 0 sin venta que lo explique se avisan siempre, aunque sean chicas
          </span>

          <button
            className="sort-btn"
            onClick={() => setOrdenMagnitud((v) => (v === 'desc' ? 'asc' : v === 'asc' ? 'ninguno' : 'desc'))}
          >
            {ordenMagnitud === 'desc' && '↓ Mayor cambio primero'}
            {ordenMagnitud === 'asc' && '↑ Menor cambio primero'}
            {ordenMagnitud === 'ninguno' && '↕ Sin ordenar'}
          </button>

          <label className="corte-label" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            Cambio mínimo
            <input
              type="number"
              className="corte-input"
              value={magnitudMinima}
              onChange={(e) => setMagnitudMinima(Number(e.target.value) || 0)}
              min={0}
              style={{ width: 70 }}
            />
          </label>

          <button className="sort-btn" onClick={toggleQuiebres}>
            📉 {mostrarQuiebres ? 'Ocultar' : 'Ver'} quiebres históricos
          </button>

          <button className="sort-btn" onClick={toggleDiscrepancias}>
            ⚠ {mostrarDiscrepancias ? 'Ocultar' : 'Ver'} discrepancias con Contabilium
          </button>
        </div>
      )}

      {lastScan && (
        <div className="scan-result">
          Último escaneo: {lastScan.productos_escaneados} productos revisados,{' '}
          {lastScan.alertas_nuevas.length} alerta(s) nueva(s) (umbral ±{lastScan.umbral}).
        </div>
      )}

      {!mostrarQuiebres && !mostrarDiscrepancias && (
      <div className="list">
        {loading && <div className="loading-state">Cargando alertas...</div>}
        {error && <div className="error-state">Error: {error}</div>}
        {revertirError && <div className="error-state">{revertirError}</div>}
        {revertirInfo && <div className="scan-result">{revertirInfo}</div>}

        {!loading && !error && (
          <>
            {alerts.length === 0 && (
              <div className="empty-state">
                Sin movimientos masivos de stock registrados. 🎉
              </div>
            )}
            {alerts.length > 0 && alertsFiltradas.length === 0 && (
              <div className="empty-state">Nada coincide con estos filtros.</div>
            )}

            {alertsFiltradas.map((a) => (
              <div key={a.id} className={`alert-row ${a.revisado ? 'alert-row-revisada' : ''}`}>
                <input
                  type="checkbox"
                  className="pick-checkbox"
                  checked={a.revisado}
                  onChange={() => toggleRevisado(a)}
                  title="Marcar como revisado"
                />
                <div className="alert-title">
                  {a.title}
                  <span className="id-cell mono">SKU: {a.sku}</span>
                  {a.revertido && <span className="badge badge-revertido">↩ Revertido</span>}
                  {!a.revertido && a.motivo === 'pausa' && (
                    <span className="badge badge-sin-explicar">
                      ⏸ Se pausó al quedar en 0 - revisar (¿venta de mostrador?)
                    </span>
                  )}
                  {!a.revertido && a.motivo !== 'pausa' && a.diferencia < 0 && (
                    a.diferencia_no_explicada >= 0 ? (
                      <span className="badge badge-explicada">
                        ✅ Coincide con ventas ML ({a.ventas_periodo})
                      </span>
                    ) : (
                      <span className="badge badge-sin-explicar">
                        ⚠️ No coincide con ventas ML ({a.diferencia_no_explicada}) - revisar
                      </span>
                    )
                  )}
                </div>
                <div className="alert-change mono">
                  {a.stock_anterior} → {a.stock_nuevo}
                </div>
                <div className={`alert-diff mono ${a.diferencia < 0 ? 'diff-neg' : 'diff-pos'}`}>
                  {a.diferencia > 0 ? '+' : ''}{a.diferencia}
                </div>
                {!a.revertido && (
                  <button
                    className="revert-btn"
                    onClick={() => revertirCambio(a)}
                    disabled={revirtiendoId === a.id}
                  >
                    {revirtiendoId === a.id ? 'Revirtiendo...' : `↩ Volver a ${a.stock_anterior}`}
                  </button>
                )}
                <div className="alert-time mono">
                  {new Date(a.detected_at).toLocaleString('es-AR', {
                    day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
      )}

      {mostrarQuiebres && (
        <div className="list">
          <h2 className="section-title" style={{ margin: '0 0 6px 12px' }}>
            Quiebres de stock (últimos 90 días)
          </h2>
          {cargandoQuiebres && <div className="loading-state">Cargando...</div>}
          {quiebresData && quiebresData.productos.length === 0 && (
            <div className="empty-state">Sin quiebres registrados todavía en este período.</div>
          )}
          {quiebresData?.productos.map((p) => (
            <div key={p.sku} className="row">
              <div className="title-cell">
                {p.titulo || p.sku}
                <span className="id-cell mono">SKU: {p.sku}</span>
              </div>
              <span className="badge badge-sin-explicar">{p.veces_sin_stock}x sin stock</span>
              <span className="badge badge-acordar">{p.dias_totales_sin_stock} día(s) totales</span>
              <span className="id-cell mono">~{p.promedio_dias_por_quiebre} días/vez</span>
            </div>
          ))}
        </div>
      )}

      {mostrarDiscrepancias && (
        <div className="list">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, margin: '0 0 6px 12px' }}>
            <h2 className="section-title" style={{ margin: 0 }}>
              Stock en 0 en ML, pero con stock en Contabilium
            </h2>
            <button
              className="sort-btn"
              onClick={actualizarDiscrepanciasAhora}
              disabled={actualizandoDiscrepancias || progreso?.corriendo}
            >
              {(actualizandoDiscrepancias || progreso?.corriendo) ? '🔄 Actualizando...' : '🔄 Actualizar ahora'}
            </button>
          </div>

          {progreso?.corriendo && (
            <div style={{ margin: '0 12px 12px' }}>
              <div style={{ background: 'var(--gray-line)', borderRadius: 8, overflow: 'hidden', height: 10 }}>
                <div
                  style={{
                    width: progreso.total > 0 ? `${(progreso.revisados / progreso.total) * 100}%` : '0%',
                    background: 'var(--navy)',
                    height: '100%',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '6px 0 0' }}>
                {progreso.revisados}/{progreso.total} revisados
                {progreso.titulo_actual && ` · Ahora: ${progreso.titulo_actual}`}
                {progreso.encontradas > 0 && ` · ${progreso.encontradas} discrepancia(s) encontrada(s) hasta ahora`}
              </p>
            </div>
          )}
          {discrepanciasData?.ultima_actualizacion && (
            <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '0 0 8px 12px' }}>
              Última actualización: {new Date(discrepanciasData.ultima_actualizacion).toLocaleString('es-AR')}
            </p>
          )}
          {!discrepanciasData?.ultima_actualizacion && !cargandoDiscrepancias && (
            <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '0 0 8px 12px' }}>
              Todavía no se corrió ninguna actualización - tocá "Actualizar ahora" (tarda unos minutos, corre solo una vez y después queda guardado).
            </p>
          )}
          {msgActualizarDiscrepancias && <div className="scan-result" style={{ margin: '0 0 8px 12px' }}>{msgActualizarDiscrepancias}</div>}
          {cargandoDiscrepancias && <div className="loading-state">Cargando...</div>}
          {errorDiscrepancias && <div className="error-state">Error: {errorDiscrepancias}</div>}
          {discrepanciasData && discrepanciasData.discrepancias.length === 0 && (
            <div className="empty-state">Ninguna discrepancia guardada - lo que está en 0 en ML, también está en 0 en Contabilium.</div>
          )}
          {discrepanciasData?.discrepancias.map((p) => (
            <div key={p.sku} className="row">
              {p.foto_url && <img src={p.foto_url} alt="" className="pick-thumb" />}
              <div className="title-cell">
                {p.titulo}
                <span className="id-cell mono">SKU: {p.sku}</span>
              </div>
              <span className="badge badge-sin-explicar">ML: 0</span>
              <span className="badge badge-explicada">Contabilium: {p.stock_contabilium}</span>
            </div>
          ))}
        </div>
      )}

      {mostrarModalFull && (
        <Modal titulo="📦 Discrepancias por Full" onCerrar={cerrarModalFull}>
          {!envioSeleccionado && (
                <>
                  <p className="tutorial-texto" style={{ marginBottom: 14 }}>
                    Elegí un Envío Full ya mandado para ver cómo venía el stock en
                    Contabilium antes de cerrarlo, y compararlo contra el stock
                    actual cuando quieras chequearlo (esto puede tardar horas o
                    días en desconfigurarse, así que no hay apuro).
                  </p>
                  {cargandoEnviosFull && <div className="loading-state">Cargando envíos...</div>}
                  {errorEnviosFull && <div className="error-state">Error: {errorEnviosFull}</div>}
                  {enviosFull && enviosFull.length === 0 && (
                    <div className="empty-state">Todavía no hay ningún Full mandado.</div>
                  )}
                  {enviosFull?.map((e) => (
                    <button
                      key={e.id}
                      className="tutorial-indice-item"
                      onClick={() => elegirEnvioFull(e)}
                    >
                      <span>
                        {e.nombre}
                        <span className="id-cell" style={{ display: 'block' }}>
                          {e.fecha_enviado && new Date(e.fecha_enviado).toLocaleString('es-AR', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                          {' · '}{e.total_skus} producto(s)
                          {e.ya_chequeado > 0 && ` · ${e.ya_chequeado} ya chequeado(s)`}
                        </span>
                      </span>
                      <span>›</span>
                    </button>
                  ))}
                </>
          )}

          {envioSeleccionado && (
                <>
                  <button
                    className="sort-btn"
                    style={{ marginBottom: 12 }}
                    onClick={() => { setEnvioSeleccionado(null); setDescuadreData(null) }}
                  >
                    ← Elegir otro envío
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
                    <strong>{envioSeleccionado.nombre}</strong>
                    <button
                      className="scan-btn"
                      onClick={chequearAhoraFull}
                      disabled={chequeandoAhora}
                    >
                      {chequeandoAhora ? '🔄 Chequeando...' : '🔄 Chequear ahora'}
                    </button>
                  </div>

                  {cargandoDescuadre && <div className="loading-state">Cargando...</div>}
                  {errorDescuadre && <div className="error-state">Error: {errorDescuadre}</div>}

                  {descuadreData?.snapshots.map((s) => {
                    const tieneDespues = s.stock_despues !== null && s.stock_despues !== undefined
                    const hayDiferencia = tieneDespues && s.diferencia !== 0
                    return (
                      <div key={s.sku} className="row">
                        <div className="title-cell">
                          {s.titulo}
                          <span className="id-cell mono">SKU: {s.sku}</span>
                        </div>
                        <span className="badge badge-explicada">Antes: {s.stock_antes ?? '?'}</span>
                        {tieneDespues ? (
                          <span className={`badge ${hayDiferencia ? 'badge-sin-explicar' : 'badge-explicada'}`}>
                            Ahora: {s.stock_despues} ({s.diferencia > 0 ? '+' : ''}{s.diferencia})
                          </span>
                        ) : (
                          <span className="id-cell">Todavía sin chequear</span>
                        )}
                        {s.error_antes && <span className="id-cell">⚠ antes: {s.error_antes}</span>}
                        {s.error_despues && <span className="id-cell">⚠ ahora: {s.error_despues}</span>}
                      </div>
                    )
                  })}
                </>
          )}
        </Modal>
      )}

      {confirmacion && (
        <ConfirmModal
          mensaje={confirmacion.mensaje}
          peligroso={confirmacion.peligroso}
          onConfirmar={() => { const fn = confirmacion.onConfirmar; setConfirmacion(null); fn() }}
          onCancelar={() => setConfirmacion(null)}
        />
      )}
    </>
  )
}
