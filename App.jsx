import { useEffect, useState } from 'react'
import PublicationsView from './PublicationsView.jsx'
import PickingListView from './PickingListView.jsx'
import StockView from './StockView.jsx'
import LoginForm from './LoginForm.jsx'
import { getAuthHeader, clearAuthHeader, apiFetch } from './api.js'

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

  if (authed === null) {
    return <div className="loading-state">Cargando...</div>
  }

  if (!authed) {
    return <LoginForm onSuccess={() => setAuthed(true)} />
  }

  return (
    <>
      <header className="header">
        <h1>Lamperti · Dashboard ML</h1>
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
          <button className="view-tab logout-tab" onClick={handleLogout}>
            Salir
          </button>
        </nav>
      </header>

      {view === 'picking' && <PickingListView onUnauthorized={handleUnauthorized} />}
      {view === 'publications' && <PublicationsView onUnauthorized={handleUnauthorized} />}
      {view === 'stock' && <StockView onUnauthorized={handleUnauthorized} />}
    </>
  )
}
