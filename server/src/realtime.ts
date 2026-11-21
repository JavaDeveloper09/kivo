import type { Server as HttpServer } from "node:http";
import { Server as IOServer, type Socket } from "socket.io";
import { parseCookie } from "cookie";
import { prisma } from "./lib/prisma.js";
import { COOKIE_NAME, verifyToken } from "./lib/auth.js";
import { joinVoice, leaveVoice, updateVoice, type VoiceChange } from "./voice.js";

/**
 * Oda (room) düzeni:
 *   user:<userId>     -> o kullanıcının tüm açık sekmeleri/cihazları
 *   server:<serverId> -> o sunucunun tüm üyeleri
 * Bir mesaj "server:<id>" odasına yayınlanır, üyeler hangi kanalda olduklarına göre filtreler.
 */

let io: IOServer | null = null;

// Çevrimiçi durumu: kullanıcı başına açık bağlantı sayısı (iki sekme açıksa 2)
const connections = new Map<string, number>();
export const isOnline = (userId: string) => (connections.get(userId) ?? 0) > 0;

export function getIO() {
  if (!io) throw new Error("Realtime henüz başlatılmadı");
  return io;
}

const MAX_MESSAGE_LENGTH = 2000;
// Basit spam koruması: bağlantı başına 5 saniyede en fazla 8 mesaj
const RATE_WINDOW_MS = 5000;
const RATE_MAX = 8;

type Ack = (res: { ok: true; message?: unknown } | { ok: false; error: string }) => void;

export function initRealtime(httpServer: HttpServer, clientOrigin: string | undefined) {
  io = new IOServer(httpServer, {
    cors: { origin: clientOrigin, credentials: true },
  });

  // Bağlantı kurulmadan önce cookie'deki JWT ile kimlik doğrula
  io.use((socket, next) => {
    const cookies = parseCookie(socket.handshake.headers.cookie ?? "");
    const userId = verifyToken(cookies[COOKIE_NAME]);
    if (!userId) return next(new Error("unauthorized"));
    socket.data.userId = userId;
    next();
  });

  io.on("connection", async (socket: Socket) => {
    const userId: string = socket.data.userId;
    const sentAt: number[] = [];

    socket.join(`user:${userId}`);
    const memberships = await prisma.member.findMany({ where: { userId }, select: { serverId: true } });
    const serverIds = memberships.map((m: { serverId: string }) => m.serverId);
    serverIds.forEach((id: string) => socket.join(`server:${id}`));

    // İlk bağlantıysa üyelere "çevrimiçi oldu" de
    const count = (connections.get(userId) ?? 0) + 1;
    connections.set(userId, count);
    if (count === 1) broadcastPresence(userId, true, serverIds);

    // ---------- Mesaj gönder ----------
    socket.on("message:send", async (payload: { channelId?: string; content?: string }, ack?: Ack) => {
      const reply: Ack = typeof ack === "function" ? ack : () => {};
      try {
        const content = String(payload?.content ?? "").trim();
        if (!content) return reply({ ok: false, error: "Boş mesaj gönderilemez." });
        if (content.length > MAX_MESSAGE_LENGTH)
          return reply({ ok: false, error: `Mesaj en fazla ${MAX_MESSAGE_LENGTH} karakter olabilir.` });

        const now = Date.now();
        while (sentAt.length && now - sentAt[0] > RATE_WINDOW_MS) sentAt.shift();
        if (sentAt.length >= RATE_MAX) return reply({ ok: false, error: "Çok hızlı yazıyorsun, biraz yavaşla." });
        sentAt.push(now);

        const channel = await prisma.channel.findUnique({ where: { id: String(payload?.channelId ?? "") } });
        if (!channel || channel.type !== "TEXT") return reply({ ok: false, error: "Kanal bulunamadı." });

        // Üyelik kontrolü: sadece sunucunun üyeleri yazabilir
        const member = await prisma.member.findUnique({
          where: { userId_serverId: { userId, serverId: channel.serverId } },
        });
        if (!member) return reply({ ok: false, error: "Bu sunucunun üyesi değilsin." });

        const message = await prisma.message.create({
          data: { content, channelId: channel.id, authorId: userId },
          include: { author: { select: { id: true, username: true, displayName: true } } },
        });

        // Gönderen dahil sunucudaki herkese yayınla
        io!.to(`server:${channel.serverId}`).emit("message:new", message);
        reply({ ok: true, message });
      } catch (err) {
        console.error(err);
        reply({ ok: false, error: "Mesaj gönderilemedi." });
      }
    });

    // ---------- "Yazıyor..." ----------
    socket.on("typing", async (payload: { channelId?: string }) => {
      const channel = await prisma.channel.findUnique({ where: { id: String(payload?.channelId ?? "") } });
      if (!channel || !socket.rooms.has(`server:${channel.serverId}`)) return;
      socket.to(`server:${channel.serverId}`).emit("typing", { channelId: channel.id, userId });
    });

    // ---------- Ses kanalı durumu ----------
    // Ses LiveKit üzerinden akar; burada sadece "kim hangi ses kanalında" bilgisini tutuyoruz.
    socket.on("voice:join", async (payload: { channelId?: string; muted?: boolean; deafened?: boolean }, ack?: Ack) => {
      const reply: Ack = typeof ack === "function" ? ack : () => {};
      const channel = await prisma.channel.findUnique({ where: { id: String(payload?.channelId ?? "") } });
      if (!channel || channel.type !== "VOICE") return reply({ ok: false, error: "Ses kanalı bulunamadı." });
      if (!socket.rooms.has(`server:${channel.serverId}`)) return reply({ ok: false, error: "Bu sunucunun üyesi değilsin." });
      joinVoice({
        userId,
        channelId: channel.id,
        serverId: channel.serverId,
        socketId: socket.id,
        muted: !!payload?.muted,
        deafened: !!payload?.deafened,
      }).forEach(broadcastVoice);
      reply({ ok: true });
    });

    socket.on("voice:leave", () => {
      const change = leaveVoice(userId, socket.id);
      if (change) broadcastVoice(change);
    });

    socket.on("voice:update", (payload: { muted?: boolean; deafened?: boolean }) => {
      const change = updateVoice(userId, socket.id, payload ?? {});
      if (change) broadcastVoice(change);
    });

    socket.on("disconnect", async () => {
      // Bu bağlantıdan ses kanalına girildiyse çıkar
      const voiceChange = leaveVoice(userId, socket.id);
      if (voiceChange) broadcastVoice(voiceChange);

      const left = (connections.get(userId) ?? 1) - 1;
      if (left > 0) return connections.set(userId, left);
      connections.delete(userId);
      // Bağlantı sırasında yeni sunuculara katılmış olabilir, güncel listeyi al
      const current = await prisma.member.findMany({ where: { userId }, select: { serverId: true } });
      broadcastPresence(userId, false, current.map((m: { serverId: string }) => m.serverId));
    });
  });

  return io;
}

export function broadcastVoice(change: VoiceChange) {
  io?.to(`server:${change.serverId}`).emit("voice:state", change);
}

function broadcastPresence(userId: string, online: boolean, serverIds: string[]) {
  if (!io || serverIds.length === 0) return;
  io.to(serverIds.map((id) => `server:${id}`)).emit("presence", { userId, online });
}
