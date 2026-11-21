import type { Member } from '../../lib/types'
import Avatar from './Avatar'

export default function MemberPanel({ members }: { members: Member[] }) {
  const online = members.filter((m) => m.online)
  const offline = members.filter((m) => !m.online)

  const row = (m: Member) => (
    <div key={m.id} className={m.online ? 'member' : 'member offline'}>
      <Avatar name={m.displayName} size={32} online={m.online} />
      <div className="member-info">
        <span className="member-name">{m.displayName}</span>
        {m.role === 'OWNER' && <span className="role-badge">Kurucu</span>}
      </div>
    </div>
  )

  return (
    <aside className="members">
      <div className="group-title"><span>Çevrimiçi — {online.length}</span></div>
      {online.map(row)}
      {offline.length > 0 && (
        <>
          <div className="group-title"><span>Çevrimdışı — {offline.length}</span></div>
          {offline.map(row)}
        </>
      )}
    </aside>
  )
}
