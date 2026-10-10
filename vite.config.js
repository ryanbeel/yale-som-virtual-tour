import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: './', // relative paths so it works on GitHub Pages and locally
  plugins: [react()],
  // the professor chat backend (FastAPI) runs on :8000 in dev
  server: { port: 5173, proxy: { '/api': 'http://localhost:8000' } },
})
