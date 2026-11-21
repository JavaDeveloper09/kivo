import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireAuth, type AuthedRequest } from "../lib/auth.js";

export const announcementsRouter = Router();
announcementsRouter.use(requireAuth);

// Giriş yapmış kullanıcının id'si (requireAuth hangi alana koyduysa onu alır)
function currentUserId(req: AuthedRequest): string {
  const r = req as any;
  return r.userId ?? r.user?.id ?? r.auth?.userId;
}

async function isAdmin(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  return Boolean(user?.isAdmin);
}

const announcementSchema = z.object({
  title: z.string().trim().min(1, "Başlık boş olamaz.").max(120, "Başlık en fazla 120 karakter olabilir."),
  content: z.string().trim().min(1, "Duyuru boş olamaz.").max(4000, "Duyuru en fazla 4000 karakter olabilir."),
});

/** Son duyurular + bu kullanıcı duyuru atabilir mi */
announcementsRouter.get("/", async (req: AuthedRequest, res) => {
  const userId = currentUserId(req);
  const announcements = await prisma.announcement.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { author: { select: { id: true, username: true, displayName: true } } },
  });
  res.json({ announcements, canPost: await isAdmin(userId) });
});

/** Yeni duyuru (sadece yönetici) */
announcementsRouter.post("/", async (req: AuthedRequest, res) => {
  const userId = currentUserId(req);
  if (!(await isAdmin(userId))) return res.status(403).json({ error: "Duyuru atma yetkin yok." });

  const parsed = announcementSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });

  const announcement = await prisma.announcement.create({
    data: { ...parsed.data, authorId: userId },
    include: { author: { select: { id: true, username: true, displayName: true } } },
  });
  res.status(201).json({ announcement });
});

/** Duyuru silme (sadece yönetici) */
announcementsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  const userId = currentUserId(req);
  if (!(await isAdmin(userId))) return res.status(403).json({ error: "Duyuru silme yetkin yok." });

  await prisma.announcement.deleteMany({ where: { id: String(req.params.id) } });
  res.json({ ok: true });
});