import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import mkcert from "vite-plugin-mkcert";

export default defineConfig(({ command }) => ({
  plugins: [
    react(),
    command === "serve" ? mkcert() : undefined // only use mkcert locally
  ],
  server: command === "serve" ? {
    port: 5173,
    https: true
  } : undefined,
  build: {
    outDir: "dist"
  }
}));
