import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  envDir: resolve(__dirname, '..'),
  publicDir: resolve(__dirname, '../extension/public'),
  css: {
    postcss: resolve(__dirname, '../postcss.config.js'),
  },
  build: {
    outDir: resolve(__dirname, '../dist-web'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        web: resolve(__dirname, 'index.html'),
      },
    }
  },
  server: {
    port: 3000,
    open: true,
  }
})
