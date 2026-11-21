import { AccessToken } from "livekit-server-sdk";

/**
 * Sesli sohbet:
 * - Sesin kendisi LiveKit sunucularından akar (WebRTC). Biz sadece giriş bileti (token) veriyoruz.
 * - "Kim hangi ses kanalında?" bilgisini burada tutup WebSocket ile sunucunun üyelerine yayınlıyoruz.
 *   Böylece ses kanalına girmemiş kişiler de kanalda kimlerin olduğunu görebiliyor.
 */

export type VoiceUser = { userId: string; muted: boolean; deafened: boolean };

type Entry = VoiceUser & { channelId: string; serverId: string; socketId: string };

// Bir kullanıcı aynı anda tek bir ses kanalında olabilir
const byUser = new Map<string, Entry>();

export function isVoiceConfigured() {
  return !!(process.env.LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET);
}

/** LiveKit odasına giriş bileti. Oda adı kanal id'sinden türetilir, bilet 2 saat geçerli. */
export async function createVoiceToken(opts: { userId: string; displayName: string; channelId: string }) {
  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: opts.userId,
    name: opts.displayName,
    ttl: "2h",
  });
  at.addGrant({
    room: `voice-${opts.channelId}`,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });
  return { url: process.env.LIVEKIT_URL!, token: await at.toJwt() };
}

/** Bir kanaldaki kişiler */
function usersIn(channelId: string): VoiceUser[] {
  return [...byUser.values()]
    .filter((e) => e.channelId === channelId)
    .map(({ userId, muted, deafened }) => ({ userId, muted, deafened }));
}

/** Sunucunun tüm ses kanallarının durumu: { kanalId: [kişiler] } (sunucu detayında kullanılıyor) */
export function voiceStateForServer(serverId: string): Record<string, VoiceUser[]> {
  const out: Record<string, VoiceUser[]> = {};
  for (const e of byUser.values()) {
    if (e.serverId !== serverId) continue;
    (out[e.channelId] ??= []).push({ userId: e.userId, muted: e.muted, deafened: e.deafened });
  }
  return out;
}

export type VoiceChange = { serverId: string; channelId: string; users: VoiceUser[] };

/** Kanala gir. Başka bir ses kanalındaysa oradan çıkar. Değişen kanalların güncel listesini döner. */
export function joinVoice(e: Entry): VoiceChange[] {
  const changes: VoiceChange[] = [];
  const prev = byUser.get(e.userId);
  byUser.set(e.userId, e);
  if (prev && prev.channelId !== e.channelId)
    changes.push({ serverId: prev.serverId, channelId: prev.channelId, users: usersIn(prev.channelId) });
  changes.push({ serverId: e.serverId, channelId: e.channelId, users: usersIn(e.channelId) });
  return changes;
}

/** Kanaldan çık. socketId verilirse sadece o bağlantıdan girilmişse çıkarır (başka sekmede hâlâ bağlı olabilir). */
export function leaveVoice(userId: string, socketId?: string): VoiceChange | null {
  const e = byUser.get(userId);
  if (!e || (socketId && e.socketId !== socketId)) return null;
  byUser.delete(userId);
  return { serverId: e.serverId, channelId: e.channelId, users: usersIn(e.channelId) };
}

export function updateVoice(userId: string, socketId: string, patch: { muted?: boolean; deafened?: boolean }): VoiceChange | null {
  const e = byUser.get(userId);
  if (!e || e.socketId !== socketId) return null;
  if (typeof patch.muted === "boolean") e.muted = patch.muted;
  if (typeof patch.deafened === "boolean") e.deafened = patch.deafened;
  return { serverId: e.serverId, channelId: e.channelId, users: usersIn(e.channelId) };
}

/** Sunucudan ayrılan biri o sunucunun ses kanalındaysa çıkar */
export function leaveVoiceIfInServer(userId: string, serverId: string): VoiceChange | null {
  const e = byUser.get(userId);
  return e && e.serverId === serverId ? leaveVoice(userId) : null;
}
