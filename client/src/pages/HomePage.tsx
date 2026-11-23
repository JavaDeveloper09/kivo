import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import type { Socket } from 'socket.io-client'
import { useAuth } from '../lib/AuthContext'
import { api, ApiError } from '../lib/api'
import { createSocket } from '../lib/socket'
import { useVoice } from '../lib/useVoice'
import { MOBILE_QUERY, useMediaQuery } from '../lib/useMediaQuery'
import type { Channel, ChannelType, Member, Message, ServerDetail, ServerSummary, VoiceUser } from '../lib/types'
import TopBar from '../components/app/TopBar'
import ChannelSidebar from '../components/app/ChannelSidebar'
import ChatArea from '../components/app/ChatArea'
import MemberPanel from '../components/app/MemberPanel'
import ServerModal from '../components/app/ServerModal'
import InviteModal from '../components/app/InviteModal'
import ChannelModal from '../components/app/ChannelModal'
import '../app.css'

type ChannelCache = { items: Message[]; hasMore: boolean; loaded: boolean }
type ModalState = null | { kind: 'server' } | { kind: 'invite' } | { kind: 'channel'; type: ChannelType }
type SendAck = { ok: true; message: Message } | { ok: false; error: string }

const LAST_SERVER_KEY = 'kivo:lastServer'
const TYPING_TTL_MS = 3500
const TYPING_THROTTLE_MS = 2000

// localStorage bazı tarayıcı ayarlarında hata fırlatabilir, sessizce geç
const storage = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* yok say */ } },
}

export default function HomePage() {
  const { user, logout } = useAuth()
  const location = useLocation()
  const [servers, setServers] = useState<ServerSummary[] | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ServerDetail | null>(null)
  const [lastChannel, setLastChannel] = useState<Record<string, string>>({})
  const [cache, setCache] = useState<Record<string, ChannelCache>>({})
  const [typing, setTyping] = useState<Record<string, Record<string, number>>>({}) // kanal -> kullanıcı -> bitiş zamanı
  const [now, setNow] = useState(Date.now())
  const [connected, setConnected] = useState(true)
  const [modal, setModal] = useState<ModalState>(null)
  const [showMembers, setShowMembers] = useState(true)
  // Dar ekranda (telefon/tablet) kanal ve üye listeleri kenardan kayan çekmece olarak açılır
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const [drawer, setDrawer] = useState<null | 'nav' | 'members'>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const socketRef = useRef<Socket | null>(null)
  const lastTypingSent = useRef(0)
  const voice = useVoice(socketRef)
  const voiceResync = useRef(voice.resync)
  voiceResync.current = voice.resync

  // ---------- Mesajı ilgili kanalın listesine ekle (aynı mesaj iki kez gelirse tekrar ekleme) ----------
  const appendMessage = useCallback((m: Message) => {
    setCache((c) => {
      const ch = c[m.channelId]
      if (!ch?.loaded || ch.items.some((x) => x.id === m.id)) return c
      return { ...c, [m.channelId]: { ...ch, items: [...ch.items, m] } }
    })
    // Mesajı gönderen artık "yazıyor" değildir
    setTyping((t) => {
      if (!t[m.channelId]?.[m.author.id]) return t
      const rest = { ...t[m.channelId] }
      delete rest[m.author.id]
      return { ...t, [m.channelId]: rest }
    })
  }, [])

  // ---------- WebSocket bağlantısı ve canlı olaylar ----------
  useEffect(() => {
    const s = createSocket()
    socketRef.current = s
    let droppedOnce = false

    s.on('connect', () => {
      setConnected(true)
      // Bağlantı koptuysa arada kaçan mesajlar olabilir: önbelleği temizle, açık kanal yeniden yüklensin
      if (droppedOnce) {
        setCache({})
        voiceResync.current() // ses kanalındaysak sunucuya tekrar bildir
      }
    })
    s.on('disconnect', () => {
      droppedOnce = true
      setConnected(false)
    })
    s.on('message:new', appendMessage)
    s.on('typing', ({ channelId, userId }: { channelId: string; userId: string }) =>
      setTyping((t) => ({ ...t, [channelId]: { ...t[channelId], [userId]: Date.now() + TYPING_TTL_MS } })),
    )
    s.on('channel:created', (ch: Channel) =>
      setDetail((d) => (d && d.id === ch.serverId && !d.channels.some((x) => x.id === ch.id) ? { ...d, channels: [...d.channels, ch] } : d)),
    )
    s.on('member:joined', ({ serverId, member }: { serverId: string; member: Member }) =>
      setDetail((d) => (d && d.id === serverId && !d.members.some((m) => m.id === member.id) ? { ...d, members: [...d.members, member] } : d)),
    )
    s.on('member:left', ({ serverId, userId }: { serverId: string; userId: string }) =>
      setDetail((d) => (d && d.id === serverId ? { ...d, members: d.members.filter((m) => m.id !== userId) } : d)),
    )
    s.on('voice:state', ({ serverId, channelId, users }: { serverId: string; channelId: string; users: VoiceUser[] }) =>
      setDetail((d) => (d && d.id === serverId ? { ...d, voice: { ...d.voice, [channelId]: users } } : d)),
    )
    s.on('presence', ({ userId, online }: { userId: string; online: boolean }) =>
      setDetail((d) => (d ? { ...d, members: d.members.map((m) => (m.id === userId ? { ...m, online } : m)) } : d)),
    )

    // "Yazıyor..." süresi dolanları ekrandan düşürmek için saniyede bir saat güncelle
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => {
      clearInterval(timer)
      s.disconnect()
    }
  }, [appendMessage])

  // ---------- Sunucu listesini yükle ----------
  useEffect(() => {
    api<{ servers: ServerSummary[] }>('/servers')
      .then(({ servers }) => {
        setServers(servers)
        // Davet sayfasından geldiysek o sunucuyu, yoksa en son açılanı, o da yoksa ilkini aç
        const fromInvite = (location.state as { serverId?: string } | null)?.serverId
        const last = storage.get(LAST_SERVER_KEY)
        const pick = [fromInvite, last].find((id) => id && servers.some((s) => s.id === id)) ?? servers[0]?.id ?? null
        setActiveId(pick)
      })
      .catch((err) => setLoadError(err instanceof ApiError ? err.message : 'Sunucular yüklenemedi.'))
  }, [location.state])

  // ---------- Seçili sunucunun detayını yükle ----------
  useEffect(() => {
    if (!activeId) return setDetail(null)
    storage.set(LAST_SERVER_KEY, activeId)
    let cancelled = false
    setDetail((d) => (d?.id === activeId ? d : null))
    api<{ server: ServerDetail }>(`/servers/${activeId}`)
      .then(({ server }) => !cancelled && setDetail(server))
      .catch((err) => !cancelled && setLoadError(err instanceof ApiError ? err.message : 'Sunucu yüklenemedi.'))
    return () => {
      cancelled = true
    }
  }, [activeId])

  useEffect(() => {
    if (!isMobile) setDrawer(null)
  }, [isMobile])

  useEffect(() => {
    if (!drawer) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawer(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [drawer])

  const textChannels = detail?.channels.filter((c) => c.type === 'TEXT') ?? []
  const channel = textChannels.find((c) => c.id === lastChannel[detail?.id ?? '']) ?? textChannels[0] ?? null
  const channelId = channel?.id ?? null
  const current = channelId ? cache[channelId] : undefined

  // ---------- Kanal açılınca son mesajları yükle ----------
  useEffect(() => {
    if (!channelId || current) return
    setCache((c) => ({ ...c, [channelId]: { items: [], hasMore: false, loaded: false } }))
    api<{ messages: Message[]; hasMore: boolean }>(`/channels/${channelId}/messages`)
      .then(({ messages, hasMore }) =>
        setCache((c) => {
          // Yükleme sırasında WebSocket'ten gelen mesajlar varsa kaybolmasın
          const live = (c[channelId]?.items ?? []).filter((m) => !messages.some((x) => x.id === m.id))
          return { ...c, [channelId]: { items: [...messages, ...live], hasMore, loaded: true } }
        }),
      )
      // Hata olursa boş göster (sonsuz yeniden deneme döngüsüne girmesin)
      .catch(() => setCache((c) => ({ ...c, [channelId]: { items: [], hasMore: false, loaded: true } })))
  }, [channelId, current])

  if (!user) return null

  async function loadOlder() {
    if (!channelId || !current?.items.length) return
    const before = encodeURIComponent(current.items[0].createdAt)
    const { messages, hasMore } = await api<{ messages: Message[]; hasMore: boolean }>(
      `/channels/${channelId}/messages?before=${before}`,
    )
    setCache((c) => ({ ...c, [channelId]: { ...c[channelId], items: [...messages, ...c[channelId].items], hasMore } }))
  }

  async function send(content: string): Promise<string | null> {
    const s = socketRef.current
    if (!s?.connected || !channelId) return 'Bağlantı yok, yeniden bağlanılıyor…'
    try {
      const res: SendAck = await s.timeout(8000).emitWithAck('message:send', { channelId, content })
      if (!res.ok) return res.error
      appendMessage(res.message)
      return null
    } catch {
      return 'Mesaj gönderilemedi, tekrar dene.'
    }
  }

  function notifyTyping() {
    const t = Date.now()
    if (!channelId || t - lastTypingSent.current < TYPING_THROTTLE_MS) return
    lastTypingSent.current = t
    socketRef.current?.emit('typing', { channelId })
  }

  function onServerReady(server: ServerDetail) {
    setServers((list) =>
      list?.some((s) => s.id === server.id)
        ? list
        : [...(list ?? []), { id: server.id, name: server.name, role: server.ownerId === user!.id ? 'OWNER' : 'MEMBER' }],
    )
    setDetail(server)
    setActiveId(server.id)
    setModal(null)
  }

  async function leaveServer() {
    if (!detail || !window.confirm(`${detail.name} sunucusundan ayrılmak istediğine emin misin?`)) return
    try {
      await api(`/servers/${detail.id}/leave`, {})
      if (voice.channel?.serverId === detail.id) voice.leave()
      const rest = (servers ?? []).filter((s) => s.id !== detail.id)
      setServers(rest)
      setActiveId(rest[0]?.id ?? null)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Ayrılırken bir hata oluştu.')
    }
  }

  const typingNames = Object.entries((channelId && typing[channelId]) || {})
    .filter(([uid, until]) => until > now && uid !== user.id)
    .map(([uid]) => detail?.members.find((m) => m.id === uid)?.displayName ?? 'Biri')

  const modals = (
    <>
      {modal?.kind === 'server' && <ServerModal onClose={() => setModal(null)} onDone={onServerReady} />}
      {modal?.kind === 'invite' && detail && (
        <InviteModal serverName={detail.name} inviteCode={detail.inviteCode} onClose={() => setModal(null)} />
      )}
      {modal?.kind === 'channel' && detail && (
        <ChannelModal serverId={detail.id} initialType={modal.type} onClose={() => setModal(null)} />
      )}
    </>
  )

  const topBar = (
    <TopBar
      servers={servers ?? []}
      activeId={activeId}
      onSelect={setActiveId}
      onAddServer={() => setModal({ kind: 'server' })}
      user={user}
      onLogout={logout}
    />
  )

  const banner = !connected && <div className="conn-banner">Bağlantı koptu, yeniden bağlanılıyor…</div>

  // ---------- Henüz hiç sunucu yoksa ----------
  if (servers && servers.length === 0) {
    return (
      <div className="app empty">
        {topBar}
        <main className="empty-state">
          <img src="/logo.svg" alt="" width="72" height="72" />
          <h2>Henüz bir sunucun yok</h2>
          <p>Kendi sunucunu oluştur ya da bir arkadaşının davet linkiyle katıl.</p>
          <button className="primary" onClick={() => setModal({ kind: 'server' })}>Sunucu oluştur veya katıl</button>
        </main>
        {modals}
      </div>
    )
  }

  return (
    <div
      className={[
        'app',
        !isMobile && !showMembers && 'no-members',
        drawer === 'nav' && 'nav-open',
        drawer === 'members' && 'members-open',
      ].filter(Boolean).join(' ')}
    >
      {topBar}
      {banner}
      {detail ? (
        <ChannelSidebar
          server={detail}
          isOwner={detail.ownerId === user.id}
          activeChannelId={channelId}
          onSelect={(id) => {
            setLastChannel((p) => ({ ...p, [detail.id]: id }))
            setDrawer(null) // telefonda kanal seçince menüyü kapat
          }}
          onInvite={() => setModal({ kind: 'invite' })}
          onAddChannel={(type) => setModal({ kind: 'channel', type })}
          onLeave={leaveServer}
          voice={voice}
        />
      ) : (
        <aside className="sidebar" />
      )}
      {channel ? (
        <ChatArea
          channel={channel}
          messages={current?.items ?? []}
          loading={!current?.loaded}
          hasMore={current?.hasMore ?? false}
          onLoadOlder={loadOlder}
          meId={user.id}
          typingNames={typingNames}
          onTyping={notifyTyping}
          onSend={send}
          showMembers={isMobile ? drawer === 'members' : showMembers}
          onToggleMembers={() =>
            isMobile ? setDrawer((d) => (d === 'members' ? null : 'members')) : setShowMembers((s) => !s)
          }
          onOpenNav={() => setDrawer('nav')}
        />
      ) : (
        <main className="chat chat-placeholder">{loadError ?? 'Yükleniyor…'}</main>
      )}
      {(isMobile || showMembers) && <MemberPanel members={detail?.members ?? []} />}
      {drawer && <div className="drawer-backdrop" onClick={() => setDrawer(null)} aria-hidden />}
      {modals}
    </div>
  )
}
