import "dotenv/config";
import http from "node:http";
import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { authRouter } from "./routes/auth.js";
import { serversRouter } from "./routes/servers.js";
import { announcementsRouter } from "./routes/announcements.js";
import { initRealtime } from "./realtime.js";

const app = express();
app.set("trust proxy", 1); // rate limit gerçek IP'yi görsün (reverse proxy arkasında)
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ ok: true }));
app.use("/api/auth", authRouter);
app.use("/api/announcements", announcementsRouter); // serversRouter'dan ÖNCE olmalı
app.use("/api", serversRouter);

// Yakalanmayan hatalar
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: "Sunucu hatası, tekrar dene." });
});

// Express ve Socket.IO aynı HTTP sunucusunu paylaşır
const httpServer = http.createServer(app);
initRealtime(httpServer, process.env.CLIENT_URL);

const port = Number(process.env.PORT ?? 4000);
httpServer.listen(port, () => console.log(`🚀 API http://localhost:${port}`));