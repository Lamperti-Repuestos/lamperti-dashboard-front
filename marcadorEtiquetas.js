// Marcador (bookmarklet) para la pantalla de etiquetado de un envío Full de ML
// (vendedores.mercadolibre.com.ar/shipping/inbounds/<número>/labeling).
//
// Lee cada producto de la tabla: "Código ML: XXXX" + la columna "N etiquetas".
// Si al lado de "N etiquetas" ML muestra el tilde verde, las etiquetas ya están
// impresas; si no hay tilde, no. Lo manda a Miguelito para que muestre ✅ / ❌.
//
// IMPORTANTE: las dos funciones de abajo se convierten a texto (toString) y se
// pegan dentro del marcador, así que tienen que ser AUTOCONTENIDAS: no pueden
// usar nada de afuera de su propio cuerpo.

export function leerEtiquetasDeLaPagina(doc) {
  const reCodigo = /C[oó]digo ML:\s*([A-Z0-9]+)/i
  const reCodigoGlobal = /C[oó]digo ML:/gi
  const reEtiquetas = /^\s*(\d+)\s+etiquetas?\s*$/i
  const vista = doc.defaultView

  const esVerde = (n) => {
    const estilo = vista.getComputedStyle(n)
    return [estilo.color, estilo.fill, estilo.stroke, estilo.backgroundColor].some((c) => {
      const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || '')
      if (!m) return false
      const r = +m[1], g = +m[2], b = +m[3]
      return g > 100 && g > r + 30 && g > b + 30
    })
  }

  const parecenExito = /success|check|\bok\b|done|ready|exito|éxito|listo|impres/i

  const esTildeVerde = (icono) => {
    const nombre = [
      icono.getAttribute('class'), icono.getAttribute('aria-label'), icono.getAttribute('alt'),
      icono.getAttribute('data-testid'), icono.getAttribute('title'),
    ].join(' ')
    if (parecenExito.test(nombre)) return true
    return esVerde(icono) || Array.from(icono.querySelectorAll('*')).some(esVerde)
  }

  const resultado = []
  const vistos = new Set()
  const todos = Array.from(doc.querySelectorAll('body *'))

  // El elemento más interno cuyo texto es exactamente "20 etiquetas".
  const conteos = todos.filter((el) => {
    if (!reEtiquetas.test(el.textContent || '')) return false
    return !Array.from(el.children).some((h) => reEtiquetas.test(h.textContent || ''))
  })

  conteos.forEach((conteo) => {
    // La fila: el ancestro más chico que contiene UN solo "Código ML:".
    let fila = conteo.parentElement
    while (fila && !reCodigo.test(fila.textContent || '')) fila = fila.parentElement
    if (!fila) return
    if (((fila.textContent || '').match(reCodigoGlobal) || []).length !== 1) return

    const codigo = reCodigo.exec(fila.textContent)[1].toUpperCase()
    if (vistos.has(codigo)) return
    vistos.add(codigo)

    // La celda: sube mientras lo único con texto sea "N etiquetas" (así entra el tilde, que no tiene texto).
    let celda = conteo
    while (celda.parentElement && celda.parentElement !== fila && reEtiquetas.test(celda.parentElement.textContent || '')) {
      celda = celda.parentElement
    }
    const iconos = Array.from(celda.querySelectorAll('svg, img, i, [class*="icon" i], [class*="check" i], [class*="success" i]'))
    const cantidad = Number(reEtiquetas.exec(conteo.textContent)[1])
    resultado.push({ inventory_id: codigo, impresas: iconos.some(esTildeVerde), etiquetas: cantidad })
  })

  return resultado
}

export async function marcadorEtiquetas(apiUrl, leer) {
  const CLAVE = 'lamperti_full_token'
  const filas = leer(document)
  if (!filas.length) {
    alert('No encontré productos con etiquetas en esta página. Tenés que estar en la pantalla "Etiquetado" de un envío Full, con la tabla a la vista.')
    return
  }

  let token = localStorage.getItem(CLAVE)
  if (!token) {
    token = (prompt('Pegá el token del marcador de Full (solo la primera vez en este navegador):') || '').trim()
    if (!token) return
    localStorage.setItem(CLAVE, token)
  }
  const cabeceras = { 'X-Bookmarklet-Token': token, 'Content-Type': 'application/json' }

  try {
    const resEnvios = await fetch(`${apiUrl}/full/bookmarklet/envios`, { headers: cabeceras })
    if (resEnvios.status === 401) {
      localStorage.removeItem(CLAVE)
      alert('El token no es válido. Volvé a apretar el marcador y pegalo de nuevo.')
      return
    }
    const { envios } = await resEnvios.json()
    if (!envios.length) {
      alert('No hay ningún Envío Full en curso en Miguelito.')
      return
    }

    let envio = envios[0]
    if (envios.length > 1) {
      const lista = envios.map((e, i) => `${i + 1}) ${e.nombre}`).join('\n')
      const eleccion = Number(prompt(`¿A qué envío de Miguelito corresponde esta pantalla?\n\n${lista}\n\nEscribí el número:`))
      envio = envios[eleccion - 1]
      if (!envio) return
    }

    const impresas = filas.filter((f) => f.impresas)
    const sinImprimir = filas.filter((f) => !f.impresas)
    const detalle = filas.map((f) => `${f.impresas ? '✅' : '❌'} ${f.inventory_id} (${f.etiquetas} etiquetas)`).join('\n')
    const ok = confirm(
      `Envío de Miguelito: ${envio.nombre}\n\nLeí ${filas.length} productos:\n✅ ${impresas.length} con etiquetas impresas\n❌ ${sinImprimir.length} sin imprimir\n\n${detalle.slice(0, 1500)}\n\n¿Lo mando a Miguelito?`
    )
    if (!ok) return

    const res = await fetch(`${apiUrl}/full/pipeline/etiquetas-por-inventory-id`, {
      method: 'POST',
      headers: cabeceras,
      body: JSON.stringify({ pedido_id: envio.id, items: filas.map((f) => ({ inventory_id: f.inventory_id, impresas: f.impresas })) }),
    })
    if (!res.ok) {
      alert(`Miguelito rechazó el pedido (${res.status}).`)
      return
    }
    const r = await res.json()
    let msg = `Listo: se actualizaron ${r.actualizados} productos en "${envio.nombre}".`
    if (r.fuera_del_envio.length) msg += `\n\n${r.fuera_del_envio.length} no están en ese envío de Miguelito (se ignoraron).`
    if (r.no_reconocidos.length) msg += `\n${r.no_reconocidos.length} códigos de ML no se reconocieron.`
    alert(msg)
  } catch (e) {
    alert(`No pude hablar con Miguelito: ${e.message}`)
  }
}

// El texto "javascript:..." que se arrastra a la barra de favoritos.
export function armarMarcadorEtiquetas(apiUrl) {
  const codigo = `(${marcadorEtiquetas.toString()})(${JSON.stringify(apiUrl)},${leerEtiquetasDeLaPagina.toString()})`
  return `javascript:${encodeURIComponent(codigo)}`
}
