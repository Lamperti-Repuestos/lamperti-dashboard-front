import { useEffect, useRef, useState } from 'react'
import PublicationsView from './PublicationsView.jsx'
import PickingListView from './PickingListView.jsx'
import StockView from './StockView.jsx'
import FullView from './FullView.jsx'
import PedidosFullView from './PedidosFullView.jsx'
import ControlEmbalajeView from './ControlEmbalajeView.jsx'
import CotejoPackingListView from './CotejoPackingListView.jsx'
import PostventaView from './PostventaView.jsx'
import MetricasView from './MetricasView.jsx'
import PublicidadView from './PublicidadView.jsx'
import CostosView from './CostosView.jsx'
import ResumenView from './ResumenView.jsx'
import TutorialView from './TutorialView.jsx'
import LogisticaView from './LogisticaView.jsx'
import NotasView from './NotasView.jsx'
import DevolucionesProveedoresView from './DevolucionesProveedoresView.jsx'
import SubagenteView from './SubagenteView.jsx'
import LoginForm from './LoginForm.jsx'
import { getAuthHeader, clearAuthHeader, apiFetch } from './api.js'
import logo70 from './logo-70.webp'

const VIEWS = ['resumen', 'picking', 'publications', 'stock', 'full', 'pedidos', 'control', 'cotejo', 'logistica', 'notas', 'devoluciones', 'postventa', 'metricas', 'publicidad', 'costos', 'subagente']

const GRUPOS = [
  {
    id: 'operacion',
    nombre: 'Operación',
    vistas: [
      { id: 'picking', label: 'Para separar' },
      { id: 'publications', label: 'Publicaciones' },
      { id: 'stock', label: 'Stock' },
      { id: 'full', label: 'Gestión Full' },
      { id: 'pedidos', label: 'Envío Full' },
      { id: 'control', label: 'Embalaje' },
      { id: 'cotejo', label: 'Cotejo Packing List' },
      { id: 'logistica', label: 'Logística' },
      { id: 'notas', label: 'Notas' },
      { id: 'devoluciones', label: 'Devoluciones a proveedores' },
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
      { id: 'costos', label: 'Costos' },
    ],
  },
]

const GRUPO_POR_VISTA = Object.fromEntries(
  GRUPOS.flatMap((g) => g.vistas.map((v) => [v.id, g.id]))
)

export default function App() {
  const [view, setView] = useState(() => {
    const guardada = localStorage.getItem('dashboard_view')
    return VIEWS.includes(guardada) ? guardada : 'resumen'
  })
  const [grupoAbierto, setGrupoAbierto] = useState(() => localStorage.getItem('dashboard_grupo') || null)
  const [mostrarTutorial, setMostrarTutorial] = useState(
    () => localStorage.getItem('dashboard_tutorial_visto') !== 'si'
  )

  const cerrarTutorial = () => {
    localStorage.setItem('dashboard_tutorial_visto', 'si')
    setMostrarTutorial(false)
  }

  const [tema, setTema] = useState(() => localStorage.getItem('dashboard_tema') || 'claro')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light')
    localStorage.setItem('dashboard_tema', tema)
  }, [tema])

  useEffect(() => {
    localStorage.setItem('dashboard_view', view)
    if (grupoAbierto) localStorage.setItem('dashboard_grupo', grupoAbierto)
    else localStorage.removeItem('dashboard_grupo')
  }, [view, grupoAbierto])

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

  const elementoIgnoraSwipe = (el) => {
    let n = el
    while (n && n !== document.body) {
      const tag = n.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
      if (n.scrollWidth > n.clientWidth) return true
      n = n.parentElement
    }
    return false
  }

  const handleTouchStart = (e) => {
    const t = e.touches[0]
    touchStart.current = {
      x: t.clientX,
      y: t.clientY,
      ignorar: elementoIgnoraSwipe(e.target),
    }
  }

  const handleTouchEnd = (e) => {
    if (!touchStart.current) return
    const { x, y, ignorar } = touchStart.current
    touchStart.current = null
    if (ignorar) return

    const t = e.changedTouches[0]
    const dx = t.clientX - x
    const dy = t.clientY - y

    // Ignoramos gestos cortos o mayormente verticales (eso es scroll normal)
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return

    // El swipe se mueve solo dentro del grupo actual (o entre Resumen y
    // el primer/último ítem del grupo) - nunca salta a otro grupo sin
    // que se vea en el menú.
    const vistasNavegables = grupoAbierto
      ? GRUPOS.find((g) => g.id === grupoAbierto).vistas.map((v) => v.id)
      : ['resumen']
    const currentIndex = vistasNavegables.indexOf(view)
    if (currentIndex === -1) return

    if (dx < 0 && currentIndex < vistasNavegables.length - 1) {
      irA(vistasNavegables[currentIndex + 1])
    } else if (dx > 0 && currentIndex > 0) {
      irA(vistasNavegables[currentIndex - 1])
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
            <h1>Miguelito</h1>
          </div>
          <button
            className={`view-tab header-ayuda ${view === 'subagente' ? 'active' : ''}`}
            onClick={() => { setView('subagente'); setGrupoAbierto(null) }}
            title="Asistente (beta)"
          >
            🤖
          </button>
          <button
            className="view-tab header-ayuda"
            onClick={() => setMostrarTutorial(true)}
            title="Ver el tutorial"
          >
            ?
          </button>
          <button
            className="view-tab header-ayuda"
            onClick={() => setTema((t) => (t === 'oscuro' ? 'claro' : 'oscuro'))}
            title="Cambiar tema"
          >
            {tema === 'oscuro' ? '☀️' : '🌙'}
          </button>
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
        {view === 'subagente' && <SubagenteView onUnauthorized={handleUnauthorized} />}
        {view === 'picking' && <PickingListView onUnauthorized={handleUnauthorized} />}
        {view === 'publications' && <PublicationsView onUnauthorized={handleUnauthorized} />}
        {view === 'stock' && <StockView onUnauthorized={handleUnauthorized} />}
        {view === 'full' && <FullView onUnauthorized={handleUnauthorized} />}
        {view === 'pedidos' && <PedidosFullView onUnauthorized={handleUnauthorized} />}
        {view === 'control' && <ControlEmbalajeView onUnauthorized={handleUnauthorized} />}
        {view === 'cotejo' && <CotejoPackingListView onUnauthorized={handleUnauthorized} />}
        {view === 'logistica' && <LogisticaView onUnauthorized={handleUnauthorized} />}
        {view === 'notas' && <NotasView onUnauthorized={handleUnauthorized} />}
        {view === 'devoluciones' && <DevolucionesProveedoresView onUnauthorized={handleUnauthorized} />}
        {view === 'postventa' && <PostventaView onUnauthorized={handleUnauthorized} />}
        {view === 'metricas' && <MetricasView onUnauthorized={handleUnauthorized} />}
        {view === 'publicidad' && <PublicidadView onUnauthorized={handleUnauthorized} />}
        {view === 'costos' && <CostosView onUnauthorized={handleUnauthorized} />}
      </div>

      {mostrarTutorial && <TutorialView onCerrar={cerrarTutorial} />}
    </>
  )
}