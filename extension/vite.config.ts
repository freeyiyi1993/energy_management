import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  publicDir: resolve(__dirname, 'public'),
  css: {
    postcss: resolve(__dirname, '../postcss.config.js'),
  },
  build: {
    outDir: resolve(__dirname, '../dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'pages/popup/index.html'),
        finish: resolve(__dirname, 'pages/finish/finish.html'),
        background: resolve(__dirname, 'background/index.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background.js';
          }
          return 'assets/[name]-[hash].js';
        }
      }
    }
  }
})
