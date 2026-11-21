import { useCallback, useEffect, useRef, useState } from 'react'
// Sadece tipler: LiveKit kütüphanesi büyük, ses kanalına ilk girişte yükleniyor (aşağıda import())
import type { Participant, RemoteTrack, Room } from 'livekit-client'
import type { Socket } from 'socket.io-client'
import { api, ApiError } from './api'

export type VoiceStatus = 'idle' | 'connecting' | 'connected'
export type VoiceChannelRef = { id: string; name: string; serverId: string }

type Ack = { ok: true } | { ok: false; error: string }

const AUDIO_ATTR = 'data-kivo-voice' // bizim eklediğimiz <audio> etiketlerini bulmak için
const INPUT_KEY = 'kivo:audioInput'
const OUTPUT_KEY = 'kivo:audioOutput'

// Seçilen cihazları hatırla (localStorage bazı tarayıcı ayarlarında hata fırlatabilir)
const store = {
  get: (k: string) => { try { return localStorage.getItem(k) ?? '' } catch { return '' } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* yok say */ } },
}

// Ses çıkışını seçebilme (setSinkId) her tarayıcıda yok: Chrome/Edge destekliyor
type SinkAudio = HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> }
export const canChooseOutput = typeof window !== 'undefined' && 'setSinkId' in HTMLMediaElement.prototype

function applyOutput(el: HTMLMediaElement, deviceId: string) {
  const a = el as SinkAudio
  if (deviceId && a.setSinkId) a.setSinkId(deviceId).catch(() => {})
}

/**
 * Sesli sohbet bağlantısını yönetir:
 * 1) Backend'den giriş bileti al  2) LiveKit odasına bağlan  3) Mikrofonu aç
 * 4) WebSocket ile "ben bu kanaldayım" de (diğerleri kanalda kim var görsün)
 */
export function useVoice(socketRef: React.RefObject<Socket | null>) {
  const roomRef = useRef<Room | null>(null)
  const [status, setStatus] = useState<VoiceStatus>('idle')
  const [channel, setChannel] = useState<VoiceChannelRef | null>(null)
  const [muted, setMuted] = useState(false)
  const [deafened, setDeafened] = useState(false)
  const [speaking, setSpeaking] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)
  const [inputs, setInputs] = useState<MediaDeviceInfo[]>([])
  const [outputs, setOutputs] = useState<MediaDeviceInfo[]>([])
  const [inputId, setInputId] = useState(() => store.get(INPUT_KEY))
  const [outputId, setOutputId] = useState(() => store.get(OUTPUT_KEY))

  // Olay dinleyicilerinin her zaman güncel değeri görmesi için ref kopyaları
  const state = useRef({ channel, muted, deafened, mutedBeforeDeafen: false, inputId, outputId })
  state.current.inputId = inputId
  state.current.outputId = outputId
  state.current.channel = channel
  state.current.muted = muted
  state.current.deafened = deafened

  const setAllAudioMuted = (value: boolean) =>
    document.querySelectorAll<HTMLAudioElement>(`audio[${AUDIO_ATTR}]`).forEach((el) => (el.muted = value))

  const teardown = useCallback(() => {
    const room = roomRef.current
    roomRef.current = null // önce null: kendi kapattığımız bağlantı "beklenmedik kopma" sayılmasın
    room?.disconnect()
    document.querySelectorAll(`audio[${AUDIO_ATTR}]`).forEach((el) => el.remove())
    setSpeaking(new Set())
  }, [])

  const leave = useCallback(() => {
    socketRef.current?.emit('voice:leave')
    teardown()
    setStatus('idle')
    setChannel(null)
  }, [socketRef, teardown])

  const join = useCallback(
    async (target: VoiceChannelRef) => {
      if (state.current.channel?.id === target.id) return
      if (roomRef.current) teardown() // başka kanaldaysak önce oradan çık
      setError(null)
      setStatus('connecting')
      setChannel(target)

      try {
        const [{ url, token }, { Room, RoomEvent }] = await Promise.all([
          api<{ url: string; token: string }>(`/channels/${target.id}/voice-token`, {}),
          import('livekit-client'),
        ])

        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            ...(state.current.inputId ? { deviceId: state.current.inputId } : {}),
          },
        })
        roomRef.current = room

        // Başkasının sesi gelince sayfaya görünmez bir <audio> ekle
        room.on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
          if (track.kind !== 'audio') return
          const el = track.attach()
          el.setAttribute(AUDIO_ATTR, '')
          el.muted = state.current.deafened
          applyOutput(el, state.current.outputId) // seçilen kulaklık/hoparlörden çal
          document.body.appendChild(el)
        })
        room.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => track.detach().forEach((el) => el.remove()))
        room.on(RoomEvent.ActiveSpeakersChanged, (speakers: Participant[]) =>
          setSpeaking(new Set(speakers.map((p) => p.identity))),
        )
        room.on(RoomEvent.Disconnected, () => {
          if (roomRef.current !== room) return // kendimiz kapattık
          socketRef.current?.emit('voice:leave')
          teardown()
          setStatus('idle')
          setChannel(null)
          setError('Ses bağlantısı koptu.')
        })

        await room.connect(url, token)
        if (roomRef.current !== room) return // bağlanırken başka kanala geçildi ya da çıkıldı
        await room.startAudio().catch(() => {})

        try {
          await room.localParticipant.setMicrophoneEnabled(!state.current.muted)
          refreshDevices() // izin verildikten sonra cihaz adları görünür
        } catch {
          // Mikrofon izni verilmediyse dinleyici olarak kal
          setMuted(true)
          state.current.muted = true
          setError('Mikrofon izni verilmedi. Sadece dinleyebilirsin.')
        }

        const ack: Ack = await socketRef.current!.timeout(8000).emitWithAck('voice:join', {
          channelId: target.id,
          muted: state.current.muted,
          deafened: state.current.deafened,
        })
        if (!ack.ok) throw new Error(ack.error)
        setStatus('connected')
      } catch (err) {
        teardown()
        setStatus('idle')
        setChannel(null)
        setError(
          err instanceof ApiError ? err.message : err instanceof Error && err.message ? err.message : 'Ses kanalına bağlanılamadı.',
        )
      }
    },
    [socketRef, teardown],
  )

  const toggleMute = useCallback(async () => {
    const room = roomRef.current
    const next = !state.current.muted
    // Kulaklık kapalıyken mikrofonu açmak kulaklığı da açar
    if (!next && state.current.deafened) {
      setDeafened(false)
      setAllAudioMuted(false)
    }
    setMuted(next)
    try {
      await room?.localParticipant.setMicrophoneEnabled(!next)
    } catch {
      setMuted(true)
      setError('Mikrofon izni verilmedi.')
      return
    }
    socketRef.current?.emit('voice:update', { muted: next, deafened: !next ? false : state.current.deafened })
  }, [socketRef])

  const toggleDeafen = useCallback(async () => {
    const room = roomRef.current
    const next = !state.current.deafened
    setDeafened(next)
    setAllAudioMuted(next)
    // Kulaklığı kapatınca mikrofon da kapanır, açınca önceki hâline döner
    let nextMuted = state.current.muted
    if (next) {
      state.current.mutedBeforeDeafen = state.current.muted
      nextMuted = true
    } else {
      nextMuted = state.current.mutedBeforeDeafen
    }
    setMuted(nextMuted)
    await room?.localParticipant.setMicrophoneEnabled(!nextMuted).catch(() => {})
    socketRef.current?.emit('voice:update', { muted: nextMuted, deafened: next })
  }, [socketRef])

  /** WebSocket koptu ve yeniden bağlandıysa sunucuya tekrar "bu kanaldayım" de */
  const resync = useCallback(() => {
    const { channel, muted, deafened } = state.current
    if (channel && roomRef.current) socketRef.current?.emit('voice:join', { channelId: channel.id, muted, deafened })
  }, [socketRef])

  // ---------- Cihaz seçimi ----------
  const refreshDevices = useCallback(async () => {
    try {
      const all = await navigator.mediaDevices.enumerateDevices()
      setInputs(all.filter((d) => d.kind === 'audioinput' && d.deviceId))
      setOutputs(all.filter((d) => d.kind === 'audiooutput' && d.deviceId))
    } catch {
      /* tarayıcı izin vermedi */
    }
  }, [])

  // Kulaklık takılınca/çıkarılınca listeyi güncelle
  useEffect(() => {
    const md = navigator.mediaDevices
    if (!md?.addEventListener) return
    md.addEventListener('devicechange', refreshDevices)
    return () => md.removeEventListener('devicechange', refreshDevices)
  }, [refreshDevices])

  const chooseInput = useCallback(async (deviceId: string) => {
    setInputId(deviceId)
    store.set(INPUT_KEY, deviceId)
    try {
      await roomRef.current?.switchActiveDevice('audioinput', deviceId || 'default')
    } catch {
      setError('Bu mikrofona geçilemedi.')
    }
  }, [])

  const chooseOutput = useCallback((deviceId: string) => {
    setOutputId(deviceId)
    store.set(OUTPUT_KEY, deviceId)
    document.querySelectorAll<HTMLMediaElement>(`audio[${AUDIO_ATTR}]`).forEach((el) => applyOutput(el, deviceId || 'default'))
  }, [])

  // Sayfadan çıkınca (çıkış yap vb.) bağlantıyı kapat
  useEffect(() => () => teardown(), [teardown])

  return {
    status, channel, muted, deafened, speaking, error, clearError: () => setError(null),
    join, leave, toggleMute, toggleDeafen, resync,
    devices: { inputs, outputs, inputId, outputId, refresh: refreshDevices, chooseInput, chooseOutput },
  }
}

export type VoiceApi = ReturnType<typeof useVoice>
