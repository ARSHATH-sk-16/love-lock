// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    // Only use mkcert locally; remove in production
    command === "serve" ? mkcert() : undefined
  ],
  server: command === "serve" ? {
    port: 5173,
    https: true
  } : undefined, // undefined for build/production
  build: {
    outDir: "dist"
  }
}));
