import { useState } from 'react'
import { setAuthHeader, clearAuthHeader } from './api.js'
import logo70 from './logo-70.webp'

const API_URL = import.meta.env.VITE_API_URL

export default function LoginForm({ onSuccess }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [checking, setChecking] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setChecking(true)

    setAuthHeader(username, password)

    try {
      const res = await fetch(`${API_URL}/auth/check`, {
        headers: { Authorization: sessionStorage.getItem('lamperti_auth') },
      })
      if (res.ok) {
        onSuccess()
      } else {
        clearAuthHeader()
        setError('Usuario o contraseña incorrectos.')
      }
    } catch {
      clearAuthHeader()
      setError('No se pudo conectar con el servidor.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <img src={logo70} alt="Lamperti 70° Aniversario" className="login-logo" />
        <p>Ingresá con el usuario y contraseña del equipo.</p>

        <input
          type="text"
          placeholder="Usuario"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoFocus
        />
        <input
          type="password"
          placeholder="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />

        {error && <div className="login-error">{error}</div>}

        <button type="submit" disabled={checking}>
          {checking ? 'Verificando...' : 'Entrar'}
        </button>
      </form>
    </div>
  )
}
