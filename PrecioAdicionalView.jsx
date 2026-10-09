import { useEffect, useMemo, useRef, useState } from 'react'
import { apiFetch } from './api.js'
import ConfirmModal from './ConfirmModal.jsx'
import AlertModal from './AlertModal.jsx'

const FILAS_POR_PAGINA = 50
const FRANJAS = [
  ['hasta $15.000', 500], ['hasta $30.000', 1000], ['hasta $45.000', 1500], ['hasta $60.000', 2000],
  ['hasta $75.000', 2500], ['hasta $90.000', 3000], ['hasta $105.000', 3500],
]

const plata = (n) => (n == null ? '—' : `$${Math.round(n).toLocaleString('es-AR')}`)

const FILTROS = [
  { id: 'ajustar', label: 'A ajustar' },
  { id: 'aplicada', label: 'Ya aplicadas' },
  { id: 'omitir', label: 'No se tocan' },
  { id: 'todas', label: 'Todas' },
]

const normalizar = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

async function leerError(res) {
  try {
    const data = await res.json()
    return data.detail || `Error ${res.status}`
  } catch {
    return `Error ${res.status}`
  }
}

export default function PrecioAdicionalView({ onUnauthorized }) {
  const [planilla, setPlanilla] = useState(null)
  const [calculando, setCalculando] = useState(false)
  const [error, setError] = useState(null)
  const [filtro, setFiltro] = useState('ajustar')
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(0)
  const [confirmacion, setConfirmacion] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [aplicandoId, setAplicandoId] = useState(null)
  const [job, setJob] = useState(null)
  const sondeo = useRef(null)

  const calcular = () => {
    setCalculando(true)
    setError(null)
    apiFetch('/precio-adicional/planilla', {}, onUnauthorized)
      .then(async (res) => {
        if (!res.ok) throw new Error(await leerError(res))
        return res.json()
      })
      .then((data) => {
        setPlanilla(data)
        setPagina(0)
      })
      .catch((e) => setError(e.message))
      .finally(() => setCalculando(false))
  }

  const traerEstado = () =>
    apiFetch('/precio-adicional/estado', {}, onUnauthorized)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setJob(data)
        return data
      })
      .catch(() => null)

  // Al abrir la pantalla: si hay un ajuste corriendo (o recién terminado), se muestra su avance.
  useEffect(() => {
    traerEstado()
    return () => clearInterval(sondeo.current)
  }, [])

  useEffect(() => {
    clearInterval(sondeo.current)
    if (job?.estado === 'corriendo') {
      sondeo.current = setInterval(async () => {
        const nuevo = await traerEstado()
        if (nuevo && nuevo.estado !== 'corriendo') {
          clearInterval(sondeo.current)
          calcular()
        }
      }, 2500)
    }
    return () => clearInterval(sondeo.current)
  }, [job?.estado])

  const corriendo = job?.estado === 'corriendo'

  const aplicarTodas = () => {
    const n = planilla.resumen.ajustar
    apiFetch('/precio-adicional/aplicar-todas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cantidad_esperada: n }),
    }, onUnauthorized)
      .then(async (res) => {
        if (!res.ok) throw new Error(await leerError(res))
        setJob(await res.json())
      })
      .catch((e) => setAviso(e.message))
  }

  const aplicarUna = (fila) => {
    setAplicandoId(fila.id_combinado)
    apiFetch('/precio-adicional/aplicar-una', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id_combinado: fila.id_combinado, titulo: fila.titulo, adicional_nuevo_esperado: fila.adicional_nuevo }),
    }, onUnauthorized)
      .then(async (res) => {
        if (!res.ok) throw new Error(await leerError(res))
        return res.json()
      })
      .then((r) => {
        setPlanilla((prev) => {
          const filas = prev.filas.map((f) => (f.id_combinado === fila.id_combinado ? { ...f, accion: 'aplicada', motivo: 'ya recibió este ajuste' } : f))
          const resumen = { ...prev.resumen, ajustar: prev.resumen.ajustar - 1, aplicada: prev.resumen.aplicada + 1 }
          return { filas, resumen }
        })
        const verificado = r.verificacion === 'ok'
          ? 'Contabilium confirmó el valor nuevo.'
          : r.verificacion === 'distinto'
            ? 'ATENCIÓN: Contabilium devolvió un valor distinto. Revisalo en Contabilium.'
            : 'Contabilium no devolvió el valor para confirmarlo: revisalo en su pantalla.'
        setAviso(`Listo: "${fila.titulo}"\nAdicional: ${plata(r.adicional_anterior)} → ${plata(r.adicional_nuevo)}\n\n${verificado}`)
      })
      .catch((e) => setAviso(e.message))
      .finally(() => setAplicandoId(null))
  }

  const pedirConfirmacionUna = (fila) =>
    setConfirmacion({
      mensaje: `"${fila.titulo}"\n\nPrecio ${plata(fila.precio)} → se suman ${plata(fila.incremento)} al adicional:\n${plata(fila.adicional_actual)} → ${plata(fila.adicional_nuevo)}\n\nEsto cambia el adicional en Contabilium. ¿Aplicar solo a esta publicación?`,
      onConfirmar: () => aplicarUna(fila),
    })

  const pedirConfirmacionTodas = () => {
    const r = planilla.resumen
    const minutos = Math.max(1, Math.round((r.ajustar * 0.7) / 60))
    setConfirmacion({
      peligroso: true,
      textoConfirmar: `Sí, aplicar a las ${r.ajustar}`,
      mensaje: `Vas a cambiar el adicional de ${r.ajustar} publicaciones en Contabilium (suma total ${plata(r.suma_incrementos)}).\n\nSe aplica de a una y tarda unos ${minutos} minutos; podés dejar la pantalla abierta o cerrarla. Los precios en Mercado Libre se actualizan en la próxima sincronización de Contabilium.\n\nNo hay botón para deshacerlo desde acá (queda el registro del antes y el después). ¿Seguimos?`,
      onConfirmar: aplicarTodas,
    })
  }

  const filas = useMemo(() => {
    if (!planilla) return []
    const q = normalizar(busqueda)
    return planilla.filas.filter((f) => {
      if (filtro !== 'todas' && f.accion !== filtro) return false
      return !q || normalizar(f.titulo).includes(q) || normalizar(f.sku).includes(q) || normalizar(f.id_producto).includes(q)
    })
  }, [planilla, filtro, busqueda])

  const paginas = Math.max(1, Math.ceil(filas.length / FILAS_POR_PAGINA))
  const visibles = filas.slice(pagina * FILAS_POR_PAGINA, (pagina + 1) * FILAS_POR_PAGINA)
  const r = planilla?.resumen

  return (
    <div>
      <div className="paste-box">
        <label className="corte-label" style={{ marginBottom: 8 }}>Precio adicional por franja de precio</label>
        <p style={{ fontSize: 13, lineHeight: 1.5, margin: '0 0 8px' }}>
          A cada publicación <strong>activa</strong> de Mercado Libre en Contabilium se le <strong>suma</strong> al "Precio adicional" que ya tiene
          un monto según su precio:
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {FRANJAS.map(([tope, suma]) => (
            <span key={tope} className="badge badge-multi" style={{ fontSize: 12 }}>{tope}: +${suma.toLocaleString('es-AR')}</span>
          ))}
          <span className="badge" style={{ fontSize: 12, background: 'var(--gray-muted)' }}>más de $105.000: no se toca</span>
        </div>
        <p style={{ fontSize: 13, color: 'var(--gray-muted)', margin: '0 0 10px' }}>
          "Calcular" solo lee y arma la planilla: <strong>no cambia nada</strong>. Los cambios se mandan únicamente cuando apretás
          "Aplicar solo a esta" o "Aplicar a todas".
        </p>
        <button className="scan-btn" onClick={calcular} disabled={calculando || corriendo}>
          {calculando ? 'Leyendo Contabilium… (puede tardar un minuto)' : planilla ? 'Volver a calcular' : 'Calcular planilla'}
        </button>
        {error && <p style={{ color: 'var(--alerta)', marginTop: 10 }}>{error}</p>}
      </div>

      {job && job.estado !== 'inactivo' && (
        <div className="paste-box" style={{ borderLeft: `4px solid ${corriendo ? 'var(--info)' : job.fallidas ? 'var(--atencion)' : 'var(--ok)'}` }}>
          <label className="corte-label" style={{ marginBottom: 6 }}>
            {corriendo ? 'Aplicando el ajuste…' : 'Último ajuste masivo'}
          </label>
          <div style={{ background: 'var(--paused-bg)', borderRadius: 6, height: 10, overflow: 'hidden', marginBottom: 6 }}>
            <div style={{ width: `${job.total ? Math.round(((job.hechas + job.fallidas) / job.total) * 100) : 0}%`, height: '100%', background: 'var(--ok)' }} />
          </div>
          <div style={{ fontSize: 14 }}>
            <strong>{job.hechas}</strong> de {job.total} aplicadas
            {job.fallidas > 0 && <span style={{ color: 'var(--alerta)' }}> · {job.fallidas} con error</span>}
            {!corriendo && ' · terminó'}
          </div>
          {job.errores?.length > 0 && (
            <ul style={{ fontSize: 12, color: 'var(--alerta)', margin: '8px 0 0', paddingLeft: 18 }}>
              {job.errores.map((e, i) => <li key={i}>{e.titulo}: {e.error}</li>)}
            </ul>
          )}
        </div>
      )}

      {planilla && (
        <>
          <div className="paste-box">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, alignItems: 'center' }}>
              <div><div style={{ fontSize: 24, fontWeight: 700 }}>{r.total}</div><div style={{ fontSize: 12 }}>publicaciones activas</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--info)' }}>{r.ajustar}</div><div style={{ fontSize: 12 }}>a ajustar</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--ok)' }}>{r.aplicada}</div><div style={{ fontSize: 12 }}>ya aplicadas</div></div>
              <div><div style={{ fontSize: 24, fontWeight: 700, color: 'var(--gray-muted)' }}>{r.omitir}</div><div style={{ fontSize: 12 }}>no se tocan</div></div>
              <div style={{ marginLeft: 'auto' }}>
                <button className="btn-peligro" onClick={pedirConfirmacionTodas} disabled={r.ajustar === 0 || corriendo}>
                  Aplicar a todas ({r.ajustar})
                </button>
              </div>
            </div>
            {r.ajustar > 0 && (
              <p style={{ fontSize: 13, margin: '10px 0 0' }}>Suma total de los incrementos: <strong>{plata(r.suma_incrementos)}</strong> (se suma al adicional de cada una).</p>
            )}
            {r.sin_confirmar > 0 && (
              <p style={{ fontSize: 13, margin: '8px 0 0', color: 'var(--atencion)' }}>
                ⚠ {r.sin_confirmar} publicación(es) quedaron anotadas pero sin confirmar (el servidor se cortó mientras guardaba). No se vuelven a tocar: revisalas en Contabilium.
              </p>
            )}
            {Object.keys(r.motivos_omitidas || {}).length > 0 && (
              <p style={{ fontSize: 12, color: 'var(--gray-muted)', margin: '8px 0 0' }}>
                No se tocan: {Object.entries(r.motivos_omitidas).map(([m, n]) => `${n} (${m})`).join(' · ')}
              </p>
            )}
          </div>

          <div className="paste-box">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {FILTROS.map((f) => (
                <button key={f.id} className={`sort-btn ${filtro === f.id ? 'active' : ''}`} onClick={() => { setFiltro(f.id); setPagina(0) }}>
                  {f.label} {f.id !== 'todas' && `(${r[f.id]})`}
                </button>
              ))}
            </div>
            <input
              className="search-input"
              type="text"
              placeholder="Buscar por título, SKU o código MLA…"
              value={busqueda}
              onChange={(e) => { setBusqueda(e.target.value); setPagina(0) }}
            />

            <div style={{ overflowX: 'auto', marginTop: 10 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--gray-line)' }}>
                    <th style={{ minWidth: 240 }}>Publicación</th>
                    <th style={{ textAlign: 'right' }}>Precio</th>
                    <th style={{ textAlign: 'right' }}>Adicional hoy</th>
                    <th style={{ textAlign: 'right' }}>Se suma</th>
                    <th style={{ textAlign: 'right' }}>Adicional nuevo</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((f) => (
                    <tr key={f.id_combinado} style={{ borderBottom: '1px solid var(--gray-line)', verticalAlign: 'top' }}>
                      <td>
                        {f.titulo}
                        <div className="mono" style={{ fontSize: 12, color: 'var(--gray-muted)' }}>
                          {f.sku || 'sin SKU'} · {f.id_producto}{!f.sync_precio && ' · no sincroniza precio'}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>{plata(f.precio)}</td>
                      <td style={{ textAlign: 'right' }}>{plata(f.adicional_actual)}</td>
                      <td style={{ textAlign: 'right', color: f.incremento ? 'var(--info)' : 'inherit' }}>{f.incremento ? `+${plata(f.incremento)}` : '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: f.accion === 'ajustar' ? 700 : 400 }}>{plata(f.adicional_nuevo)}</td>
                      <td style={{ textAlign: 'right', minWidth: 150 }}>
                        {f.accion === 'ajustar' && (
                          <button className="sort-btn" style={{ padding: '2px 8px', fontSize: 12 }} disabled={corriendo || aplicandoId !== null} onClick={() => pedirConfirmacionUna(f)}>
                            {aplicandoId === f.id_combinado ? 'Aplicando…' : 'Aplicar solo a esta'}
                          </button>
                        )}
                        {f.accion === 'aplicada' && <span style={{ color: 'var(--ok)', fontWeight: 600 }}>✅ aplicada</span>}
                        {f.accion === 'omitir' && <span style={{ fontSize: 12, color: 'var(--gray-muted)' }}>{f.motivo}</span>}
                      </td>
                    </tr>
                  ))}
                  {visibles.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 16, color: 'var(--gray-muted)' }}>No hay publicaciones en esta lista.</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            {paginas > 1 && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
                <button className="sort-btn" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>← Anterior</button>
                <span style={{ fontSize: 13 }}>Página {pagina + 1} de {paginas} · {filas.length} publicaciones</span>
                <button className="sort-btn" disabled={pagina >= paginas - 1} onClick={() => setPagina(pagina + 1)}>Siguiente →</button>
              </div>
            )}
          </div>
        </>
      )}

      {confirmacion && (
        <ConfirmModal
          titulo={confirmacion.peligroso ? 'Aplicar a todas' : 'Aplicar a una publicación'}
          mensaje={<span style={{ whiteSpace: 'pre-wrap' }}>{confirmacion.mensaje}</span>}
          peligroso={confirmacion.peligroso}
          textoConfirmar={confirmacion.textoConfirmar || 'Aplicar'}
          onConfirmar={() => { const fn = confirmacion.onConfirmar; setConfirmacion(null); fn() }}
          onCancelar={() => setConfirmacion(null)}
        />
      )}
      {aviso && <AlertModal mensaje={aviso} onCerrar={() => setAviso(null)} />}
    </div>
  )
}
