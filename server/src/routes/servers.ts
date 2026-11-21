import { Router, type Response } from "express";
import crypto from "node:crypto";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";
import { broadcastVoice, getIO, isOnline } from "../realtime.js";
import { createVoiceToken, isVoiceConfigured, leaveVoiceIfInServer, voiceStateForServer } from "../voice.js";

export const serversRouter = Router();
serversRouter.use(requireAuth);

const MESSAGE_PAGE_SIZE = 50;
const userSelect = { id: true, username: true, displayName: true } as const;

// Okunması kolay davet kodu: karışan karakterler (0/O, 1/l/I) yok
const INVITE_ALPHABET = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newInviteCode(length = 8) {
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (b) => INVITE_ALPHABET[b % INVITE_ALPHABET.length]).join("");
}

// Express 5'te parametre tipi string | string[] olabiliyor, tek string'e çeviriyoruz
const pid = (req: AuthedRequest) => String(req.params.id);

const fail = (res: Response, status: number, error: string, field?: string) =>
  res.status(status).json(field ? { error, field } : { error });

const firstError = (err: z.ZodError) => ({ error: err.issues[0].message, field: err.issues[0].path[0] });

async function getMembership(userId: string, serverId: string) {
  return prisma.member.findUnique({ where: { userId_serverId: { userId, serverId } } });
}

/** Sunucu detayı: kanallar + üyeler (çevrimiçi bilgisiyle) */
async function serverDetail(serverId: string) {
  const server = await prisma.server.findUnique({
    where: { id: serverId },
    include: {
      channels: { orderBy: [{ position: "asc" }, { createdAt: "asc" }] },
      members: { include: { user: { select: userSelect } }, orderBy: { joinedAt: "asc" } },
    },
  });
  if (!server) return null;
  return {
    id: server.id,
    name: server.name,
    ownerId: server.ownerId,
    inviteCode: server.inviteCode,
    channels: server.channels,
    members: server.members.map((m: { role: string; user: { id: string; username: string; displayName: string } }) => ({
      ...m.user,
      role: m.role,
      online: isOnline(m.user.id),
    })),
    voice: voiceStateForServer(server.id), // ses kanallarında şu an kimler var
    voiceEnabled: isVoiceConfigured(),
  };
}

// ---------- GET /api/servers : üye olduğum sunucular ----------
serversRouter.get("/servers", async (req: AuthedRequest, res) => {
  const memberships = await prisma.member.findMany({
    where: { userId: req.userId },
    include: { server: { select: { id: true, name: true } } },
    orderBy: { joinedAt: "asc" },
  });
  res.json({
    servers: memberships.map((m: { role: string; server: { id: string; name: string } }) => ({ ...m.server, role: m.role })),
  });
});

// ---------- POST /api/servers : sunucu oluştur ----------
const serverNameSchema = z
  .string()
  .trim()
  .min(2, "Sunucu adı en az 2 karakter olmalı.")
  .max(50, "Sunucu adı en fazla 50 karakter olabilir.");

serversRouter.post("/servers", async (req: AuthedRequest, res) => {
  const parsed = z.object({ name: serverNameSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(firstError(parsed.error));
  const userId = req.userId!;

  const server = await prisma.server.create({
    data: {
      name: parsed.data.name,
      inviteCode: newInviteCode(),
      ownerId: userId,
      members: { create: { userId, role: "OWNER" } },
      // Her yeni sunucu varsayılan kanallarla gelir
      channels: {
        create: [
          { name: "genel", type: "TEXT", position: 0 },
          { name: "Genel Ses", type: "VOICE", position: 1 },
        ],
      },
    },
  });

  // Kullanıcının açık bağlantılarını yeni sunucunun odasına al
  getIO().in(`user:${userId}`).socketsJoin(`server:${server.id}`);
  res.status(201).json({ server: await serverDetail(server.id) });
});

// ---------- GET /api/servers/:id : sunucu detayı ----------
serversRouter.get("/servers/:id", async (req: AuthedRequest, res) => {
  if (!(await getMembership(req.userId!, pid(req)))) return fail(res, 404, "Sunucu bulunamadı.");
  res.json({ server: await serverDetail(pid(req)) });
});

// ---------- POST /api/servers/:id/leave : sunucudan ayrıl ----------
serversRouter.post("/servers/:id/leave", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const membership = await getMembership(userId, pid(req));
  if (!membership) return fail(res, 404, "Sunucu bulunamadı.");
  if (membership.role === "OWNER") return fail(res, 400, "Kurucu sunucudan ayrılamaz.");

  await prisma.member.delete({ where: { id: membership.id } });
  const voiceChange = leaveVoiceIfInServer(userId, pid(req));
  if (voiceChange) broadcastVoice(voiceChange);
  const io = getIO();
  io.in(`user:${userId}`).socketsLeave(`server:${pid(req)}`);
  io.to(`server:${pid(req)}`).emit("member:left", { serverId: pid(req), userId });
  res.json({ ok: true });
});

// ---------- POST /api/servers/:id/channels : kanal oluştur (sadece kurucu) ----------
const channelSchema = z
  .object({
    name: z.string().trim().min(1, "Kanal adı boş olamaz.").max(32, "Kanal adı en fazla 32 karakter olabilir."),
    type: z.enum(["TEXT", "VOICE"]).default("TEXT"),
  })
  .transform((c) => ({
    ...c,
    // Yazı kanalı adları: küçük harf, boşluk yerine tire ("Oyun Sohbeti" -> "oyun-sohbeti")
    name: c.type === "TEXT" ? c.name.toLocaleLowerCase("tr").replace(/\s+/g, "-") : c.name,
  }));

serversRouter.post("/servers/:id/channels", async (req: AuthedRequest, res) => {
  const membership = await getMembership(req.userId!, pid(req));
  if (!membership) return fail(res, 404, "Sunucu bulunamadı.");
  if (membership.role !== "OWNER") return fail(res, 403, "Kanalı sadece sunucu kurucusu ekleyebilir.");

  const parsed = channelSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(firstError(parsed.error));

  const count = await prisma.channel.count({ where: { serverId: pid(req) } });
  if (count >= 50) return fail(res, 400, "Bir sunucuda en fazla 50 kanal olabilir.");

  const channel = await prisma.channel.create({
    data: { ...parsed.data, serverId: pid(req), position: count },
  });
  getIO().to(`server:${pid(req)}`).emit("channel:created", channel);
  res.status(201).json({ channel });
});

// ---------- GET /api/invites/:code : davet önizlemesi ----------
serversRouter.get("/invites/:code", async (req: AuthedRequest, res) => {
  const server = await prisma.server.findUnique({
    where: { inviteCode: String(req.params.code) },
    include: { _count: { select: { members: true } } },
  });
  if (!server) return fail(res, 404, "Davet linki geçersiz.");
  const alreadyMember = !!(await getMembership(req.userId!, server.id));
  res.json({ server: { id: server.id, name: server.name, memberCount: server._count.members }, alreadyMember });
});

// ---------- POST /api/invites/:code/join : davetle katıl ----------
serversRouter.post("/invites/:code/join", async (req: AuthedRequest, res) => {
  const userId = req.userId!;
  const server = await prisma.server.findUnique({ where: { inviteCode: String(req.params.code) } });
  if (!server) return fail(res, 404, "Davet linki geçersiz.");

  if (!(await getMembership(userId, server.id))) {
    await prisma.member.create({ data: { userId, serverId: server.id } });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: userSelect });
    const io = getIO();
    io.in(`user:${userId}`).socketsJoin(`server:${server.id}`);
    io.to(`server:${server.id}`).emit("member:joined", {
      serverId: server.id,
      member: { ...user, role: "MEMBER", online: isOnline(userId) },
    });
  }
  res.json({ server: await serverDetail(server.id) });
});

// ---------- GET /api/channels/:id/messages?before=<ISO tarih> : mesaj geçmişi ----------
serversRouter.get("/channels/:id/messages", async (req: AuthedRequest, res) => {
  const channel = await prisma.channel.findUnique({ where: { id: pid(req) } });
  if (!channel || !(await getMembership(req.userId!, channel.serverId))) return fail(res, 404, "Kanal bulunamadı.");

  const before = typeof req.query.before === "string" ? new Date(req.query.before) : null;
  if (before && isNaN(before.getTime())) return fail(res, 400, "Geçersiz tarih.");

  // En yeniden eskiye 51 tane çek: 51. varsa "daha eski mesaj var" demektir
  const rows = await prisma.message.findMany({
    where: { channelId: channel.id, ...(before ? { createdAt: { lt: before } } : {}) },
    orderBy: { createdAt: "desc" },
    take: MESSAGE_PAGE_SIZE + 1,
    include: { author: { select: userSelect } },
  });
  const hasMore = rows.length > MESSAGE_PAGE_SIZE;
  res.json({ messages: rows.slice(0, MESSAGE_PAGE_SIZE).reverse(), hasMore });
});

// ---------- POST /api/channels/:id/voice-token : ses kanalı giriş bileti ----------
serversRouter.post("/channels/:id/voice-token", async (req: AuthedRequest, res) => {
  if (!isVoiceConfigured()) return fail(res, 503, "Sesli sohbet henüz ayarlanmadı (LiveKit anahtarları eksik).");

  const channel = await prisma.channel.findUnique({ where: { id: pid(req) } });
  if (!channel || channel.type !== "VOICE" || !(await getMembership(req.userId!, channel.serverId)))
    return fail(res, 404, "Ses kanalı bulunamadı.");

  const user = await prisma.user.findUnique({ where: { id: req.userId }, select: userSelect });
  res.json(await createVoiceToken({ userId: user!.id, displayName: user!.displayName, channelId: channel.id }));
});
