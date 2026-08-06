import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    watch: { usePolling: true },
    // HMR über Nginx-Proxy
    hmr: {
      clientPort: 8084,   // Der Port den der Browser sieht
      protocol: 'ws',
    },
  },
})