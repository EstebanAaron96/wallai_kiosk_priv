import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Kiosco de producción: no exponer sourcemaps públicamente.
    sourcemap: false,
    // El kiosco carga un único GLB grande (escena 3D); no hace falta que
    // Vite avise por el tamaño de chunk.
    chunkSizeWarningLimit: 2000,
  },
  // .glb se sirve desde public/ tal cual, pero esto mantiene contento al
  // loader si en algún momento se importa directamente.
  assetsInclude: ['**/*.glb', '**/*.hdr'],
})
