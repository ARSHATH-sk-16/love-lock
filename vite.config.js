import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Only use mkcert + server config in local dev
export default defineConfig(({ command }) => {
  if (command === "serve") {
    return {
      plugins: [react()],
      server: {
        port: 5173,
        https: true
      }
    }
  } else {
    // production build for Vercel
    return {
      plugins: [react()],
      build: {
        outDir: "dist"
      }
    }
  }
})
