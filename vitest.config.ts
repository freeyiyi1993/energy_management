import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.{ts,tsx}', 'shared/**/*.test.{ts,tsx}', 'extension/**/*.test.{ts,tsx}', 'web/**/*.test.{ts,tsx}'],
    testTimeout: 30000,
  }
})
