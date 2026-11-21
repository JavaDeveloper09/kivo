import { useEffect } from 'react'

type Props = { title: string; onClose: () => void; children: React.ReactNode }

// Ortak pencere: arka plana tıklayınca veya Esc'ye basınca kapanır
export default function Modal({ title, onClose, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal form-modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Kapat">✕</button>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}
