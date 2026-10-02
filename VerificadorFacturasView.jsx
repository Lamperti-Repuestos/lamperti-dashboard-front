import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'

const MAX_ARCHIVOS = 60

// Orden en que se muestran los que requieren acción (lo más grave primero)
const ESTADOS = {
  diferencia: { label: 'Diferencia', color: 'alerta', orden: 0, accion: true },
  diferencia_menor: { label: 'Diferencia menor', color: 'atencion', orden: 1, accion: true },
  no_cargada: { label: 'No cargada', color: 'alerta', orden: 2, accion: true },
  rechazada: { label: 'Rechazada', color: 'alerta', orden: 3, accion: true },
  pendiente: { label: 'Pendiente', color: 'atencion', orden: 4, accion: true },
  revisar: { label: 'Revisar a mano', color: 'atencion', orden: 5, accion: true },
  ok: { label: 'Coincide', color: 'ok', orden: 6, accion: false },
  duplicada: { label: 'Duplicada', color: 'info', orden: 7, accion: false },
}

const esNC = (f) => (f.titulo || '').startsWith('NC')
// El backend manda los importes del PDF en positivo; en una nota de crédito
// Contabilium los guarda en negativo, así que se muestran igual que allá.
const conSigno = (f, v) => (v && esNC(f) && !v.startsWith('-') && v !== '0,00' ? `-${v}` : v)

const escapar = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))

function imprimirChecklists(facturas) {
  const conItems = facturas.filter((f) => f.items && f.items.length)
  if (!conItems.length) return false
  const bloques = conItems
    .map(
      (f) => `
      <section>
        <h2>${escapar(f.proveedor || f.cuit || 'Proveedor')} — ${escapar(f.titulo)} <small>${escapar(f.fecha || '')}</small></h2>
        <table>
          <thead><tr><th class="c">✓</th><th>Código</th><th>Descripción</th><th class="n">Cant.</th><th class="n">P. unit.</th><th class="n">Importe</th></tr></thead>
          <tbody>${f.items
            .map(
              (it) => `<tr><td class="c">☐</td><td>${escapar(it.codigo)}</td><td>${escapar(it.descripcion)}</td>
              <td class="n">${escapar(it.cantidad ?? '')}</td><td class="n">${escapar(it.precio_unitario ?? '')}</td><td class="n">${escapar(it.importe ?? '')}</td></tr>`
            )
            .join('')}</tbody>
        </table>
        <p class="firma">Remito Nº: ____________________ &nbsp; Controló: ____________________</p>
      </section>`
    )
    .join('')
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Checklist de recepción</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:12px;margin:18px;color:#111}
      h2{font-size:14px;margin:0 0 6px} h2 small{font-weight:normal;color:#555}
      section{margin-bottom:22px;page-break-inside:avoid}
      table{border-collapse:collapse;width:100%} th,td{border:1px solid #999;padding:4px 6px;text-align:left}
      th{background:#eee} .n{text-align:right} .c{text-align:center;width:28px}
      .firma{margin-top:8px;color:#333}
    </style></head><body>${bloques}</body></html>`)
  w.document.close()
  w.focus()
  w.print()
  return true
}

function TablaComparacion({ f }) {
  if (!f.pdf || !f.contabilium) return null
  const filas = [
    ['Neto', 'neto'],
    ['IVA', 'iva'],
    ['Percepciones / otros', 'otros'],
    ['Total', 'total'],
  ]
  return (
    <table className="vf-tabla">
      <thead>
        <tr>
          <th></th>
          <th className="vf-n">Factura (PDF)</th>
          <th className="vf-n">Contabilium</th>
          <th className="vf-n">Diferencia</th>
        </tr>
      </thead>
      <tbody>
        {filas.map(([etiqueta, k]) => {
          const dif = f.diferencia?.[k]
          const hayDif = dif && dif !== '0,00'
          return (
            <tr key={k}>
              <td>{etiqueta}</td>
              <td className="vf-n mono">{conSigno(f, f.pdf[k])}</td>
              <td className="vf-n mono">{f.contabilium[k]}</td>
              <td className={`vf-n mono ${hayDif ? 'vf-dif' : ''}`}>{hayDif ? (dif.startsWith('-') ? dif : `+${dif}`) : '—'}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ChecklistItems({ f }) {
  const [tildados, setTildados] = useState(() => new Set())
  const [abierto, setAbierto] = useState(false)
  const n = f.items?.length || 0
  if (!n) return null
  const alternar = (i) =>
    setTildados((prev) => {
      const sig = new Set(prev)
      sig.has(i) ? sig.delete(i) : sig.add(i)
      return sig
    })
  return (
    <div className="vf-items">
      <div className="vf-items-barra">
        <button className="sort-btn" onClick={() => setAbierto((a) => !a)}>
          {abierto ? '▾' : '▸'} Ítems para el remito ({n}){tildados.size ? ` · ${tildados.size}/${n} tildados` : ''}
        </button>
        {abierto && (
          <button className="sort-btn" onClick={() => imprimirChecklists([f])}>
            🖨 Imprimir
          </button>
        )}
      </div>
      {abierto && (
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
              {f.items.map((it, i) => (
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
  )
}

function TarjetaFactura({ f, compacta }) {
  const est = ESTADOS[f.estado] || ESTADOS.revisar
  return (
    <div className={`vf-card vf-borde-${est.color}`}>
      <div className="vf-card-cab">
        <span className={`vf-badge vf-badge-${est.color}`}>{est.label}</span>
        <strong>{f.titulo || f.archivo}</strong>
        {f.proveedor && <span className="vf-prov">{f.proveedor}</span>}
        {!f.proveedor && f.cuit && <span className="vf-prov">CUIT {f.cuit}</span>}
        {f.fecha && <span className="vf-fecha">{f.fecha}</span>}
      </div>
      {f.titulo && <div className="vf-archivo">{f.archivo}</div>}
      {f.avisos?.map((a, i) => (
        <p key={i} className="vf-aviso">
          {f.estado === 'ok' ? 'ℹ️' : '⚠️'} {a}
        </p>
      ))}
      {!compacta && <TablaComparacion f={f} />}
      {compacta && f.estado === 'ok' && f.pdf && (
        <div className="vf-resumen-ok mono">Total {conSigno(f, f.pdf.total)} · neto {conSigno(f, f.pdf.neto)} · IVA {conSigno(f, f.pdf.iva)}</div>
      )}
      {f.estado !== 'ok' && f.pdf && !f.contabilium && (
        <div className="vf-resumen-ok mono">
          Factura: total {conSigno(f, f.pdf.total)} · neto {conSigno(f, f.pdf.neto)} · IVA {conSigno(f, f.pdf.iva)}
        </div>
      )}
      <ChecklistItems f={f} />
    </div>
  )
}

export default function VerificadorFacturasView({ onUnauthorized }) {
  const [archivos, setArchivos] = useState([])
  const [arrastrando, setArrastrando] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState(null)
  const [reporte, setReporte] = useState(null)
  const [configurado, setConfigurado] = useState(true)
  const inputRef = useRef(null)

  useEffect(() => {
    apiFetch('/facturas/estado', {}, onUnauthorized)
      .then((res) => (res.ok ? res.json() : null))
      .then((d) => d && setConfigurado(!!d.contabilium_web))
      .catch(() => {})
  }, [])

  const agregar = (lista) => {
    const pdfs = Array.from(lista).filter((a) => a.name.toLowerCase().endsWith('.pdf'))
    if (pdfs.length < lista.length) setError('Se ignoraron los archivos que no son PDF.')
    else setError(null)
    setArchivos((prev) => {
      const vistos = new Set(prev.map((a) => `${a.name}|${a.size}`))
      const nuevos = pdfs.filter((a) => !vistos.has(`${a.name}|${a.size}`))
      return [...prev, ...nuevos].slice(0, MAX_ARCHIVOS)
    })
    setReporte(null)
  }

  const verificar = () => {
    setCargando(true)
    setError(null)
    setReporte(null)
    const fd = new FormData()
    archivos.forEach((a) => fd.append('archivos', a))
    apiFetch('/facturas/verificar', { method: 'POST', body: fd }, onUnauthorized)
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.detail || `Error ${res.status}`)
        return data
      })
      .then((data) => {
        setReporte(data)
        setCargando(false)
      })
      .catch((err) => {
        setError(err.message)
        setCargando(false)
      })
  }

  const limpiar = () => {
    setArchivos([])
    setReporte(null)
    setError(null)
  }

  const ordenadas = reporte
    ? [...reporte.facturas].sort((a, b) => (ESTADOS[a.estado]?.orden ?? 9) - (ESTADOS[b.estado]?.orden ?? 9))
    : []
  const requierenAccion = ordenadas.filter((f) => ESTADOS[f.estado]?.accion)
  const coinciden = ordenadas.filter((f) => f.estado === 'ok')
  const duplicadas = ordenadas.filter((f) => f.estado === 'duplicada')

  return (
    <div className="vf-pagina">
      <h2 className="section-title">Verificador de facturas de proveedores</h2>
      <p style={{ fontSize: 13, color: 'var(--gray-muted)', margin: '0 0 12px' }}>
        Arrastrá los PDF de las facturas (los de la carpeta "para pasar"). Compara cada una contra Contabilium y
        muestra los ítems para controlarlos contra el remito. Solo lee: no carga ni modifica nada.
      </p>

      {!configurado && (
        <p className="vf-aviso">
          ⚠️ Falta configurar en el backend las variables CONTABILIUM_WEB_USER y CONTABILIUM_WEB_PASS.
        </p>
      )}

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
          agregar(e.dataTransfer.files)
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && inputRef.current?.click()}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            agregar(e.target.files)
            e.target.value = ''
          }}
        />
        {archivos.length === 0 ? (
          <span>📄 Soltá los PDF acá, o tocá para elegirlos</span>
        ) : (
          <span>
            <strong>{archivos.length}</strong> PDF listo{archivos.length === 1 ? '' : 's'} · soltá más o tocá para agregar
          </span>
        )}
      </div>

      {archivos.length > 0 && (
        <div className="vf-acciones">
          <button className="sort-btn toggle-on-green" onClick={verificar} disabled={cargando || !configurado}>
            {cargando ? 'Verificando…' : `Verificar ${archivos.length} factura${archivos.length === 1 ? '' : 's'}`}
          </button>
          <button className="sort-btn" onClick={limpiar} disabled={cargando}>
            Vaciar
          </button>
        </div>
      )}

      {cargando && <div className="loading-state" style={{ padding: '24px 0' }}>Leyendo las facturas y consultando Contabilium… puede tardar unos segundos por factura.</div>}
      {error && <p className="vf-aviso" style={{ color: 'var(--alerta)' }}>{error}</p>}

      {reporte && (
        <>
          <div className="vf-resumen">
            <div className="vf-resumen-linea">
              Revisadas {reporte.resumen.total} factura{reporte.resumen.total === 1 ? '' : 's'}:{' '}
              <strong style={{ color: 'var(--ok)' }}>{coinciden.length} coinciden</strong>
              {requierenAccion.length > 0 ? (
                <>
                  {' · '}
                  <strong style={{ color: 'var(--alerta)' }}>{requierenAccion.length} requieren acción</strong>
                </>
              ) : (
                ' · nada para corregir 🎉'
              )}
            </div>
            <div className="vf-chips">
              {Object.entries(ESTADOS)
                .filter(([k]) => reporte.resumen[k])
                .map(([k, e]) => (
                  <span key={k} className={`vf-badge vf-badge-${e.color}`}>
                    {e.label}: {reporte.resumen[k]}
                  </span>
                ))}
            </div>
            <button
              className="sort-btn"
              onClick={() => imprimirChecklists(ordenadas) || alert('No se pudo abrir la ventana de impresión (¿bloqueada por el navegador?) o no hay ítems.')}
            >
              🖨 Imprimir todos los checklists de ítems
            </button>
          </div>

          {requierenAccion.length > 0 && (
            <>
              <h3 className="section-title">⚠️ Requieren acción ({requierenAccion.length})</h3>
              {requierenAccion.map((f, i) => (
                <TarjetaFactura key={`${f.archivo}-${i}`} f={f} />
              ))}
            </>
          )}

          {coinciden.length > 0 && (
            <details className="vf-detalles" open={requierenAccion.length === 0}>
              <summary>✓ Coinciden ({coinciden.length})</summary>
              {coinciden.map((f, i) => (
                <TarjetaFactura key={`${f.archivo}-${i}`} f={f} compacta />
              ))}
            </details>
          )}

          {duplicadas.length > 0 && (
            <details className="vf-detalles">
              <summary>Duplicadas ({duplicadas.length})</summary>
              {duplicadas.map((f, i) => (
                <TarjetaFactura key={`${f.archivo}-${i}`} f={f} compacta />
              ))}
            </details>
          )}
        </>
      )}
    </div>
  )
}
