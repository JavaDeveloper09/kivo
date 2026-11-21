import { useEffect } from 'react'

const INSTAGRAM_USER = 'erenyayla09'

export default function ContactModal({ onClose }: { onClose: () => void }) {
  // Esc ile kapat
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    // Arka plana tıklayınca kapanır, pencerenin içine tıklayınca kapanmaz
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="contact-title" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        <img src="/logo.svg" alt="" width="56" height="56" />
        <h2 id="contact-title">Bizimle iletişime geçin</h2>
        <p>Öneri, hata bildirimi ya da sadece selam için yazabilirsin.</p>
        <a
          className="contact-link"
          href={`https://www.instagram.com/${INSTAGRAM_USER}/`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <span className="contact-platform">Instagram</span>
          <span className="contact-handle">@{INSTAGRAM_USER}</span>
          <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
            <path fill="currentColor" d="M14 3h7v7h-2V6.4l-9.3 9.3-1.4-1.4L17.6 5H14V3ZM5 5h6v2H5v12h12v-6h2v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          </svg>
        </a>
      </div>
    </div>
  )
}
