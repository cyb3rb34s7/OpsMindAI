import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Dev proxy so the SPA can call the FastAPI backend same-origin.
      '/api': { target: 'http://127.0.0.1:8077', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8077', changeOrigin: true },
    },
  },
})
