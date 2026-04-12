import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/map-proxy': {
        target: 'http://testtaxi3.aparu.kz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/map-proxy/, ''),
      },
    },
  },
})
