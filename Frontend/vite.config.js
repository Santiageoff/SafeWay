import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // Separa las librerías más pesadas del código de la app: así el
        // navegador las cachea aparte y no hay que descargar todo de nuevo
        // por un cambio en un componente (issue #12: reducir la carga inicial).
        // Rolldown (el bundler de Vite 8) solo acepta la forma función.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('leaflet')) return 'leaflet'
            if (id.includes('@supabase')) return 'supabase'
          }
        },
      },
    },
  },
})
