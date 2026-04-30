import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Proxy /api to the Spring Boot backend so the frontend can use
      // same-origin requests in dev (no CORS, no env-specific base URLs).
      '/api': 'http://localhost:8080',
    },
  },
})
