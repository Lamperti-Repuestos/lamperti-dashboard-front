import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'
import ImageLightbox from './ImageLightbox.jsx'

const REFRESCO_MS = 30 * 1000

const TIPOS_DIFERENCIA = [
  ['faltante', 'Faltó mercadería'],
  ['sobrante', 'Llegó de más'],
  ['producto', 'Producto distinto'],
  ['precio', 'Precio distinto'],
  ['danado', 'Llegó dañado'],
  ['otro', 'Otro'],
]

// "Pasar sin control de remito": para lo que no tiene remito que controlar, o cuando se decide pasarla igual.
// Pasa como una conforme, pero en el reporte queda marcada aparte (para que se sepa que nadie miró un remito).
const MOTIVOS_SIN_REMITO = [
  ['nota_credito', 'Nota de crédito'],
  ['servicio', 'Servicio (no lleva remito)'],
  ['otro', 'Otro motivo (explicarlo en la nota)'],
]
const textoMotivo = (k) => (MOTIVOS_SIN_REMITO.find(([clave]) => clave === k) || [k, k])[1].replace(' (explicarlo en la nota)', '')

const DIAS_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

// Hora exacta con segundos: "hoy a las 18:24:05" / "el 30/09 a las 18:24:05"
function horaExacta(iso, segundos = true) {
  const d = new Date(iso)
  const opciones = segundos ? { hour: '2-digit', minute: '2-digit', second: '2-digit' } : { hour: '2-digit', minute: '2-digit' }
  const h = d.toLocaleTimeString('es-AR', opciones)
  if (d.toDateString() === new Date().toDateString()) return `hoy a las ${h}`
  return `el ${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} a las ${h}`
}

async function pedir(path, opciones, onUnauthorized) {
  const res = await apiFetch(path, opciones, onUnauthorized)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(typeof data.detail === 'string' ? data.detail : `Error ${res.status}`)
  return data
}

// Los pedidos llevan la contraseña en un encabezado: por eso las imágenes y los archivos se bajan con fetch
async function bajar(path, onUnauthorized) {
  const res = await apiFetch(path, {}, onUnauthorized)
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(typeof data.detail === 'string' ? data.detail : `Error ${res.status}`)
  }
  return res.blob()
}

function guardarArchivo(blob, nombre) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nombre
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}

// La "foto" de la factura: sirve para controlar a ojo si la lectura se equivocó en algún número o palabra.
// Se muestra de a una página (muchas facturas traen el original y el duplicado) y se baja cada una al pedirla.
function FotoFactura({ id, paginas, onUnauthorized }) {
  const [pagina, setPagina] = useState(1)
  const [fotos, setFotos] = useState({})
  const [error, setError] = useState(null)
  const [grande, setGrande] = useState(null)
  const [cargandoGrande, setCargandoGrande] = useState(false)
  const urls = useRef([])

  useEffect(() => {
    if (fotos[pagina]) return undefined
    let vivo = true
    setError(null)
    bajar(`/facturas/control/${id}/pagina/${pagina}`, onUnauthorized)
      .then((b) => {
        const u = URL.createObjectURL(b)
        urls.current.push(u)
        if (vivo) setFotos((f) => ({ ...f, [pagina]: u }))
      })
      .catch((e) => vivo && setError(e.message))
    return () => {
      vivo = false
    }
  }, [id, pagina])

  useEffect(() => () => {
    urls.current.forEach((u) => URL.revokeObjectURL(u))
  }, [])
  useEffect(() => () => grande && URL.revokeObjectURL(grande), [grande])

  // al tocar la imagen se baja una versión más grande, para leer los números chicos
  const agrandar = () => {
    setCargandoGrande(true)
    bajar(`/facturas/control/${id}/pagina/${pagina}?escala=2.6`, onUnauthorized)
      .then((b) => setGrande(URL.createObjectURL(b)))
      .catch((e) => setError(e.message))
      .finally(() => setCargandoGrande(false))
  }

  return (
    <div className="cr-fotos">
      {paginas > 1 && (
        <div className="vf-acciones" style={{ margin: 0 }}>
          {Array.from({ length: paginas }, (_, i) => (
            <button key={i} className={`sort-btn ${pagina === i + 1 ? 'toggle-on-green' : ''}`} onClick={() => setPagina(i + 1)}>
              Página {i + 1} de {paginas}
            </button>
          ))}
        </div>
      )}
      {error && <p className="vf-aviso" style={{ color: 'var(--alerta)' }}>No se pudo mostrar la factura: {error}</p>}
      {!error && !fotos[pagina] && <p className="cr-nota">Cargando la factura…</p>}
      {fotos[pagina] && <img src={fotos[pagina]} alt={`Factura, página ${pagina}`} className="cr-foto" onClick={agrandar} />}
      <p className="cr-nota">{cargandoGrande ? 'Agrandando…' : 'Tocá la imagen para verla más grande.'}</p>
      <ImageLightbox url={grande} onClose={() => setGrande(null)} />
    </div>
  )
}

function Tarjeta({ c, onCambio, onUnauthorized }) {
  const [tildados, setTildados] = useState(() => new Set(c.tildados || []))
  const [verItems, setVerItems] = useState(c.estado === 'pendiente')
  const [remito, setRemito] = useState(c.remito || '')
  const [conDiferencia, setConDiferencia] = useState(c.estado === 'diferencia')
  const [sinRemito, setSinRemito] = useState(c.estado === 'sin_remito')
  const [motivo, setMotivo] = useState(c.motivo || '')
  const [tipos, setTipos] = useState(() => new Set(c.diferencias || []))
  const [nota, setNota] = useState(c.nota || '')
  const [editando, setEditando] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState(null)
  const [verFoto, setVerFoto] = useState(false)
  const [errorPdf, setErrorPdf] = useState(null)
  const primera = useRef(true)

  // los ítems tildados se guardan solos (si se recarga la página, siguen ahí)
  useEffect(() => {
    if (primera.current) {
      primera.current = false
      return undefined
    }
    const t = setTimeout(() => {
      pedir(`/facturas/control/${c.id}/tildes`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tildados: [...tildados] }),
      }, onUnauthorized).catch(() => {})
    }, 600)
    return () => clearTimeout(t)
  }, [tildados])

  const n = c.items.length
  const alternar = (i) =>
    setTildados((prev) => {
      const sig = new Set(prev)
      sig.has(i) ? sig.delete(i) : sig.add(i)
      return sig
    })

  const marcar = (resultado) => {
    if (resultado === 'conforme' && n > 0 && tildados.size < n) {
      const faltan = n - tildados.size
      if (!window.confirm(`Quedan ${faltan} ítem${faltan === 1 ? '' : 's'} sin tildar. ¿Marcar conforme igual?`)) return
    }
    setEnviando(true)
    setError(null)
    pedir(`/facturas/control/${c.id}/resolver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resultado,
        remito: resultado === 'sin_remito' ? '' : remito,
        diferencias: resultado === 'diferencia' ? [...tipos] : [],
        motivo: resultado === 'sin_remito' ? motivo : null,
        nota,
        tildados: [...tildados],
      }),
    }, onUnauthorized)
      .then(() => {
        setEditando(false)
        setEnviando(false)
        onCambio()
      })
      .catch((e) => {
        setError(e.message)
        setEnviando(false)
      })
  }

  const abrirPdf = () => {
    // la ventana se abre ya (si no, el navegador bloquea el popup) y después se le pone el PDF
    const ventana = window.open('', '_blank')
    setErrorPdf(null)
    bajar(`/facturas/control/${c.id}/pdf`, onUnauthorized)
      .then((b) => {
        const url = URL.createObjectURL(b)
        if (ventana) ventana.location.href = url
        else guardarArchivo(b, c.archivo)
        setTimeout(() => URL.revokeObjectURL(url), 60000)
      })
      .catch((e) => {
        ventana?.close()
        setErrorPdf(e.message)
      })
  }

  const decidida = c.estado === 'conforme' || c.estado === 'diferencia' || c.estado === 'sin_remito'
  const formulario = !decidida || editando
  const color = c.estado === 'conforme' ? 'ok' : c.estado === 'diferencia' ? 'alerta' : c.estado === 'sin_remito' ? 'atencion' : 'info'
  const etiqueta = c.estado === 'conforme' ? 'Conforme' : c.estado === 'diferencia' ? 'Con diferencia' : c.estado === 'sin_remito' ? 'Sin control de remito' : 'Para controlar'

  return (
    <div className={`vf-card vf-borde-${color}`}>
      <div className="vf-card-cab">
        <span className={`vf-badge vf-badge-${color}`}>{etiqueta}</span>
        <strong>{c.titulo || c.archivo}</strong>
        {c.cuit && <span className="vf-prov">CUIT {c.cuit}</span>}
        {c.fecha && <span className="vf-fecha">{c.fecha}</span>}
      </div>
      <div className="vf-archivo">{c.archivo} · llegó {horaExacta(c.leido_en, false)}</div>

      {!c.confiable && <p className="vf-aviso">⚠️ No pude leer esta factura con seguridad. Controlala mirando el PDF.</p>}
      {c.confiable && !c.a_nombre_de_lamperti && <p className="vf-aviso">⚠️ No encontré el CUIT de Lamperti en la factura. Revisá que sea nuestra.</p>}
      {c.avisos.map((a, i) => <p key={i} className="vf-aviso">⚠️ {a}</p>)}
      {c.importes && (
        <div className="vf-resumen-ok mono">
          Total {c.importes.total} · neto {c.importes.neto} · IVA {c.importes.iva}
          {c.importes.otros && c.importes.otros !== '0,00' ? ` · otros ${c.importes.otros}` : ''}
        </div>
      )}

      <div className="vf-acciones" style={{ margin: '10px 0 0' }}>
        {c.paginas > 0 && (
          <button className="sort-btn" onClick={() => setVerFoto((v) => !v)}>
            {verFoto ? '▾' : '▸'} 👁 Ver la factura (foto)
          </button>
        )}
        <button className="sort-btn" onClick={abrirPdf}>📄 Abrir el PDF original</button>
      </div>
      {verFoto && c.paginas > 0 && <FotoFactura id={c.id} paginas={c.paginas} onUnauthorized={onUnauthorized} />}
      {errorPdf && <p className="vf-aviso" style={{ color: 'var(--alerta)' }}>{errorPdf}</p>}

      {n > 0 && (
        <div className="vf-items">
          <div className="vf-items-barra">
            <button className="sort-btn" onClick={() => setVerItems((v) => !v)}>
              {verItems ? '▾' : '▸'} Ítems para el remito ({n}) · {tildados.size}/{n} tildados
            </button>
            {verItems && (
              <>
                <button className="sort-btn" onClick={() => setTildados(new Set(c.items.map((_, i) => i)))}>Tildar todos</button>
                <button className="sort-btn" onClick={() => setTildados(new Set())}>Destildar</button>
              </>
            )}
          </div>
          {verItems && (
            <div className="vf-scroll">
              <table className="vf-tabla">
                <thead>
                  <tr>
                    <th className="vf-c">✓</th>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th className="vf-n">Cant.</th>
                    <th className="vf-n">P. unit.</th>
                    <th className="vf-n">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {c.items.map((it, i) => (
                    <tr key={i} className={tildados.has(i) ? 'vf-tildado' : ''}>
                      <td className="vf-c">
                        <input type="checkbox" className="pick-checkbox" checked={tildados.has(i)} onChange={() => alternar(i)} aria-label={`Ítem ${it.codigo || i + 1} controlado`} />
                      </td>
                      <td className="mono">{it.codigo}</td>
                      <td>{it.descripcion}</td>
                      <td className="vf-n mono">{it.cantidad ?? '—'}</td>
                      <td className="vf-n mono">{it.precio_unitario}</td>
                      <td className="vf-n mono">{it.importe}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {decidida && !editando && (
        <div className="cr-decision">
          {c.estado === 'conforme' ? (
            <>
              <strong>✅ Remito conforme</strong> · {[c.remito && `Remito Nº ${c.remito}`, `${c.controlado_por} ${horaExacta(c.controlado_en, false)}`].filter(Boolean).join(' · ')}
              <div className="cr-nota">
                {c.en_carpeta
                  ? 'Pasa sola a "Para pasar" en menos de 1 minuto.'
                  : 'El programa todavía no vio este PDF en la carpeta Nora Control: cuando lo vea, lo pasa solo. Si lo arrastraste desde otro lado, pasalo vos a "Para pasar".'}
              </div>
            </>
          ) : c.estado === 'sin_remito' ? (
            <>
              <strong>⏭ Pasada sin control de remito</strong> · {textoMotivo(c.motivo)} · {c.controlado_por} {horaExacta(c.controlado_en, false)}
              {c.nota && <div className="cr-nota">«{c.nota}»</div>}
              <div className="cr-nota">
                {c.en_carpeta
                  ? 'Pasa sola a "Para pasar" en menos de 1 minuto. Queda anotado en el reporte diario que no se controló contra un remito.'
                  : 'El programa todavía no vio este PDF en la carpeta Nora Control: cuando lo vea, lo pasa solo.'}
              </div>
            </>
          ) : (
            <>
              <strong>⚠️ Con diferencia</strong> · {[c.remito && `Remito Nº ${c.remito}`, `${c.controlado_por} ${horaExacta(c.controlado_en, false)}`].filter(Boolean).join(' · ')}
              {c.diferencias.length > 0 && <div>{c.diferencias.map((d) => (TIPOS_DIFERENCIA.find(([k]) => k === d) || [d, d])[1]).join(' · ')}</div>}
              {c.nota && <div className="cr-nota">«{c.nota}»</div>}
              <div className="cr-nota">Queda en la carpeta Nora Control, sin pasar, hasta que se resuelva.</div>
            </>
          )}
          <button className="sort-btn" onClick={() => setEditando(true)}>Cambiar decisión</button>
        </div>
      )}

      {formulario && (
        <div className="cr-decision">
          {!sinRemito && (
            <label className="cr-campo">
              <span>Remito Nº</span>
              <input type="text" value={remito} maxLength={40} placeholder="Ej: 0005-00012345" onChange={(e) => setRemito(e.target.value)} />
            </label>
          )}
          {sinRemito && (
            <div className="cr-dif">
              <div className="cr-nota">Se pasa igual a "Para pasar", pero en el reporte queda anotado que no se controló contra un remito.</div>
              <div className="cr-tipos">
                {MOTIVOS_SIN_REMITO.map(([k, label]) => (
                  <label key={k} className="cr-tipo">
                    <input type="radio" name={`motivo-${c.id}`} checked={motivo === k} onChange={() => setMotivo(k)} />
                    {label}
                  </label>
                ))}
              </div>
              <textarea value={nota} maxLength={500} rows={2} placeholder="Nota (obligatoria si elegís Otro motivo)" onChange={(e) => setNota(e.target.value)} />
            </div>
          )}
          {conDiferencia && (
            <div className="cr-dif">
              <div className="cr-tipos">
                {TIPOS_DIFERENCIA.map(([k, label]) => (
                  <label key={k} className="cr-tipo">
                    <input type="checkbox" checked={tipos.has(k)} onChange={() => setTipos((prev) => {
                      const sig = new Set(prev)
                      sig.has(k) ? sig.delete(k) : sig.add(k)
                      return sig
                    })} />
                    {label}
                  </label>
                ))}
              </div>
              <textarea value={nota} maxLength={500} rows={2} placeholder="Qué pasó (ej: llegaron 3 de 5 filtros)" onChange={(e) => setNota(e.target.value)} />
            </div>
          )}
          <div className="vf-acciones">
            {sinRemito ? (
              <>
                <button className="sort-btn toggle-on-green" disabled={enviando || !motivo} onClick={() => marcar('sin_remito')}>⏭ Pasar sin control de remito</button>
                <button className="sort-btn" disabled={enviando} onClick={() => setSinRemito(false)}>Volver</button>
              </>
            ) : !conDiferencia ? (
              <>
                <button className="sort-btn toggle-on-green" disabled={enviando} onClick={() => marcar('conforme')}>✅ Remito conforme</button>
                <button className="sort-btn" disabled={enviando} onClick={() => setConDiferencia(true)}>⚠️ Hay diferencia</button>
                <button className="sort-btn" disabled={enviando} onClick={() => setSinRemito(true)}>⏭ Pasar sin control de remito</button>
              </>
            ) : (
              <>
                <button className="sort-btn toggle-on-red" disabled={enviando} onClick={() => marcar('diferencia')}>Guardar diferencia</button>
                <button className="sort-btn" disabled={enviando} onClick={() => setConDiferencia(false)}>Volver</button>
              </>
            )}
            {editando && <button className="sort-btn" disabled={enviando} onClick={() => setEditando(false)}>Cancelar</button>}
          </div>
          {error && <p className="vf-aviso" style={{ color: 'var(--alerta)' }}>{error}</p>}
        </div>
      )}
    </div>
  )
}

function Lectura({ lectura, pendientes }) {
  let tono = 'ok'
  let titulo = 'El programa está mirando la carpeta Nora Control'
  let detalle = 'Las facturas que deje Aldo aparecen acá solas, en menos de 1 minuto.'
  if (!lectura.actualizada) {
    tono = 'info'
    titulo = 'Todavía no hay lecturas de la carpeta'
    detalle = 'Cuando el programa de la oficina mire la carpeta Nora Control por primera vez, las facturas aparecen acá. Mientras tanto se pueden arrastrar los PDF a mano.'
  } else if (!lectura.funcionando) {
    tono = 'alerta'
    titulo = 'El programa no está mirando la carpeta'
    detalle = '¿La PC de la oficina está prendida y con la sesión iniciada? Mientras tanto se pueden arrastrar los PDF a mano.'
  } else if (lectura.error) {
    tono = 'alerta'
    titulo = 'El programa no pudo abrir la carpeta'
    detalle = lectura.error
  }
  const vistas = pendientes.filter((p) => p.en_carpeta).length
  const sinLeer = Math.max(0, lectura.en_carpeta - vistas)
  return (
    <div className={`fe-banner fe-banner-${tono}`}>
      <div className="fe-banner-titulo">{titulo}</div>
      <div className="fe-banner-detalle">{detalle}</div>
      {lectura.actualizada && (
        <div className="fe-banner-pie">
          Última lectura de la carpeta: {horaExacta(lectura.actualizada)}
          <span>· {lectura.en_carpeta} PDF en la carpeta</span>
          {sinLeer > 0 && <span>· {sinLeer} esperando que el programa los lea</span>}
          {lectura.modo === 'simulacion' && <span className="fe-modo">MODO PRUEBA</span>}
        </div>
      )}
    </div>
  )
}

function ReporteDiario({ onUnauthorized }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [errorDescarga, setErrorDescarga] = useState(null)

  const descargar = (fecha) => {
    setErrorDescarga(null)
    const ruta = fecha ? `/facturas/control/reporte.csv?fecha=${fecha}` : '/facturas/control/reporte.csv?dias=60'
    bajar(ruta, onUnauthorized)
      .then((b) => guardarArchivo(b, fecha ? `reporte-remitos-${fecha}.csv` : 'reporte-remitos.csv'))
      .catch((e) => setErrorDescarga(e.message))
  }

  useEffect(() => {
    pedir('/facturas/control/reporte?dias=60', {}, onUnauthorized).then(setData).catch((e) => setError(e.message))
  }, [])

  if (error) return <p className="vf-aviso" style={{ color: 'var(--alerta)' }}>No se pudo cargar: {error}</p>
  if (!data) return <div className="loading-state">Cargando…</div>
  const sinControl = data.dias.reduce((n, d) => n + (d.sin_remito || 0), 0)
  return (
    <div>
      <p style={{ fontSize: 13, color: 'var(--gray-muted)', margin: '0 0 8px' }}>
        Un renglón por día, con los remitos que se revisaron. Si un día no se revisó nada, queda anotado igual.
      </p>
      {sinControl > 0 && (
        <p className="cr-aviso-sin">
          ⏭ En estos días se pasaron <strong>{sinControl}</strong> factura{sinControl === 1 ? '' : 's'} sin control de remito
          (aparecen marcadas en amarillo, con el motivo).
        </p>
      )}
      <div className="vf-acciones">
        <button className="sort-btn" onClick={() => descargar(null)}>⬇ Descargar los últimos 60 días (Excel)</button>
      </div>
      {errorDescarga && <p className="vf-aviso" style={{ color: 'var(--alerta)' }}>{errorDescarga}</p>}
      {data.dias.map((d, idx) => {
        const fecha = new Date(`${d.fecha}T12:00:00`)
        const titulo = `${DIAS_SEMANA[d.dia_semana]} ${fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}${idx === 0 ? ' (hoy)' : ''}`
        const resumen = d.total === 0
          ? 'Sin remitos revisados'
          : `${d.total} revisado${d.total === 1 ? '' : 's'}: ${d.conformes} conforme${d.conformes === 1 ? '' : 's'}${d.con_diferencia ? ` · ${d.con_diferencia} con diferencia` : ''}${d.sin_remito ? ` · ${d.sin_remito} sin control de remito` : ''}`
        return (
          <details key={d.fecha} className="vf-detalles cr-dia" open={idx === 0 && d.total > 0}>
            <summary>
              <span className="cr-dia-titulo">{titulo}</span>
              <span className={d.con_diferencia ? 'cr-dia-dif' : d.sin_remito ? 'cr-dia-sin' : d.total === 0 ? 'cr-dia-vacio' : ''}>{resumen}</span>
            </summary>
            <div className="vf-acciones" style={{ margin: '4px 0' }}>
              <button className="sort-btn" onClick={() => descargar(d.fecha)}>⬇ Descargar este día</button>
            </div>
            {d.remitos.length > 0 && (
              <div className="vf-scroll">
                <table className="vf-tabla">
                  <thead>
                    <tr><th>Hora</th><th>Factura</th><th>Remito Nº</th><th>Resultado</th><th>Quién</th></tr>
                  </thead>
                  <tbody>
                    {d.remitos.map((r, i) => (
                      <tr key={i} className={r.resultado === 'sin_remito' ? 'cr-fila-sin' : ''}>
                        <td className="mono">{r.hora}</td>
                        <td>{r.titulo || r.archivo}{r.cuit ? <div className="vf-archivo">CUIT {r.cuit}</div> : null}</td>
                        <td className="mono">{r.remito || '—'}</td>
                        <td>
                          {r.resultado === 'conforme' ? '✅ Conforme' : r.resultado === 'sin_remito' ? <strong>⏭ Sin control de remito</strong> : <strong className="vf-dif">⚠️ Con diferencia</strong>}
                          {r.motivo && <div className="vf-archivo">{r.motivo}</div>}
                          {r.diferencias.length > 0 && <div className="vf-archivo">{r.diferencias.join(' · ')}</div>}
                          {r.nota && <div className="vf-archivo">«{r.nota}»</div>}
                        </td>
                        <td>{r.usuario}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </details>
        )
      })}
    </div>
  )
}

export default function ControlRemitosView({ onUnauthorized }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [pestana, setPestana] = useState('controlar')
  const [arrastrando, setArrastrando] = useState(false)
  const [subiendo, setSubiendo] = useState(false)
  const [errorSubida, setErrorSubida] = useState(null)
  const inputRef = useRef(null)

  const cargar = () =>
    pedir('/facturas/control', {}, onUnauthorized)
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e) => setError(e.message))

  useEffect(() => {
    cargar()
    const refresco = setInterval(cargar, REFRESCO_MS)
    return () => clearInterval(refresco)
  }, [])

  const subir = (lista) => {
    const pdfs = Array.from(lista).filter((a) => a.name.toLowerCase().endsWith('.pdf'))
    if (!pdfs.length) {
      setErrorSubida('Solo se pueden subir PDF.')
      return
    }
    setErrorSubida(pdfs.length < lista.length ? 'Se ignoraron los archivos que no son PDF.' : null)
    setSubiendo(true)
    const fd = new FormData()
    pdfs.forEach((a) => fd.append('archivos', a))
    pedir('/facturas/control/subir', { method: 'POST', body: fd }, onUnauthorized)
      .then(() => cargar())
      .catch((e) => setErrorSubida(e.message))
      .finally(() => setSubiendo(false))
  }

  if (!data) {
    return (
      <div className="vf-pagina">
        <h2 className="section-title">Control de remitos</h2>
        {error ? (
          <p className="vf-aviso" style={{ color: 'var(--alerta)' }}>No se pudo cargar: {error} <button className="sort-btn" onClick={cargar}>Reintentar</button></p>
        ) : (
          <div className="loading-state">Cargando…</div>
        )}
      </div>
    )
  }

  const porControlar = data.pendientes.filter((p) => p.estado === 'pendiente')
  const conDiferencia = data.pendientes.filter((p) => p.estado === 'diferencia')
  const conformes = data.pendientes.filter((p) => p.estado === 'conforme' || p.estado === 'sin_remito')

  return (
    <div className="vf-pagina">
      <h2 className="section-title">Control de remitos</h2>
      <p style={{ fontSize: 13, color: 'var(--gray-muted)', margin: '0 0 4px' }}>
        Las facturas que Aldo deja en la carpeta "Nora Control" aparecen acá solas. Controlalas contra el remito y marcá si está conforme:
        al marcarla conforme, el programa la pasa solo a "Para pasar".
      </p>

      <Lectura lectura={data.lectura} pendientes={data.pendientes} />

      <div
        className={`vf-drop ${arrastrando ? 'vf-drop-activo' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setArrastrando(true)
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault()
          setArrastrando(false)
          subir(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        <input ref={inputRef} type="file" accept="application/pdf,.pdf" multiple style={{ display: 'none' }}
          onChange={(e) => {
            subir(e.target.files)
            e.target.value = ''
          }} />
        {subiendo ? 'Subiendo…' : '📄 ¿No querés esperar? Soltá acá el PDF de la factura (o tocá para elegirlo)'}
      </div>
      {errorSubida && <p className="vf-aviso" style={{ color: 'var(--alerta)' }}>{errorSubida}</p>}

      <div className="vf-acciones">
        <button className={`sort-btn ${pestana === 'controlar' ? 'toggle-on-green' : ''}`} onClick={() => setPestana('controlar')}>
          Para controlar ({porControlar.length})
        </button>
        <button className={`sort-btn ${pestana === 'reporte' ? 'toggle-on-green' : ''}`} onClick={() => setPestana('reporte')}>
          Reporte diario
        </button>
      </div>

      {pestana === 'reporte' && <ReporteDiario onUnauthorized={onUnauthorized} />}

      {pestana === 'controlar' && (
        <>
          {data.pendientes.length === 0 && (
            <p className="cr-vacio">No hay facturas esperando control. 🎉</p>
          )}
          {porControlar.map((c) => <Tarjeta key={c.id} c={c} onCambio={cargar} onUnauthorized={onUnauthorized} />)}

          {conDiferencia.length > 0 && (
            <>
              <h3 className="section-title">⚠️ Con diferencia ({conDiferencia.length})</h3>
              {conDiferencia.map((c) => <Tarjeta key={c.id} c={c} onCambio={cargar} onUnauthorized={onUnauthorized} />)}
            </>
          )}

          {conformes.length > 0 && (
            <>
              <h3 className="section-title">✅ Controladas, por pasar a "Para pasar" ({conformes.length})</h3>
              {conformes.map((c) => <Tarjeta key={c.id} c={c} onCambio={cargar} onUnauthorized={onUnauthorized} />)}
            </>
          )}

          {data.pasaron.length > 0 && (
            <details className="vf-detalles">
              <summary>Ya pasaron a "Para pasar" ({data.pasaron.length})</summary>
              {data.pasaron.map((c) => (
                <div key={c.id} className="vf-card vf-borde-ok">
                  <div className="vf-card-cab">
                    <span className="vf-badge vf-badge-ok">Pasada</span>
                    <strong>{c.titulo || c.archivo}</strong>
                    {c.remito && <span className="vf-prov">Remito Nº {c.remito}</span>}
                    <span className="vf-fecha">{c.movida_en ? horaExacta(c.movida_en, false) : ''}</span>
                  </div>
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  )
}
