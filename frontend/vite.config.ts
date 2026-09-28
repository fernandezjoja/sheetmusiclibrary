import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { alphaTab } from '@coderline/alphatab-vite'

// https://vite.dev/config/
export default defineConfig({
  // alphaTab() serves/bundles alphaTab's music font, soundfont, and the
  // audio worker/worklet the player needs.
  plugins: [react(), alphaTab()],
  // alphaTab's worker/worklet bundling fails under Vite 8's default 'iife'
  // worker format; its code relies on import.meta.url, which needs ESM.
  worker: { format: 'es' },
  server: {
    proxy: {
      // Proxy /api to the Spring Boot backend so the frontend can use
      // same-origin requests in dev (no CORS, no env-specific base URLs).
      // changeOrigin + cookieDomainRewrite let the JSESSIONID set by Spring
      // (whose Set-Cookie names "localhost:8080") be accepted by the browser
      // on the Vite dev origin (localhost:5173).
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        cookieDomainRewrite: 'localhost',
      },
    },
  },
})
