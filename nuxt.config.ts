// Narrow declaration instead of @types/node: the config only reads one env var.
declare const process: { env: Record<string, string | undefined> }

export default defineNuxtConfig({
  compatibilityDate: '2026-11-10',
  ssr: false,
  modules: ['@pinia/nuxt', '@nuxt/eslint'],
  app: {
    // GitHub Pages serves the site from /<repo>/, so the base must be configurable at build time.
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
  },
  vite: {
    optimizeDeps: {
      // Imported only from workers, so Vite finds them late and reloads the page mid-session in dev.
      include: ['mp4box', 'mediabunny'],
    },
  },
  typescript: {
    strict: true,
    tsConfig: {
      // lib/, workers/ and tests/ live outside app/, Nuxt does not include them by default.
      include: ['../lib/**/*', '../workers/**/*', '../tests/**/*'],
    },
  },
})
