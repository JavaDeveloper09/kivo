import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";

const JWT_SECRET = process.env.JWT_SECRET ?? "";
if (!JWT_SECRET || JWT_SECRET === "degistir-beni") {
  console.warn("⚠️  JWT_SECRET ayarlanmamış. Canlıda mutlaka uzun ve rastgele bir değer kullan.");
}

export const COOKIE_NAME = "token";
const DAY = 24 * 60 * 60 * 1000;

/**
 * "Oturumu açık tut" işaretliyse 30 gün geçerli kalıcı cookie,
 * değilse tarayıcı kapanınca silinen oturum cookie'si (token yine 1 günde düşer).
 */
export function setAuthCookie(res: Response, userId: string, remember: boolean) {
  const expiresIn = remember ? "30d" : "1d";
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn });

  res.cookie(COOKIE_NAME, token, {
    httpOnly: true, // JavaScript okuyamaz -> XSS ile token çalınamaz
    sameSite: "lax", // CSRF'e karşı temel koruma
    secure: process.env.NODE_ENV === "production", // canlıda sadece HTTPS
    ...(remember ? { maxAge: 30 * DAY } : {}),
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(COOKIE_NAME);
}

export interface AuthedRequest extends Request {
  userId?: string;
}

/** Token geçerliyse kullanıcı id'sini, değilse null döner (WebSocket de bunu kullanır). */
export function verifyToken(token: string | undefined): string | null {
  if (!token) return null;
  try {
    return (jwt.verify(token, JWT_SECRET) as { sub: string }).sub;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return res.status(401).json({ error: "Giriş yapmalısın." });
  const userId = verifyToken(token);
  if (!userId) {
    clearAuthCookie(res);
    return res.status(401).json({ error: "Oturumun sona erdi, tekrar giriş yap." });
  }
  req.userId = userId;
  next();
}
