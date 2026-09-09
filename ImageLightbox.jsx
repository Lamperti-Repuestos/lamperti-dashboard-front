export default function ImageLightbox({ url, onClose }) {
  if (!url) return null

  return (
    <div className="lightbox-overlay" onClick={onClose}>
      <img src={url} alt="" className="lightbox-image" />
      <button className="lightbox-close" onClick={onClose} aria-label="Cerrar">
        ✕
      </button>
    </div>
  )
}
