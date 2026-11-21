import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Channel, Message } from '../../lib/types'
import Avatar from './Avatar'

type Props = {
  channel: Channel
  messages: Message[]
  loading: boolean
  hasMore: boolean
  onLoadOlder: () => Promise<void>
  meId: string
  typingNames: string[]
  onTyping: () => void
  onSend: (content: string) => Promise<string | null> // hata mesajı ya da null
  showMembers: boolean
  onToggleMembers: () => void
}

const GROUP_WINDOW_MS = 5 * 60_000 // aynı kişinin 5 dk içindeki mesajları tek blok

function formatTime(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today.getTime() - 86_400_000)
  const time = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === today.toDateString()) return `Bugün ${time}`
  if (d.toDateString() === yesterday.toDateString()) return `Dün ${time}`
  return `${d.toLocaleDateString('tr-TR')} ${time}`
}

function typingText(names: string[]) {
  if (names.length === 1) return `${names[0]} yazıyor…`
  if (names.length === 2) return `${names[0]} ve ${names[1]} yazıyor…`
  return 'Birkaç kişi yazıyor…'
}

export default function ChatArea(props: Props) {
  const { channel, messages, loading, hasMore, onLoadOlder, meId, typingNames, onTyping, onSend, showMembers, onToggleMembers } = props
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const listRef = useRef<HTMLDivElement>(null)
  const stickToBottom = useRef(true)
  const keepOffset = useRef<number | null>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Kanal değişince en alta in, kutuyu temizle
  useEffect(() => {
    stickToBottom.current = true
    setDraft('')
    setSendError(null)
    inputRef.current?.focus()
  }, [channel.id])

  // Yeni mesaj gelince: kullanıcı zaten alttaysa aşağı kaydır, yukarıda eski mesajları okuyorsa dokunma.
  // Eski mesajlar yüklenince de okunan yerin kaymaması için kaydırma konumunu koru.
  useLayoutEffect(() => {
    const el = listRef.current
    if (!el) return
    if (keepOffset.current !== null) {
      el.scrollTop = el.scrollHeight - keepOffset.current
      keepOffset.current = null
    } else if (stickToBottom.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [messages, channel.id, typingNames.length])

  function onScroll() {
    const el = listRef.current!
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
  }

  async function loadOlder() {
    const el = listRef.current!
    keepOffset.current = el.scrollHeight - el.scrollTop
    setLoadingOlder(true)
    await onLoadOlder()
    setLoadingOlder(false)
  }

  async function send() {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    setSendError(null)
    stickToBottom.current = true
    const error = await onSend(text)
    setSending(false)
    if (error) setSendError(error)
    else setDraft('')
    inputRef.current?.focus()
  }

  return (
    <main className="chat">
      <div className="chat-head">
        <div className="chat-title">
          <span className="channel-icon">#</span>
          <h3>{channel.name}</h3>
        </div>
        <button
          className={showMembers ? 'icon-btn toggled' : 'icon-btn'}
          onClick={onToggleMembers}
          title={showMembers ? 'Üye listesini gizle' : 'Üye listesini göster'}
          aria-label="Üye listesi"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <path fill="currentColor" d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm-8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4Zm8 0c-.3 0-.7 0-1.1.1 1.3.9 2.1 2.1 2.1 3.9v2h7v-2c0-2.7-5.3-4-8-4Z" />
          </svg>
        </button>
      </div>

      <div className="messages" ref={listRef} onScroll={onScroll}>
        {hasMore ? (
          <div className="load-older">
            <button onClick={loadOlder} disabled={loadingOlder}>
              {loadingOlder ? 'Yükleniyor…' : 'Daha eski mesajları yükle'}
            </button>
          </div>
        ) : (
          !loading && (
            <div className="channel-intro">
              <div className="intro-icon">#</div>
              <h2>#{channel.name} kanalına hoş geldin</h2>
              <p>Bu kanalın başlangıcı burası. İlk mesajı sen yaz!</p>
            </div>
          )
        )}

        {loading && <div className="messages-loading">Mesajlar yükleniyor…</div>}

        {messages.map((m, i) => {
          const prev = messages[i - 1]
          const grouped =
            prev && prev.author.id === m.author.id &&
            new Date(m.createdAt).getTime() - new Date(prev.createdAt).getTime() < GROUP_WINDOW_MS

          return grouped ? (
            <div key={m.id} className="message cont">
              <span className="hover-time">
                {new Date(m.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
              </span>
              <p>{m.content}</p>
            </div>
          ) : (
            <div key={m.id} className="message">
              <Avatar name={m.author.displayName} size={40} />
              <div className="message-body">
                <div className="message-meta">
                  <span className={m.author.id === meId ? 'author me' : 'author'}>{m.author.displayName}</span>
                  <time dateTime={m.createdAt}>{formatTime(m.createdAt)}</time>
                </div>
                <p>{m.content}</p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="typing-line" aria-live="polite">
        {typingNames.length > 0 && (
          <>
            <span className="typing-dots"><i /><i /><i /></span>
            {typingText(typingNames)}
          </>
        )}
      </div>

      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
      >
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value)
            if (e.target.value) onTyping()
          }}
          onKeyDown={(e) => {
            // Enter gönderir, Shift+Enter yeni satır
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
          placeholder={`#${channel.name} kanalına mesaj yaz`}
          rows={1}
          maxLength={2000}
        />
        <button className="primary send" disabled={!draft.trim() || sending}>Gönder</button>
      </form>
      {sendError && <div className="send-error" role="alert">{sendError}</div>}
    </main>
  )
}
