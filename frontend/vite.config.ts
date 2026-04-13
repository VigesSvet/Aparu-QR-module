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
    // Allow all external hostnames so ngrok tunnels work without
    // "blocked request" errors from Vite's host-header check.
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
      '/uploads': {
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
