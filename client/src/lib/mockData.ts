// GEÇİCİ örnek veriler. Backend'e sunucu/kanal/mesaj API'leri eklenince
// bu dosya silinip yerine gerçek istekler gelecek.
export type Channel = { id: string; name: string; type: 'text' | 'voice' }
export type Member = { id: string; displayName: string; username: string; online: boolean; role?: string }
export type Message = { id: string; authorId: string; content: string; createdAt: string }
export type Server = { id: string; name: string; channels: Channel[]; members: Member[] }

const now = Date.now()
const ago = (min: number) => new Date(now - min * 60_000).toISOString()

export const servers: Server[] = [
  {
    id: 's1',
    name: 'Yazılımcılar',
    channels: [
      { id: 'c1', name: 'genel', type: 'text' },
      { id: 'c2', name: 'yardım', type: 'text' },
      { id: 'c3', name: 'projeler', type: 'text' },
      { id: 'v1', name: 'Sohbet Odası', type: 'voice' },
      { id: 'v2', name: 'Kod Seansı', type: 'voice' },
    ],
    members: [
      { id: 'u1', displayName: 'Mert', username: 'mert', online: true, role: 'Kurucu' },
      { id: 'u2', displayName: 'Zeynep', username: 'zeynep.k', online: true },
      { id: 'u3', displayName: 'Can', username: 'can_dev', online: true },
      { id: 'u4', displayName: 'Elif', username: 'elif', online: false },
      { id: 'u5', displayName: 'Burak', username: 'burak42', online: false },
    ],
  },
  {
    id: 's2',
    name: 'Oyun Ekibi',
    channels: [
      { id: 'c4', name: 'genel', type: 'text' },
      { id: 'c5', name: 'klipler', type: 'text' },
      { id: 'v3', name: 'Lobi', type: 'voice' },
    ],
    members: [
      { id: 'u3', displayName: 'Can', username: 'can_dev', online: true, role: 'Kurucu' },
      { id: 'u5', displayName: 'Burak', username: 'burak42', online: false },
    ],
  },
  {
    id: 's3',
    name: 'Üniversite',
    channels: [
      { id: 'c6', name: 'duyurular', type: 'text' },
      { id: 'c7', name: 'ödevler', type: 'text' },
    ],
    members: [{ id: 'u2', displayName: 'Zeynep', username: 'zeynep.k', online: true, role: 'Kurucu' }],
  },
]

export const initialMessages: Record<string, Message[]> = {
  c1: [
    { id: 'm1', authorId: 'u1', content: 'Herkese selam! Sunucuya hoş geldiniz 👋', createdAt: ago(180) },
    { id: 'm2', authorId: 'u2', content: 'Selam! Burası çok güzel olmuş', createdAt: ago(175) },
    { id: 'm3', authorId: 'u2', content: 'Kanalları nasıl ayırdınız?', createdAt: ago(174) },
    { id: 'm4', authorId: 'u3', content: 'Genel sohbet burada, sorular için #yardım var', createdAt: ago(40) },
    { id: 'm5', authorId: 'u1', content: 'Akşam kod seansı yapalım mı?', createdAt: ago(5) },
  ],
  c2: [{ id: 'm6', authorId: 'u3', content: 'React sorusu olan buraya yazabilir', createdAt: ago(300) }],
  c4: [{ id: 'm7', authorId: 'u3', content: 'Bu akşam kim var?', createdAt: ago(60) }],
}
