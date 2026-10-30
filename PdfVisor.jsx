import { useEffect, useRef, useState } from 'react'

// Muestra un PDF dibujando cada página en la pantalla (no depende del visor de PDF del navegador, que en celulares
// y con algunas configuraciones de Chrome no abre el archivo y pide "abrir con…").
export default function PdfVisor({ datos, onError }) {
  const contenedor = useRef(null)
  const [estado, setEstado] = useState('cargando') // cargando | listo | error

  useEffect(() => {
    let vigente = true
    let documento = null
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist/build/pdf.mjs')
        const worker = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
        pdfjs.GlobalWorkerOptions.workerSrc = worker
        documento = await pdfjs.getDocument({ data: new Uint8Array(datos.slice(0)) }).promise
        const ancho = Math.max(280, (contenedor.current?.clientWidth || 600) - 4)
        const nitidez = Math.min(window.devicePixelRatio || 1, 2)
        for (let n = 1; n <= documento.numPages; n += 1) {
          const pagina = await documento.getPage(n)
          if (!vigente) return
          const base = pagina.getViewport({ scale: 1 })
          const escala = ancho / base.width
          const vista = pagina.getViewport({ scale: escala * nitidez })
          const lienzo = document.createElement('canvas')
          lienzo.width = Math.floor(vista.width)
          lienzo.height = Math.floor(vista.height)
          lienzo.style.cssText = `width:${Math.floor(vista.width / nitidez)}px;height:${Math.floor(vista.height / nitidez)}px;display:block;margin:0 auto 8px;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,0.25)`
          contenedor.current?.appendChild(lienzo)
          await pagina.render({ canvasContext: lienzo.getContext('2d'), viewport: vista }).promise
        }
        if (vigente) setEstado('listo')
      } catch (e) {
        if (vigente) { setEstado('error'); onError?.(e) }
      }
    })()
    return () => { vigente = false; if (documento) documento.destroy() }
  }, [datos]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ flex: 1, minHeight: 0, overflow: 'auto', padding: 8, background: '#8a8f98' }}>
      {estado === 'cargando' && <div style={{ color: '#fff', textAlign: 'center', padding: 16 }}>Preparando la factura…</div>}
      {estado === 'error' && (
        <div style={{ color: '#fff', textAlign: 'center', padding: 16 }}>
          No pude mostrar la factura acá. Usá "Descargar PDF" para verla.
        </div>
      )}
      <div ref={contenedor} />
    </div>
  )
}
