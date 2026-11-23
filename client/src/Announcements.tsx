import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useAuth } from "./lib/AuthContext";

type Announcement = {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  author: { displayName: string };
};

// En son görülen duyurunun tarihi (kırmızı nokta için), tarayıcıda saklanır
const SEEN_KEY = "kivo:lastSeenAnnouncement";
const readSeen = () => {
  try { return localStorage.getItem(SEEN_KEY) ?? ""; } catch { return ""; }
};
const writeSeen = (v: string) => {
  try { localStorage.setItem(SEEN_KEY, v); } catch { /* yoksay */ }
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });

export default function Announcements() {
  const { user } = useAuth();
  const [loggedIn, setLoggedIn] = useState(false);
  const [items, setItems] = useState<Announcement[]>([]);
  const [canPost, setCanPost] = useState(false);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(readSeen);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements", { credentials: "include" });
      if (!res.ok) { setLoggedIn(false); return; } // giriş yapılmamış: buton gizli
      const data = await res.json();
      setItems(data.announcements);
      setCanPost(data.canPost);
      setLoggedIn(true);
    } catch { /* ağ hatası: bir sonraki denemede tekrar */ }
  }, []);

  // Açılışta, giriş/çıkış yapılınca ve her 20 saniyede bir yenile (yeni duyuru gelirse nokta yanar)
  useEffect(() => {
    if (!user) { setLoggedIn(false); setOpen(false); return; } // çıkış yapınca buton hemen gizlensin
    load();
    const timer = setInterval(load, 20000);
    return () => clearInterval(timer);
  }, [load, user]);

  // Esc ile kapat
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const hasUnread = items.length > 0 && items[0].createdAt > seen;

  function openPanel() {
    setOpen(true);
    if (items[0]) { writeSeen(items[0].createdAt); setSeen(items[0].createdAt); }
  }

  async function post(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, content }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Duyuru gönderilemedi."); return; }
      setItems((prev) => [data.announcement, ...prev]);
      writeSeen(data.announcement.createdAt);
      setSeen(data.announcement.createdAt);
      setTitle("");
      setContent("");
    } catch {
      setError("Bağlantı hatası, tekrar dene.");
    } finally {
      setSending(false);
    }
  }

  async function remove(id: string) {
    if (!window.confirm("Bu duyuru silinsin mi?")) return;
    const res = await fetch(`/api/announcements/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) setItems((prev) => prev.filter((a) => a.id !== id));
  }

  if (!loggedIn) return null;

  return (
    <>
      <button className="announce-trigger" style={styles.trigger} onClick={openPanel} aria-label="Duyurular">
        📢<span className="announce-label"> Duyurular</span>
        {hasUnread && <span style={styles.dot} />}
      </button>

      {open && (
        <div className="announce-overlay" style={styles.overlay} onClick={() => setOpen(false)}>
          <div className="announce-panel" style={styles.panel} onClick={(e) => e.stopPropagation()}>
            <div style={styles.header}>
              <h2 style={styles.heading}>📢 Duyurular</h2>
              <button style={styles.close} onClick={() => setOpen(false)} aria-label="Kapat">✕</button>
            </div>

            {canPost && (
              <form onSubmit={post} style={styles.form}>
                <input
                  style={styles.input}
                  placeholder="Başlık (ör. Yeni özellik: sesli odalar!)"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={120}
                />
                <textarea
                  style={{ ...styles.input, minHeight: 90, resize: "vertical" }}
                  placeholder="Duyuru metni…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={4000}
                />
                {error && <div style={styles.error}>{error}</div>}
                <button style={styles.submit} disabled={sending || !title.trim() || !content.trim()}>
                  {sending ? "Gönderiliyor…" : "Duyuru yayınla"}
                </button>
              </form>
            )}

            <div style={styles.list}>
              {items.length === 0 && <p style={styles.empty}>Henüz duyuru yok.</p>}
              {items.map((a) => (
                <article key={a.id} style={styles.card}>
                  <div style={styles.cardTop}>
                    <strong style={styles.cardTitle}>{a.title}</strong>
                    {canPost && (
                      <button style={styles.delete} onClick={() => remove(a.id)} aria-label="Sil">🗑</button>
                    )}
                  </div>
                  <p style={styles.cardBody}>{a.content}</p>
                  <small style={styles.meta}>
                    {a.author.displayName} · {formatDate(a.createdAt)}
                  </small>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const green = "#22c55e";
const styles: Record<string, CSSProperties> = {
  trigger: {
    position: "fixed", top: 16, left: "50%", transform: "translateX(-50%)", zIndex: 50,
    background: "#173324", color: "#e6f4ea", border: `1px solid ${green}`, borderRadius: 999,
    padding: "8px 18px", fontWeight: 700, fontSize: 15, cursor: "pointer",
  },
  dot: {
    position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: "50%",
    background: "#ef4444", border: "2px solid #0f1f17",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100,
    display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "70px 16px 16px",
  },
  panel: {
    width: "100%", maxWidth: 560, maxHeight: "calc(100vh - 90px)", overflowY: "auto",
    background: "#13261c", border: "1px solid #24412f", borderRadius: 14, padding: 20, color: "#e6f4ea",
  },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  heading: { margin: 0, fontSize: 20 },
  close: { background: "none", border: "none", color: "#9fb8a8", fontSize: 18, cursor: "pointer" },
  form: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 },
  input: {
    background: "#0d1a13", color: "#e6f4ea", border: "1px solid #24412f", borderRadius: 8,
    padding: "10px 12px", fontSize: 15, fontFamily: "inherit",
  },
  error: { color: "#f87171", fontSize: 14 },
  submit: {
    background: green, color: "#06260f", border: "none", borderRadius: 8, padding: "10px 14px",
    fontWeight: 700, fontSize: 15, cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: 10 },
  empty: { color: "#9fb8a8", textAlign: "center", margin: "20px 0" },
  card: { background: "#173324", borderRadius: 10, padding: "12px 14px" },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { fontSize: 16, color: green },
  delete: { background: "none", border: "none", cursor: "pointer", fontSize: 15 },
  cardBody: { margin: "6px 0 8px", whiteSpace: "pre-wrap", lineHeight: 1.45 },
  meta: { color: "#9fb8a8" },
};