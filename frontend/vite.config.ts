import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
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
