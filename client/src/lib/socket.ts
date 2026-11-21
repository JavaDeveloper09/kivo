import { io, type Socket } from 'socket.io-client'

// Aynı origin'e bağlanır (geliştirmede Vite proxy'si backend'e iletir).
// Kimlik doğrulama, giriş yaparken alınan httpOnly cookie ile otomatik yapılır.
export function createSocket(): Socket {
  return io({ withCredentials: true, transports: ['websocket', 'polling'] })
}
