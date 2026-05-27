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
  // Stabile Output-Dateinamen ohne Content-Hash — beim FTP-Deployment
  // einfach immer dieselben 4 Files ueberschreiben. Cache-Busting muss
  // Akamai (max-age) bzw. ein Hard-Reload uebernehmen.
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/index.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: assetInfo => {
          const name = assetInfo.name || '';
          if (name.endsWith('.css')) return 'assets/index.css';
          return 'assets/[name][extname]';
        },
      },
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
