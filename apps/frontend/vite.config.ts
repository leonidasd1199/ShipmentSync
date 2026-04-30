import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: ['html2pdf.js'],
    esbuildOptions: {
      // Ensure CommonJS modules are handled
      target: 'es2020',
    },
  },
})
