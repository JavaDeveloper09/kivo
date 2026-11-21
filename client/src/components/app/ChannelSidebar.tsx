import type { ChannelType, ServerDetail } from '../../lib/types'
import type { VoiceApi } from '../../lib/useVoice'
import Avatar from './Avatar'
import VoicePanel, { DeafBadge, MicOffBadge } from './VoicePanel'

type Props = {
  server: ServerDetail
  isOwner: boolean
  activeChannelId: string | null
  onSelect: (id: string) => void
  onInvite: () => void
  onAddChannel: (type: ChannelType) => void
  onLeave: () => void
  voice: VoiceApi
}

export default function ChannelSidebar({ server, isOwner, activeChannelId, onSelect, onInvite, onAddChannel, onLeave, voice }: Props) {
  const text = server.channels.filter((c) => c.type === 'TEXT')
  const voiceChannels = server.channels.filter((c) => c.type === 'VOICE')

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <h2 title={server.name}>{server.name}</h2>
        <button className="primary small" onClick={onInvite}>Davet Et</button>
      </div>

      <div className="channel-group">
        <div className="group-title">
          <span>Yazı Kanalları</span>
          {isOwner && (
            <button className="icon-btn" title="Kanal ekle" aria-label="Yazı kanalı ekle" onClick={() => onAddChannel('TEXT')}>+</button>
          )}
        </div>
        {text.map((c) => (
          <button
            key={c.id}
            className={c.id === activeChannelId ? 'channel active' : 'channel'}
            onClick={() => onSelect(c.id)}
          >
            <span className="channel-icon">#</span>
            {c.name}
          </button>
        ))}
      </div>

      <div className="channel-group">
        <div className="group-title">
          <span>Ses Kanalları</span>
          {isOwner && (
            <button className="icon-btn" title="Kanal ekle" aria-label="Ses kanalı ekle" onClick={() => onAddChannel('VOICE')}>+</button>
          )}
        </div>
        {voiceChannels.map((c) => {
          const inside = server.voice?.[c.id] ?? []
          const mine = voice.channel?.id === c.id
          return (
            <div key={c.id}>
              <button
                className={mine ? 'channel voice-active' : 'channel'}
                onClick={() => voice.join({ id: c.id, name: c.name, serverId: server.id })}
                title={mine ? 'Bu ses kanalındasın' : 'Ses kanalına katıl'}
              >
                <svg className="channel-icon" viewBox="0 0 24 24" width="16" height="16" aria-hidden>
                  <path fill="currentColor" d="M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 8v8a4.5 4.5 0 0 0 2.5-4Z" />
                </svg>
                {c.name}
              </button>
              {inside.length > 0 && (
                <ul className="voice-users">
                  {inside.map((u) => {
                    const m = server.members.find((x) => x.id === u.userId)
                    const name = m?.displayName ?? 'Biri'
                    // Konuşma göstergesini sadece aynı kanaldaysak biliyoruz (ses LiveKit'ten geliyor)
                    const talking = mine && voice.speaking.has(u.userId) && !u.muted
                    return (
                      <li key={u.userId} className={talking ? 'voice-user speaking' : 'voice-user'}>
                        <Avatar name={name} size={22} />
                        <span className="voice-user-name">{name}</span>
                        {u.deafened ? <DeafBadge /> : u.muted && <MicOffBadge />}
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          )
        })}
      </div>

      {!isOwner && (
        <button className="leave-btn" onClick={onLeave}>Sunucudan ayrıl</button>
      )}

      <VoicePanel voice={voice} />

      <div className="sidebar-hint">
        <span aria-hidden>↖</span>
        İletişim detayları için sol üstteki logoya tıklayınız.
      </div>
    </aside>
  )
}
