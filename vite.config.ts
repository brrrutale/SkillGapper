import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  // Relative Pfade - base wird dynamisch im index.html gesetzt
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    // Proxy für API-Anfragen während der Entwicklung
    // Leitet /api/* Anfragen an MAMP weiter
    proxy: {
      '/api': {
        target: 'http://localhost:8888', // MAMP Server URL
        changeOrigin: true,
      },
    },
  },
})
