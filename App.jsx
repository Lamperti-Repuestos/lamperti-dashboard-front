import { useEffect, useRef, useState } from 'react'
import PublicationsView from './PublicationsView.jsx'
import PickingListView from './PickingListView.jsx'
import StockView from './StockView.jsx'
import FullView from './FullView.jsx'
import PedidosFullView from './PedidosFullView.jsx'
import ControlEmbalajeView from './ControlEmbalajeView.jsx'
import CotejoPackingListView from './CotejoPackingListView.jsx'
import LoginForm from './LoginForm.jsx'
import { getAuthHeader, clearAuthHeader, apiFetch } from './api.js'
import logo70 from './logo-70.webp'

const VIEWS = ['picking', 'publications', 'stock', 'full', 'pedidos', 'control', 'cotejo']

export default function App() {
  const [view, setView] = useState('picking') // picking | publications | stock
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
        </div>
        <nav className="view-nav">
          <button
            className={`view-tab ${view === 'picking' ? 'active' : ''}`}
            onClick={() => setView('picking')}
          >
            Para separar
          </button>
          <button
            className={`view-tab ${view === 'publications' ? 'active' : ''}`}
            onClick={() => setView('publications')}
          >
            Publicaciones
          </button>
          <button
            className={`view-tab ${view === 'stock' ? 'active' : ''}`}
            onClick={() => setView('stock')}
          >
            Stock
          </button>
          <button
            className={`view-tab ${view === 'full' ? 'active' : ''}`}
            onClick={() => setView('full')}
          >
            Gestión Full
          </button>
          <button
            className={`view-tab ${view === 'pedidos' ? 'active' : ''}`}
            onClick={() => setView('pedidos')}
          >
            Envío Full
          </button>
          <button
            className={`view-tab ${view === 'control' ? 'active' : ''}`}
            onClick={() => setView('control')}
          >
            Control Embalaje
          </button>
          <button
            className={`view-tab ${view === 'cotejo' ? 'active' : ''}`}
            onClick={() => setView('cotejo')}
          >
            Cotejo Packing List
          </button>
          <button className="view-tab logout-tab" onClick={handleLogout}>
            Salir
          </button>
        </nav>
      </header>

      <div className="view-wrap" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        {view === 'picking' && <PickingListView onUnauthorized={handleUnauthorized} />}
        {view === 'publications' && <PublicationsView onUnauthorized={handleUnauthorized} />}
        {view === 'stock' && <StockView onUnauthorized={handleUnauthorized} />}
        {view === 'full' && <FullView onUnauthorized={handleUnauthorized} />}
        {view === 'pedidos' && <PedidosFullView onUnauthorized={handleUnauthorized} />}
        {view === 'control' && <ControlEmbalajeView onUnauthorized={handleUnauthorized} />}
        {view === 'cotejo' && <CotejoPackingListView onUnauthorized={handleUnauthorized} />}
      </div>
    </>
  )
}