import { useEffect, useRef, useState } from 'react'
import { apiFetch } from './api.js'

const EJEMPLO = `SKU123
SKU456\t5
SKU789\t2\t18500\thttps://ejemplo.com/foto.jpg\tFiltro de aceite Fram PH5796`

const COLORES = {
  listo: 'var(--ok)',
  publicado: 'var(--ok)',
  simulado: 'var(--info)',
  error: 'var(--alerta)',
}

// Una fila por línea: SKU [cantidad] [precio] [foto] [título]. Separador: tab, ; o coma
// (tab = pegado directo desde Excel). Lo que falta lo completa Contabilium.
function parsearTexto(texto) {
  return texto
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((linea) => {
      const [sku, cant, precio, foto, titulo] = linea.split(/\t|;|,/).map((x) => x.trim())
      const cantidad = cant ? parseInt(cant, 10) : null
      const p = precio ? parseFloat(precio.replace(',', '.')) : null
      return {
        sku,
        cantidad: Number.isNaN(cantidad) ? null : cantidad,
        precio: Number.isNaN(p) ? null : p,
        fotos: foto ? [foto] : [],
        titulo: titulo || null,
      }
    })
    .filter((f) => f.sku)
}

export default function PublicadorView({ onUnauthorized }) {
  const [status, setStatus] = useState(null)
  const [texto, setTexto] = useState('')
  const [factor, setFactor] = useState('1')
  const [filas, setFilas] = useState([])
  const [progreso, setProgreso] = useState(null) // { hechos, total, tipo }
  const [error, setError] = useState(null)
  const timer = useRef(null)

  useEffect(() => {
    apiFetch('/publicador/status', {}, onUnauthorized)
      .then((r) => (r.ok ? r.json() : null))
      .then(setStatus)
      .catch(() => {})
    return () => clearInterval(timer.current)
  }, [])

  const ocupado = progreso !== null

  const seguirJob = (jobId) => {
    clearInterval(timer.current)
    timer.current = setInterval(async () => {
      try {
        const res = await apiFetch(`/publicador/jobs/${jobId}`, {}, onUnauthorized)
        if (!res.ok) throw new Error((await res.json()).detail || `Error ${res.status}`)
        const job = await res.json()
        setProgreso({ hechos: job.hechos, total: job.total, tipo: job.tipo })
        setFilas((prev) => (job.filas.length >= prev.length || job.terminado ? job.filas : prev))
        if (job.terminado) {
          clearInterval(timer.current)
          setProgreso(null)
          if (job.error) setError(job.error)
        }
      } catch (e) {
        clearInterval(timer.current)
        setProgreso(null)
        setError(e.message)
      }
    }, 1500)
  }

  const lanzar = async (path, body, tipo, cantidad) => {
    setError(null)
    setProgreso({ hechos: 0, total: cantidad, tipo })
    try {
      const res = await apiFetch(
        path,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
        onUnauthorized
      )
      if (!res.ok) throw new Error((await res.json()).detail || `Error ${res.status}`)
      const { job_id } = await res.json()
      if (tipo === 'preparar') setFilas([])
      seguirJob(job_id)
    } catch (e) {
      setProgreso(null)
      setError(e.message)
    }
  }

  const preparar = () => {
    const parsed = parsearTexto(texto)
    if (!parsed.length) return setError('Pegá al menos un SKU.')
    lanzar('/publicador/preparar', { filas: parsed, factor_precio: parseFloat(factor) || 1 }, 'preparar', parsed.length)
  }

  const publicar = () => {
    const pendientes = filas.filter((f) => f.estado !== 'publicado')
    if (!pendientes.length) return
    const real = status && !status.dry_run
    if (real && !window.confirm(`Se van a publicar/actualizar ${pendientes.length} publicaciones en Mercado Libre. ¿Seguir?`)) return
    lanzar('/publicador/publicar', { filas: pendientes }, 'publicar', pendientes.length)
    // Las ya publicadas quedan fuera de la próxima tanda; las volvemos a ver al terminar
    setFilas((prev) => prev.filter((f) => f.estado === 'publicado'))
  }

  const editar = (i, campo, valor) =>
    setFilas((prev) => prev.map((f, idx) => (idx === i ? { ...f, [campo]: valor } : f)))

  const listas = filas.filter((f) => f.estado === 'listo' || f.estado === 'error').length
  const conteo = (e) => filas.filter((f) => f.estado === e).length

  const inp = { width: '100%', boxSizing: 'border-box', padding: '4px 6px', border: '1px solid var(--gray-line)', borderRadius: 6, background: 'var(--card-bg)', color: 'var(--charcoal)' }

  return (
    <div>
      <h2>Publicador masivo</h2>
      <p style={{ color: 'var(--gray-muted)', marginTop: 0 }}>
        Pegá los SKUs del stock físico. Si el SKU está en Contabilium, ahí se toma nombre, precio y stock;
        si no está, completás título, precio y cantidad y se da de alta en Contabilium al publicar. Si ya está
        publicado en ML repone stock, y si no, lo crea. Antes de publicar, ML valida cada uno.
      </p>

      {status && status.dry_run && (
        <div style={{ background: 'var(--bg-aviso)', color: '#2E2E2E', padding: 10, borderRadius: 'var(--radius)', marginBottom: 12 }}>
          Modo prueba: solo valida contra ML, no publica nada (PUBLICADOR_DRY_RUN=true en el backend).
        </div>
      )}
      {status && !status.contabilium_configurado && (
        <div style={{ background: 'var(--bg-faltante)', color: '#2E2E2E', padding: 10, borderRadius: 'var(--radius)', marginBottom: 12 }}>
          Contabilium no está configurado en el backend.
        </div>
      )}

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder={`Un producto por línea: SKU [cantidad] [precio] [foto] [título]\n\n${EJEMPLO}`}
        rows={7}
        style={{ ...inp, fontFamily: 'monospace', padding: 10 }}
        disabled={ocupado}
      />
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', margin: '10px 0' }}>
        <label>
          Multiplicador de precio{' '}
          <input value={factor} onChange={(e) => setFactor(e.target.value)} style={{ ...inp, width: 70 }} disabled={ocupado} />
        </label>
        <button className="sort-btn" onClick={preparar} disabled={ocupado || !texto.trim()}>
          1. Preparar y validar
        </button>
        <button className="sort-btn" onClick={publicar} disabled={ocupado || !listas}>
          2. {status && status.dry_run ? 'Validar de nuevo (prueba)' : `Publicar ${listas}`}
        </button>
      </div>

      {progreso && (
        <div style={{ margin: '8px 0' }}>
          {progreso.tipo === 'preparar' ? 'Consultando Contabilium y ML' : 'Publicando'}: {progreso.hechos}/{progreso.total}
          <div style={{ height: 6, background: 'var(--gray-line)', borderRadius: 3, marginTop: 4 }}>
            <div style={{ height: 6, width: `${(progreso.hechos / Math.max(progreso.total, 1)) * 100}%`, background: 'var(--info)', borderRadius: 3 }} />
          </div>
        </div>
      )}
      {error && <div style={{ color: 'var(--alerta)', margin: '8px 0' }}>{error}</div>}

      {filas.length > 0 && (
        <>
          <p>
            <strong>{filas.length}</strong> filas · {conteo('listo')} listas · {conteo('error')} con error
            {conteo('simulado') > 0 && ` · ${conteo('simulado')} simuladas`}
            {conteo('publicado') > 0 && ` · ${conteo('publicado')} publicadas`}
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--gray-line)' }}>
                  <th>Estado</th><th>SKU</th><th>Acción</th><th style={{ minWidth: 220 }}>Título</th>
                  <th>Cant.</th><th>Precio</th><th>Categoría</th><th style={{ minWidth: 180 }}>Foto (URL)</th><th>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f, i) => {
                  // Si no está en Contabilium, todo es editable: ahí se completa lo que falta para darlo de alta
                  const crear = f.accion === 'crear' || f.en_contabilium === false
                  return (
                    <tr key={f.sku} style={{ borderBottom: '1px solid var(--gray-line)', verticalAlign: 'top' }}>
                      <td style={{ color: COLORES[f.estado], fontWeight: 600 }}>{f.estado}</td>
                      <td>{f.sku}{f.en_contabilium === false && <div style={{ fontSize: 12, color: 'var(--atencion)' }}>nuevo en Contabilium</div>}</td>
                      <td>{f.accion || '-'}</td>
                      <td><input style={inp} value={f.titulo || ''} disabled={!crear} maxLength={60} onChange={(e) => editar(i, 'titulo', e.target.value)} /></td>
                      <td><input style={{ ...inp, width: 60 }} type="number" min="0" value={f.cantidad ?? ''} onChange={(e) => editar(i, 'cantidad', e.target.value === '' ? null : parseInt(e.target.value, 10))} /></td>
                      <td><input style={{ ...inp, width: 90 }} type="number" min="0" value={f.precio ?? ''} disabled={!crear} onChange={(e) => editar(i, 'precio', e.target.value === '' ? null : parseFloat(e.target.value))} /></td>
                      <td><input style={{ ...inp, width: 100 }} value={f.categoria || ''} disabled={!crear} onChange={(e) => editar(i, 'categoria', e.target.value)} /></td>
                      <td><input style={inp} value={(f.fotos && f.fotos[0]) || ''} disabled={!crear} onChange={(e) => editar(i, 'fotos', e.target.value ? [e.target.value] : [])} /></td>
                      <td style={{ color: f.estado === 'error' ? 'var(--alerta)' : 'var(--gray-muted)' }}>
                        {f.mensaje}{' '}
                        {f.permalink && <a href={f.permalink} target="_blank" rel="noreferrer">ver</a>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
