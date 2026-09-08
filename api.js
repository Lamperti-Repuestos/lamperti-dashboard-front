const API_URL = import.meta.env.VITE_API_URL

export function getAuthHeader() {
  return sessionStorage.getItem('lamperti_auth')
}

export function setAuthHeader(username, password) {
  const encoded = btoa(`${username}:${password}`)
  sessionStorage.setItem('lamperti_auth', `Basic ${encoded}`)
}

export function clearAuthHeader() {
  sessionStorage.removeItem('lamperti_auth')
}

/**
 * fetch con la contraseña puesta sola en cada pedido.
 * Si el backend devuelve 401 (usuario/contraseña ya no válidos),
 * avisa con onUnauthorized para volver a mostrar el login.
 */
export async function apiFetch(path, options = {}, onUnauthorized) {
  const authHeader = getAuthHeader()
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(authHeader ? { Authorization: authHeader } : {}),
    },
  })

  if (res.status === 401) {
    clearAuthHeader()
    if (onUnauthorized) onUnauthorized()
  }

  return res
}
