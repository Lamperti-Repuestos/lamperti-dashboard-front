import { useCallback, useEffect, useState } from 'react'
import { apiFetch } from './api.js'

export default function StockView({ onUnauthorized }) {
  const [umbral, setUmbral] = useState(15)
  const [alerts, setAlerts] = useState([])
  const [soloPendientes, setSoloPendientes] = useState(true)
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
        setMsgActualizarDiscrepancias(`✅ ${d.revisados} revisado(s), ${d.discrepancias_encontradas} discrepancia(s) encontrada(s).`)
        setActualizandoDiscrepancias(false)
        apiFetch('/stock/discrepancias-contabilium', {}, onUnauthorized)
          .then((res) => res.json())
          .then(setDiscrepanciasData)
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
  const [revertirError, setRevertirError] = useState(null)

  const [revertirInfo, setRevertirInfo] = useState(null)

  const revertirCambio = (alerta) => {
    if (!confirm(
      `¿Devolver el stock de "${alerta.title}" a ${alerta.stock_anterior} unidades ` +
      `(el valor de antes del cambio)?`
    )) return

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

  return (
    <>
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

        <button className="scan-btn" onClick={handleScan} disabled={scanning}>
          {scanning ? 'Escaneando...' : '🔍 Escanear ahora'}
        </button>

        <button className="sort-btn" onClick={() => setSoloPendientes((v) => !v)}>
          {soloPendientes ? '✓ ' : ''}Solo pendientes
        </button>

        <button className="sort-btn" onClick={toggleQuiebres}>
          📉 {mostrarQuiebres ? 'Ocultar' : 'Ver'} quiebres históricos
        </button>

        <button className="sort-btn" onClick={toggleDiscrepancias}>
          ⚠ {mostrarDiscrepancias ? 'Ocultar' : 'Ver'} discrepancias con Contabilium
        </button>
      </div>

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

            {alerts.map((a) => (
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
          <label className="corte-label" style={{ margin: '0 0 6px 12px' }}>
            Quiebres de stock (últimos 90 días)
          </label>
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
            <label className="corte-label" style={{ marginBottom: 0 }}>
              Stock en 0 en ML, pero con stock en Contabilium
            </label>
            <button className="sort-btn" onClick={actualizarDiscrepanciasAhora} disabled={actualizandoDiscrepancias}>
              {actualizandoDiscrepancias ? '🔄 Actualizando (tarda unos minutos)...' : '🔄 Actualizar ahora'}
            </button>
          </div>
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
    </>
  )
}
