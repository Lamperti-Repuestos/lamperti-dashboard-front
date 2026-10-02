import { useEffect, useState } from 'react'
import { apiFetch } from './api.js'

const REFRESCO_MS = 60 * 1000

// Qué hacer, en palabras simples, según lo que el programa encontró
const QUE_HACER = {
  diferencia: 'Corregir la compra en Contabilium. El programa archiva la factura solo cuando los importes coincidan.',
  diferencia_menor: 'Corregir la compra en Contabilium (la diferencia es chica). El programa la archiva solo cuando coincida.',
  pendiente: 'Entrar a Consulta de comprobantes en Contabilium e importarla (Estado: Pendiente; elegí Período "Últimos 7 días" o más: filtra por la fecha de la factura, no por cuándo llegó). Si el proveedor es nuevo, primero darlo de alta.',
  rechazada: 'La casilla de Contabilium la rechazó. Revisar la factura y cargarla a mano.',
  revisar: 'El programa no pudo leer este PDF con seguridad. Mirarlo y pasarlo a mano.',
  no_cargada: 'Se mandó a Contabilium pero no aparece. Revisar la casilla de compras.',
  duplicada: 'Es el mismo comprobante que otro PDF de la carpeta. Dejar solo uno.',
}

function queHacer(a) {
  if (a.accion === 'error') return 'Se reintenta solo en la próxima corrida. Si se repite varias veces, avisar.'
  if ((a.motivo || '').includes('se carga a mano')) return 'Pasarla a mano en Contabilium, como siempre. Cuando quede cargada, el programa la archiva solo.'
  if ((a.motivo || '').includes('dirigida a Lamperti')) return 'Revisar si es una factura de Lamperti. Si lo es, pasarla a mano.'
  return QUE_HACER[a.estado] || 'Revisar a mano.'
}

function hace(segundos) {
  if (segundos < 90) return 'menos de 2 minutos'
  const min = Math.round(segundos / 60)
  if (min < 60) return `${min} minutos`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} hora${h === 1 ? '' : 's'}`
  return `${Math.round(h / 24)} días`
}

function etiquetaDia(iso) {
  const d = new Date(iso)
  const hoy = new Date()
  const ayer = new Date()
  ayer.setDate(hoy.getDate() - 1)
  if (d.toDateString() === hoy.toDateString()) return 'Hoy'
  if (d.toDateString() === ayer.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-AR', { weekday: 'long', day: '2-digit', month: '2-digit' })
}

const hora = (iso) => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

// "a las 18:24" si es de hoy, "el 30/09 a las 18:24" si es de otro día
function cuando(iso) {
  const d = new Date(iso)
  if (d.toDateString() === new Date().toDateString()) return `a las ${hora(iso)}`
  return `el ${d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })} a las ${hora(iso)}`
}

// Qué le pasó a la factura y cuándo, en orden: mandada → llegó a Contabilium → sigue pendiente hace X.
// "Sigue pendiente" solo se dice cuando se sabe desde cuándo (la mandó el agente): si la factura llegó
// por otro camino o se la devolvió a pendiente al borrar su compra, la hora de llegada no sirve para eso.
function pasosDeTiempo(a, ahoraMs) {
  const pasos = []
  if (a.enviada_en) pasos.push(`✉ Mandada ${cuando(a.enviada_en)}`)
  if (a.llego_en) pasos.push(`📥 Llegó a Contabilium ${cuando(a.llego_en)}`)
  if (a.enviada_en && a.estado === 'pendiente') {
    pasos.push(`⏳ Sigue pendiente hace ${hace(Math.max(0, (ahoraMs - new Date(a.enviada_en).getTime()) / 1000))}`)
  }
  return pasos
}

function Tarjeta({ a, color, etiqueta, mostrarQueHacer, ahoraMs }) {
  const pasos = pasosDeTiempo(a, ahoraMs)
  return (
    <div className={`vf-card vf-borde-${color}`}>
      <div className="vf-card-cab">
        <span className={`vf-badge vf-badge-${color}`}>{etiqueta}</span>
        <strong>{a.titulo || a.archivo}</strong>
        {a.proveedor && <span className="vf-prov">{a.proveedor}</span>}
      </div>
      {a.titulo && <div className="vf-archivo">{a.archivo}</div>}
      {pasos.length > 0 && <div className="fe-linea">{pasos.map((p) => <span key={p}>{p}</span>)}</div>}
      <p className="vf-aviso">{a.motivo}</p>
      {mostrarQueHacer && <p className="fe-que-hacer"><strong>Qué hacer:</strong> {queHacer(a)}</p>}
    </div>
  )
}

function resumenGeneral(data, atencion, enProceso, segundos) {
  if (!data.actualizado) {
    return { tono: 'info', icono: '⏳', titulo: 'Todavía no hay reportes del programa', detalle: 'Cuando el programa de la oficina corra por primera vez, el estado aparece acá.' }
  }
  if (!data.funcionando) {
    return { tono: 'alerta', icono: '🔴', titulo: 'El programa no está reportando', detalle: `Último aviso hace ${hace(segundos)}. ¿La PC de la oficina está prendida?` }
  }
  if (data.error) {
    return { tono: 'alerta', icono: '⚠️', titulo: 'El programa tiene un problema', detalle: data.error }
  }
  if (atencion.length) {
    const n = atencion.length
    return { tono: 'atencion', icono: '⚠️', titulo: `${n} factura${n === 1 ? ' necesita' : 's necesitan'} atención`, detalle: 'Mirá abajo qué pasó con cada una y qué hacer.' }
  }
  if (enProceso.length) {
    const n = enProceso.length
    return { tono: 'info', icono: '⏳', titulo: `${n} factura${n === 1 ? '' : 's'} en proceso`, detalle: 'El programa las está tramitando. No hay nada para hacer.' }
  }
  return { tono: 'ok', icono: '✅', titulo: 'Todo en orden', detalle: 'No hay facturas esperando en "Para pasar".' }
}

export default function FacturasEstadoView({ onUnauthorized }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [recibidoEn, setRecibidoEn] = useState(Date.now())
  const [, setTic] = useState(0)

  const cargar = () => {
    apiFetch('/facturas/agente/estado', {}, onUnauthorized)
      .then(async (res) => {
        const d = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(d.detail || `Error ${res.status}`)
        return d
      })
      .then((d) => {
        setData(d)
        setRecibidoEn(Date.now())
        setError(null)
      })
      .catch((e) => setError(e.message))
  }

  useEffect(() => {
    cargar()
    const refresco = setInterval(cargar, REFRESCO_MS)
    const reloj = setInterval(() => setTic((t) => t + 1), 20 * 1000)   // para que el "hace X" avance
    return () => {
      clearInterval(refresco)
      clearInterval(reloj)
    }
  }, [])

  if (!data) {
    return (
      <div className="vf-pagina">
        <h2 className="section-title">Estado de facturas</h2>
        {error ? (
          <p className="vf-aviso" style={{ color: 'var(--alerta)' }}>No se pudo cargar: {error} <button className="sort-btn" onClick={cargar}>Reintentar</button></p>
        ) : (
          <div className="loading-state">Cargando…</div>
        )}
      </div>
    )
  }

  const simulacion = data.modo === 'simulacion'
  const ahoraMs = Date.now()
  const segundos = data.segundos == null ? null : data.segundos + (ahoraMs - recibidoEn) / 1000
  const atencion = data.archivos.filter((a) => a.accion === 'dejar' || a.accion === 'error')
  const enProceso = data.archivos.filter((a) => a.accion === 'esperar' || (!simulacion && a.accion === 'enviar'))
  const sePasarian = simulacion ? data.archivos.filter((a) => a.accion === 'enviar' || a.accion === 'mover') : []
  const banner = resumenGeneral(data, atencion, enProceso, segundos)

  // historial agrupado por día
  const dias = []
  data.eventos.forEach((e) => {
    const dia = etiquetaDia(e.fecha)
    const ultimo = dias[dias.length - 1]
    if (ultimo && ultimo.dia === dia) ultimo.items.push(e)
    else dias.push({ dia, items: [e] })
  })

  return (
    <div className="vf-pagina">
      <h2 className="section-title">Estado de facturas</h2>
      <p style={{ fontSize: 13, color: 'var(--gray-muted)', margin: '0 0 4px' }}>
        Lo que el programa de la oficina hace solo con las facturas que caen en "Para pasar". Se actualiza solo.
      </p>

      <div className={`fe-banner fe-banner-${banner.tono}`}>
        <div className="fe-banner-titulo">{banner.icono} {banner.titulo}</div>
        <div className="fe-banner-detalle">{banner.detalle}</div>
        {data.actualizado && (
          <div className="fe-banner-pie">
            Último aviso del programa: hace {hace(segundos)}
            {simulacion && <span className="fe-modo">MODO PRUEBA</span>}
          </div>
        )}
      </div>

      {simulacion && data.actualizado && (
        <p className="vf-aviso">
          🧪 El programa está en <strong>modo prueba</strong>: mira la carpeta y anota qué haría, pero no manda ni mueve nada todavía.
        </p>
      )}
      {error && <p className="vf-aviso" style={{ color: 'var(--alerta)' }}>No se pudo actualizar ({error}). Se muestra lo último que se pudo cargar.</p>}

      {atencion.length > 0 && (
        <>
          <h3 className="section-title">⚠️ Necesitan atención ({atencion.length})</h3>
          {atencion.map((a) => (
            <Tarjeta key={a.archivo} a={a} color={a.accion === 'error' ? 'info' : 'alerta'} etiqueta={a.accion === 'error' ? 'Reintentando' : 'Revisar'} mostrarQueHacer ahoraMs={ahoraMs} />
          ))}
        </>
      )}

      {enProceso.length > 0 && (
        <>
          <h3 className="section-title">⏳ En proceso ({enProceso.length})</h3>
          {enProceso.map((a) => (
            <Tarjeta key={a.archivo} a={a} color="info" etiqueta={a.accion === 'enviar' ? 'Mandada' : 'Esperando'} ahoraMs={ahoraMs} />
          ))}
        </>
      )}

      {sePasarian.length > 0 && (
        <>
          <h3 className="section-title">🧪 Esto haría el programa ({sePasarian.length})</h3>
          {sePasarian.map((a) => (
            <Tarjeta key={a.archivo} a={a} color="ok" etiqueta={a.accion === 'enviar' ? 'La mandaría' : 'La archivaría'} ahoraMs={ahoraMs} />
          ))}
        </>
      )}

      <h3 className="section-title">Últimos 7 días</h3>
      {dias.length === 0 ? (
        <p style={{ fontSize: 13, color: 'var(--gray-muted)' }}>Todavía no hay movimientos para mostrar.</p>
      ) : (
        dias.map(({ dia, items }) => (
          <div key={dia}>
            <div className="fe-dia">{dia}</div>
            {items.map((e, i) => (
              <div key={i} className="fe-evento">
                <span className="fe-hora">{hora(e.fecha)}</span>
                <span className={`vf-badge ${e.evento === 'archivada' ? 'vf-badge-ok' : 'vf-badge-info'}`}>
                  {e.evento === 'archivada' ? '✓ Cargada y archivada' : '✉ Mandada a Contabilium'}
                </span>
                <strong>{e.titulo || e.archivo}</strong>
                {e.proveedor && <span className="vf-prov">{e.proveedor}</span>}
                {ahoraMs - new Date(e.fecha).getTime() < 30 * 60 * 1000 && <span className="fe-nuevo">NUEVO</span>}
                {e.detalle && <span className="fe-detalle">{e.detalle}</span>}
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
