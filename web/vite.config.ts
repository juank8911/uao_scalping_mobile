import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    dedupe: ['react', 'react-dom'],
  },
  optimizeDeps: {
    include: ['jeikei-design-system'],
    force: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.API_URL || 'http://127.0.0.1:8000',
        changeOrigin: true,
        ws: true,
        timeout: 0,        // sin timeout en conexiones WS (keepalive con heartbeat)
        proxyTimeout: 0,   // ídem para el proxy hacia el backend
      },
    },
  },
})

