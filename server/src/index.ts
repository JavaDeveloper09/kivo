import "dotenv/config";
import http from "node:http";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { serversRouter } from "./routes/servers.js";
import { announcementsRouter } from "./routes/announcements.js";
import { initRealtime } from "./realtime.js";

// Sitenin adresi: yerelde .env'den, Render'da otomatik gelen RENDER_EXTERNAL_URL'den
// (davet ve şifre sıfırlama linkleri, CORS ve WebSocket izinleri bunu kullanıyor)
process.env.CLIENT_URL ??= process.env.RENDER_EXTERNAL_URL ?? "http://localhost:5173";

const app = express();
app.set("trust proxy", 1); // rate limit gerçek IP'yi görsün (reverse proxy arkasında)
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/announcements", announcementsRouter); // serversRouter'dan ÖNCE olmalı
app.use("/api", serversRouter);

// ---------- Yayında: derlenmiş React uygulamasını da bu sunucu verir ----------
// Yerelde (npm run dev) client/dist yoksa bu kısım atlanır, frontend'i Vite sunar.
const clientDist = fileURLToPath(new URL("../../client/dist", import.meta.url));
if (fs.existsSync(clientDist)) {
  // Dosya adlarında içerik özeti (hash) olduğu için uzun süre önbelleğe alınabilir
  app.use("/assets", express.static(`${clientDist}/assets`, { immutable: true, maxAge: "1y" }));
  app.use(express.static(clientDist, { index: false }));
  // /login, /invite/abc gibi sayfa adresleri: hepsi index.html'i alır, yönlendirmeyi React yapar
  app.use((req, res, next) => {
    if ((req.method !== "GET" && req.method !== "HEAD") || req.path.startsWith("/api") || req.path.startsWith("/socket.io")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(`${clientDist}/index.html`);
  });
  console.log("📦 Frontend sunuluyor:", clientDist);
}

// Yakalanmayan hatalar
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Sunucu hatası, tekrar dene." });
});

// Express ve Socket.IO aynı HTTP sunucusunu paylaşır
const httpServer = http.createServer(app);
initRealtime(httpServer, process.env.CLIENT_URL);

const port = Number(process.env.PORT ?? 4000);
httpServer.listen(port, () => console.log(`🚀 Sunucu çalışıyor: port ${port} (${process.env.CLIENT_URL})`));