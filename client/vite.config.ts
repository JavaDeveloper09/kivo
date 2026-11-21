import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['.trycloudflare.com'],
    // /api ve /socket.io isteklerini backend'e yönlendir: frontend ve backend
    // aynı origin gibi görünür, cookie'ler sorunsuz çalışır.
    proxy: {
      '/api': 'http://localhost:4000',
      '/socket.io': { target: 'http://localhost:4000', ws: true },
    },
  },
})
