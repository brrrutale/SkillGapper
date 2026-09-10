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
  // console.* und debugger aus dem Produktions-Bundle entfernen. Die App
  // hat an gut zwei Dutzend Stellen Personennamen, Skill-Sets und
  // Bewertungen in die Konsole geschrieben — das hat auf einem produktiven
  // System nichts verloren.
  esbuild: {
    drop: ['console', 'debugger'],
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
    // Fester Port statt Vites Default 5173: SkillGapper soll parallel zu
    // anderen lokalen Projekten laufen können, ohne dass Vite auf einen
    // freien Nachbarport ausweicht und die API-/CORS-Konfiguration ins
    // Leere zeigt. Der lokale Functions-Server liegt entsprechend auf 7072
    // (siehe azure-functions/local.settings.json).
    port: 8765,
    strictPort: true,
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
