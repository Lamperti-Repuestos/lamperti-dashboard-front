import { useEffect, useRef, useState } from 'react'
import PublicationsView from './PublicationsView.jsx'
import PickingListView from './PickingListView.jsx'
import StockView from './StockView.jsx'
import FullView from './FullView.jsx'
import PedidosFullView from './PedidosFullView.jsx'
import ControlEmbalajeView from './ControlEmbalajeView.jsx'
import EtiquetasView from './EtiquetasView.jsx'
import CotejoPackingListView from './CotejoPackingListView.jsx'
import PostventaView from './PostventaView.jsx'
import MetricasView from './MetricasView.jsx'
import PublicidadView from './PublicidadView.jsx'
import ResumenView from './ResumenView.jsx'
import LoginForm from './LoginForm.jsx'
import { getAuthHeader, clearAuthHeader, apiFetch } from './api.js'
import logo70 from './logo-70.webp'

const VIEWS = ['resumen', 'picking', 'etiquetas', 'publications', 'stock', 'full', 'pedidos', 'control', 'cotejo', 'postventa', 'metricas', 'publicidad']

const GRUPOS = [
  {
    id: 'operacion',
    nombre: 'Operación',
    vistas: [
      { id: 'picking', label: 'Para separar' },
      { id: 'etiquetas', label: 'Etiquetas' },
      { id: 'publications', label: 'Publicaciones' },
      { id: 'stock', label: 'Stock' },
      { id: 'full', label: 'Gestión Full' },
      { id: 'pedidos', label: 'Envío Full' },
      { id: 'control', label: 'Control Embalaje' },
      { id: 'cotejo', label: 'Cotejo Packing List' },
    ],
  },
  {
    id: 'postventa',
    nombre: 'Postventa',
    vistas: [{ id: 'postventa', label: 'Postventa' }],
  },
  {
    id: 'datos',
    nombre: 'Datos',
    vistas: [
      { id: 'metricas', label: 'Métricas' },
      { id: 'publicidad', label: 'Publicidad' },
    ],
  },
]

const GRUPO_POR_VISTA = Object.fromEntries(
  GRUPOS.flatMap((g) => g.vistas.map((v) => [v.id, g.id]))
)

export default function App() {
  const [view, setView] = useState('resumen') // resumen | picking | publications | stock
  const [grupoAbierto, setGrupoAbierto] = useState(null)

  const irA = (nuevaVista) => {
    setView(nuevaVista)
    setGrupoAbierto(GRUPO_POR_VISTA[nuevaVista] || null)
  }
  const [authed, setAuthed] = useState(null) // null = todavía chequeando

  useEffect(() => {
    if (!getAuthHeader()) {
      setAuthed(false)
      return
    }
    apiFetch('/auth/check', {}, () => setAuthed(false)).then((res) => {
      setAuthed(res.ok)
    })
  }, [])

  const handleUnauthorized = () => setAuthed(false)

  const handleLogout = () => {
    clearAuthHeader()
    setAuthed(false)
  }

  // Swipe para cambiar de pestaña en celular (izquierda/derecha)
  const touchStart = useRef(null)

  const handleTouchStart = (e) => {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }

  const handleTouchEnd = (e) => {
    if (!touchStart.current) return
    const t = e.changedTouches[0]
    const dx = t.clientX - touchStart.current.x
    const dy = t.clientY - touchStart.current.y
    touchStart.current = null

    // Ignoramos gestos cortos o mayormente verticales (eso es scroll normal)
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return

    const currentIndex = VIEWS.indexOf(view)
    if (dx < 0 && currentIndex < VIEWS.length - 1) {
      setView(VIEWS[currentIndex + 1])
    } else if (dx > 0 && currentIndex > 0) {
      setView(VIEWS[currentIndex - 1])
    }
  }

  if (authed === null) {
    return <div className="loading-state">Cargando...</div>
  }

  if (!authed) {
    return <LoginForm onSuccess={() => setAuthed(true)} />
  }

  return (
    <>
      <header className="header">
        <div className="header-brand">
          <img src={logo70} alt="Lamperti 70° Aniversario" className="header-logo" />
          <div className="header-text">
            <h1>Dashboard</h1>
          </div>
          <button className="view-tab logout-tab header-logout" onClick={handleLogout}>
            Salir
          </button>
        </div>

        <button
          className={`view-tab view-tab-full ${view === 'resumen' ? 'active' : ''}`}
          onClick={() => { setView('resumen'); setGrupoAbierto(null) }}
        >
          Resumen
        </button>

        <nav className="view-nav">
          {GRUPOS.map((g) => (
            <button
              key={g.id}
              className={`view-tab view-tab-grow ${grupoAbierto === g.id ? 'active' : ''}`}
              onClick={() => setGrupoAbierto(grupoAbierto === g.id ? null : g.id)}
            >
              {g.nombre} {grupoAbierto === g.id ? '▲' : '▼'}
            </button>
          ))}
        </nav>

        {grupoAbierto && (
          <nav className="view-nav view-nav-sub">
            {GRUPOS.find((g) => g.id === grupoAbierto).vistas.map((v) => (
              <button
                key={v.id}
                className={`view-tab ${view === v.id ? 'active' : ''}`}
                onClick={() => setView(v.id)}
              >
                {v.label}
              </button>
            ))}
          </nav>
        )}
      </header>

      <div className="view-wrap" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {view === 'resumen' && <ResumenView onUnauthorized={handleUnauthorized} onIrA={irA} />}
        {view === 'picking' && <PickingListView onUnauthorized={handleUnauthorized} />}
        {view === 'etiquetas' && <EtiquetasView onUnauthorized={handleUnauthorized} />}
        {view === 'publications' && <PublicationsView onUnauthorized={handleUnauthorized} />}
        {view === 'stock' && <StockView onUnauthorized={handleUnauthorized} />}
        {view === 'full' && <FullView onUnauthorized={handleUnauthorized} />}
        {view === 'pedidos' && <PedidosFullView onUnauthorized={handleUnauthorized} />}
        {view === 'control' && <ControlEmbalajeView onUnauthorized={handleUnauthorized} />}
        {view === 'cotejo' && <CotejoPackingListView onUnauthorized={handleUnauthorized} />}
        {view === 'postventa' && <PostventaView onUnauthorized={handleUnauthorized} />}
        {view === 'metricas' && <MetricasView onUnauthorized={handleUnauthorized} />}
        {view === 'publicidad' && <PublicidadView onUnauthorized={handleUnauthorized} />}
      </div>
    </>
  )
}