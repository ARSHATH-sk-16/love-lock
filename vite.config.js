import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import mkcert from 'vite-plugin-mkcert';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    mkcert() // enables local HTTPS automatically
  ],
  server: {
    port: 5173, // your dev server port
    https: true // use HTTPS
  }
});
