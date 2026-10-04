import Modal from './Modal.jsx'

/**
 * Reemplazo de confirm() nativo. Uso:
 *   const [confirmacion, setConfirmacion] = useState(null)
 *   setConfirmacion({ mensaje: '¿Borrar todo?', peligroso: true, onConfirmar: () => hacerAlgo() })
 *   {confirmacion && (
 *     <ConfirmModal
 *       titulo="Confirmar"
 *       mensaje={confirmacion.mensaje}
 *       peligroso={confirmacion.peligroso}
 *       onConfirmar={() => { confirmacion.onConfirmar(); setConfirmacion(null) }}
 *       onCancelar={() => setConfirmacion(null)}
 *     />
 *   )}
 */
export default function ConfirmModal({ titulo = 'Confirmar', mensaje, peligroso = false, onConfirmar, onCancelar, textoConfirmar = 'Confirmar' }) {
  return (
    <Modal
      titulo={titulo}
      onCerrar={onCancelar}
      footer={
        <>
          <button className="sort-btn" onClick={onCancelar}>Cancelar</button>
          <button className={peligroso ? 'btn-peligro' : 'scan-btn'} onClick={onConfirmar}>
            {textoConfirmar}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>{mensaje}</p>
    </Modal>
  )
}
