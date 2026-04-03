import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'
import { copyFileSync } from 'fs'

/** Copy web/public/manifest.json to dist-web, overriding the extension manifest */
function webManifestPlugin(): Plugin {
  return {
    name: 'copy-web-manifest',
    closeBundle() {
      copyFileSync(
        resolve(__dirname, 'public/manifest.json'),
        resolve(__dirname, '../dist-web/manifest.json')
      )
    }
  }
}

export default defineConfig({
  plugins: [react(), webManifestPlugin()],
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
