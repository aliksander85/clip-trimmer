import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // lib/ is pure TS, so tests need neither Nuxt runtime nor a DOM.
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
