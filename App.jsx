import { useState } from 'react'
import PublicationsView from './PublicationsView.jsx'
import PickingListView from './PickingListView.jsx'

export default function App() {
  const [view, setView] = useState('picking') // picking | publications

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
        </nav>
      </header>

      {view === 'picking' ? <PickingListView /> : <PublicationsView />}
    </>
  )
}
