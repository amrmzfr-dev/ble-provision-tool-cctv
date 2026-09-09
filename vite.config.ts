import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    // Web Bluetooth requires a secure context; allows testing via `vite --host`
    // over LAN with a self-signed cert if needed later.
    host: true,
  },
  test: {
    environment: 'node',
  },
})
