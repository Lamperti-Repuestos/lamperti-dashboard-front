import { useEffect, useState } from 'react'

// Gag de un solo día (7 de octubre de 2026) - al día siguiente este
// componente deja de activarse solo, no hace falta volver a tocarlo.
const FECHA_VALIDA = '2026-10-07'
const DURACION_MS = 7000

export function gagSancorVigente() {
  const hoy = new Date().toLocaleDateString('en-CA') // YYYY-MM-DD en hora local
  const yaVisto = sessionStorage.getItem('gag_sancor_visto') === 'si'
  return hoy === FECHA_VALIDA && !yaVisto
}

export default function GagSancor({ onTerminar }) {
  const [mostrandoLogo, setMostrandoLogo] = useState(true)

  useEffect(() => {
    const t1 = setTimeout(() => setMostrandoLogo(false), 2200)
    const t2 = setTimeout(() => {
      sessionStorage.setItem('gag_sancor_visto', 'si')
      onTerminar()
    }, DURACION_MS)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [onTerminar])

  const saltear = () => {
    sessionStorage.setItem('gag_sancor_visto', 'si')
    onTerminar()
  }

  return (
    <div
      onClick={saltear}
      style={{
        position: 'fixed', inset: 0, background: '#0A0E1F',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', zIndex: 9999, overflow: 'hidden',
      }}
    >
      <div style={{ position: 'absolute', top: 16, right: 16, fontSize: 11, color: '#666', fontFamily: 'monospace' }}>
        tocá para saltear
      </div>

      {mostrandoLogo ? (
        <div style={{ textAlign: 'center', animation: 'gagAparecer 0.6s ease-out' }}>
          <div style={{ fontSize: 'clamp(28px, 7vw, 56px)', fontWeight: 900, color: '#FFFFFF', letterSpacing: '0.02em', fontFamily: 'Archivo, sans-serif' }}>
            SANCOR SEGUROS
          </div>
          <div style={{ fontSize: 13, color: '#8CA1D8', marginTop: 10, fontFamily: 'monospace' }}>
            patrocinador oficial de esta pantalla de carga
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', animation: 'gagAparecer 0.6s ease-out' }}>
          <div style={{ fontSize: 'clamp(22px, 5vw, 36px)', fontWeight: 800, color: '#FFE600', fontFamily: 'Archivo, sans-serif' }}>
            ⚽ 🦵➡️ (pierna derecha, como en los drones)
          </div>
          <div style={{ fontSize: 18, color: '#FFFFFF', marginTop: 14, fontFamily: 'Archivo, sans-serif' }}>
            Ahora sí, Miguelito 💙
          </div>
        </div>
      )}

      <style>{`
        @keyframes gagAparecer {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
