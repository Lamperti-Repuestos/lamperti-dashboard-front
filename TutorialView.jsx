import { useState } from 'react'

const SECCIONES = [
  {
    id: 'inicio',
    titulo: '👋 Bienvenido al dashboard',
    pasos: [
      {
        titulo: '¿Qué es esto?',
        texto: 'Es la herramienta interna de Lamperti para manejar todo lo de Mercado Libre: qué separar, qué embalar, qué imprimir, reclamos, stock y métricas. Reemplaza tener 6 pestañas de ML abiertas.',
      },
      {
        titulo: 'Cómo está organizado',
        texto: 'Arriba tenés "Resumen" (la foto del día) y tres categorías: OPERACIÓN (el trabajo diario), POSTVENTA (reclamos y devoluciones) y DATOS (métricas y publicidad). Tocás una categoría y se despliegan sus pantallas abajo.',
      },
      {
        titulo: 'Se acuerda dónde estabas',
        texto: 'Si recargás la página (F5 o deslizando para abajo en el celu), volvés a la misma pantalla donde estabas. No te manda de nuevo al inicio.',
      },
    ],
  },
  {
    id: 'resumen',
    titulo: '🏠 Resumen',
    pasos: [
      {
        titulo: 'El contador de ventas del día',
        texto: 'Arriba de todo ves cuántas ventas llevamos hoy (de 00:00 hasta ahora), con el desglose: Colecta, Flex, Full y Acordar entrega. Abajo dice cuánto falta para el próximo objetivo del equipo.',
      },
      {
        titulo: 'Cambiar el objetivo',
        texto: 'El botón "✏️ Cambiar objetivo" deja poner una meta nueva y su premio. Cuando lleguemos a 200 (asado), ahí mismo se carga el objetivo siguiente.',
      },
      {
        titulo: 'Los 4 cuadros de colores',
        texto: 'Cada uno es un número que importa mirar hoy: unidades por separar, productos que se sobrevendieron, reclamos que vencen hoy y reclamos abiertos. Si tocás cualquiera, te lleva directo a la pantalla correspondiente.',
      },
      {
        titulo: 'Rojo y amarillo = mirar ahora',
        texto: 'Si un cuadro está rojo o amarillo con un ⚠, hay algo que necesita atención. Verde o azul es que está todo bien.',
      },
    ],
  },
  {
    id: 'separar',
    titulo: '📋 Para separar',
    pasos: [
      {
        titulo: 'Qué muestra',
        texto: 'Todo lo que se vendió y hay que ir a buscar a la estantería, agrupado por producto (no venta por venta). Si de un mismo producto se vendieron 7, te muestra "×7" en una sola fila.',
      },
      {
        titulo: 'Tildar lo que ya separaste',
        texto: 'Tocás el casillero de la izquierda cuando ya lo buscaste. La fila queda tachada y gris.',
      },
      {
        titulo: 'El botón "Faltante"',
        texto: 'Si fuiste a buscarlo y no está, tocá "Faltante". Queda marcado en rojo y también aparece así en la pantalla de Embalaje, para que el que embala lo sepa.',
      },
      {
        titulo: 'Etiquetas de envío',
        texto: 'Cada fila te dice si es Colecta, Flex o Acordar, y cuántos de cada uno. Si dice "⏸ Quedó pausada la publicación", ese producto se quedó sin stock y ML lo pausó solo.',
      },
      {
        titulo: 'No desaparece al pasar el corte',
        texto: 'Las ventas siguen apareciendo hasta que el envío realmente se despacha, no cuando pasa la hora de corte. Si está ahí, todavía hay algo que hacer.',
      },
    ],
  },
  {
    id: 'embalaje',
    titulo: '📦 Embalaje',
    pasos: [
      {
        titulo: 'Arranca por las etiquetas',
        texto: 'Arriba de todo hay un botón "🖨 Etiquetas (imprimir / despachar) → Ver". Ahí está todo lo de imprimir, sin salir de esta pantalla.',
      },
      {
        titulo: 'Imprimir etiquetas',
        texto: 'Te muestra las pendientes separadas en Colecta y Flex. Marcás las que querés (o "Marcar todas"), tocás "🖨 Imprimir seleccionadas" y se abre el PDF en una pestaña nueva para mandar a la impresora.',
      },
      {
        titulo: 'Las que ya se imprimieron',
        texto: 'Abajo aparecen como "listas para despachar". Desde ahí tocás "📥 Importar a Control Embalaje" y los productos bajan solos a la lista de abajo. No hace falta copiar y pegar nada de ML.',
      },
      {
        titulo: 'La lista de embalaje',
        texto: 'Cada producto con su foto, SKU, comprador y si es Colecta o Flex. Lo tildás cuando lo embalaste. Si dice "⚠ Marcado como faltante", ese ya se sabe que no está.',
      },
      {
        titulo: 'Buscar por voz 🎤',
        texto: 'Tocás "Voz" y podés decir: "marcá el primero", "marcá el segundo", "marcá todos", o "traer colecta" / "traer flex" para filtrar. También podés decir el nombre del producto para buscarlo.',
      },
      {
        titulo: 'Finalizar la tanda',
        texto: 'Cuando terminás, "✅ Finalizar embalaje" guarda todo en el historial y te muestra el resumen: cuántos embalados, cuántos faltantes, cuántos de cada tipo. Después la lista queda limpia para la próxima.',
      },
    ],
  },
  {
    id: 'full',
    titulo: '🏭 Gestión Full y Envío Full',
    pasos: [
      {
        titulo: 'Gestión Full: qué hay allá',
        texto: 'Muestra el stock que tenemos en el depósito de Mercado Libre, ordenado de menos a más. El cuadro amarillo "Con 3 o menos disponibles" es clickeable: te filtra solo esos, que son los que hay que reponer ya.',
      },
      {
        titulo: 'Armar un pedido Full',
        texto: 'Desde la pantalla de reposición de ML, se usa el marcador (bookmarklet) del navegador. Lee los casilleros que cargaste y los manda acá solo.',
      },
      {
        titulo: 'El marcador compara, no duplica',
        texto: 'Si ya importaste 35 productos y después agregás 3 más en ML, apretás el marcador de nuevo: te muestra qué se agregó, qué se sacó y a qué le cambió la cantidad. Confirmás y se actualiza. No suma 35 + 38.',
      },
      {
        titulo: 'Envío Full: el seguimiento',
        texto: 'Cada producto tiene tres cosas para marcar: "Pedido" (ya se lo pedimos al proveedor), "En stock" (ya llegó al local) y el tilde de embalado.',
      },
      {
        titulo: 'Cargas parciales',
        texto: 'Si hay que mandar 10 y solo tenemos 5, tocás "Marcar parcial", ponés 5 y confirmás. La fila queda amarilla con "Parcial: 5/10". Cuando llegan los otros 5, actualizás y pasa a embalado completo.',
      },
      {
        titulo: 'Filtros',
        texto: 'Arriba tenés Todos / Sin pedir / Pedidos / En stock / Embalados / Parciales, más un buscador por SKU o título para no scrollear entre 38 productos.',
      },
    ],
  },
  {
    id: 'stock',
    titulo: '📊 Stock',
    pasos: [
      {
        titulo: 'Alertas de movimientos raros',
        texto: 'Avisa cuando el stock de un producto se movió mucho de golpe. Si el sistema puede explicarlo con ventas de ML, lo marca en verde. Si no coincide, lo marca en rojo para revisar (puede ser una venta de mostrador no registrada).',
      },
      {
        titulo: 'Revertir un cambio',
        texto: 'El botón "↩ Volver a X" deshace el movimiento, tanto en Mercado Libre como en Contabilium. Ojo: es un cambio real, no una simulación.',
      },
      {
        titulo: 'Ordenar y filtrar',
        texto: 'Podés ordenar por el tamaño del cambio (para ver los -170 antes que los -3), poner un "Cambio mínimo" para esconder los movimientos chicos, y filtrar entre los que subieron y los que bajaron.',
      },
      {
        titulo: 'Quiebres históricos',
        texto: '"📉 Ver quiebres históricos" muestra qué productos se quedaron en cero más seguido en los últimos 90 días, y cuántos días estuvieron sin stock cada vez.',
      },
      {
        titulo: 'Discrepancias con Contabilium',
        texto: 'Encuentra productos que en ML están en cero pero en Contabilium tienen stock real disponible (típico caso de que no sincronizó). Tarda varios minutos porque Contabilium es lento, pero se ve la barra de progreso mientras corre.',
      },
    ],
  },
  {
    id: 'postventa',
    titulo: '⚠ Postventa',
    pasos: [
      {
        titulo: 'Reclamos abiertos y cerrados',
        texto: 'Dos pestañas. En cada reclamo ves el producto, el comprador y de qué tipo es: Reclamo, Devolución o Cancelación.',
      },
      {
        titulo: 'La fecha que importa',
        texto: 'Si hay un plazo para decidir algo, aparece arriba en verde: "📅 Fecha real (del mensaje)". Esa es la que vale.',
      },
      {
        titulo: 'La conversación',
        texto: 'Ves todo el hilo: mensajes del comprador (azul), nuestros (verde) y del mediador de ML (dorado).',
      },
      {
        titulo: 'Responder',
        texto: 'Escribís abajo y tocás "✉ Responder". Podés adjuntar una foto si hace falta mostrar algo. En reclamos cerrados no aparece la caja, porque ML ya no acepta mensajes.',
      },
      {
        titulo: 'Devoluciones',
        texto: 'Si el reclamo es una devolución, muestra el estado del envío de vuelta y el número de seguimiento. Cuando el producto llega bien, el botón "✅ Aprobar devolución".',
      },
      {
        titulo: 'Buscador',
        texto: 'Arriba podés buscar por título o SKU para encontrar un reclamo puntual sin scrollear.',
      },
    ],
  },
  {
    id: 'cotejo',
    titulo: '📄 Cotejo Packing List',
    pasos: [
      {
        titulo: 'Para qué sirve',
        texto: 'Para chequear que lo que mandó el proveedor coincida con lo facturado. La cuenta es: lo del papel (Lado B) + lo de la factura digital = lo de la packing list oficial.',
      },
      {
        titulo: 'Cargar los papeles',
        texto: 'Para Lado B y la Oficial: podés dictar por voz, o escribir varias líneas juntas y tocar "📥 Cargar". El formato por línea es: código, descripción, y la cantidad al final.',
      },
      {
        titulo: 'La factura digital',
        texto: 'Subís el PDF y se lee solo. Revisá las filas antes de cotejar, porque a veces un código raro (con espacios) queda mal partido y hay que corregirlo a mano.',
      },
      {
        titulo: 'Cotejar',
        texto: 'Tocás "🔍 Cotejar las tres listas". Verde si la cuenta cierra, rojo si no. Ignora guiones y tildes, así que "1192w00i" y "1192w-00i" son el mismo código.',
      },
      {
        titulo: 'Guardar',
        texto: '"💾 Guardar este cotejo" lo deja archivado, y "📜 Ver cotejos guardados" te muestra los anteriores por si hay que volver a mirarlos.',
      },
    ],
  },
  {
    id: 'metricas',
    titulo: '📈 Métricas y Publicidad',
    pasos: [
      {
        titulo: 'Qué es y qué no',
        texto: 'Métricas mira el pasado para tomar decisiones. Se alimenta de una foto que se guarda todas las noches, así que cuanto más tiempo pase, más útil se pone.',
      },
      {
        titulo: 'Los rankings',
        texto: 'Top unidades (qué más vendemos), Top $ (qué más factura) y Neto real (lo que queda después de la comisión de ML, que es lo que de verdad entra).',
      },
      {
        titulo: 'Sin ventas',
        texto: 'Productos con stock que no vendieron nada en el período, con la fecha de su última venta. Candidatos a bajar de precio o sacar de Full.',
      },
      {
        titulo: 'Las otras vistas',
        texto: 'Quiebres de stock, Reclamos por producto (cuáles dan más problemas en proporción a lo que venden), Sobreventa 48h, Devoluciones acumuladas, Clientes recurrentes y Stock bajo en Full.',
      },
      {
        titulo: 'Publicidad',
        texto: 'Pestaña aparte. Muestra las campañas de Product Ads: cuánto gastaron, cuántos clicks y cuántas ventas generaron. Avisa si alguna está gastando plata sin traer ninguna venta.',
      },
    ],
  },
  {
    id: 'cierre',
    titulo: '✅ Eso es todo',
    pasos: [
      {
        titulo: 'Si algo no cierra',
        texto: 'Los números salen de Mercado Libre y Contabilium en vivo. Si ves algo raro, primero refrescá la pantalla. Si sigue raro, avisale a Tom.',
      },
      {
        titulo: 'Volver a ver esto',
        texto: 'El botón "?" arriba a la derecha abre este tutorial cuando quieras. Podés saltar directo a la sección que te interese desde el índice.',
      },
    ],
  },
]

export default function TutorialView({ onCerrar }) {
  const [seccionIdx, setSeccionIdx] = useState(0)
  const [pasoIdx, setPasoIdx] = useState(0)
  const [mostrarIndice, setMostrarIndice] = useState(false)

  const seccion = SECCIONES[seccionIdx]
  const paso = seccion.pasos[pasoIdx]

  const totalPasos = SECCIONES.reduce((acc, s) => acc + s.pasos.length, 0)
  const pasoGlobal =
    SECCIONES.slice(0, seccionIdx).reduce((acc, s) => acc + s.pasos.length, 0) + pasoIdx + 1

  const esUltimo = seccionIdx === SECCIONES.length - 1 && pasoIdx === seccion.pasos.length - 1
  const esPrimero = seccionIdx === 0 && pasoIdx === 0

  const siguiente = () => {
    if (pasoIdx < seccion.pasos.length - 1) {
      setPasoIdx(pasoIdx + 1)
    } else if (seccionIdx < SECCIONES.length - 1) {
      setSeccionIdx(seccionIdx + 1)
      setPasoIdx(0)
    }
  }

  const anterior = () => {
    if (pasoIdx > 0) {
      setPasoIdx(pasoIdx - 1)
    } else if (seccionIdx > 0) {
      const nuevaSeccion = seccionIdx - 1
      setSeccionIdx(nuevaSeccion)
      setPasoIdx(SECCIONES[nuevaSeccion].pasos.length - 1)
    }
  }

  const irASeccion = (idx) => {
    setSeccionIdx(idx)
    setPasoIdx(0)
    setMostrarIndice(false)
  }

  return (
    <div className="tutorial-overlay">
      <div className="tutorial-modal">
        <div className="tutorial-header">
          <button className="sort-btn" onClick={() => setMostrarIndice((v) => !v)}>
            ☰ Índice
          </button>
          <span className="mono" style={{ fontSize: 12, color: 'var(--gray-muted)' }}>
            {pasoGlobal} / {totalPasos}
          </span>
          <button className="revert-btn" onClick={onCerrar}>✕ Cerrar</button>
        </div>

        <div className="tutorial-progress">
          <div style={{ width: `${(pasoGlobal / totalPasos) * 100}%` }} />
        </div>

        {mostrarIndice ? (
          <div className="tutorial-indice">
            {SECCIONES.map((s, idx) => (
              <button
                key={s.id}
                className={`tutorial-indice-item ${idx === seccionIdx ? 'activo' : ''}`}
                onClick={() => irASeccion(idx)}
              >
                {s.titulo}
                <span className="mono" style={{ fontSize: 11, opacity: 0.6 }}>
                  {s.pasos.length} paso(s)
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="tutorial-cuerpo">
            <div className="tutorial-seccion-label">{seccion.titulo}</div>
            <h2 className="tutorial-titulo">{paso.titulo}</h2>
            <p className="tutorial-texto">{paso.texto}</p>
          </div>
        )}

        {!mostrarIndice && (
          <div className="tutorial-footer">
            <button className="sort-btn" onClick={anterior} disabled={esPrimero}>
              ← Anterior
            </button>
            {esUltimo ? (
              <button className="scan-btn" onClick={onCerrar}>
                ✅ Listo, entendí
              </button>
            ) : (
              <button className="scan-btn" onClick={siguiente}>
                Siguiente →
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
