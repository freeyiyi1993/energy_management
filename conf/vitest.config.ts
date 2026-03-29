import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    root: path.resolve(__dirname, '../'),
    include: ['tests/**/*.test.{ts,tsx}', 'shared/**/*.test.{ts,tsx}', 'extension/**/*.test.{ts,tsx}', 'web/**/*.test.{ts,tsx}'],
  }
})