import { useState } from 'react'
import type { ServerSummary } from '../../lib/types'
import type { User } from '../../lib/api'
import Avatar from './Avatar'
import ContactModal from './ContactModal'

type Props = {
  servers: ServerSummary[]
  activeId: string | null
  onSelect: (id: string) => void
  onAddServer: () => void
  user: User
  onLogout: () => void
}

export default function TopBar({ servers, activeId, onSelect, onAddServer, user, onLogout }: Props) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)

  return (
    <header className="topbar">
      <button className="brand" onClick={() => setContactOpen(true)} title="İletişim">
        <img className="brand-logo" src="/logo.svg" alt="" />
        <span className="brand-name">Kivo</span>
      </button>
      {contactOpen && <ContactModal onClose={() => setContactOpen(false)} />}

      <nav className="server-tabs" aria-label="Sunucular">
        {servers.map((s) => (
          <button
            key={s.id}
            className={s.id === activeId ? 'server-tab active' : 'server-tab'}
            onClick={() => onSelect(s.id)}
          >
            {s.name}
          </button>
        ))}
        <button className="server-tab add" title="Sunucu oluştur veya katıl" aria-label="Sunucu ekle" onClick={onAddServer}>+</button>
      </nav>

      <div className="user-menu">
        <button className="user-button" onClick={() => setMenuOpen((o) => !o)} aria-expanded={menuOpen}>
          <Avatar name={user.displayName} size={30} online />
          <span className="user-name">{user.displayName}</span>
        </button>
        {menuOpen && (
          <div className="dropdown" role="menu">
            <div className="dropdown-head">
              <strong>{user.displayName}</strong>
              <span>@{user.username}</span>
            </div>
            <button className="dropdown-item" disabled>Profil ayarları (yakında)</button>
            <button className="dropdown-item danger" onClick={onLogout}>Çıkış yap</button>
          </div>
        )}
      </div>
    </header>
  )
}
