import { Router } from "express";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { setAuthCookie, clearAuthCookie, requireAuth, type AuthedRequest } from "../lib/auth.js";

export const authRouter = Router();

const BCRYPT_ROUNDS = 12;
const RESET_TOKEN_TTL_MIN = 30;

// ---------- Doğrulama kuralları (frontend'dekilerle aynı) ----------
const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3, "Kullanıcı adı en az 3 karakter olmalı.")
  .max(32, "Kullanıcı adı en fazla 32 karakter olabilir.")
  .regex(/^[a-z0-9_.]+$/, "Kullanıcı adında sadece küçük harf, rakam, _ ve . kullanılabilir.");

const passwordSchema = z
  .string()
  .min(8, "Şifre en az 8 karakter olmalı.")
  .max(72, "Şifre en fazla 72 karakter olabilir.") // bcrypt 72 byte'tan sonrasını yok sayar
  .regex(/[A-Za-z]/, "Şifrede en az bir harf olmalı.")
  .regex(/[0-9]/, "Şifrede en az bir rakam olmalı.");

const registerSchema = z.object({
  email: z.string().trim().toLowerCase().email("Geçerli bir e-posta gir."),
  username: usernameSchema,
  displayName: z.string().trim().max(32, "Görünen ad en fazla 32 karakter olabilir.").optional(),
  password: passwordSchema,
});

const loginSchema = z.object({
  identifier: z.string().trim().toLowerCase().min(1, "Kullanıcı adı veya e-posta gir."),
  password: z.string().min(1, "Şifre gir."),
  remember: z.boolean().optional().default(false),
});

function firstError(err: z.ZodError) {
  const issue = err.issues[0];
  return { error: issue.message, field: issue.path[0] };
}

const publicUser = (u: { id: string; username: string; displayName: string; email: string }) => ({
  id: u.id,
  username: u.username,
  displayName: u.displayName,
  email: u.email,
});

// ---------- Rate limit: kaba kuvvetle şifre denemeye karşı ----------
const loginLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla deneme yaptın. 1 dakika sonra tekrar dene." },
});

const sensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Çok fazla istek. Biraz sonra tekrar dene." },
});

// ---------- POST /api/auth/register ----------
authRouter.post("/register", sensitiveLimiter, async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(firstError(parsed.error));
  const { email, username, displayName, password } = parsed.data;

  const existing = await prisma.user.findFirst({
    where: { OR: [{ email }, { username }] },
    select: { email: true, username: true },
  });
  if (existing?.username === username)
    return res.status(409).json({ error: "Bu kullanıcı adı alınmış.", field: "username" });
  if (existing?.email === email)
    return res.status(409).json({ error: "Bu e-posta ile zaten bir hesap var.", field: "email" });

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  const user = await prisma.user.create({
    data: { email, username, displayName: displayName || username, passwordHash },
  });

  setAuthCookie(res, user.id, false);
  res.status(201).json({ user: publicUser(user) });
});

// ---------- POST /api/auth/login ----------
// Kullanıcı adı veya e-posta ile giriş
const DUMMY_HASH = bcrypt.hashSync("zamanlama-saldirisina-karsi", BCRYPT_ROUNDS);

authRouter.post("/login", loginLimiter, async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(firstError(parsed.error));
  const { identifier, password, remember } = parsed.data;

  const user = await prisma.user.findFirst({
    where: identifier.includes("@") ? { email: identifier } : { username: identifier },
  });

  // Kullanıcı yoksa da hash karşılaştırması yap: cevap süresinden
  // "bu kullanıcı var mı" bilgisi sızmasın.
  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) {
    // Hangisinin yanlış olduğunu söylemiyoruz (kullanıcı adı tahminini zorlaştırır)
    return res.status(401).json({ error: "Kullanıcı adı/e-posta veya şifre hatalı." });
  }

  setAuthCookie(res, user.id, remember);
  res.json({ user: publicUser(user) });
});

// ---------- POST /api/auth/logout ----------
authRouter.post("/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

// ---------- GET /api/auth/me ----------
authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) {
    clearAuthCookie(res);
    return res.status(401).json({ error: "Kullanıcı bulunamadı." });
  }
  res.json({ user: publicUser(user) });
});

// ---------- POST /api/auth/forgot-password ----------
const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

authRouter.post("/forgot-password", sensitiveLimiter, async (req, res) => {
  const parsed = z.object({ email: z.string().trim().toLowerCase().email("Geçerli bir e-posta gir.") }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(firstError(parsed.error));

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const token = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: {
        tokenHash: sha256(token),
        userId: user.id,
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MIN * 60 * 1000),
      },
    });
    const link = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
    // TODO: Gerçek e-posta gönderimi (Resend, Nodemailer vb.). Şimdilik konsola yazıyoruz.
    console.log(`\n📧 Şifre sıfırlama linki (${user.email}):\n${link}\n`);
  }

  // E-posta kayıtlı olsun olmasın aynı cevap: hangi e-postaların kayıtlı olduğu sızmasın.
  res.json({ ok: true, message: "Bu e-posta kayıtlıysa sıfırlama linki gönderildi." });
});

// ---------- POST /api/auth/reset-password ----------
authRouter.post("/reset-password", sensitiveLimiter, async (req, res) => {
  const parsed = z.object({ token: z.string().min(1), password: passwordSchema }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json(firstError(parsed.error));

  const record = await prisma.passwordResetToken.findUnique({
    where: { tokenHash: sha256(parsed.data.token) },
  });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return res.status(400).json({ error: "Link geçersiz veya süresi dolmuş. Yeni bir link iste." });
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  res.json({ ok: true });
});
