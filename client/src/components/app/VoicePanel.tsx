import { useState } from 'react'
import type { VoiceApi } from '../../lib/useVoice'
import VoiceSettingsModal from './VoiceSettingsModal'

// Basit ikonlar (mikrofon, kulaklık, çıkış)
const MicIcon = () => (
  <path fill="currentColor" d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3Zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2Z" />
)
const HeadphoneIcon = () => (
  <path fill="currentColor" d="M12 3a9 9 0 0 0-9 9v7a2 2 0 0 0 2 2h3v-8H5v-1a7 7 0 0 1 14 0v1h-3v8h3a2 2 0 0 0 2-2v-7a9 9 0 0 0-9-9Z" />
)
const Slash = () => <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />

export function MicOffBadge() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-label="Mikrofon kapalı" className="voice-badge">
      <MicIcon />
      <Slash />
    </svg>
  )
}

export function DeafBadge() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" aria-label="Kulaklık kapalı" className="voice-badge">
      <HeadphoneIcon />
      <Slash />
    </svg>
  )
}

export default function VoicePanel({ voice }: { voice: VoiceApi }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  if (voice.status === 'idle' && !voice.error) return null

  return (
    <div className="voice-panel">
      {voice.status !== 'idle' && (
        <div className="voice-panel-row">
          <div className="voice-status">
            <span className={voice.status === 'connected' ? 'voice-dot on' : 'voice-dot'} />
            <div>
              <strong>{voice.status === 'connected' ? 'Bağlandın' : 'Bağlanıyor…'}</strong>
              <span>{voice.channel?.name}</span>
            </div>
          </div>
          <div className="voice-controls">
            <button
              className={voice.muted ? 'voice-btn off' : 'voice-btn'}
              onClick={voice.toggleMute}
              disabled={voice.status !== 'connected'}
              title={voice.muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}
              aria-label={voice.muted ? 'Mikrofonu aç' : 'Mikrofonu kapat'}
              aria-pressed={voice.muted}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <MicIcon />
                {voice.muted && <Slash />}
              </svg>
            </button>
            <button
              className={voice.deafened ? 'voice-btn off' : 'voice-btn'}
              onClick={voice.toggleDeafen}
              disabled={voice.status !== 'connected'}
              title={voice.deafened ? 'Sesi aç' : 'Sesi kapat (kimseyi duyma)'}
              aria-label={voice.deafened ? 'Sesi aç' : 'Sesi kapat'}
              aria-pressed={voice.deafened}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <HeadphoneIcon />
                {voice.deafened && <Slash />}
              </svg>
            </button>
            <button
              className="voice-btn"
              onClick={() => setSettingsOpen(true)}
              title="Ses ayarları (mikrofon, kulaklık seçimi)"
              aria-label="Ses ayarları"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path fill="currentColor" d="M19.4 13a7.6 7.6 0 0 0 0-2l2.1-1.6-2-3.4-2.5 1a7.4 7.4 0 0 0-1.7-1l-.4-2.6h-4l-.4 2.6a7.4 7.4 0 0 0-1.7 1l-2.5-1-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2.1 1.6 2 3.4 2.5-1a7.4 7.4 0 0 0 1.7 1l.4 2.6h4l.4-2.6a7.4 7.4 0 0 0 1.7-1l2.5 1 2-3.4L19.4 13ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z" />
              </svg>
            </button>
            <button className="voice-btn leave" onClick={voice.leave} title="Ses kanalından ayrıl" aria-label="Ses kanalından ayrıl">
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                <path fill="currentColor" d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.71l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28a11.27 11.27 0 0 0-2.67-1.85.996.996 0 0 1-.56-.9v-3.1C15.15 9.25 13.6 9 12 9Z" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {settingsOpen && <VoiceSettingsModal voice={voice} onClose={() => setSettingsOpen(false)} />}
      {voice.error && (
        <div className="voice-error" role="alert">
          {voice.error}
          <button onClick={voice.clearError} aria-label="Kapat">✕</button>
        </div>
      )}
    </div>
  )
}
