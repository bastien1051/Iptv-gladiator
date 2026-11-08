import { readFileSync, writeFileSync } from 'node:fs'
import preact from '@preact/preset-vite'
import legacy from '@vitejs/plugin-legacy'
import { defineConfig } from 'vitest/config'

function tizenModuleBrowsers() {
  return {
    name: 'tizen-module-browsers',
    apply: 'build' as const,
    closeBundle() {
      const file = 'dist/index.html'
      const html = readFileSync(file, 'utf8')
      const next = html.replace(
        /<script type="module">import'data:text\/javascript[\s\S]*?__vite_is_modern_browser=true<\/script>/,
        '<script type="module">window.__vite_is_modern_browser=true</script>',
      )
      if (next === html) throw new Error('Détection legacy introuvable dans dist/index.html')
      writeFileSync(file, next)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [
    preact(),
    legacy({
      targets: ['chrome >= 56'],
      modernTargets: ['chrome >= 63'],
      modernPolyfills: true,
      renderModernChunks: true,
    }),
    tizenModuleBrowsers(),
  ],
  server: { host: '0.0.0.0', port: 4178, strictPort: true },
  preview: { host: '0.0.0.0', port: 4178, strictPort: true },
  build: { chunkSizeWarningLimit: 2500, target: 'chrome63' },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 90000,
  },
})
