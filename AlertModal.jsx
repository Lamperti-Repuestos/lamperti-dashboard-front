import Modal from './Modal.jsx'

/**
 * Reemplazo de alert() nativo. Uso:
 *   const [aviso, setAviso] = useState(null)
 *   setAviso('Este navegador no tiene reconocimiento de voz')
 *   {aviso && <AlertModal mensaje={aviso} onCerrar={() => setAviso(null)} />}
 */
export default function AlertModal({ titulo = 'Aviso', mensaje, onCerrar }) {
  return (
    <Modal
      titulo={titulo}
      onCerrar={onCerrar}
      footer={<button className="scan-btn" onClick={onCerrar}>Entendido</button>}
    >
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{mensaje}</p>
    </Modal>
  )
}
