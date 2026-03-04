import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/health': 'http://localhost:3000',
      '/admin': 'http://localhost:3000',
      '/chat': 'http://localhost:3000'
    }
  }
})
